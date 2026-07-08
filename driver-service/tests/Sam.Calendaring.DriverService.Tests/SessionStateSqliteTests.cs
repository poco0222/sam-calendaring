/**
 * @file SessionStateSqliteTests.cs - 验证 SQLite（嵌入式数据库）session state（会话状态）存储。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 以 TDD（测试驱动开发）方式锁定 Task4 所需的最小 SQLite 状态持久化行为。
 */
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 Driver state store（驱动状态存储）会持久化最小会话状态、最大 fencing token（隔离令牌）与脱敏审计日志。
/// </summary>
public sealed class SessionStateSqliteTests
{
    /// <summary>
    /// 验证状态存储会在跨实例重建后保留最大已见 fencing token（隔离令牌）。
    /// </summary>
    [Fact]
    public async Task StorePersistsMaxSeenFencingTokenAcrossInstances()
    {
        var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db");
        var first = new SqliteDriverStateStore($"Data Source={path}");
        await first.InitializeAsync(CancellationToken.None);
        Assert.True(await first.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-001",
            "press-001",
            "192.168.19.110:502",
            """{"signals":[{"name":"pressure","address":100}]}""",
            ["100-120"],
            12,
            DateTimeOffset.UtcNow.AddMinutes(10),
            "Active",
            "Connected"), CancellationToken.None));

        var second = new SqliteDriverStateStore($"Data Source={path}");
        await second.InitializeAsync(CancellationToken.None);

        Assert.Equal(12, await second.GetMaxSeenFencingTokenAsync(CancellationToken.None));
    }

    /// <summary>
    /// 验证已持久化的 CleanupPending（清理待完成）状态会被重新加载，供新租约申请阻塞判断复用。
    /// </summary>
    [Fact]
    public async Task CleanupPendingStateBlocksNewApply()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveSnapshotAsync(new DriverStateSnapshot(
            null,
            20,
            "Active",
            "CleanupPending"), CancellationToken.None);

        var snapshot = await store.LoadSnapshotAsync(CancellationToken.None);

        Assert.Equal("CleanupPending", snapshot.DeviceSessionState);
    }

    /// <summary>
    /// 验证审计日志只持久化脱敏后的命令字段，不写入签名敏感内容。
    /// </summary>
    [Fact]
    public async Task AuditLogStoresSanitizedCommandFields()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);

        await store.AppendAuditLogAsync(new AuditLogEntry(
            "cid-audit-001",
            "lease-001",
            "press-001",
            21,
            "applyLeaseAndConfig",
            35,
            "OK",
            "Active",
            "Disconnected",
            "授权已更新，刷新快照时连接设备"), CancellationToken.None);

        var logs = await store.ReadAuditLogsForTestsAsync(CancellationToken.None);

        Assert.Single(logs);
        Assert.DoesNotContain("signature", logs[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证当较新的租约已落盘后，较旧 fencing token（隔离令牌）的租约不会覆盖当前活跃状态。
    /// </summary>
    [Fact]
    public async Task OlderLeaseDoesNotReplaceNewerPersistedLease()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        Assert.True(await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-012",
            "press-001",
            "192.168.19.110:502",
            """{"signals":[{"name":"pressure","address":100}]}""",
            ["100-120"],
            12,
            DateTimeOffset.UtcNow.AddMinutes(10),
            "Active",
            "Connected"), CancellationToken.None));

        var saved = await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-010",
            "press-001",
            "192.168.19.110:502",
            """{"signals":[{"name":"pressure","address":100}]}""",
            ["100-120"],
            10,
            DateTimeOffset.UtcNow.AddMinutes(10),
            "Active",
            "Connected"), CancellationToken.None);
        var snapshot = await store.LoadSnapshotAsync(CancellationToken.None);

        Assert.False(saved);
        Assert.Equal(12, snapshot.MaxSeenFencingToken);
        Assert.Equal("lease-012", snapshot.ActiveLease?.LeaseId);
    }
}

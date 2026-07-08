/**
 * @file DiagnosticLogRetentionTests.cs - 验证 diagnostic log（诊断日志）保留策略。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 验证 diagnostic_log（诊断日志表）保留策略只清理诊断日志，不影响 audit_log（审计日志表）。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// @author PopoY
/// 验证 diagnostic log retention（诊断日志保留）只影响 diagnostic_log（诊断日志表）。
/// </summary>
public sealed class DiagnosticLogRetentionTests
{
    /// <summary>
    /// @author PopoY
    /// 验证 cutoffUtc（截止时间）之前的 diagnostic log（诊断日志）会被删除，audit log（审计日志）保持不变。
    /// </summary>
    [Fact]
    public async Task CleanupDeletesOldDiagnosticLogsOnly()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);

        await store.AppendDiagnosticLogAsync(CreateDiagnostic("old-cid", DateTimeOffset.UtcNow.AddDays(-8)), CancellationToken.None);
        await store.AppendDiagnosticLogAsync(CreateDiagnostic("fresh-cid", DateTimeOffset.UtcNow.AddDays(-1)), CancellationToken.None);
        await store.AppendAuditLogAsync(AuditLogEntry.CreateSanitized(
            "old-cid",
            "getSignalSnapshot",
            10,
            DriverResultCode.Ok,
            LeaseState.Active,
            DeviceSessionState.Connected,
            "旧审计日志必须保留"), CancellationToken.None);

        var deleted = await stateService.DeleteDiagnosticLogsBeforeAsync(DateTimeOffset.UtcNow.AddDays(-7), CancellationToken.None);

        var diagnostics = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "all", null, 100), CancellationToken.None);
        var auditLogs = await store.ReadAuditLogsForTestsAsync(CancellationToken.None);
        Assert.Equal(1, deleted);
        Assert.DoesNotContain(diagnostics, entry => entry.CorrelationId == "old-cid");
        Assert.Contains(diagnostics, entry => entry.CorrelationId == "fresh-cid");
        Assert.Contains(auditLogs, entry => entry.CorrelationId == "old-cid");
    }

    /// <summary>
    /// @author PopoY
    /// 验证 cleanup（清理）按 UTC 时间语义比较不同 offset（偏移）的 createdAt（创建时间）。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task CleanupUsesUtcCutoffForOffsetDiagnosticLogTimes()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var service = new DiagnosticLogRetentionService(
            stateService,
            new DriverOptions { DiagnosticLogRetentionDays = 7 },
            new FixedTimeProvider(new DateTimeOffset(2026, 7, 3, 0, 0, 0, TimeSpan.Zero)),
            NullLogger<DiagnosticLogRetentionService>.Instance);

        await store.AppendDiagnosticLogAsync(CreateDiagnostic("old-offset-cid", new DateTimeOffset(2026, 6, 26, 7, 59, 59, TimeSpan.FromHours(8))), CancellationToken.None);
        await store.AppendDiagnosticLogAsync(CreateDiagnostic("fresh-offset-cid", new DateTimeOffset(2026, 6, 26, 8, 0, 1, TimeSpan.FromHours(8))), CancellationToken.None);

        var deleted = await service.CleanupOnceAsync(CancellationToken.None);

        var diagnostics = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "all", null, 100), CancellationToken.None);
        Assert.Equal(1, deleted);
        Assert.DoesNotContain(diagnostics, entry => entry.CorrelationId == "old-offset-cid");
        Assert.Contains(diagnostics, entry => entry.CorrelationId == "fresh-offset-cid");
    }

    /// <summary>
    /// @author PopoY
    /// 验证 cleanup failure（清理失败）不会终止 retention hosted service（保留托管服务）。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task RetentionLoopKeepsRunningAfterCleanupFailure()
    {
        var service = new DiagnosticLogRetentionService(
            new DriverStateService(new RetentionLoopStore(throwOnDelete: true), NullLogger<DriverStateService>.Instance),
            new DriverOptions(),
            TimeProvider.System,
            NullLogger<DiagnosticLogRetentionService>.Instance);

        await service.StartAsync(CancellationToken.None);
        await Task.Delay(50);

        Assert.False(service.ExecuteTask?.IsFaulted ?? false);
        await service.StopAsync(CancellationToken.None);
    }

    /// <summary>
    /// @author PopoY
    /// 验证 invalid cleanup interval（非法清理周期）会被钳制，避免后台服务异常退出。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task RetentionLoopClampsInvalidCleanupInterval()
    {
        var store = new RetentionLoopStore(throwOnDelete: false);
        var service = new DiagnosticLogRetentionService(
            new DriverStateService(store, NullLogger<DriverStateService>.Instance),
            new DriverOptions { DiagnosticLogCleanupIntervalMs = -2 },
            TimeProvider.System,
            NullLogger<DiagnosticLogRetentionService>.Instance);

        await service.StartAsync(CancellationToken.None);
        await Task.Delay(50);

        Assert.False(service.ExecuteTask?.IsFaulted ?? false);
        Assert.Equal(1, store.DeleteCalls);
        await service.StopAsync(CancellationToken.None);
    }

    /// <summary>
    /// @author PopoY
    /// 创建测试用 diagnostic log（诊断日志），并覆盖 CreatedAt（创建时间）以验证保留边界。
    /// </summary>
    /// <param name="correlationId">关联 ID。</param>
    /// <param name="createdAt">创建时间。</param>
    /// <returns>返回测试日志条目。</returns>
    private static DiagnosticLogEntry CreateDiagnostic(string correlationId, DateTimeOffset createdAt)
    {
        var entry = DiagnosticLogEntry.Create(
            level: "Information",
            category: "Device",
            eventName: "SignalSnapshotPublisherRecovered",
            message: "信号快照后台读取已恢复。",
            eventStage: "Completed",
            correlationId: correlationId,
            commandName: "signalSnapshotPublisher",
            resultCode: DriverResultCode.Ok);

        return entry with { CreatedAt = createdAt };
    }

    /// <summary>
    /// @author PopoY
    /// 固定 UTC now（当前时间）的 TimeProvider（时间提供器）。
    /// </summary>
    /// <param name="utcNow">固定 UTC 时间。</param>
    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        /// <summary>
        /// @author PopoY
        /// 返回固定 UTC now（当前时间）。
        /// </summary>
        /// <returns>固定 UTC 时间。</returns>
        public override DateTimeOffset GetUtcNow()
        {
            return utcNow;
        }
    }

    /// <summary>
    /// @author PopoY
    /// 提供 retention loop（保留循环）测试用状态存储。
    /// </summary>
    /// <param name="throwOnDelete">删除时是否抛出异常。</param>
    private sealed class RetentionLoopStore(bool throwOnDelete) : IDriverStateStore
    {
        /// <summary>
        /// @author PopoY
        /// 记录 delete（删除）调用次数。
        /// </summary>
        public int DeleteCalls { get; private set; }

        /// <summary>
        /// @author PopoY
        /// 初始化测试状态存储。
        /// </summary>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回完成任务。</returns>
        public Task InitializeAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        /// @author PopoY
        /// 加载默认 driver state snapshot（驱动状态快照）。
        /// </summary>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回默认快照。</returns>
        public Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new DriverStateSnapshot(null, 0, LeaseState.None, DeviceSessionState.Disconnected));
        }

        /// <summary>
        /// @author PopoY
        /// 返回测试用最大 fencing token（栅栏令牌）。
        /// </summary>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回 0。</returns>
        public Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(0L);
        }

        /// <summary>
        /// @author PopoY
        /// 保存测试用 active lease（活跃租约）摘要。
        /// </summary>
        /// <param name="summary">租约摘要。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回保存成功。</returns>
        public Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }

        /// <summary>
        /// @author PopoY
        /// 保存测试用 driver state snapshot（驱动状态快照）。
        /// </summary>
        /// <param name="snapshot">驱动状态快照。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回完成任务。</returns>
        public Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        /// @author PopoY
        /// 写入测试用 audit log（审计日志）。
        /// </summary>
        /// <param name="entry">审计日志条目。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回完成任务。</returns>
        public Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        /// @author PopoY
        /// 写入测试用 diagnostic log（诊断日志）。
        /// </summary>
        /// <param name="entry">诊断日志条目。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回完成任务。</returns>
        public Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        /// @author PopoY
        /// 删除测试用 diagnostic log（诊断日志）并按配置模拟失败。
        /// </summary>
        /// <param name="cutoffUtc">UTC 截止时间。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回删除行数。</returns>
        public Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
        {
            DeleteCalls++;
            if (throwOnDelete)
            {
                throw new InvalidOperationException("模拟 diagnostic log retention（诊断日志保留）清理失败。");
            }

            return Task.FromResult(0);
        }

        /// <summary>
        /// @author PopoY
        /// 查询测试用 diagnostic log（诊断日志）。
        /// </summary>
        /// <param name="query">诊断日志查询条件。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回空日志集合。</returns>
        public Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(
            DiagnosticLogQuery query,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<DiagnosticLogEntry>>(Array.Empty<DiagnosticLogEntry>());
        }
    }
}

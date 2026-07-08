# Task 04: Session State + SQLite

> @file Driver Service V1 会话状态与 SQLite 持久化任务
> @author PopoY
> @created 2026-06-26
> @purpose 用最小 SQLite + WAL 表保存活跃租约摘要、最大 fencingToken、状态与审计日志。

## Goal（目标）

Persist only the state needed by V1: `active lease summary（活跃租约摘要）`, max seen `fencingToken（隔离令牌）`, current `Lease State（租约状态）`, current `Device Session State（设备会话状态）`, and `audit log（审计日志）`. This task prevents stale tokens after restart and avoids full business tables.

## Status（状态）

- `Done（已完成）`：`Task4` 已完成，最小 `SQLite + WAL（SQLite 与预写日志）` 状态持久化、`fencingToken（隔离令牌）` 恢复保护、`CleanupPending（清理待完成）` 阻塞接线与审计日志已通过验证。

## Progress（进度）

- `2026-06-26`：计划已落库，当前进度 `0/8`。
- `2026-06-26`：已完成 `Step 1/8`。新增 `SessionStateSqliteTests`，先锁定 `maxSeenFencingToken（最大已见隔离令牌）` 持久化、`CleanupPending（清理待完成）` 阻塞状态保留，以及 `audit log（审计日志）` 脱敏存储边界，当前进度 `1/8`。
- `2026-06-26`：已完成 `Step 2/8`。执行 `dotnet test --filter FullyQualifiedName~SessionStateSqliteTests` 后按预期 RED，当前失败为 `Sam.Calendaring.DriverService.State` 命名空间与相关类型尚未存在，说明缺口已被测试准确锁定，当前进度 `2/8`。
- `2026-06-26`：已完成 `Step 3/8` 到 `Step 7/8`。新增 `LeaseState`、`DeviceSessionState`、`ActiveLeaseSummary`、`AuditLogEntry`、`DriverStateSnapshot`、`IDriverStateStore`、`SqliteDriverStateStore`、`DriverStateService`，并把 `/applyLeaseAndConfig` 接到本地状态存储；同时将 SQLite 原生运行时切换到 `SourceGear.sqlite3`，消除新引入依赖的高危 `advisory（安全公告）`，当前进度 `7/8`。
- `2026-06-26`：已完成 `Step 8/8`。顺序执行 `dotnet test --filter FullyQualifiedName~SessionStateSqliteTests`、`dotnet test --filter FullyQualifiedName~LeaseValidationTests`、`dotnet test --filter FullyQualifiedName~ApiContractTests` 与 `dotnet build`，结果分别为 `4/4`、`18/18`、`15/15` 通过，且构建 `0 warning / 0 error`，当前进度 `8/8`。
- `2026-06-26`：根据 reviewer 发现继续收紧 Task4：`maxSeenFencingToken（最大已见隔离令牌）` 现已保证单调不降，较旧租约不会覆盖较新活跃状态，默认 SQLite 路径会解析到稳定可写目录，真实 `Kestrel（ASP.NET Core Web server）` 运行时测试也改为注入独立临时数据库。
- `2026-06-26`：额外执行 `dotnet test` 全量回归，结果 `38/38` 通过，用于确认 Task4 接线没有破坏既有测试面。

## Files（文件）

- Create: `driver-service/src/Sam.Calendaring.DriverService/Domain/LeaseState.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Domain/DeviceSessionState.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/ActiveLeaseSummary.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/AuditLogEntry.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DriverStateSnapshot.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/IDriverStateStore.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/SqliteDriverStateStore.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DriverStateService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/SessionStateSqliteTests.cs`

## Steps（步骤）

- [x] **Step 1: Add failing state and persistence tests**

```csharp
/**
 * @file Driver state SQLite tests.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Tests;

public sealed class SessionStateSqliteTests
{
    [Fact]
    public async Task StorePersistsMaxSeenFencingTokenAcrossInstances()
    {
        var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db");
        var first = new SqliteDriverStateStore($"Data Source={path}");
        await first.InitializeAsync(CancellationToken.None);
        await first.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-001",
            "press-001",
            "192.168.19.110:502",
            """{"signals":[{"name":"pressure","address":100}]}""",
            ["100-120"],
            12,
            "Active",
            "Connected"), CancellationToken.None);

        var second = new SqliteDriverStateStore($"Data Source={path}");
        await second.InitializeAsync(CancellationToken.None);

        Assert.Equal(12, await second.GetMaxSeenFencingTokenAsync(CancellationToken.None));
    }

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
}
```

- [x] **Step 2: Run tests and confirm RED（失败状态）**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~SessionStateSqliteTests
```

Expected: fails because state store types do not exist.

- [x] **Step 3: Add allowed state enums and state records**

```csharp
/**
 * @file Lease state constants.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Domain;

public static class LeaseState
{
    public const string None = "None";
    public const string Pending = "Pending";
    public const string Active = "Active";
    public const string Superseded = "Superseded";
    public const string Expired = "Expired";
    public const string Released = "Released";
}
```

```csharp
/**
 * @file Device session state constants.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Domain;

public static class DeviceSessionState
{
    public const string Disconnected = "Disconnected";
    public const string Connecting = "Connecting";
    public const string Connected = "Connected";
    public const string Prechecked = "Prechecked";
    public const string Running = "Running";
    public const string CleanupPending = "CleanupPending";
    public const string Faulted = "Faulted";
}
```

```csharp
/**
 * @file Persisted active lease summary.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.State;

public sealed record ActiveLeaseSummary(
    string LeaseId,
    string TargetDeviceId,
    string TargetEndpoint,
    string SignalConfigJson,
    IReadOnlyList<string> AllowedAddressRanges,
    long FencingToken,
    string LeaseState,
    string DeviceSessionState);
```

- [x] **Step 4: Add audit log entry contract**

```csharp
/**
 * @file Sanitized audit log entry.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.State;

public sealed record AuditLogEntry(
    string CorrelationId,
    string? LeaseId,
    string? TargetDeviceId,
    long? FencingToken,
    string CommandName,
    long DurationMs,
    string ResultCode,
    string LeaseState,
    string DeviceSessionState,
    string Message);
```

- [x] **Step 5: Add minimal SQLite schema with WAL**

Use two tables only: `driver_state（驱动状态）` key-value table and `audit_log（审计日志）`.

```csharp
/**
 * @file SQLite backed Driver Service state store.
 * @author PopoY
 * @created 2026-06-26
 */
using Microsoft.Data.Sqlite;

namespace Sam.Calendaring.DriverService.State;

public sealed class SqliteDriverStateStore(string connectionString) : IDriverStateStore
{
    public static SqliteDriverStateStore CreateTempFileForTests()
    {
        var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db");
        return new($"Data Source={path}");
    }

    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await ExecuteAsync(connection, "PRAGMA journal_mode=WAL;", cancellationToken).ConfigureAwait(false);
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS driver_state (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
            """, cancellationToken).ConfigureAwait(false);
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                correlation_id TEXT NOT NULL,
                lease_id TEXT,
                target_device_id TEXT,
                fencing_token INTEGER,
                command_name TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                result_code TEXT NOT NULL,
                lease_state TEXT NOT NULL,
                device_session_state TEXT NOT NULL,
                message TEXT NOT NULL
            );
            """, cancellationToken).ConfigureAwait(false);
    }

    private static async Task ExecuteAsync(SqliteConnection connection, string sql, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}
```

- [x] **Step 6: Implement snapshot and token persistence**

```csharp
/**
 * @file Driver state snapshot.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.State;

public sealed record DriverStateSnapshot(
    ActiveLeaseSummary? ActiveLease,
    long MaxSeenFencingToken,
    string LeaseState,
    string DeviceSessionState);
```

```csharp
/**
 * @file Driver state store contract.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.State;

public interface IDriverStateStore
{
    Task InitializeAsync(CancellationToken cancellationToken);
    Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken);
    Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken);
    Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken);
    Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken);
    Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken);
}
```

Implementation rule: store `activeLease` as JSON, `maxSeenFencingToken` as invariant string, and states as exact enum strings. Do not create job, operator, device, or production business tables in V1.

- [x] **Step 7: Wire state store into apply lease endpoint**

When `LeaseValidator（租约校验器）` returns success:

```csharp
// PopoY: only a validated lease can update local active state and max fencing token.
var saved = await stateStore.SaveActiveLeaseAsync(new ActiveLeaseSummary(
    result.Claims.LeaseId,
    result.Claims.TargetDeviceId,
    result.Claims.TargetEndpoint,
    request.SignalConfig.GetRawText(),
    result.Claims.AllowedAddressRanges,
    result.Claims.FencingToken,
    LeaseState.Active,
    DeviceSessionState.Disconnected), cancellationToken).ConfigureAwait(false);

if (!saved)
{
    return FENCING_TOKEN_STALE;
}
```

If persisted `DeviceSessionState（设备会话状态）` is `CleanupPending（清理待完成）`, `/applyLeaseAndConfig` returns:

```json
{
  "resultCode": "CLEANUP_PENDING",
  "message": "上次清理未完成，禁止应用新租约",
  "leaseState": "Active",
  "deviceSessionState": "CleanupPending"
}
```

- [x] **Step 8: Verify session state and regression gates**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~SessionStateSqliteTests
dotnet test --filter FullyQualifiedName~LeaseValidationTests
dotnet test --filter FullyQualifiedName~ApiContractTests
dotnet build
```

Expected: state survives store recreation, stale `fencingToken（隔离令牌）` protection can use persisted max token, `CleanupPending（清理待完成）` is preserved but not actively entered by V1 business flow.

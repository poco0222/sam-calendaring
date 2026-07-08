# Task 02: Driver Diagnostic Log Storage

> @file Driver Service V1 诊断日志存储任务
> @author PopoY
> @created 2026-06-27
> @purpose 新增 diagnostic_log（诊断日志表）、白名单模型、写入、查询和安全失败边界。

## Goal（目标）

Add `DiagnosticLogEntry（诊断日志条目）` and `diagnostic_log（诊断日志表）` beside the existing `audit_log（审计日志表）`, while keeping their purposes separate.

## Status（状态）

- `Completed（已完成）`: 本轮仅处理 Task2，代码实现、验证和文档回写已完成；commit（提交）因当前 workspace（工作区）不是 Git repository（版本库）按计划跳过。

## Progress（进度）

- `2026-06-27`: 计划已落库，当前进度 `0/7`。
- `2026-06-27`: Step 1 开始，新增 RED（失败）存储测试。
- `2026-06-27`: Step 1 完成，已新增 `DiagnosticLogStorageTests（诊断日志存储测试）`；Step 2 开始运行 RED（失败）验证。
- `2026-06-27`: Step 2 完成，`dotnet test --filter "FullyQualifiedName~DiagnosticLogStorageTests"` 按预期失败，缺少 `DiagnosticLogEntry（诊断日志条目）` 与 `DiagnosticLogQuery（诊断日志查询）`。
- `2026-06-27`: Step 3 完成，新增 `DiagnosticLogEntry（诊断日志条目）` 与 `DiagnosticLogQuery（诊断日志查询）`。
- `2026-06-27`: Step 4 完成，扩展 `IDriverStateStore（驱动状态存储契约）` 与 `DriverStateService（驱动状态服务）`，诊断写入失败只记录 `ILogger（日志抽象）`。
- `2026-06-27`: Step 5 开始，新增 SQLite（嵌入式数据库）表、插入和查询。
- `2026-06-27`: Step 5 完成，`diagnostic_log（诊断日志表）` 使用白名单字段并支持过滤查询；Step 6 开始运行聚焦验证。
- `2026-06-27`: Step 6 完成，`dotnet test --filter "FullyQualifiedName~DiagnosticLogStorageTests|FullyQualifiedName~SessionStateSqliteTests"` 通过，`11/11` passed（通过）。
- `2026-06-27`: Step 7 开始，确认当前 workspace（工作区）是否支持 Git commit（版本提交）。
- `2026-06-27`: Step 7 完成，`git status --short --branch` 返回 `not a git repository（不是版本库）`，按计划跳过 commit（提交）。
- `2026-06-27`: Review fix（审查修复）完成，诊断写入失败的 `ILogger（日志抽象）` 仅记录 `exceptionType（异常类型）` 摘要，不传完整 exception（异常对象）。
- `2026-06-27`: Sensitive message guard（敏感正文防线）完成，`DiagnosticLogEntry（诊断日志条目）` 在模型入口拦截禁止字段名。
- `2026-06-27`: Final verification（最终验证）完成：focused verification（聚焦验证）`13/13` passed（通过），`dotnet test` `84/84` passed（通过），`dotnet build` 通过。

## Files（文件）

- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogEntry.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogQuery.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/IDriverStateStore.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/DriverStateService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/SqliteDriverStateStore.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogStorageTests.cs`

## Steps（步骤）

- [x] **Step 1: Write failing storage tests（编写失败存储测试）** - `Done（完成）`

Create `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogStorageTests.cs`:

```csharp
/**
 * @file DiagnosticLogStorageTests.cs
 * @author PopoY
 * @created 2026-06-27
 * @purpose 以 TDD（测试驱动开发）锁定 diagnostic_log（诊断日志表）的白名单字段、查询过滤和安全失败行为。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 Driver diagnostic log（驱动诊断日志）独立于 audit log（审计日志）的最小持久化能力。
/// </summary>
public sealed class DiagnosticLogStorageTests
{
    /// <summary>
    /// 验证 Warning（警告）和非 OK resultCode（结果码）会归类为 Abnormal（异常）。
    /// </summary>
    [Fact]
    public void DiagnosticLogEntryDerivesStatusClassFromLevelAndResultCode()
    {
        var warningEntry = DiagnosticLogEntry.Create(
            level: "Warning",
            category: "Device",
            eventName: "SignalReadFailed",
            message: "设备通信超时",
            resultCode: DriverResultCode.DeviceTimeout);
        var informationFailure = DiagnosticLogEntry.Create(
            level: "Information",
            category: "Response",
            eventName: "RequestCompleted",
            message: "请求已完成但设备拒绝",
            resultCode: DriverResultCode.DeviceRejected);
        var normalEntry = DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "收到驱动请求",
            resultCode: DriverResultCode.Ok);

        Assert.Equal("Abnormal", warningEntry.StatusClass);
        Assert.Equal("Abnormal", informationFailure.StatusClass);
        Assert.Equal("Normal", normalEntry.StatusClass);
    }

    /// <summary>
    /// 验证 diagnostic_log（诊断日志表）保存并查询白名单字段。
    /// </summary>
    [Fact]
    public async Task DiagnosticLogStoresAndQueriesWhitelistedFields()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        var service = new DriverStateService(store, NullLogger<DriverStateService>.Instance);

        await service.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Error",
            category: "Device",
            eventName: "SignalReadFailed",
            message: "设备通信超时",
            eventStage: "Failed",
            correlationId: "cid-diagnostic-001",
            commandName: "getSignalSnapshot",
            resultCode: DriverResultCode.DeviceTimeout,
            httpStatusCode: 504,
            durationMs: 5000,
            leaseState: "Active",
            deviceSessionState: "Connected",
            leaseId: "lease-001",
            targetDeviceId: "press-001",
            fencingToken: 11,
            exceptionType: nameof(TimeoutException)), CancellationToken.None);

        var logs = await service.QueryDiagnosticLogsAsync(new DiagnosticLogQuery(
            StatusClass: "abnormal",
            Category: "device",
            CorrelationId: "cid-diagnostic-001",
            Limit: 100), CancellationToken.None);

        var entry = Assert.Single(logs);
        Assert.Equal("Device", entry.Category);
        Assert.Equal("Abnormal", entry.StatusClass);
        Assert.Equal("SignalReadFailed", entry.EventName);
        Assert.Equal("TimeoutException", entry.ExceptionType);
        Assert.DoesNotContain("signedLease", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signalConfig", entry.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证 query limit（查询数量限制）默认 100，最大 500。
    /// </summary>
    [Theory]
    [InlineData(null, 100)]
    [InlineData(0, 100)]
    [InlineData(20, 20)]
    [InlineData(900, 500)]
    public void DiagnosticLogQueryNormalizesLimit(int? requestedLimit, int expectedLimit)
    {
        var query = new DiagnosticLogQuery("all", "all", null, requestedLimit);

        Assert.Equal(expectedLimit, query.NormalizedLimit);
    }

    /// <summary>
    /// 验证 diagnostic log（诊断日志）写入失败不会向调用方抛出异常。
    /// </summary>
    [Fact]
    public async Task DiagnosticWriteFailureIsSuppressedAndLogged()
    {
        var service = new DriverStateService(
            new FailingDiagnosticStore(),
            NullLogger<DriverStateService>.Instance);

        await service.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "收到驱动请求"), CancellationToken.None);
    }

    /// <summary>
    /// 提供只在 diagnostic log（诊断日志）写入时报错的测试状态存储。
    /// </summary>
    private sealed class FailingDiagnosticStore : IDriverStateStore
    {
        public Task InitializeAsync(CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken) => Task.FromResult(new DriverStateSnapshot(null, 0, "None", "Disconnected"));
        public Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken) => Task.FromResult(0L);
        public Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken) => throw new InvalidOperationException("模拟诊断日志写入失败。");
        public Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(DiagnosticLogQuery query, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<DiagnosticLogEntry>>(Array.Empty<DiagnosticLogEntry>());
    }
}
```

- [x] **Step 2: Run test to confirm RED（确认失败状态）** - `Done（完成）`

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogStorageTests"
```

Expected（期望）: FAIL because `DiagnosticLogEntry（诊断日志条目）`, `DiagnosticLogQuery（诊断日志查询）`, and store methods do not exist yet.

- [x] **Step 3: Add diagnostic log models（新增诊断日志模型）** - `Done（完成）`

Create `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogEntry.cs`:

```csharp
/**
 * @file DiagnosticLogEntry.cs
 * @author PopoY
 * @created 2026-06-27
 * @purpose 定义 diagnostic_log（诊断日志表）的白名单字段模型。
 */
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 表示可写入 diagnostic_log（诊断日志表）的单条白名单事件。
/// </summary>
public sealed record DiagnosticLogEntry(
    DateTimeOffset CreatedAt,
    string Level,
    string Category,
    string StatusClass,
    string EventName,
    string? EventStage,
    string? CorrelationId,
    string? CommandName,
    string? ResultCode,
    int? HttpStatusCode,
    long? DurationMs,
    string? LeaseState,
    string? DeviceSessionState,
    string? LeaseId,
    string? TargetDeviceId,
    long? FencingToken,
    string? ExceptionType,
    string Message)
{
    /// <summary>
    /// 创建诊断日志并按 level（级别）与 resultCode（结果码）推导 statusClass（状态分类）。
    /// </summary>
    public static DiagnosticLogEntry Create(
        string level,
        string category,
        string eventName,
        string message,
        string? eventStage = null,
        string? correlationId = null,
        string? commandName = null,
        string? resultCode = null,
        int? httpStatusCode = null,
        long? durationMs = null,
        string? leaseState = null,
        string? deviceSessionState = null,
        string? leaseId = null,
        string? targetDeviceId = null,
        long? fencingToken = null,
        string? exceptionType = null)
    {
        return new DiagnosticLogEntry(
            DateTimeOffset.UtcNow,
            level,
            category,
            DetermineStatusClass(level, resultCode),
            eventName,
            eventStage,
            correlationId,
            commandName,
            resultCode,
            httpStatusCode,
            durationMs,
            leaseState,
            deviceSessionState,
            leaseId,
            targetDeviceId,
            fencingToken,
            exceptionType,
            message);
    }

    /// <summary>
    /// 根据日志级别和结果码计算 Normal（正常）或 Abnormal（异常）。
    /// </summary>
    private static string DetermineStatusClass(string level, string? resultCode)
    {
        if (string.Equals(level, "Warning", StringComparison.Ordinal)
            || string.Equals(level, "Error", StringComparison.Ordinal)
            || (!string.IsNullOrWhiteSpace(resultCode)
                && !string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)))
        {
            return "Abnormal";
        }

        return "Normal";
    }
}
```

Create `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogQuery.cs`:

```csharp
/**
 * @file DiagnosticLogQuery.cs
 * @author PopoY
 * @created 2026-06-27
 * @purpose 定义 GET /diagnosticLogs（诊断日志接口）的最小查询条件。
 */
namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 表示 diagnostic log（诊断日志）查询条件。
/// </summary>
public sealed record DiagnosticLogQuery(
    string? StatusClass,
    string? Category,
    string? CorrelationId,
    int? Limit)
{
    /// <summary>
    /// 获取规范化后的 statusClass（状态分类）。
    /// </summary>
    public string NormalizedStatusClass => NormalizeAllValue(StatusClass);

    /// <summary>
    /// 获取规范化后的 category（分类）。
    /// </summary>
    public string NormalizedCategory => NormalizeAllValue(Category);

    /// <summary>
    /// 获取默认 100、最大 500 的 limit（数量限制）。
    /// </summary>
    public int NormalizedLimit => Limit is > 0
        ? Math.Min(Limit.Value, 500)
        : 100;

    /// <summary>
    /// 把空值统一成 all（全部）。
    /// </summary>
    private static string NormalizeAllValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? "all"
            : value.Trim().ToLowerInvariant();
    }
}
```

- [x] **Step 4: Extend store contract and service（扩展存储契约与服务）** - `Done（完成）`

Modify `IDriverStateStore.cs` by adding:

```csharp
/// <summary>
/// 追加一条诊断日志。
/// </summary>
/// <param name="entry">待追加的诊断日志。</param>
/// <param name="cancellationToken">取消令牌。</param>
Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken);

/// <summary>
/// 查询诊断日志。
/// </summary>
/// <param name="query">查询条件。</param>
/// <param name="cancellationToken">取消令牌。</param>
/// <returns>返回匹配条件的诊断日志。</returns>
Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(DiagnosticLogQuery query, CancellationToken cancellationToken);
```

Modify `DriverStateService.cs` constructor and methods:

```csharp
private readonly IDriverStateStore _stateStore;
private readonly ILogger<DriverStateService> _logger;

/// <summary>
/// 初始化状态编排服务。
/// </summary>
/// <param name="stateStore">底层状态存储实现。</param>
/// <param name="logger">诊断日志写入失败时使用的日志抽象。</param>
public DriverStateService(IDriverStateStore stateStore, ILogger<DriverStateService> logger)
{
    _stateStore = stateStore;
    _logger = logger;
}

/// <summary>
/// 尝试追加 diagnostic log（诊断日志）；失败时只写 ILogger（日志抽象），不影响业务响应。
/// </summary>
/// <param name="entry">待写入的诊断日志。</param>
/// <param name="cancellationToken">取消令牌。</param>
public async Task TryAppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken)
{
    try
    {
        await _stateStore.AppendDiagnosticLogAsync(entry, cancellationToken).ConfigureAwait(false);
    }
    catch (Exception exception)
    {
        _logger.LogWarning(
            exception,
            "诊断日志写入失败，业务响应不受影响。事件：{EventName}",
            entry.EventName);
    }
}

/// <summary>
/// 查询 diagnostic log（诊断日志）。
/// </summary>
/// <param name="query">查询条件。</param>
/// <param name="cancellationToken">取消令牌。</param>
/// <returns>返回诊断日志列表。</returns>
public Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(
    DiagnosticLogQuery query,
    CancellationToken cancellationToken)
{
    return _stateStore.QueryDiagnosticLogsAsync(query, cancellationToken);
}
```

Also update direct test construction sites（直接测试构造点） to pass `NullLogger<DriverStateService>.Instance`, especially helpers that instantiate `DriverStateService（驱动状态服务）` outside dependency injection（依赖注入）.

- [x] **Step 5: Add SQLite table and query（新增 SQLite 表和查询）** - `Done（完成）`

Modify `SqliteDriverStateStore.EnsureSchemaAsync` to create `diagnostic_log（诊断日志表）` with the exact whitelist fields from the spec.

Implementation rules（实现规则）:

1. Insert every field by named SQL parameter（命名参数）.
2. Query `ORDER BY id DESC LIMIT @limit`.
3. Apply `statusClass` filter only when it is not `all`.
4. Apply `category` filter only when it is not `all`.
5. Apply `correlationId` filter only when it is not blank.
6. Do not add JSON blob（JSON 数据块） or raw request / response columns.

- [x] **Step 6: Run focused verification（运行聚焦验证）** - `Done（完成）`

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogStorageTests|FullyQualifiedName~SessionStateSqliteTests"
```

Expected（期望）: PASS.

- [x] **Step 7: Commit（提交）** - `Skipped（已跳过）`: 当前 workspace（工作区）不是 Git repository（版本库）。

```bash
git add driver-service/src/Sam.Calendaring.DriverService/State driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogStorageTests.cs
git commit -m "feat: 新增 Driver Service diagnostic log 存储"
```

If this workspace remains not a Git repository（Git 仓库）, skip commit and record that in the execution note.

## Verification（验证）

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogStorageTests|FullyQualifiedName~SessionStateSqliteTests"
```

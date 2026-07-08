# Task 03: Diagnostic Log Retention Service

> @file 诊断日志保留服务任务
> @author PopoY
> @created 2026-07-03
> @purpose 新增 diagnostic_log（诊断日志表）7 天保留和 24 小时自动清理，确保 audit_log（审计日志表）不被清理。

## Goal（目标）

Delete diagnostic logs older than 7 days on startup（启动） and every 24 hours while the Driver Service（驱动服务） is running. Keep the implementation boring: one store method, one service method, one hosted service, and focused tests.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/7`。
- `2026-07-03`: Step 1 已新增 RED（失败）测试 `DiagnosticLogRetentionTests`，当前进度 `1/7`。
- `2026-07-03`: Step 2 已运行 focused test（聚焦测试）并确认 RED（失败），缺少 `DeleteDiagnosticLogsBeforeAsync`，当前进度 `2/7`。
- `2026-07-03`: Step 3 已新增 diagnostic log retention（诊断日志保留）配置默认值，当前进度 `3/7`。
- `2026-07-03`: Step 4 已新增 store/service（存储/服务）删除方法、SQLite（嵌入式数据库）实现，并补齐测试替身，当前进度 `4/7`。
- `2026-07-03`: Step 5 已新增 `DiagnosticLogRetentionService` hosted service（托管服务）实现，当前进度 `5/7`。
- `2026-07-03`: Step 6 已注册 hosted service（托管服务）并通过 focused tests（聚焦测试）`dotnet test --filter "FullyQualifiedName~DiagnosticLogRetentionTests|FullyQualifiedName~DiagnosticLogStorageTests"`，结果 24/24 passed（通过），当前进度 `6/7`。
- `2026-07-03`: Step 7 已运行 `git status --short --branch`，结果当前 workspace（工作区）不是 Git repository（Git 仓库），commit skipped（提交跳过），Task3 完成，当前进度 `7/7`。
- `2026-07-03`: Post-step regression（步骤后回归）中发现旧 API test（接口测试）固定日期与 7 天 retention cutoff（保留截止时间）冲突，已改为最近三天测试数据；随后 `dotnet test` 169/169 passed（通过），`dotnet build` 0 warnings（警告）/0 errors（错误）。
- `2026-07-03`: Code review remediation（代码评审修复）已补 `created_at` 非 UTC offset（UTC 偏移）RED test（失败测试），确认旧实现删除 0 条；随后将 diagnostic log（诊断日志）落库时间统一转 UTC，focused test（聚焦测试）通过。
- `2026-07-03`: Code review remediation（代码评审修复）已补 cleanup failure（清理失败）和 invalid cleanup interval（非法清理周期）RED tests（失败测试），确认旧实现会让 retention hosted service（保留托管服务）异常退出；随后捕获单次清理异常、钳制 cleanup interval（清理周期），focused tests（聚焦测试）2/2 passed（通过）。
- `2026-07-03`: Final verification（最终验证）已运行 `dotnet test --filter "FullyQualifiedName~DiagnosticLogRetentionTests"`，结果 4/4 passed（通过）；已运行 driver-service full tests（全量测试），结果 172/172 passed（通过）；已运行 driver-service build（构建），结果 0 warnings（警告）/0 errors（错误）。

## Files（文件）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/IDriverStateStore.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/DriverStateService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/SqliteDriverStateStore.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogRetentionService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogRetentionTests.cs`
- Update test fake stores that implement `IDriverStateStore`.

## Steps（步骤）

- [x] **Step 1: Write failing retention tests（编写失败保留策略测试）**

Create `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogRetentionTests.cs`:

```csharp
/**
 * @file DiagnosticLogRetentionTests.cs
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

public sealed class DiagnosticLogRetentionTests
{
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
}
```

Add helper in the same test:

```csharp
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
```

- [x] **Step 2: Run tests to confirm RED（确认失败状态）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogRetentionTests"
```

Expected（期望）: FAIL because `DeleteDiagnosticLogsBeforeAsync` and `DiagnosticLogRetentionService` do not exist.

- [x] **Step 3: Add retention options（新增保留配置）**

Update `driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs`:

```csharp
/// <summary>
/// @author PopoY
/// diagnostic log（诊断日志）默认保留天数。
/// </summary>
public int DiagnosticLogRetentionDays { get; init; } = 7;

/// <summary>
/// @author PopoY
/// diagnostic log cleanup（诊断日志清理）周期，单位毫秒。
/// </summary>
public int DiagnosticLogCleanupIntervalMs { get; init; } = 86_400_000;
```

- [x] **Step 4: Add store and service method（新增存储与服务方法）**

Update `IDriverStateStore.cs`:

```csharp
/// <summary>
/// 删除 cutoffUtc（截止时间）之前的 diagnostic log（诊断日志）。
/// </summary>
/// <param name="cutoffUtc">UTC 截止时间。</param>
/// <param name="cancellationToken">取消令牌。</param>
/// <returns>返回删除行数。</returns>
Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken);
```

Update `DriverStateService.cs`:

```csharp
/// <summary>
/// 删除截止时间之前的 diagnostic log（诊断日志）。
/// </summary>
/// <param name="cutoffUtc">UTC 截止时间。</param>
/// <param name="cancellationToken">取消令牌。</param>
/// <returns>返回删除行数。</returns>
public Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
{
    return _stateStore.DeleteDiagnosticLogsBeforeAsync(cutoffUtc, cancellationToken);
}
```

Update `SqliteDriverStateStore.cs`:

```csharp
public async Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
{
    await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
    await using var command = connection.CreateCommand();
    command.CommandText = "DELETE FROM diagnostic_log WHERE created_at < $cutoffUtc";
    command.Parameters.AddWithValue("$cutoffUtc", cutoffUtc.ToUniversalTime().ToString("O"));
    return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
}
```

Update all fake `IDriverStateStore` implementations in tests with:

```csharp
public Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
{
    return Task.FromResult(0);
}
```

- [x] **Step 5: Add hosted retention service（新增托管清理服务）**

Create `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogRetentionService.cs`:

```csharp
/**
 * @file DiagnosticLogRetentionService.cs - 清理过期 diagnostic log（诊断日志）。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 在启动和运行期间按 7 天保留规则清理 diagnostic_log（诊断日志表），不清理 audit_log（审计日志表）。
 */
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sam.Calendaring.DriverService.Options;

namespace Sam.Calendaring.DriverService.State;

public sealed class DiagnosticLogRetentionService : BackgroundService
{
    private readonly DriverStateService _stateService;
    private readonly DriverOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<DiagnosticLogRetentionService> _logger;

    public DiagnosticLogRetentionService(
        DriverStateService stateService,
        DriverOptions options,
        TimeProvider timeProvider,
        ILogger<DiagnosticLogRetentionService> logger)
    {
        _stateService = stateService;
        _options = options;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await CleanupOnceAsync(stoppingToken).ConfigureAwait(false);
            await Task.Delay(TimeSpan.FromMilliseconds(_options.DiagnosticLogCleanupIntervalMs), _timeProvider, stoppingToken).ConfigureAwait(false);
        }
    }

    public async Task<int> CleanupOnceAsync(CancellationToken cancellationToken)
    {
        var cutoffUtc = _timeProvider.GetUtcNow().AddDays(-Math.Max(1, _options.DiagnosticLogRetentionDays));
        var deleted = await _stateService.DeleteDiagnosticLogsBeforeAsync(cutoffUtc, cancellationToken).ConfigureAwait(false);
        _logger.LogInformation("诊断日志保留清理完成，删除行数：{DeletedCount}", deleted);
        return deleted;
    }
}
```

- [x] **Step 6: Register hosted service and run tests（注册服务并运行测试）**

Update `Program.cs`:

```csharp
builder.Services.AddHostedService<DiagnosticLogRetentionService>();
```

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogRetentionTests|FullyQualifiedName~DiagnosticLogStorageTests"
```

Expected（期望）: PASS.

- [x] **Step 7: Commit or record skip（提交或记录跳过）**

Run:

```bash
git status --short --branch
```

Expected（期望）:

- If this directory is a Git repository（Git 仓库）, commit with:

```bash
git add driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs driver-service/src/Sam.Calendaring.DriverService/State driver-service/src/Sam.Calendaring.DriverService/Program.cs driver-service/tests/Sam.Calendaring.DriverService.Tests
git commit -m "feat: 增加 diagnostic log 保留清理服务"
```

- If command returns `fatal: not a git repository`, update this task progress with commit skipped（提交跳过） because workspace（工作区） is not a Git repository.

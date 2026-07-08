# Task 04: Session and Modbus Action Logging

> @file Driver Service V1 会话与 Modbus 动作日志任务
> @author PopoY
> @created 2026-06-27
> @purpose 为 lease validation（租约校验）、state save（状态保存）、device connect（设备连接）、identity probe（身份探测）和 signal read（信号读取）补齐过程诊断。

## Goal（目标）

Write process diagnostic events for the action path inside `/applyLeaseAndConfig（应用租约与配置接口）` and `/getSignalSnapshot（获取信号快照接口）`, including device boundary failures with only `exceptionType（异常类型）` and Chinese summaries.

## Status（状态）

- `Done（完成）`: Task4 已完成；commit（提交）因当前 workspace（工作区）不是 Git repository（Git 仓库）已按计划跳过。

## Progress（进度）

- `2026-06-27`: 计划已落库，当前进度 `0/7`。
- `2026-06-27`: Step 1 进入 RED（失败测试）阶段；当前进度 `0/7`。
- `2026-06-27`: Step 1 已创建 `SessionDiagnosticLoggingTests.cs` 失败测试；当前进度 `1/7`。
- `2026-06-27`: Step 2 已补充 endpoint execution assertions（端点执行断言）；当前进度 `2/7`。
- `2026-06-27`: Step 3 已运行 RED 验证，3 个测试按预期失败于缺少 Task4 diagnostic events（诊断事件）；当前进度 `3/7`。
- `2026-06-27`: Step 4 已在 `DriverEndpoints.cs` 新增 Execution（执行）诊断事件；当前进度 `4/7`。
- `2026-06-27`: Step 5 已在 `DriverSessionManager.cs` 新增 Device（设备）与 PlanSignalRead（信号读取计划）诊断事件；当前进度 `5/7`。
- `2026-06-27`: Step 6 聚焦验证通过，`13/13` tests passed；当前进度 `6/7`。
- `2026-06-27`: 额外回归验证通过，logging contract/storage/API（日志契约/存储/接口）`15/15` tests passed，driver-service 全量 `91/91` tests passed。
- `2026-06-27`: Step 7 已确认当前 workspace（工作区）不是 Git repository（Git 仓库），跳过 commit（提交）；当前进度 `7/7`。

## Files（文件）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/TestDriverSessionManagerFactory.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/SignalSnapshotTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/SessionDiagnosticLoggingTests.cs`

## Steps（步骤）

- [x] **Step 1: Write failing session diagnostic tests（编写失败会话诊断测试）**

Create `driver-service/tests/Sam.Calendaring.DriverService.Tests/SessionDiagnosticLoggingTests.cs`:

```csharp
/**
 * @file SessionDiagnosticLoggingTests.cs
 * @author PopoY
 * @created 2026-06-27
 * @purpose 验证 DriverSessionManager（驱动会话管理器）写入 Device（设备）和 Execution（执行）过程诊断日志。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 覆盖 session manager（会话管理器）的过程型 diagnostic log（诊断日志）。
/// </summary>
public sealed class SessionDiagnosticLoggingTests
{
    /// <summary>
    /// 验证成功快照链路写入设备连接、身份探测、信号计划和读取完成事件。
    /// </summary>
    [Fact]
    public async Task SuccessfulSnapshotWritesDeviceTimelineEvents()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-diagnostic-001",
            "press-001",
            "192.168.19.110:502",
            """
            {"identityProbe":{"name":"deviceIdentity","address":1,"expectedValue":"PRESS-001"},"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["1-120"],
            10,
            DateTimeOffset.UtcNow.AddMinutes(10),
            LeaseState.Active,
            DeviceSessionState.Disconnected), CancellationToken.None);
        var manager = new DriverSessionManager(
            store,
            new IdentityMatchModbusAdapter(),
            TimeProvider.System,
            logger: NullLogger<DriverSessionManager>.Instance);

        var response = await manager.GetSignalSnapshotAsync(
            "cid-session-diagnostic-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);
        var logs = await store.QueryDiagnosticLogsAsync(
            new DiagnosticLogQuery("all", "all", "cid-session-diagnostic-001", 100),
            CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Contains(logs, entry => entry.EventName == "DeviceConnectStarted");
        Assert.Contains(logs, entry => entry.EventName == "DeviceConnectCompleted");
        Assert.Contains(logs, entry => entry.EventName == "IdentityProbeStarted");
        Assert.Contains(logs, entry => entry.EventName == "IdentityProbeCompleted");
        Assert.Contains(logs, entry => entry.EventName == "PlanSignalReadCompleted");
        Assert.Contains(logs, entry => entry.EventName == "SignalReadStarted");
        Assert.Contains(logs, entry => entry.EventName == "SignalReadCompleted");
    }

    /// <summary>
    /// 验证设备异常只记录 exceptionType（异常类型）和中文摘要，不记录完整堆栈。
    /// </summary>
    [Fact]
    public async Task DeviceFailureWritesExceptionTypeWithoutStackTrace()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["100-120"],
            adapter: new ThrowingModbusAdapter());

        var response = await manager.GetSignalSnapshotAsync(
            "cid-session-device-failed-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        var store = TestDriverSessionManagerFactory.GetLastStoreForTests();
        var logs = await store.QueryDiagnosticLogsAsync(
            new DiagnosticLogQuery("abnormal", "device", "cid-session-device-failed-001", 100),
            CancellationToken.None);
        var failure = Assert.Single(logs.Where(entry => entry.EventName == "DeviceConnectFailed" || entry.EventName == "SignalReadFailed"));

        Assert.Equal(DriverResultCode.DeviceRejected, response.ResultCode);
        Assert.Equal(nameof(InvalidOperationException), failure.ExceptionType);
        Assert.Contains("设备通信失败", failure.Message);
        Assert.DoesNotContain(" at ", failure.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signedLease", failure.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 提供身份探测成功的测试 Modbus（通信协议）适配器。
    /// </summary>
    private sealed class IdentityMatchModbusAdapter : IModbusAdapter
    {
        /// <summary>
        /// 模拟连接成功。
        /// </summary>
        public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        /// 模拟读取授权信号值。
        /// </summary>
        public Task<IDictionary<string, object?>> ReadAsync(
            IReadOnlyList<SignalPoint> points,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            IDictionary<string, object?> values = points.ToDictionary(
                point => point.EffectiveKey(),
                point => (object?)point.EffectiveAddress());
            return Task.FromResult(values);
        }

        /// <summary>
        /// 返回与 identityProbe（身份探测）期望值一致的设备身份。
        /// </summary>
        public Task<object?> ReadIdentityAsync(
            SignalPoint identityProbe,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<object?>("PRESS-001");
        }
    }
}
```

- [x] **Step 2: Add failing endpoint execution assertions（新增失败端点执行断言）**

Update `DriverServiceV1AcceptanceTests.cs` successful apply test:

```csharp
/**
 * @author PopoY
 * @brief 验证 applyLeaseAndConfig（应用租约与配置）写入执行阶段诊断事件。
 */
Assert.Contains(diagnosticLogs, entry => entry.EventName == "ApplyLeaseStarted");
Assert.Contains(diagnosticLogs, entry => entry.EventName == "ValidateLeaseStarted");
Assert.Contains(diagnosticLogs, entry => entry.EventName == "ValidateLeaseCompleted");
Assert.Contains(diagnosticLogs, entry => entry.EventName == "SaveLeaseStarted");
Assert.Contains(diagnosticLogs, entry => entry.EventName == "SaveLeaseCompleted");
Assert.DoesNotContain(diagnosticLogs, entry => entry.EventName == "ConnectActiveLeaseStarted");
Assert.DoesNotContain(diagnosticLogs, entry => entry.EventName == "ConnectActiveLeaseCompleted");
Assert.Contains(diagnosticLogs, entry => entry.EventName == "GetSignalSnapshotStarted");
```

- [x] **Step 3: Run tests to confirm RED（确认失败状态）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~SessionDiagnosticLoggingTests|FullyQualifiedName~DriverServiceV1AcceptanceTests"
```

Expected（期望）: FAIL because session and execution diagnostic events are not implemented yet.

- [x] **Step 4: Add endpoint execution events（新增端点执行事件）**

In `DriverEndpoints.cs`, append these `Execution（执行）` events around existing code:

| Location（位置） | Event（事件） | Stage（阶段） | Message（中文说明） |
| --- | --- | --- | --- |
| start of `HandleApplyLeaseAndConfig` | `ApplyLeaseStarted` | `Start` | `开始应用租约和信号配置` |
| before `leaseValidator.Validate` | `ValidateLeaseStarted` | `Start` | `开始校验签名租约` |
| after validation result | `ValidateLeaseCompleted` or failed response event | `Completed` / `Failed` | `租约校验完成` / `租约校验失败` |
| before `SaveValidatedLeaseAsync` | `SaveLeaseStarted` | `Start` | `开始保存活跃租约状态` |
| after save result | `SaveLeaseCompleted` | `Completed` | `活跃租约状态已保存` |
| start of `HandleGetSignalSnapshot` | `GetSignalSnapshotStarted` | `Start` | `开始获取信号快照` |

Each event must include available `correlationId（关联 ID）`, `commandName（命令名）`, `resultCode（结果码）`, `durationMs（耗时）`, `leaseState（租约状态）`, `deviceSessionState（设备会话状态）`, `leaseId（租约 ID）`, `targetDeviceId（目标设备 ID）`, and `fencingToken（隔离令牌）` without raw payloads.

- [x] **Step 5: Add session manager device events（新增会话管理器设备事件）**

Modify `DriverSessionManager` constructor:

```csharp
private readonly ILogger<DriverSessionManager> _logger;

/// <summary>
/// 初始化驱动会话管理器。
/// </summary>
/// <param name="stateStore">状态持久化接口。</param>
/// <param name="adapter">Modbus（通信协议）读取适配器。</param>
/// <param name="clock">用于判断租约过期的时间提供器。</param>
/// <param name="driverOptions">Driver Service（驱动服务）运行模式配置。</param>
/// <param name="logger">用于诊断日志失败摘要的日志抽象。</param>
public DriverSessionManager(
    IDriverStateStore stateStore,
    IModbusAdapter adapter,
    TimeProvider clock,
    DriverOptions? driverOptions = null,
    ILogger<DriverSessionManager>? logger = null)
{
    _stateStore = stateStore;
    _adapter = adapter;
    _clock = clock;
    _driverOptions = driverOptions ?? new DriverOptions();
    _logger = logger ?? NullLogger<DriverSessionManager>.Instance;
}
```

Add a private safe helper:

```csharp
/// <summary>
/// 尝试写入 diagnostic log（诊断日志）；失败时只输出中文 ILogger（日志抽象）摘要。
/// </summary>
private async Task TryAppendDiagnosticLogAsync(
    DiagnosticLogEntry entry,
    CancellationToken cancellationToken)
{
    try
    {
        await _stateStore.AppendDiagnosticLogAsync(entry, cancellationToken).ConfigureAwait(false);
    }
    catch (Exception exception)
    {
        _logger.LogWarning(
            "会话诊断日志写入失败，业务响应不受影响。事件：{EventName}，异常类型：{ExceptionType}",
            entry.EventName,
            exception.GetType().Name);
    }
}
```

Wrap existing adapter calls:

1. Before `_adapter.ConnectAsync`: `DeviceConnectStarted`.
2. After `_adapter.ConnectAsync`: `DeviceConnectCompleted`.
3. Catch connect exception: `DeviceConnectFailed` with `exceptionType`.
4. Before identity read: `IdentityProbeStarted`.
5. After identity read and match: `IdentityProbeCompleted`.
6. Catch identity exception: `IdentityProbeFailed` with `exceptionType`.
7. After `AuthorizedSignalPlanner.Plan`: `PlanSignalReadCompleted`.
8. Before `_adapter.ReadAsync`: `SignalReadStarted`.
9. After `_adapter.ReadAsync`: `SignalReadCompleted`.
10. Catch read exception or timeout: `SignalReadFailed` with `exceptionType`.

- [x] **Step 6: Update test helpers and run verification（更新测试 helper 并运行验证）**

If tests need to inspect the store after factory creation, update `TestDriverSessionManagerFactory` with a narrowly scoped test accessor:

```csharp
// ponytail: test-only backdoor, replace with returned tuple if more tests start needing store access.
private static SqliteDriverStateStore? _lastStoreForTests;

/// <summary>
/// 返回最近一次测试工厂创建的 SQLite 状态存储。
/// </summary>
public static SqliteDriverStateStore GetLastStoreForTests()
{
    return _lastStoreForTests ?? throw new InvalidOperationException("测试状态存储尚未创建。");
}
```

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~SessionDiagnosticLoggingTests|FullyQualifiedName~SignalSnapshotTests|FullyQualifiedName~DriverServiceV1AcceptanceTests"
```

Expected（期望）: PASS.

- [x] **Step 7: Commit（提交）**

```bash
git add driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs driver-service/tests/Sam.Calendaring.DriverService.Tests
git commit -m "feat: 补齐 Driver Service session 和 Modbus diagnostic logging"
```

If this workspace remains not a Git repository（Git 仓库）, skip commit and record that in the execution note.

## Verification（验证）

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~SessionDiagnosticLoggingTests|FullyQualifiedName~SignalSnapshotTests|FullyQualifiedName~DriverServiceV1AcceptanceTests"
```

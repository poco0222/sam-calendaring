# Task 02: Signal Snapshot Publisher Service

> @file 信号快照后台发布服务任务
> @author PopoY
> @created 2026-07-03
> @purpose 新增 SignalSnapshotPublisherService（信号快照发布服务），复用 DriverSessionManager（驱动会话管理器）读取快照并通过 DeviceEventHub（设备事件中心）发布 SSE（服务器发送事件）。

## Goal（目标）

Create the smallest background publisher（后台发布器） that reads only when there is an active lease（活跃租约） and at least one SSE subscriber（订阅者）, publishes `signalSnapshotChanged`, writes no audit log（审计日志） for automatic success, writes no per-success diagnostic log（诊断日志）, and records throttled failures plus one recovery event.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/9`。
- `2026-07-03`: Step 1 已完成，新增 `SignalSnapshotPublisherServiceTests.cs` 聚焦 publisher（发布器）成功发布、subscriber（订阅者）门控、active lease（活跃租约）门控和成功日志边界，当前进度 `1/9`。
- `2026-07-03`: Step 2 已完成，补充失败 throttle（节流）与 recovery（恢复）测试，当前进度 `2/9`。
- `2026-07-03`: Step 3 已完成，`dotnet test --filter "FullyQualifiedName~SignalSnapshotPublisherServiceTests"` 按预期 RED（失败），缺少 `SignalSnapshotPublisherService`，当前进度 `3/9`。
- `2026-07-03`: Step 4 已完成，在 `DriverOptions` 增加 publisher interval（发布间隔）和 failure throttle（失败节流）配置，当前进度 `4/9`。
- `2026-07-03`: Step 5 已完成，新增 `SignalSnapshotDiagnosticMode` 并扩展 `GetSignalSnapshotAsync` 可选 diagnostic mode（诊断模式）；publisher 路径静默成功 tick（计时读取）诊断日志，当前进度 `5/9`。
- `2026-07-03`: Step 6 已完成，新增 `SignalSnapshotPublisherService`，实现 subscriber（订阅者）门控、active lease（活跃租约）门控、10 秒 tick（计时读取）、`signalSnapshotChanged` 发布、失败 throttle（节流）和 recovery（恢复）日志，当前进度 `6/9`。
- `2026-07-03`: Step 7 已完成，在 `Program.cs` 注册 `SignalSnapshotPublisherService` hosted service（托管服务），当前进度 `7/9`。
- `2026-07-03`: Step 8 已完成，focused tests（聚焦测试）`13/13` 通过，full regression（全量回归）`168/168` 通过，额外 `dotnet build` 通过且 `0` warning（警告）/`0` error（错误），当前进度 `8/9`。
- `2026-07-03`: Step 9 已完成，`git status --short --branch` 返回 `fatal: not a git repository`，commit skipped（提交跳过）；Task2 完成，当前进度 `9/9`。
- `2026-07-03`: Review fix（审查修复）完成，补齐 publisher（发布器）`FailureOnly` 模式下底层 `DeviceConnectFailed` / `SignalReadFailed` diagnostic log（诊断日志）抑制，连续失败只保留 throttled（节流后）`SignalSnapshotPublisherReadFailed`；RED（失败）复现后 focused backend tests（聚焦后端测试）`8/8` 通过，full backend tests（完整后端测试）`173/173` 通过，`dotnet build` 通过且 `0` warning（警告）/`0` error（错误）。

## Files（文件）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Sessions/SignalSnapshotDiagnosticMode.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Sessions/SignalSnapshotPublisherService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/SignalSnapshotPublisherServiceTests.cs`
- Modify only for constructor compatibility: existing `driver-service/tests/Sam.Calendaring.DriverService.Tests/*Tests.cs`

## Steps（步骤）

- [x] **Step 1: Write failing publisher tests（编写失败发布器测试）**

Create `driver-service/tests/Sam.Calendaring.DriverService.Tests/SignalSnapshotPublisherServiceTests.cs`:

```csharp
/**
 * @file SignalSnapshotPublisherServiceTests.cs
 * @author PopoY
 * @created 2026-07-03
 * @purpose 验证 SignalSnapshotPublisherService（信号快照发布服务）的读取门控、SSE 发布和失败诊断节流。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

public sealed class SignalSnapshotPublisherServiceTests
{
    [Fact]
    public async Task TickPublishesSignalSnapshotChangedWhenLeaseAndSubscriberExist()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await SaveActiveLeaseAsync(store);
        var adapter = new CountingModbusAdapter();
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        await using var enumerator = hub.SubscribeAsync(CancellationToken.None).GetAsyncEnumerator();
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System, NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, hub, stateService);

        await service.PublishOnceAsync(CancellationToken.None);
        var hasEvent = await enumerator.MoveNextAsync();

        Assert.True(hasEvent);
        Assert.Equal(DeviceEventNames.SignalSnapshotChanged, enumerator.Current.EventName);
        Assert.Equal("signalSnapshotPublisher", enumerator.Current.CommandName);
        Assert.Equal(DriverResultCode.Ok, enumerator.Current.ResultCode);
        Assert.Contains(enumerator.Current.SnapshotValues, item => item.SignalCode == "pressure" && Equals(item.Value, 100));
        Assert.Equal(1, adapter.ReadCount);
    }

    [Fact]
    public async Task TickSkipsReadWhenNoSubscriberExists()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await SaveActiveLeaseAsync(store);
        var adapter = new CountingModbusAdapter();
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System, NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, new DeviceEventHub(stateService), stateService);

        await service.PublishOnceAsync(CancellationToken.None);

        Assert.Equal(0, adapter.ReadCount);
    }

    [Fact]
    public async Task TickSkipsReadWhenNoActiveLeaseExists()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        var adapter = new CountingModbusAdapter();
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        await using var enumerator = hub.SubscribeAsync(CancellationToken.None).GetAsyncEnumerator();
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System, NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, hub, stateService);

        await service.PublishOnceAsync(CancellationToken.None);

        var diagnosticLogs = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "all", null, 100), CancellationToken.None);
        Assert.Equal(0, adapter.ReadCount);
        Assert.DoesNotContain(diagnosticLogs, entry => entry.EventName == "SignalSnapshotPublisherReadFailed");
    }

    [Fact]
    public async Task SuccessTickDoesNotAppendAuditOrSuccessDiagnosticLogs()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await SaveActiveLeaseAsync(store);
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        await using var enumerator = hub.SubscribeAsync(CancellationToken.None).GetAsyncEnumerator();
        var manager = new DriverSessionManager(store, new CountingModbusAdapter(), TimeProvider.System, NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, hub, stateService);

        await service.PublishOnceAsync(CancellationToken.None);

        var diagnosticLogs = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "all", null, 100), CancellationToken.None);
        var auditLogs = await store.ReadAuditLogsForTestsAsync(CancellationToken.None);
        Assert.DoesNotContain(diagnosticLogs, entry => entry.EventName == "SignalSnapshotPublisherReadCompleted");
        Assert.DoesNotContain(auditLogs, entry => entry.CommandName == "signalSnapshotPublisher");
    }
}
```

Keep helpers in the same file:

```csharp
private static SignalSnapshotPublisherService CreateService(
    DriverSessionManager manager,
    DeviceEventHub hub,
    DriverStateService stateService)
{
    return new SignalSnapshotPublisherService(
        manager,
        hub,
        stateService,
        new DriverOptions
        {
            SignalSnapshotPublisherIntervalMs = 10_000,
            SignalSnapshotPublisherFailureThrottleMs = 300_000
        },
        TimeProvider.System,
        NullLogger<SignalSnapshotPublisherService>.Instance);
}

private static Task SaveActiveLeaseAsync(IDriverStateStore store)
{
    return store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
        "lease-snapshot-publisher-001",
        "press-001",
        "192.168.19.110:502",
        """
        {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
        """,
        ["100-120"],
        10,
        DateTimeOffset.UtcNow.AddMinutes(10),
        LeaseState.Active,
        DeviceSessionState.Disconnected), CancellationToken.None);
}

private sealed class CountingModbusAdapter : IModbusAdapter
{
    public int ReadCount { get; private set; }

    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        ReadCount++;
        IDictionary<string, object?> values = points.ToDictionary(point => point.EffectiveKey(), _ => (object?)100);
        return Task.FromResult(values);
    }

    public Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<object?>("PRESS-001");
    }
}
```

- [x] **Step 2: Add failure and recovery tests（新增失败与恢复测试）**

Add tests to the same file:

```csharp
[Fact]
public async Task FailureLogsReadFailedWithThrottleAndRecovery()
{
    var store = SqliteDriverStateStore.CreateTempFileForTests();
    await store.InitializeAsync(CancellationToken.None);
    await SaveActiveLeaseAsync(store);
    var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
    var hub = new DeviceEventHub(stateService);
    await using var enumerator = hub.SubscribeAsync(CancellationToken.None).GetAsyncEnumerator();
    var adapter = new FailingThenRecoveringModbusAdapter();
    var manager = new DriverSessionManager(store, adapter, TimeProvider.System, NullLogger<DriverSessionManager>.Instance);
    var service = CreateService(manager, hub, stateService);

    await service.PublishOnceAsync(CancellationToken.None);
    await service.PublishOnceAsync(CancellationToken.None);
    adapter.ShouldFail = false;
    await service.PublishOnceAsync(CancellationToken.None);

    var logs = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "device", null, 100), CancellationToken.None);
    Assert.Single(logs.Where(entry => entry.EventName == "SignalSnapshotPublisherReadFailed"));
    Assert.Single(logs.Where(entry => entry.EventName == "SignalSnapshotPublisherRecovered"));
    Assert.DoesNotContain(string.Join('\n', logs.Select(entry => entry.Message)), "signalConfig", StringComparison.OrdinalIgnoreCase);
}

private sealed class FailingThenRecoveringModbusAdapter : IModbusAdapter
{
    public bool ShouldFail { get; set; } = true;

    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        if (ShouldFail)
        {
            throw new InvalidOperationException("设备通信失败");
        }

        return Task.CompletedTask;
    }

    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        IDictionary<string, object?> values = points.ToDictionary(point => point.EffectiveKey(), _ => (object?)100);
        return Task.FromResult(values);
    }

    public Task<object?> ReadIdentityAsync(SignalPoint identityProbe, TimeSpan timeout, CancellationToken cancellationToken)
    {
        return Task.FromResult<object?>("PRESS-001");
    }
}
```

- [x] **Step 3: Run tests to confirm RED（确认失败状态）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~SignalSnapshotPublisherServiceTests"
```

Expected（期望）: FAIL because `SignalSnapshotPublisherService`, `SignalSnapshotDiagnosticMode`, and DriverOptions（驱动配置） properties do not exist.

- [x] **Step 4: Add minimal options（新增最小配置）**

Update `driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs`:

```csharp
/// <summary>
/// @author PopoY
/// signal snapshot publisher（信号快照发布器）读取间隔，单位毫秒。
/// </summary>
public int SignalSnapshotPublisherIntervalMs { get; init; } = 10_000;

/// <summary>
/// @author PopoY
/// signal snapshot publisher（信号快照发布器）同一失败键的诊断日志节流窗口，单位毫秒。
/// </summary>
public int SignalSnapshotPublisherFailureThrottleMs { get; init; } = 300_000;
```

- [x] **Step 5: Add diagnostic mode（新增诊断模式）**

Create `driver-service/src/Sam.Calendaring.DriverService/Sessions/SignalSnapshotDiagnosticMode.cs`:

```csharp
/**
 * @file SignalSnapshotDiagnosticMode.cs - 定义信号快照读取诊断模式。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 让后台自动读取复用 GetSignalSnapshotAsync（获取信号快照）时避免成功 tick（计时读取）刷 diagnostic_log（诊断日志）。
 */
namespace Sam.Calendaring.DriverService.Sessions;

/// <summary>
/// 定义 signal snapshot（信号快照）读取的 diagnostic log（诊断日志）写入模式。
/// </summary>
public enum SignalSnapshotDiagnosticMode
{
    /// <summary>
    /// @author PopoY
    /// 完整记录 manual refresh（手动刷新）链路。
    /// </summary>
    Full,

    /// <summary>
    /// @author PopoY
    /// 仅保留失败摘要，供后台自动读取使用。
    /// </summary>
    FailureOnly
}
```

Update `DriverSessionManager.GetSignalSnapshotAsync` signature:

```csharp
public async Task<GetSignalSnapshotResponse> GetSignalSnapshotAsync(
    string correlationId,
    TimeSpan timeout,
    CancellationToken cancellationToken,
    SignalSnapshotDiagnosticMode diagnosticMode = SignalSnapshotDiagnosticMode.Full)
```

Guard success diagnostic writes:

```csharp
if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
{
    await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
        level: "Information",
        eventName: "PlanSignalReadCompleted",
        message: "信号读取计划已生成。",
        eventStage: "Completed",
        correlationId: correlationId,
        commandName: "getSignalSnapshot",
        activeLease: activeLease,
        resultCode: DriverResultCode.Ok,
        deviceSessionState: DeviceSessionState.Connected), timeoutCts.Token).ConfigureAwait(false);
}
```

Apply the same `diagnosticMode == SignalSnapshotDiagnosticMode.Full` guard to `SignalReadStarted` and `SignalReadCompleted`. Keep existing failure diagnostics because failure-only mode still needs abnormal summaries.

- [x] **Step 6: Implement publisher（实现发布服务）**

Create `driver-service/src/Sam.Calendaring.DriverService/Sessions/SignalSnapshotPublisherService.cs`:

```csharp
/**
 * @file SignalSnapshotPublisherService.cs - 后台发布授权信号快照。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 在存在 active lease（活跃租约）和 SSE subscriber（订阅者）时，定期读取 signal snapshot（信号快照）并发布 signalSnapshotChanged（信号快照变化）。
 */
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Sessions;

public sealed class SignalSnapshotPublisherService : BackgroundService
{
    private readonly DriverSessionManager _sessionManager;
    private readonly DeviceEventHub _eventHub;
    private readonly DriverStateService _stateService;
    private readonly DriverOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<SignalSnapshotPublisherService> _logger;
    private string? _lastFailureKey;
    private DateTimeOffset? _lastFailureLoggedAt;
    private bool _hasConsecutiveFailure;

    public SignalSnapshotPublisherService(
        DriverSessionManager sessionManager,
        DeviceEventHub eventHub,
        DriverStateService stateService,
        DriverOptions options,
        TimeProvider timeProvider,
        ILogger<SignalSnapshotPublisherService> logger)
    {
        _sessionManager = sessionManager;
        _eventHub = eventHub;
        _stateService = stateService;
        _options = options;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _stateService.TryAppendDiagnosticLogAsync(CreateLifecycleLog("SignalSnapshotPublisherStarted", "信号快照发布服务已启动。"), stoppingToken);
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await PublishOnceAsync(stoppingToken).ConfigureAwait(false);
                await Task.Delay(TimeSpan.FromMilliseconds(_options.SignalSnapshotPublisherIntervalMs), _timeProvider, stoppingToken).ConfigureAwait(false);
            }
        }
        finally
        {
            await _stateService.TryAppendDiagnosticLogAsync(CreateLifecycleLog("SignalSnapshotPublisherStopped", "信号快照发布服务已停止。"), CancellationToken.None);
        }
    }

    public async Task PublishOnceAsync(CancellationToken cancellationToken)
    {
        if (!_eventHub.HasSubscribers)
        {
            _logger.LogDebug("无 SSE 订阅者，跳过信号快照后台读取。");
            return;
        }

        var stateSnapshot = await _stateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
        if (stateSnapshot.ActiveLease is null
            || !string.Equals(stateSnapshot.LeaseState, LeaseState.Active, StringComparison.Ordinal))
        {
            _logger.LogDebug("无 active lease（活跃租约），跳过信号快照后台读取。");
            return;
        }

        if (stateSnapshot.ActiveLease.ExpiresAt <= _timeProvider.GetUtcNow())
        {
            var expiredCorrelationId = $"signal-snapshot-publisher-{_timeProvider.GetUtcNow():yyyyMMddHHmmssfff}";
            await AppendFailureAsync(expiredCorrelationId, DriverResultCode.LeaseExpired, null, cancellationToken).ConfigureAwait(false);
            return;
        }

        var correlationId = $"signal-snapshot-publisher-{_timeProvider.GetUtcNow():yyyyMMddHHmmssfff}";
        var response = await _sessionManager.GetSignalSnapshotAsync(
            correlationId,
            TimeSpan.FromSeconds(10),
            cancellationToken,
            SignalSnapshotDiagnosticMode.FailureOnly).ConfigureAwait(false);

        if (!string.Equals(response.ResultCode, DriverResultCode.Ok, StringComparison.Ordinal))
        {
            await AppendFailureAsync(correlationId, response.ResultCode, null, cancellationToken).ConfigureAwait(false);
            return;
        }

        await _eventHub.PublishAsync(new DeviceEventStreamItem
        {
            EventId = Guid.NewGuid().ToString("N"),
            CorrelationId = response.CorrelationId,
            EventName = DeviceEventNames.SignalSnapshotChanged,
            CommandName = "signalSnapshotPublisher",
            ResultCode = DriverResultCode.Ok,
            OccurredAt = _timeProvider.GetUtcNow(),
            SnapshotValues = response.SignalValues
                .Where(item => IsSafeSignalCode(item.Key))
                .Select(item => new DeviceEventSnapshotValue(item.Key, UnwrapSafeValue(item.Value)))
                .ToArray()
        }, cancellationToken).ConfigureAwait(false);

        if (_hasConsecutiveFailure)
        {
            await _stateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
                level: "Information",
                category: "Device",
                eventName: "SignalSnapshotPublisherRecovered",
                message: "信号快照后台读取已恢复。",
                eventStage: "Completed",
                correlationId: response.CorrelationId,
                commandName: "signalSnapshotPublisher",
                resultCode: DriverResultCode.Ok), cancellationToken).ConfigureAwait(false);
        }

        _hasConsecutiveFailure = false;
        _lastFailureKey = null;
        _lastFailureLoggedAt = null;
    }
}
```

Add private helpers in the same file:

```csharp
private static DiagnosticLogEntry CreateLifecycleLog(string eventName, string message)
{
    return DiagnosticLogEntry.Create(
        level: "Information",
        category: "Startup",
        eventName: eventName,
        message: message,
        eventStage: "Completed",
        commandName: "signalSnapshotPublisher",
        resultCode: DriverResultCode.Ok);
}

private async Task AppendFailureAsync(
    string correlationId,
    string resultCode,
    string? exceptionType,
    CancellationToken cancellationToken)
{
    var failureKey = $"{resultCode}:{exceptionType ?? string.Empty}";
    if (!ShouldLogFailure(failureKey))
    {
        _hasConsecutiveFailure = true;
        return;
    }

    await _stateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Warning",
        category: "Device",
        eventName: "SignalSnapshotPublisherReadFailed",
        message: "信号快照后台读取失败。",
        eventStage: "Failed",
        correlationId: correlationId,
        commandName: "signalSnapshotPublisher",
        resultCode: resultCode,
        exceptionType: exceptionType), cancellationToken).ConfigureAwait(false);
    _hasConsecutiveFailure = true;
    _lastFailureKey = failureKey;
    _lastFailureLoggedAt = _timeProvider.GetUtcNow();
}

private bool ShouldLogFailure(string failureKey)
{
    if (!string.Equals(_lastFailureKey, failureKey, StringComparison.Ordinal))
    {
        return true;
    }

    if (_lastFailureLoggedAt is null)
    {
        return true;
    }

    var throttle = TimeSpan.FromMilliseconds(_options.SignalSnapshotPublisherFailureThrottleMs);
    return _timeProvider.GetUtcNow() - _lastFailureLoggedAt >= throttle;
}

private static bool IsSafeSignalCode(string signalCode)
{
    return !string.IsNullOrWhiteSpace(signalCode)
        && !string.Equals(signalCode, "signedLease", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "signature", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "signaturePayload", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "signalConfig", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "privateKey", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "credential", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "sessionToken", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "targetEndpoint", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "ip", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "port", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "deviceId", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "registerAddress", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "writeValue", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(signalCode, "rawRegisters", StringComparison.OrdinalIgnoreCase);
}

private static object? UnwrapSafeValue(object? value)
{
    if (value is IReadOnlyDictionary<string, object?> readOnlyRow
        && readOnlyRow.TryGetValue("value", out var readOnlyValue))
    {
        return readOnlyValue;
    }

    if (value is IDictionary<string, object?> row
        && row.TryGetValue("value", out var rowValue))
    {
        return rowValue;
    }

    return value;
}
```

Do not carry `rawRegisters`, `registerAddress`, `targetEndpoint`, `signalConfig`, or raw network fields into `SnapshotValues`.

- [x] **Step 7: Register hosted service（注册托管服务）**

Update `driver-service/src/Sam.Calendaring.DriverService/Program.cs` after `PressDeviceCommandExecutor` registration:

```csharp
builder.Services.AddHostedService<SignalSnapshotPublisherService>();
```

- [x] **Step 8: Run focused and regression tests（运行聚焦与回归测试）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~SignalSnapshotPublisherServiceTests|FullyQualifiedName~DeviceEventStreamTests|FullyQualifiedName~SessionDiagnosticLoggingTests"
```

Expected（期望）: PASS.

Then run:

```bash
cd driver-service
dotnet test
```

Expected（期望）: PASS.

- [x] **Step 9: Commit or record skip（提交或记录跳过）**

Run:

```bash
git status --short --branch
```

Expected（期望）:

- If this directory is a Git repository（Git 仓库）, commit with:

```bash
git add driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs driver-service/src/Sam.Calendaring.DriverService/Sessions driver-service/src/Sam.Calendaring.DriverService/Program.cs driver-service/tests/Sam.Calendaring.DriverService.Tests
git commit -m "feat: 增加 signal snapshot 后台 SSE 发布服务"
```

- If command returns `fatal: not a git repository`, update this task progress with commit skipped（提交跳过） because workspace（工作区） is not a Git repository.

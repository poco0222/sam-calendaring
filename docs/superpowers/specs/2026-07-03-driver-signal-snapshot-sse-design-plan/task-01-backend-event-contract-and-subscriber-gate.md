# Task 01: Backend Event Contract and Subscriber Gate

> @file 后端信号快照事件契约与订阅者门控任务
> @author PopoY
> @created 2026-07-03
> @purpose 固化 `signalSnapshotChanged` SSE event（服务器发送事件）、subscriber gate（订阅者门控）和 payload（载荷）安全边界。

## Goal（目标）

Add the backend event contract needed by the publisher（发布器） without adding the publisher yet: event name constant（常量）, safe SSE frame（安全事件帧）, and a `DeviceEventHub.HasSubscribers` gate（订阅者门控） so later background work can skip device reads when nobody is connected.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/6`。
- `2026-07-03`: Task 01 开始执行，按 TDD（测试驱动开发）先补 RED（失败）测试。
- `2026-07-03`: Step 1 完成，已在 `DeviceEventStreamTests` 增加 `signalSnapshotChanged` SSE（服务器发送事件）帧测试和 subscriber gate（订阅者门控）测试，当前进度 `1/6`。
- `2026-07-03`: Step 2 完成，`cd driver-service && dotnet test --filter "FullyQualifiedName~DeviceEventStreamTests"` 按预期 RED（失败），缺少 `DeviceEventNames.SignalSnapshotChanged` 和 `DeviceEventHub.HasSubscribers`，当前进度 `2/6`。
- `2026-07-03`: Step 3 完成，已在 `DeviceEventNames` 增加 `SignalSnapshotChanged = "signalSnapshotChanged"` 常量，当前进度 `3/6`。
- `2026-07-03`: Step 4 完成，已在 `DeviceEventHub` 增加 `HasSubscribers` subscriber gate（订阅者门控），复用现有 `_gate` lock（锁），当前进度 `4/6`。
- `2026-07-03`: Step 5 完成，`cd driver-service && dotnet test --filter "FullyQualifiedName~DeviceEventStreamTests"` 通过，6/6 tests（测试）通过，当前进度 `5/6`。
- `2026-07-03`: 回归补充验证完成，`cd driver-service && dotnet test --filter "FullyQualifiedName~DeviceEventStreamTests|FullyQualifiedName~PressDownCountMonitorTests"` 通过，27/27 tests（测试）通过；`cd driver-service && dotnet build` 通过，0 warning（警告）/0 error（错误）。
- `2026-07-03`: 后端 full regression（完整回归）完成，`cd driver-service && dotnet test` 通过，163/163 tests（测试）通过。
- `2026-07-03`: Step 6 完成，`git status --short --branch` 返回 `fatal: not a git repository`，当前 workspace（工作区）不是 Git repository（Git 仓库），按计划记录 commit skipped（提交跳过），当前进度 `6/6`。

## Files（文件）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DeviceEventStreamModels.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Events/DeviceEventHub.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceEventStreamTests.cs`

## Steps（步骤）

- [x] **Step 1: Write failing tests（编写失败测试）**

Update `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceEventStreamTests.cs` with two tests:

```csharp
/// <summary>
/// @author PopoY
/// 验证 signalSnapshotChanged（信号快照变化）作为 named SSE event（命名服务器发送事件）输出。
/// </summary>
[Fact]
public async Task DeviceEventsStream_SendsSignalSnapshotChangedFrame()
{
    var factory = CreateFactory(new CapturingStore());
    var client = factory.CreateClient();
    var hub = factory.Services.GetRequiredService<DeviceEventHub>();
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

    using var response = await client.GetAsync(
        "/deviceEvents/stream?correlationId=cid-snapshot-stream-001",
        HttpCompletionOption.ResponseHeadersRead,
        timeoutCts.Token);
    await hub.PublishAsync(new DeviceEventStreamItem
    {
        EventId = "evt-snapshot-001",
        CorrelationId = "signal-snapshot-publisher-001",
        EventName = DeviceEventNames.SignalSnapshotChanged,
        CommandName = "signalSnapshotPublisher",
        ResultCode = DriverResultCode.Ok,
        OccurredAt = DateTimeOffset.UtcNow,
        SnapshotValues = [new DeviceEventSnapshotValue("pressure", 100)]
    }, timeoutCts.Token);

    var frame = await ReadUntilEventFrameAsync(response, "signalSnapshotChanged", timeoutCts.Token);

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Contains("event: signalSnapshotChanged", frame, StringComparison.Ordinal);
    Assert.Contains("snapshotValues", frame, StringComparison.Ordinal);
    Assert.DoesNotContain("signalConfig", frame, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain("targetEndpoint", frame, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain("registerAddress", frame, StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// @author PopoY
/// 验证 DeviceEventHub（设备事件中心）能暴露当前 subscriber（订阅者）状态。
/// </summary>
[Fact]
public async Task DeviceEventHub_ReportsSubscriberGate()
{
    var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));

    Assert.False(hub.HasSubscribers);

    using var subscriberCts = new CancellationTokenSource();
    await using var enumerator = hub.SubscribeAsync(subscriberCts.Token).GetAsyncEnumerator();
    var pendingRead = enumerator.MoveNextAsync().AsTask();

    Assert.True(hub.HasSubscribers);

    subscriberCts.Cancel();
    try
    {
        await pendingRead;
    }
    catch (OperationCanceledException)
    {
        // @author PopoY: 测试主动取消长连接，只验证 subscriber gate（订阅者门控）。
    }
}
```

- [x] **Step 2: Run tests to confirm RED（确认失败状态）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DeviceEventStreamTests"
```

Expected（期望）: FAIL because `DeviceEventNames.SignalSnapshotChanged` and `DeviceEventHub.HasSubscribers` do not exist.

- [x] **Step 3: Add event constant（新增事件常量）**

Update `driver-service/src/Sam.Calendaring.DriverService/Contracts/DeviceEventStreamModels.cs` inside `DeviceEventNames`:

```csharp
/// <summary>
/// @author PopoY
/// signal snapshot（信号快照）已由后台发布器读取并变化。
/// </summary>
public const string SignalSnapshotChanged = "signalSnapshotChanged";
```

- [x] **Step 4: Add subscriber gate（新增订阅者门控）**

Update `driver-service/src/Sam.Calendaring.DriverService/Events/DeviceEventHub.cs`:

```csharp
/// <summary>
/// 获取当前是否存在 SSE subscriber（服务器发送事件订阅者）。
/// </summary>
/// <remarks>@author PopoY: 后台快照发布器用它避免无人查看时空耗设备通信。</remarks>
public bool HasSubscribers
{
    get
    {
        lock (_gate)
        {
            return _subscribers.Count > 0;
        }
    }
}
```

- [x] **Step 5: Run focused tests（运行聚焦测试）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DeviceEventStreamTests"
```

Expected（期望）: PASS. Existing pressDownCount monitor（下压计数监测） SSE tests must still pass.

- [x] **Step 6: Commit or record skip（提交或记录跳过）**

Run:

```bash
git status --short --branch
```

Expected（期望）:

- If this directory is a Git repository（Git 仓库）, commit with:

```bash
git add driver-service/src/Sam.Calendaring.DriverService/Contracts/DeviceEventStreamModels.cs driver-service/src/Sam.Calendaring.DriverService/Events/DeviceEventHub.cs driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceEventStreamTests.cs
git commit -m "feat: 增加 signalSnapshotChanged SSE 事件契约"
```

- If command returns `fatal: not a git repository`, update this task progress with commit skipped（提交跳过） because workspace（工作区） is not a Git repository.

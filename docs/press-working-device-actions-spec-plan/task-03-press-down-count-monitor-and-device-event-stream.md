# Task 03: PressDownCount Monitor And Device Event Stream

> @file pressDownCountMonitor（下压计数监测）与设备事件流任务
> @author PopoY
> @created 2026-07-02
> @purpose 由 Driver Service（驱动服务）持有 bounded monitor（有界监测）并通过 one-way event stream（单向事件流）通知 QT App（Qt 应用）。

## Goal（目标）

Implement Driver-owned `pressDownCountMonitor（下压计数监测）` without Web polling（网页轮询）. The monitor（监测） reads authorized `pressDownCount（下压计数）` from active lease（活跃租约）, emits lifecycle events（生命周期事件）, sends `pressDownCountThresholdReached（下压计数阈值已达到）` once at `>= 5`, and stops on timeout/rollback/cleanup/lease loss/disconnect/explicit stop（超时/回滚/收尾/租约失效/断开/显式停止）.

## Status（状态）

- `Completed（已完成）`: 本轮只执行 Task 03，Driver-owned pressDownCountMonitor（驱动侧下压计数监测）与 SSE event stream（服务器发送事件流）已完成并通过验证；未推进 Task 04+。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/9`。
- `2026-07-02`: Step 1 已完成，新增 `PressDownCountMonitorTests.cs` 与 `DeviceEventStreamTests.cs`，当前进度 `1/9`。
- `2026-07-02`: Step 2 已完成，focused tests（聚焦测试）按预期 RED（失败），缺少 `DeviceEventHub`、`PressDownCountMonitorService`、`DeviceEventStreamItem`，当前进度 `2/9`。
- `2026-07-02`: Step 3 已完成，新增 `DeviceEventStreamModels.cs` 白名单事件载荷模型，当前进度 `3/9`。
- `2026-07-02`: Step 4 已完成，新增 `DeviceEventHub.cs` 进程内事件广播与 SSE frame（服务器发送事件帧）输出，当前进度 `4/9`。
- `2026-07-02`: Step 5 已完成，新增 `PressDownCountMonitorService.cs`，阈值固定为 Driver-owned `>= 5`，当前进度 `5/9`。
- `2026-07-02`: Step 6 已完成，`startPressDownCountMonitor` / `stopPressDownCountMonitor` 已接入 executor（执行器），rollback/cleanup（回滚/收尾）会停止 monitor（监测），当前进度 `6/9`。
- `2026-07-02`: Step 7 已完成，新增 `GET /deviceEvents/stream` SSE（服务器发送事件）端点并注册事件服务，当前进度 `7/9`。
- `2026-07-02`: Step 8 已完成，`PressDownCountMonitorTests|DeviceEventStreamTests|LoggingContractTests` 通过 `13/13`，当前进度 `8/9`。
- `2026-07-02`: Step 9 已完成，当前目录、`driver-service`、`qt-app` 均为 no-git（非 Git 仓库）状态，`git status --short --branch` 输出均为 `fatal: not a git repository (or any of the parent directories): .git`；补充 driver focused tests（驱动聚焦测试）`25/25` 通过，driver regression（驱动回归）`138/138` 通过，当前进度 `9/9`。
- `2026-07-02`: Review fixes（评审修复）已完成：补齐 lease replacement（租约替换）停止、safe signal code（安全信号码）不回退地址、natural stopped lifecycle（自然停止生命周期事件）、SSE slow subscriber（慢订阅者）不阻塞、共享 `ModbusDeviceGate（通信门闩）` 串行化真实 adapter（适配器）访问；最终 `PressDownCountMonitorTests|DeviceEventStreamTests|LoggingContractTests` 通过 `17/17`，driver focused tests（驱动聚焦测试）通过 `29/29`，driver regression（驱动回归）通过 `142/142`。

## Files（文件）

- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DeviceEventStreamModels.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Monitoring/PressDownCountMonitorService.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Events/DeviceEventHub.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceCommandCatalog.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceCommandExecutor.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- No change needed（无需改动）: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Modbus/ModbusDeviceGate.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/PressDownCountMonitorTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceEventStreamTests.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs`

## Event Names（事件名）

```text
pressDownCountMonitorStarted
pressDownCountChanged
pressDownCountThresholdReached
pressDownCountMonitorFailed
pressDownCountMonitorStopped
```

## Steps（步骤）

- [x] **Step 1: Write RED monitor and stream tests（编写失败的监测与事件流测试）**

Create `PressDownCountMonitorTests.cs` and `DeviceEventStreamTests.cs`.

Monitor tests（监测测试）:

1. `Monitor_EmitsThresholdReached_WhenCountReachesFive（达到五次下压时发送阈值事件）`
2. `Monitor_ReturnsSignalNotConfigured_WhenPressDownCountMissing（缺少下压计数信号时失败）`
3. `Monitor_ReturnsMonitorAlreadyRunning_ForDuplicateStart（重复启动返回已运行）`
4. `Monitor_ReturnsMonitorTimeout_WhenThresholdNotReached（未达到阈值返回超时）`
5. `Monitor_Stops_OnRollbackCleanupOrExplicitStop（回滚收尾或显式停止时结束）`
6. `Monitor_EmitsNarrowedSnapshot_WithoutRawSignalConfig（事件只带收窄快照）`

Stream tests（事件流测试）:

1. `DeviceEventsStream_SendsSseFrames（发送 SSE 帧）`
2. `DeviceEventsStream_DoesNotUseTokenOrLeaseInQuery（查询参数不含令牌或租约）`
3. `DeviceEventsStream_LogsDisconnectWithoutQueryString（断开日志不记录查询字符串）`

Expected RED（预期失败）:

```text
PressDownCountMonitorService and GET /deviceEvents/stream do not exist.
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~PressDownCountMonitorTests|FullyQualifiedName~DeviceEventStreamTests"
```

Expected（预期）:

```text
Failed! Monitor service and device event stream are missing.
```

- [x] **Step 3: Add event stream models（新增事件流模型）**

Create `DeviceEventStreamModels.cs`.

Fields（字段）:

```text
EventId
CorrelationId
LocalJobSessionId
EventName
CommandName
ResultCode
PressDownCount
Threshold
ParameterIdempotencyKey
OccurredAt
SnapshotValues
```

Rules（规则）:

1. `SnapshotValues（快照值）` only contains safe signal code（安全信号码） and value.
2. No raw `signalConfig（信号配置）`, Modbus address（Modbus 地址）, `deviceId（设备 ID）`, `ip（网络地址）`, or `port（端口）`.
3. `ParameterIdempotencyKey（参数幂等键）` is generated by Driver Service（驱动服务） for threshold event（阈值事件）.

- [x] **Step 4: Implement DeviceEventHub（实现设备事件中心）**

Create `DeviceEventHub.cs`.

Rules（规则）:

1. Keep an in-memory channel（内存通道） for event broadcast（事件广播）.
2. The hub（中心） stores no token（令牌）, lease（租约）, or raw signal config（原始信号配置）.
3. Disconnect diagnostic（断开诊断） records only `correlationId（关联 ID）`, `eventName（事件名）`, `eventId（事件 ID）`, and Chinese summary（中文摘要）.
4. Backpressure（背压） may drop `pressDownCountChanged（下压计数变化）` events, but must not drop `pressDownCountThresholdReached（阈值达到）`.

- [x] **Step 5: Implement PressDownCountMonitorService（实现下压计数监测服务）**

Create `PressDownCountMonitorService.cs`.

Constants（常量）:

```text
Threshold = 5
PollIntervalMs = Driver config（驱动本地配置）, default 1000
MaxDurationMs = Driver config（驱动本地配置）, default 300000
```

Rules（规则）:

1. `startPressDownCountMonitor（启动监测）` does not write device（不写设备）.
2. It resolves `signalName=下压计数` from local signalConfig（本地信号配置）.
3. It does not accept threshold/poll interval/signal key from request（不从请求读取阈值/间隔/信号键）.
4. It sends `pressDownCountChanged（下压计数变化）` throttled（节流）.
5. It sends `pressDownCountThresholdReached（阈值达到）` once.
6. It stops on threshold, timeout, explicit stop, rollback, cleanup, lease loss, or disconnect.

- [x] **Step 6: Wire monitor commands through executor（通过执行器接入监测命令）**

Modify `PressDeviceCommandExecutor.cs`.

Command behavior（命令行为）:

```text
startPressDownCountMonitor -> monitorService.StartAsync(...)
stopPressDownCountMonitor -> monitorService.StopAsync(...)
rollbackStartSignal -> stop monitor for localJobSessionId
cleanupDeviceSession -> stop monitor for localJobSessionId
```

Result mapping（结果映射）:

```text
MONITOR_ALREADY_RUNNING
MONITOR_NOT_RUNNING
MONITOR_TIMEOUT
EVENT_STREAM_UNAVAILABLE
SIGNAL_NOT_CONFIGURED
```

- [x] **Step 7: Map SSE endpoint（映射 SSE 端点）**

Modify `DriverEndpoints.cs`.

Endpoint（端点）:

```text
GET /deviceEvents/stream
```

Rules（规则）:

1. Use `text/event-stream（事件流文本）`.
2. Do not require token（令牌） in query string（查询字符串）.
3. Do not log full query string（完整查询字符串）.
4. Keep payload（载荷） identical to `DeviceEventStreamModels.cs`.

- [x] **Step 8: Run focused monitor, stream, and logging tests（运行监测、事件流与日志测试）**

Run:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~PressDownCountMonitorTests|FullyQualifiedName~DeviceEventStreamTests|FullyQualifiedName~LoggingContractTests"
```

Expected（预期）:

```text
Passed! Monitor lifecycle and event stream boundary are green.
```

- [x] **Step 9: Commit or record no-git state（提交或记录非 Git 状态）**

If a Git repository（Git 仓库） is available:

```bash
git add driver-service/src driver-service/tests docs/press-working-device-actions-spec-plan/task-03-press-down-count-monitor-and-device-event-stream.md
git commit -m "feat: 新增 Driver 下压计数监测事件流"
```

If no Git repository（Git 仓库） is available, update this task `Status（状态）` and `Progress（进度）` with the exact `git status --short --branch` result.

## Acceptance（验收）

- No frontend polling（前端轮询） is introduced for `pressDownCount（下压计数）`.
- Threshold（阈值） is owned by Driver Service（驱动服务） and fixed at `>= 5` for this phase（阶段）.
- Threshold event（阈值事件） is at-least-once（至少一次） and carries `parameterIdempotencyKey（参数幂等键）`.
- Event payload（事件载荷） contains only whitelist（白名单） data and narrowed snapshot（收窄快照）.
- Monitor lifecycle logs（监测生命周期日志） do not include full snapshot（完整快照） or raw signal config（原始信号配置）.

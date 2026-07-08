# Task 01: Driver Command Contract And Request Boundary

> @file Driver command（驱动命令）契约与请求边界任务
> @author PopoY
> @created 2026-07-02
> @purpose 新增 `/executeDeviceCommand` contract（契约）、result codes（结果码）、strict JSON whitelist（严格 JSON 白名单）和日志安全边界。

## Goal（目标）

Add the smallest Driver Service（驱动服务） API surface for production device actions: one `POST /executeDeviceCommand` endpoint（端点）, stable request/response contracts（请求/响应契约）, result codes（结果码）, unknown-field rejection（未知字段拒绝）, and audit/diagnostic log（审计/诊断日志） records linked by `correlationId（关联 ID）`.

## Status（状态）

- `Completed（已完成）`: Task 01 已完成，未推进 Task 02+。

## Progress（进度）

- `2026-07-02 15:40 CST`: Step 1 completed（已完成），新增 `DeviceCommandContractTests` 覆盖白名单字段、裸设备字段拒绝、未知命令、稳定响应和脱敏日志；当前进度 `1/8`。
- `2026-07-02 15:42 CST`: Step 2 completed（已完成），运行 `dotnet test ... --filter "FullyQualifiedName~DeviceCommandContractTests"`，确认 6/6 tests failed（失败）且原因均为 `/executeDeviceCommand` 返回 `404 NotFound`；当前进度 `2/8`。
- `2026-07-02 15:44 CST`: Step 3 completed（已完成），新增 `ExecuteDeviceCommandRequest` 与 `ExecuteDeviceCommandResponse` contract（契约），仅包含 Task 01 白名单字段与稳定响应字段；当前进度 `3/8`。
- `2026-07-02 15:44 CST`: Step 4 completed（已完成），扩展 Task 01 要求的 `DriverResultCode` constants（常量），并补齐 HTTP status mapping（状态码映射）与默认中文审计消息；当前进度 `4/8`。
- `2026-07-02 15:47 CST`: Step 5 completed（已完成），映射 `POST /executeDeviceCommand`，接入 strict JSON boundary（严格 JSON 边界）、必填校验、timeoutMs 校验和 allowed command（允许命令）白名单；当前进度 `5/8`。
- `2026-07-02 15:47 CST`: Step 6 completed（已完成），复用现有 audit/diagnostic log（审计/诊断日志）通道，补齐 `RequestReceived -> ActionStarted/ActionCompleted -> ResponseSent` 生命周期，且不写入裸设备字段；当前进度 `6/8`。
  Evidence（证据）: `dotnet test ... --filter "FullyQualifiedName~DeviceCommandContractTests"` 通过 `6/6`。
- `2026-07-02 15:48 CST`: Step 7 completed（已完成），运行 Task 01 focused verification（聚焦验证）`dotnet test ... --filter "FullyQualifiedName~DeviceCommandContractTests|FullyQualifiedName~LoggingContractTests|FullyQualifiedName~ApiContractTests"`，通过 `30/30`；当前进度 `7/8`。
- `2026-07-02 15:48 CST`: Step 8 completed（已完成），根目录执行 `git status --short --branch` 返回 `fatal: not a git repository (or any of the parent directories): .git`，因此未提交；额外 driver regression（驱动回归）`dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj` 通过 `118/118`；当前进度 `8/8`。
- `2026-07-02 15:56 CST`: Review fix completed（审查修复已完成），补齐 strict JSON boundary（严格 JSON 边界）失败路径的 audit log（审计日志）、`ActionStarted/ActionCompleted`、`ResponseSent` 和 response `correlationId` 回填；先运行单测确认 RED（失败）后修复，随后 focused verification（聚焦验证）通过 `30/30`。
  Previous（上一状态）: 计划已落库，当前进度 `0/8`。

## Files（文件）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DriverResultCode.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/ExecuteDeviceCommandRequest.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/ExecuteDeviceCommandResponse.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/ApiContractTests.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceCommandContractTests.cs`

## Contract（契约）

Allowed request（允许请求）:

```json
{
  "correlationId": "press-start-001",
  "commandName": "connectMes",
  "localJobSessionId": "press-device-action-001",
  "idempotencyKey": "press-connect-001",
  "timeoutMs": 5000
}
```

Forbidden request fields（禁止请求字段）:

```text
signedLease
signature
signalConfig
sessionToken
deviceId
ip
port
targetEndpoint
targetEndpointOverride
signalName
signalCode
registerAddress
address
pointOverride
writeValue
expectedDuration
operatorId
teamId
processId
```

Allowed command names（允许命令名）:

```text
connectMes
precheckForStart
startDeviceSession
rollbackStartSignal
startPressDownCountMonitor
stopPressDownCountMonitor
cleanupDeviceSession
moveIn
moveOut
lineIn
lineOut
```

## Steps（步骤）

- [x] **Step 1: Write RED contract tests（编写失败的契约测试）**

Create `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceCommandContractTests.cs`.

Test cases（测试用例）:

1. `ExecuteDeviceCommand_Accepts_OnlyWhitelistFields（只接受白名单字段）`
2. `ExecuteDeviceCommand_Rejects_RawDeviceFields（拒绝裸设备字段）`
3. `ExecuteDeviceCommand_Rejects_UnknownCommandName（拒绝未知命令）`
4. `ExecuteDeviceCommand_Returns_StableResponseShape（返回稳定响应结构）`
5. `ExecuteDeviceCommand_Writes_RequestResponseAudit（写入请求响应审计）`
6. `ExecuteDeviceCommand_DoesNotLogSensitiveFields（不记录敏感字段）`

Expected RED（预期失败）:

```text
POST /executeDeviceCommand returns 404 because endpoint is not mapped yet.
ExecuteDeviceCommandRequest/Response types are missing.
```

- [x] **Step 2: Run contract tests and confirm RED（运行契约测试并确认失败）**

Run:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~DeviceCommandContractTests"
```

Expected（预期）:

```text
Failed! POST /executeDeviceCommand is not registered.
```

- [x] **Step 3: Add request and response contracts（新增请求与响应契约）**

Create `ExecuteDeviceCommandRequest.cs` with file header（文件头） containing `@author PopoY`.

Fields（字段）:

```text
CorrelationId: string
CommandName: string
LocalJobSessionId: string
IdempotencyKey: string
TimeoutMs: int
```

Create `ExecuteDeviceCommandResponse.cs` with file header（文件头） containing `@author PopoY`.

Fields（字段）:

```text
CorrelationId: string
CommandName: string
LocalJobSessionId: string
IdempotencyKey: string
ResultCode: string
Message: string
LeaseState: string
DeviceSessionState: string
CompletedSteps: IReadOnlyList<string>
FailedSteps: IReadOnlyList<string>
```

Rules（规则）:

1. Do not include（不要包含） `deviceId/ip/port/signalName/registerAddress/writeValue`.
2. Keep JSON property names camelCase（小驼峰） through existing `DriverJson（驱动 JSON 配置）`.
3. Use Chinese `Message（消息）` values.

- [x] **Step 4: Extend result codes（扩展结果码）**

Modify `DriverResultCode.cs`.

Add constants（新增常量）:

```text
PartialOk = "PARTIAL_OK"
CommandNotAllowed = "COMMAND_NOT_ALLOWED"
SignalNotConfigured = "SIGNAL_NOT_CONFIGURED"
SignalNotWritable = "SIGNAL_NOT_WRITABLE"
RollbackFailed = "ROLLBACK_FAILED"
IdempotencyReplay = "IDEMPOTENCY_REPLAY"
MonitorAlreadyRunning = "MONITOR_ALREADY_RUNNING"
MonitorNotRunning = "MONITOR_NOT_RUNNING"
MonitorTimeout = "MONITOR_TIMEOUT"
EventStreamUnavailable = "EVENT_STREAM_UNAVAILABLE"
```

- [x] **Step 5: Map endpoint with strict JSON boundary（映射端点并启用严格 JSON 边界）**

Modify `DriverEndpoints.cs`.

Implementation rules（实现规则）:

1. Register `app.MapPost("/executeDeviceCommand", HandleExecuteDeviceCommand)`.
2. Reject missing `correlationId（关联 ID）`, `commandName（命令名）`, `localJobSessionId（本地作业会话 ID）`, `idempotencyKey（幂等键）`, or invalid `timeoutMs（超时毫秒）`.
3. Reject any forbidden field（禁止字段） before command execution（命令执行）.
4. Return `400 Bad Request（错误请求）` with `LEASE_INVALID（租约无效）` for malformed boundary（边界错误）.
5. Return `400 Bad Request（错误请求）` with `COMMAND_NOT_ALLOWED（命令不允许）` for unknown command（未知命令）.
6. For Task 01 only, return a minimal contract response（最小契约响应） through a thin executor seam（执行器接缝） so Task 02 can replace the executor without remapping the endpoint.

- [x] **Step 6: Wire audit and diagnostic logs（接入审计与诊断日志）**

Modify `DriverEndpoints.cs` and existing log tests.

Required lifecycle（必需生命周期）:

```text
RequestReceived -> ActionStarted -> ActionCompleted -> ResponseSent
```

Allowed log fields（允许日志字段）:

```text
correlationId
idempotencyKey
localJobSessionId
commandName
resultCode
durationMs
leaseState
deviceSessionState
completedSteps
failedSteps
```

Sensitive field scan（敏感字段扫描） must assert absence of:

```text
signedLease
signature
signalConfig
sessionToken
privateKey
credential
deviceId
ip
port
registerAddress
writeValue
```

- [x] **Step 7: Run focused and logging tests（运行聚焦与日志测试）**

Run:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~DeviceCommandContractTests|FullyQualifiedName~LoggingContractTests|FullyQualifiedName~ApiContractTests"
```

Expected（预期）:

```text
Passed! Device command contract and logging boundary are green.
```

- [x] **Step 8: Commit or record no-git state（提交或记录非 Git 状态）**

If a Git repository（Git 仓库） is available:

```bash
git add driver-service/src driver-service/tests docs/press-working-device-actions-spec-plan/task-01-driver-command-contract-and-request-boundary.md
git commit -m "feat: 新增 Driver command 契约边界"
```

If no Git repository（Git 仓库） is available, update this task `Status（状态）` and `Progress（进度）` with the exact `git status --short --branch` result.

## Acceptance（验收）

- `/executeDeviceCommand` accepts only five request fields（请求字段）.
- Forbidden raw device/network fields（裸设备/网络字段） are rejected before execution（执行前拒绝）.
- Unknown command（未知命令） returns `COMMAND_NOT_ALLOWED（命令不允许）`.
- Every response contains stable result shape（稳定响应结构）.
- Audit/diagnostic logs（审计/诊断日志） contain only whitelist（白名单） fields and Chinese summaries（中文摘要）.

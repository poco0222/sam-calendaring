# Task 02: Modbus Write Planner And Semantic Command Executor

> @file Modbus write（写入）规划与语义命令执行任务
> @author PopoY
> @created 2026-07-02
> @purpose 扩展 Driver Service（驱动服务）写设备能力，按 semanticKey（语义键）执行设备动作并进行 read-back confirmation（回读确认）。

## Goal（目标）

Implement the root device-write path once inside Driver Service（驱动服务）: resolve semantic signal（语义信号） from active lease（活跃租约） and signalConfig（信号配置）, verify allowed scope/address/writable（授权范围/地址/可写）, write via `IModbusAdapter（Modbus 适配器接口）`, read back, and return `OK（成功）`, `PARTIAL_OK（部分成功）`, or stable failure result（稳定失败结果）.

## Status（状态）

- `Completed（已完成）`: 本轮只执行 Task 02；Driver Service（驱动服务）semantic command executor（语义命令执行器）已完成，未推进 Task 03+。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/9`。
- `2026-07-02`: Step 1 completed（已完成）- 新增 `PressDeviceCommandExecutorTests.cs`，覆盖 semantic command（语义命令）写入、read-back confirmation（回读确认）、idempotency（幂等）和请求点位隔离；当前进度 `1/9`。
- `2026-07-02`: Step 2 completed（已完成）- 已运行 `dotnet test ... --filter "FullyQualifiedName~PressDeviceCommandExecutorTests"` 并确认 RED（失败）：`Commands` namespace（命名空间）和 `PressDeviceCommandExecutor` 尚不存在；当前进度 `2/9`。
- `2026-07-02`: Step 3 completed（已完成）- `SignalPoint` 新增 `SemanticKey` 与 `Writable`，并保留旧 `signalType` 写能力 fallback（回退）；当前进度 `3/9`。
- `2026-07-02`: Step 4 completed（已完成）- `IModbusAdapter` 新增 `WriteAsync`，`MockModbusAdapter` 缓存写值供回读，`NModbusAdapter` 支持 coil（线圈）与 holding register（保持寄存器）写入；当前进度 `4/9`。
- `2026-07-02`: Step 5 completed（已完成）- 新增 `PressDeviceCommandCatalog`，固定 commandName（命令名）到 semanticKey（语义键）和内部 writeValue（写入值）的映射，并支持 base/command-specific scope（基础/命令级作用域）；当前进度 `5/9`。
- `2026-07-02`: Step 6 completed（已完成）- 新增 `PressDeviceCommandExecutor` 与 `PressDeviceIdempotencyStore`，从 active lease（活跃租约）读取 scope/address/signalConfig（作用域/地址/信号配置）、执行 write/read-back（写入/回读）并处理 CleanupPending（清理待完成）；当前进度 `6/9`。
- `2026-07-02`: Step 7 completed（已完成）- `/executeDeviceCommand` 已由 Task 01 placeholder（占位执行器）切换为 `PressDeviceCommandExecutor`，保留请求白名单与日志边界，并按 `DriverResponseWriter` 映射稳定 HTTP status（HTTP 状态）；当前进度 `7/9`。
- `2026-07-02`: Step 8 completed（已完成）- 已运行 focused driver tests（驱动聚焦测试）：`PressDeviceCommandExecutorTests|DeviceCommandContractTests|NModbusAdapterTests`，结果 `15 passed / 0 failed`；当前进度 `8/9`。
- `2026-07-02`: Regression（回归）- 已运行 `dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj`，结果 `126 passed / 0 failed`。
- `2026-07-02`: Step 9 completed（已完成）- 当前目录和 `driver-service` 均非 Git repository（Git 仓库），`git status --short --branch` 返回 `fatal: not a git repository (or any of the parent directories): .git`；未提交 commit（提交）；当前进度 `9/9`。
- `2026-07-02`: Review remediation RED（审查修复失败测试）- 针对 concurrent idempotency（并发幂等）、planned address authorization（计划地址授权）和 connect failure stable result（连接失败稳定结果）新增 3 个测试，`PressDeviceCommandExecutorTests` 当前按预期 `3 failed / 7 passed`。
- `2026-07-02`: Review remediation GREEN（审查修复通过）- 在 device gate（设备门闩）内二次检查 idempotency（幂等），按最终 `SignalReadPlan.Address` 校验授权地址，并将 connect failure（连接失败）收敛成 stable result（稳定结果）；`PressDeviceCommandExecutorTests` 结果 `10 passed / 0 failed`。
- `2026-07-02`: Final verification（最终验证）- focused driver tests（驱动聚焦测试）结果 `18 passed / 0 failed`；full driver regression（驱动全量回归）结果 `129 passed / 0 failed`。

## Files（文件）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/SignalPoint.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/SignalConfig.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/AuthorizedSignalPlanner.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/IModbusAdapter.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/NModbusAdapter.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/MockModbusAdapter.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceCommandCatalog.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceCommandExecutor.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceIdempotencyStore.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/NModbusAdapterTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/PressDeviceCommandExecutorTests.cs`

## Command Mapping（命令映射）

| Command（命令） | Steps（步骤） |
| --- | --- |
| `connectMes` | `MES通信状态=true` |
| `precheckForStart` | No write（不写入）, validate lease/scope/signal/session（校验租约/范围/信号/会话） |
| `startDeviceSession` | `MES通信状态=true`, `下压计数清零=true`, optional（可选） `开始信号=true` |
| `rollbackStartSignal` | optional（可选） `开始信号=false` |
| `cleanupDeviceSession` | optional（可选） `MES通信状态=false`, `下压计数清零=false`, `下压计数清零=true` |
| `moveIn` | `允许移入=true` |
| `moveOut` | `允许移出=true` |
| `lineIn` | `是否出线=false` |
| `lineOut` | `是否出线=true` |

## Steps（步骤）

- [x] **Step 1: Write RED executor tests（编写失败的执行器测试）**

Create `PressDeviceCommandExecutorTests.cs`.

Test cases（测试用例）:

1. `ConnectMes_WritesCommunicationOnly（建立通信只写通信状态）`
2. `StartDeviceSession_WritesCounterClearBeforeStartSignal（开始加工先清零再开始）`
3. `StartDeviceSession_StopsBeforeStartSignal_WhenCounterClearFails（清零失败不继续写开始信号）`
4. `StartDeviceSession_PrechecksLeaseScopeAndWritableSignals（开始加工预检授权和可写信号）`
5. `CleanupDeviceSession_PulsesCounterClearForCompleteWorkflow（完成加工收尾触发清零脉冲）`
6. `CleanupDeviceSession_SetsCleanupPending_WhenReadbackFails（收尾回读失败进入清理待完成）`
7. `MoveInMoveOutLineInLineOut_MapToSemanticKeys（动作映射语义键）`
8. `ExecuteDeviceCommand_ReplaysIdempotencyKey（幂等键重放）`
9. `Executor_DoesNotReadEndpointOrPointFromRequest（执行器不读请求中的设备点位）`

Expected RED（预期失败）:

```text
PressDeviceCommandExecutor does not exist.
IModbusAdapter.WriteAsync does not exist.
```

- [x] **Step 2: Run executor tests and confirm RED（运行执行器测试并确认失败）**

Run:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~PressDeviceCommandExecutorTests"
```

Expected（预期）:

```text
Failed! Missing write adapter and command executor.
```

- [x] **Step 3: Add signal metadata（新增信号元数据）**

Modify `SignalPoint.cs`.

Add properties（新增属性）:

```text
SemanticKey: string
Writable: bool?
```

Rules（规则）:

1. Keep existing `JsonExtensionData（JSON 扩展字段）`.
2. `Writable（可写）` true or `SignalType（信号类型）` compatible with write means write-capable（可写）.
3. Legacy fallback（旧字段回退） stays internal to Driver Service（驱动服务） only.

- [x] **Step 4: Extend Modbus adapter write capability（扩展 Modbus 适配器写能力）**

Modify `IModbusAdapter.cs`, `MockModbusAdapter.cs`, and `NModbusAdapter.cs`.

Contract（契约）:

```text
Task WriteAsync(SignalPoint point, object value, TimeSpan timeout, CancellationToken cancellationToken)
```

Support（支持范围）:

1. `coil（线圈）`: write `true/false`, read back with coil read（线圈读取）.
2. `holding register（保持寄存器）`: write `1/0` or `ushort（无符号 16 位整数）`, read back with holding register read（保持寄存器读取）.
3. Unsupported register type（不支持寄存器类型） returns `SIGNAL_NOT_WRITABLE（信号不可写）` through executor（执行器）.

- [x] **Step 5: Add command catalog（新增命令目录）**

Create `PressDeviceCommandCatalog.cs`.

Catalog entries（目录项）:

```text
commandName
requiredScopes
requiredSteps
optionalSteps
semanticKey
writeValue
resultStepKey
```

Rules（规则）:

1. Accept scope（范围） `pressWorking.deviceActions`.
2. Accept scope（范围） `pressWorking.deviceActions.<commandName>`.
3. Do not expose signal names（信号名）, addresses（地址）, or write values（写入值） to QT App（Qt 应用）.

- [x] **Step 6: Implement executor and idempotency（实现执行器与幂等）**

Create `PressDeviceCommandExecutor.cs` and `PressDeviceIdempotencyStore.cs`.

Implementation rules（实现规则）:

1. Load active snapshot（活跃快照） from `DriverStateService（驱动状态服务）`.
2. Reject missing/expired active lease（活跃租约） with `LEASE_INVALID（租约无效）` or `LEASE_EXPIRED（租约过期）`.
3. Reject `CleanupPending（清理待完成）` for `precheckForStart（开始前检查）` and `startDeviceSession（启动设备会话）`.
4. Resolve each step by `semanticKey（语义键）` first.
5. Allow legacy signal name（旧信号名） fallback only in an internal whitelist（内部白名单）.
6. Verify address（地址） stays inside `allowedAddressRanges（授权地址范围）`.
7. Verify command（命令） is inside `allowedScopes（授权范围）`.
8. Write each step, then read back the same point（同一点位回读）.
9. Store confirmed result by `idempotencyKey（幂等键）`.

- [x] **Step 7: Replace Task 01 placeholder executor（替换任务一占位执行器）**

Modify `DriverEndpoints.cs`.

Rules（规则）:

1. Endpoint（端点） delegates to `PressDeviceCommandExecutor（压机设备命令执行器）`.
2. Keep Task 01 request boundary（请求边界） unchanged.
3. Map `PARTIAL_OK（部分成功）` to `200 OK（成功）`.
4. Map state/validation failures（状态/校验失败） to `400/409` with stable JSON（稳定 JSON）.

- [x] **Step 8: Run focused driver tests（运行驱动聚焦测试）**

Run:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~PressDeviceCommandExecutorTests|FullyQualifiedName~DeviceCommandContractTests|FullyQualifiedName~NModbusAdapterTests"
```

Expected（预期）:

```text
Passed! Semantic device commands write only authorized signals.
```

- [x] **Step 9: Commit or record no-git state（提交或记录非 Git 状态）**

If a Git repository（Git 仓库） is available:

```bash
git add driver-service/src driver-service/tests docs/press-working-device-actions-spec-plan/task-02-modbus-write-planner-and-semantic-command-executor.md
git commit -m "feat: 实现 Driver semantic command 写设备"
```

If no Git repository（Git 仓库） is available, update this task `Status（状态）` and `Progress（进度）` with the exact `git status --short --branch` result.

## Acceptance（验收）

- Driver Service（驱动服务） never reads endpoint/point/write value（端点/点位/写值） from HTTP request（HTTP 请求）.
- All write commands（写命令） use active lease（活跃租约） and signalConfig（信号配置）.
- Each write step（写入步骤） performs read-back confirmation（回读确认）.
- Duplicate `idempotencyKey（幂等键）` returns replay（重放） or `DEVICE_BUSY（设备忙）`, not duplicate write（重复写入）.
- `CleanupPending（清理待完成）` blocks the next `开始加工`.

# Task 04: Frontend Domain And Typed Clients

> @file 前端领域模型与 typed clients（类型化客户端）任务
> @author PopoY
> @created 2026-07-02
> @purpose 新增 QT App（Qt 应用）调用 Driver command（驱动命令）、device event stream（设备事件流）和 ERP Qt API（企业资源计划 Qt 接口）的最小客户端契约。

## Goal（目标）

Add typed frontend（类型化前端） surfaces for `executeDeviceCommand（执行设备命令）`, `subscribeDriverDeviceEvents（订阅设备事件）`, and ERP Qt endpoints（企业资源计划 Qt 端点） for start/complete/parameter/machine status（开始/完成/参数/设备状态）. All clients must narrow request/response fields（收窄请求/响应字段） and keep `sessionToken（会话令牌）` inside `erpClient（企业资源计划客户端）`.

## Status（状态）

- `Completed（已完成）`: 本轮只执行 Task 04，frontend domain models（前端领域模型）、Driver command client（驱动命令客户端）、device event stream client（设备事件流客户端）、ERP Qt clients（企业资源计划 Qt 客户端）和 diagnostic summary（诊断摘要）白名单已完成；未推进 Task 05+。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/8`。
- `2026-07-02`: Step 1 准备中，已确认本轮边界与文件范围，当前进度 `0/8`。
- `2026-07-02`: Step 1 已完成，已写入 Driver command（驱动命令）、SSE（服务器发送事件）、ERP Qt clients（企业资源计划客户端）和 diagnostic summary（诊断摘要）RED tests（失败测试），当前进度 `1/8`。
- `2026-07-02`: Step 2 已完成，聚焦测试按预期 RED（失败）：`buildPressDeviceCommandRequest`、`executePressDeviceCommand`、`driverDeviceEventsClient`、`startPressJob` 等尚未实现，当前进度 `2/8`。
- `2026-07-02`: Step 3 已完成，已新增 PressDevice command/event（压机设备命令/事件）、ERP Qt press job（企业资源计划压机作业）和 diagnostic summary（诊断摘要）白名单类型，当前进度 `3/8`。
- `2026-07-02`: Step 4 已完成，已实现 `buildPressDeviceCommandRequest` 和 `executePressDeviceCommand`，请求体仅保留五个白名单字段，当前进度 `4/8`。
- `2026-07-02`: Step 5 已完成，已新增 `subscribeDriverDeviceEvents` 与 `narrowPressDeviceEvent`，使用原生 EventSource（事件源）且不追加敏感 query params（查询参数），当前进度 `5/8`。
- `2026-07-02`: Step 6 已完成，已新增 `startPressJob`、`recordPressJobParameters`、`completePressJob`、`updatePressMachineStatus`，复用 ERP AjaxResult（企业资源计划响应包装）解包和 Authorization/X-Correlation-Id（授权/关联请求头），当前进度 `6/8`。
- `2026-07-02`: Step 7 已完成，`./node_modules/.bin/vitest run src/services/driverClient.test.ts src/services/driverDeviceEventsClient.test.ts src/services/erpClient.test.ts src/services/logging.test.ts` 通过，4 files / 41 tests passed（4 个文件 / 41 个测试通过），当前进度 `7/8`。
- `2026-07-02`: Step 8 已完成，当前目录 `git status --short --branch` 结果为 `fatal: not a git repository (or any of the parent directories): .git`；补充 regression（回归）验证 `pnpm exec tsc --noEmit` 通过，`pnpm test` 通过 18 files / 162 tests passed（18 个文件 / 162 个测试通过），`pnpm build` 成功且仅有 chunk size warning（包体大小警告），当前进度 `8/8`。

## Files（文件）

- Modify: `qt-app/frontend/src/domain/driver.ts`
- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/domain/logRecord.ts`
- Modify: `qt-app/frontend/src/services/driverClient.ts`
- Modify: `qt-app/frontend/src/services/driverClient.test.ts`
- Create: `qt-app/frontend/src/services/driverDeviceEventsClient.ts`
- Create: `qt-app/frontend/src/services/driverDeviceEventsClient.test.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/services/logging.test.ts`

## Client Contracts（客户端契约）

Driver command request（驱动命令请求）:

```json
{
  "correlationId": "press-start-001",
  "commandName": "startDeviceSession",
  "localJobSessionId": "press-job-row-001",
  "idempotencyKey": "press-start-001",
  "timeoutMs": 5000
}
```

ERP start request（企业资源计划开始请求）:

```json
{
  "correlationId": "press-start-001",
  "idempotencyKey": "press-start-001",
  "localJobSessionId": "press-job-row-001",
  "operatorId": "zhangsan",
  "teamId": "PLINE-01",
  "processId": "CRAFT-001",
  "expectedDuration": "1.5"
}
```

Machine status request（设备状态请求）:

```json
{
  "correlationId": "press-line-in-001",
  "idempotencyKey": "press-line-in-001",
  "localJobSessionId": "press-device-action-001",
  "status": "0",
  "reason": "lineIn"
}
```

## Steps（步骤）

- [x] **Step 1: Write RED client tests（编写失败的客户端测试）**

Modify `driverClient.test.ts`, `erpClient.test.ts`, `logging.test.ts`; create `driverDeviceEventsClient.test.ts`.

Test cases（测试用例）:

1. `executePressDeviceCommand（执行压机设备命令）` posts only five whitelist fields（白名单字段）.
2. Driver command request（驱动命令请求） drops or rejects `deviceId/ip/port/registerAddress/writeValue（设备/网络/点位/写值）`.
3. `subscribeDriverDeviceEvents（订阅设备事件）` opens `/deviceEvents/stream` without token（令牌） or lease（租约） query params（查询参数）.
4. Event payload（事件载荷） narrows to safe fields（安全字段）.
5. ERP start/complete/parameter/machine status clients（客户端） send `Authorization（授权请求头）` and `X-Correlation-Id（关联 ID 请求头）`.
6. ERP request bodies（请求体） do not include raw device/network fields（原始设备/网络字段）.
7. Diagnostic summary（诊断摘要） whitelist includes button/action/result（按钮/动作/结果） fields only.

Expected RED（预期失败）:

```text
executePressDeviceCommand, subscribeDriverDeviceEvents, startPressJob, completePressJob, recordPressJobParameters, updatePressMachineStatus are not exported.
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/driverClient.test.ts src/services/driverDeviceEventsClient.test.ts src/services/erpClient.test.ts src/services/logging.test.ts
```

Expected（预期）:

```text
FAIL（失败） because new typed clients are not implemented.
```

- [x] **Step 3: Add frontend domain models（新增前端领域模型）**

Modify `domain/driver.ts`.

Add types（新增类型）:

```text
PressDeviceCommandName
PressDeviceCommandRequest
PressDeviceCommandResponse
PressDeviceCommandResultCode
PressDeviceEventName
PressDeviceEvent
```

Modify `domain/pressJob.ts`.

Add types（新增类型）:

```text
PressJobStartRequest
PressJobStartResult
PressJobParameterRecordRequest
PressJobParameterRecordResult
PressJobCompleteRequest
PressJobCompleteResult
PressMachineStatusUpdateRequest
PressMachineStatusUpdateResult
PressDeviceActionButtonKey
PressDeviceActionIdentity
```

Rules（规则）:

1. No raw `deviceId/ip/port/registerAddress/writeValue（设备/网络/点位/写值）` types.
2. `expectedDuration（预计时长）` stays string（字符串） to preserve one-decimal validation（保留一位小数校验）.
3. `signalValues（信号值）` is `Record<string, unknown>` narrowed snapshot（收窄快照） only.

- [x] **Step 4: Implement driver command client（实现驱动命令客户端）**

Modify `services/driverClient.ts`.

Add exports（新增导出）:

```text
buildPressDeviceCommandRequest
executePressDeviceCommand
```

Rules（规则）:

1. `buildPressDeviceCommandRequest（构建请求）` returns exactly `correlationId`, `commandName`, `localJobSessionId`, `idempotencyKey`, `timeoutMs`.
2. `executePressDeviceCommand（执行命令）` posts to `/executeDeviceCommand`.
3. Response narrowing（响应收窄） keeps `completedSteps（完成步骤）` and `failedSteps（失败步骤）` arrays only.
4. Timeout error（超时错误） remains `DEVICE_TIMEOUT（设备超时）`.

- [x] **Step 5: Implement device event client（实现设备事件客户端）**

Create `services/driverDeviceEventsClient.ts`.

Exports（导出）:

```text
subscribeDriverDeviceEvents(driverBaseUrl, onEvent, onError)
narrowPressDeviceEvent(raw)
```

Rules（规则）:

1. Use native `EventSource（事件源）`; no dependency（依赖）.
2. URL is `/deviceEvents/stream`.
3. Do not append `sessionToken（会话令牌）`, `signedLease（签名租约）`, `signature（签名）`, or `signalConfig（信号配置）`.
4. `close()` must be returned for cleanup（清理）.
5. Invalid event JSON（无效事件数据） calls `onError（错误回调）` with Chinese summary（中文摘要）.

- [x] **Step 6: Implement ERP Qt clients（实现企业资源计划 Qt 客户端）**

Modify `services/erpClient.ts`.

Add exports（新增导出）:

```text
startPressJob
recordPressJobParameters
completePressJob
updatePressMachineStatus
```

Paths（路径）:

```text
POST /api/qt/press-working/press-job-starts
POST /api/qt/press-working/press-job-parameters
POST /api/qt/press-working/press-job-completions
POST /api/qt/press-working/machine-status
```

Rules（规则）:

1. Use existing `unwrapErpAjaxResult（ERP 响应解包）`.
2. Use `Authorization: Bearer <sessionToken>` inside client（客户端内部）.
3. Add `X-Correlation-Id（关联 ID 请求头）`.
4. Request narrowing（请求收窄） rejects/drops raw device/network fields（原始设备/网络字段）.
5. Error messages（错误消息） are Chinese and sanitized（已脱敏）.

- [x] **Step 7: Run focused client tests（运行客户端聚焦测试）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/driverClient.test.ts src/services/driverDeviceEventsClient.test.ts src/services/erpClient.test.ts src/services/logging.test.ts
```

Expected（预期）:

```text
PASS（通过） all typed client whitelist and narrowing tests.
```

- [x] **Step 8: Commit or record no-git state（提交或记录非 Git 状态）**

If a Git repository（Git 仓库） is available:

```bash
git add qt-app/frontend/src docs/press-working-device-actions-spec-plan/task-04-frontend-domain-and-typed-clients.md
git commit -m "feat: 新增压机设备动作 typed clients"
```

If no Git repository（Git 仓库） is available, update this task `Status（状态）` and `Progress（进度）` with the exact `git status --short --branch` result.

## Acceptance（验收）

- Frontend clients（前端客户端） expose all needed typed functions（类型函数）.
- Driver command request（驱动命令请求） contains only whitelist fields（白名单字段）.
- Event subscription（事件订阅） does not leak token/lease/config（令牌/租约/配置）.
- ERP Qt clients（企业资源计划 Qt 客户端） cover start, parameter, complete, and machine status（开始/参数/完成/设备状态）.
- No new dependency（依赖） is added.

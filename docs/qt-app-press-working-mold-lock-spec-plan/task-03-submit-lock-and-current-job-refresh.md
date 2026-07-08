# Task 03: Submit Lock And Refresh Current Jobs

> @file QT App 锁模提交与当前作业刷新任务
> @author PopoY
> @created 2026-06-30
> @purpose 接入真实锁模提交、中文错误处理、白名单 diagnostic log（诊断日志）摘要和 current jobs（当前作业）局部刷新。

## Goal（目标）

Wire the Task 01（任务一） ERP client（客户端） and Task 02（任务二） panel（面板） together. A confirmed lock must submit exactly one selected row in the spec-compatible array shape, show sanitized Chinese feedback（中文反馈）, record only whitelisted diagnostic summary（诊断摘要）, and refresh only `current jobs（当前作业）`.

## Status（状态）

- `Completed（已完成）`: Task3 submit/refresh/logging（提交/刷新/日志）链路已实现并通过验证；当前环境不是 Git repository（Git 仓库），未提交 commit（提交）。

## Progress（进度）

- `2026-06-30`: 计划已落库，当前进度 `0/9`。
- `2026-06-30`: Step 1 已完成，写入 submit（提交）、refresh（刷新）和 logging（日志）RED tests（失败测试），当前进度 `1/9`。
- `2026-06-30`: Step 2 已完成，focused tests（聚焦测试）按预期失败在缺少 lock submit（锁模提交）、refresh（刷新）和 diagnostic summary（诊断摘要）接线上，当前进度 `2/9`。
- `2026-06-30`: Step 3 已完成，仅为 `LogRecord（日志记录）` 增加 `moldNo/operatorId/teamId/processId` 四个可选白名单字段，当前进度 `3/9`。
- `2026-06-30`: Step 4 已完成，`App（应用层）` 新增 current jobs state（当前作业状态）以及 lock/refresh/diagnostic callbacks（锁模/刷新/诊断回调），当前进度 `4/9`。
- `2026-06-30`: Step 5 已完成，`PressJobPage（压机作业页）` 已构造单行锁模请求并通过 injected callback（注入回调）提交，当前进度 `5/9`。
- `2026-06-30`: Step 6 已完成，成功展示 `锁定完成` 并局部刷新 current jobs（当前作业），失败展示中文脱敏错误并记录诊断摘要，当前进度 `6/9`。
- `2026-06-30`: Step 7 已完成，action-handler safety tests（操作处理函数安全测试）已改为允许锁模注入回调和 Ant Design feedback（组件库反馈），当前进度 `7/9`。
- `2026-06-30`: Review fixes（评审修复）已完成，补充 refresh failure（刷新失败）独立结果码 `CURRENT_JOB_REFRESH_FAILED`、中文/English token（英文令牌）敏感词脱敏和注释契约修正。
- `2026-06-30`: Post-review P1 fix（复核后高优先级修复）已完成，`resolvePressMoldLockErrorMessage（锁模错误文案解析）` 新增 raw network endpoint（原始网络端点）格式脱敏，覆盖 IPv4 literal（IPv4 字面量）和 host:port（主机端口）泄漏风险；`PressJobPage.test.tsx` 已按 RED -> GREEN 验证。
- `2026-06-30`: 最终只读 review（评审）未发现 blocker（阻塞问题）或 Task3 scope（范围）越界。
- `2026-06-30`: Step 8 已完成，最终重跑 focused tests（聚焦测试）`48/48`、`pnpm test` `131/131`、`pnpm build` 均通过；build（构建）仅有 Vite chunk-size warning（包体积告警），当前进度 `8/9`。
- `2026-06-30`: Step 9 已完成，`git status --short --branch` 返回当前目录不是 Git repository（Git 仓库），因此未创建 commit（提交），当前进度 `9/9`。

## Files（文件）

- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify: `qt-app/frontend/src/domain/logRecord.ts`
- Modify: `qt-app/frontend/src/services/logging.test.ts`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## Refresh Boundary（刷新边界）

Allowed after successful mold lock（锁模成功后允许）:

```text
fetchPressJobCurrentJobs（读取当前作业）
set local currentJobRows state（更新本地当前作业状态）
```

Forbidden after successful mold lock（锁模成功后禁止）:

```text
bootstrapSession.retry（启动会话重试）
loadBootstrapSession（重新启动引导）
fetchLeasePackage（重新申请租约）
applyLeaseAndConfig（应用租约和配置）
Driver Service（驱动服务） calls
```

## Steps（步骤）

- [x] **Step 1: Write RED submit, refresh, and logging tests（编写失败的提交、刷新和日志测试）**

Modify:

```text
qt-app/frontend/src/components/PressJobPage.test.tsx
qt-app/frontend/src/App.test.tsx
qt-app/frontend/src/services/logging.test.ts
```

Add tests（测试） that assert:

1. Confirm button（确认按钮） validates selected mold（选中模具） and opens confirmation text `是否确认锁定「MOLD-01」模具？`.
2. Confirmed submit（确认提交） calls injected `lockPressMold（锁定模具）` with `operatorId`, `teamId`, `processId`, `selectedRows`, and `correlationId`.
3. Submit payload（提交载荷） contains no `deviceId`, `ip`, or `port`.
4. Success shows `锁定完成`, closes panel（面板）, and calls `refreshPressJobCurrentJobs（刷新当前作业）`.
5. App-level refresh（应用层刷新） updates the table with the new `moldNo（模具号）`.
6. Refresh does not call `bootstrapSession.retry（启动会话重试）`.
7. ERP Chinese business error（中文业务错误） is shown as-is.
8. Unknown error（未知错误） shows `锁定失败，请查看诊断信息后重试。`.
9. Diagnostic log（诊断日志） record includes only `correlationId`, `moldNo`, `operatorId`, `teamId`, `processId`, `commandName`, `durationMs`, `resultCode`, and `stationAccountId`.
10. Diagnostic log（诊断日志） record does not include full `selectedRows（选中行）`, raw response（原始响应）, token（令牌）, `signedLease（签名租约）`, or `signalConfig（信号配置）`.

Expected RED（预期失败）:

```text
refreshPressJobCurrentJobs prop（属性） does not exist.
recordPressMoldLockDiagnostic prop（属性） does not exist.
LogRecord（日志记录） does not allow mold lock summary fields yet.
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx src/services/logging.test.ts
```

Expected（预期）:

```text
FAIL（失败） because submit, refresh, and lock summary logging are not wired.
```

- [x] **Step 3: Extend log record whitelist（扩展日志白名单）**

Modify `qt-app/frontend/src/domain/logRecord.ts`.

Add optional fields（可选字段） only:

```ts
moldNo?: string;
operatorId?: string;
teamId?: string;
processId?: string;
```

Rules:

1. Do not add `selectedRows（选中行）`.
2. Do not add `requestBody（请求体）` or `responseBody（响应体）`.
3. Do not add `sessionToken（会话令牌）`, `signedLease（签名租约）`, `signature（签名）`, or `signalConfig（信号配置）`.

- [x] **Step 4: Add local current jobs state and injected callbacks in App（在应用中新增当前作业状态与注入回调）**

Modify `qt-app/frontend/src/App.tsx`.

Implementation rules（实现规则）:

1. Add `pressJobCurrentRows（当前作业行）` state initialized from `bootstrapSession.data.pressJobCurrentJobs`.
2. Use `useEffect（副作用钩子）` to resync rows when bootstrap data（启动数据） changes.
3. Add `searchPressMoldCandidates（查询候选模具）` callback using `fetchPressMoldCandidates(getJson, ...)`.
4. Add `lockPressMold（锁定模具）` callback using `lockPressMold(postJson, ...)`.
5. Add `refreshPressJobCurrentJobs（刷新当前作业）` callback using `fetchPressJobCurrentJobs(getJson, ...)` and update local rows.
6. Add `recordPressMoldLockDiagnostic（记录锁模诊断摘要）` callback using `logDiagnostic（诊断日志）`.
7. Pass callbacks and `currentJobRows={pressJobCurrentRows}` to `PressJobPage（压机作业页）`.
8. Do not call `useDriverSession（驱动会话 hook）` or `driverClient（驱动客户端）` from the lock flow.

- [x] **Step 5: Submit selected mold from PressJobPage（从压机作业页提交选中模具）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Extend props（属性）:

```ts
lockPressMold?: (request: PressMoldLockRequest) => Promise<PressMoldLockResult>;
refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
recordPressMoldLockDiagnostic?: (summary: {
  correlationId: string;
  durationMs: number;
  moldNo?: string;
  operatorId?: string;
  teamId?: string;
  processId?: string;
  resultCode: string;
}) => void;
```

Submit rules（提交规则）:

1. Re-run `validatePressMoldLockSelection（选中行校验）` immediately before confirmation.
2. Use `modal.confirm（确认框）` text `是否确认锁定「{moldNo}」模具？`.
3. Build `PressMoldLockRequest（锁模请求）` from current filters（筛选） and selected row（选中行）.
4. `selectedRows（选中行数组）` must contain one row.
5. Do not append raw `deviceId/ip/port（设备/网络字段）`.
6. Disable submit button（提交按钮） while submit is in-flight（进行中）.

- [x] **Step 6: Handle success, failure, and cleanup（处理成功、失败与清理）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Success rules（成功规则）:

1. Show `锁定完成`.
2. Call `refreshPressJobCurrentJobs（刷新当前作业）`.
3. Close panel（面板） and clear candidates（候选）.
4. Record diagnostic summary（诊断摘要） with `resultCode: "OK"`.

Failure rules（失败规则）:

1. Show ERP Chinese error（企业资源计划中文错误） when available.
2. Unknown error（未知错误） -> `锁定失败，请查看诊断信息后重试。`.
3. Do not render stack trace（堆栈）.
4. Do not render raw response（原始响应）.
5. Record diagnostic summary（诊断摘要） with stable `resultCode` such as `ERP_MOLD_LOCK_FAILED`.

- [x] **Step 7: Update action-handler safety tests（更新操作处理函数安全测试）**

Modify `qt-app/frontend/src/components/PressJobPage.test.tsx`.

Replace the old blanket assertion（旧的全量断言） that forbids `message.` or every backend call（后端调用） in `PressJobPage.tsx`.

New contract（新契约）:

1. Non-lock handlers（非锁模操作） remain no-op.
2. `PressJobPage（压机作业页）` still does not import `erpClient（ERP 客户端）`, `driverClient（驱动客户端）`, or `logDiagnostic（诊断日志）`.
3. `PressJobPage（压机作业页）` still does not read `localStorage（本地存储）`.
4. Lock flow（锁模流程） can use injected props（注入属性） and Ant Design（组件库） message/modal（消息/确认框）.

- [x] **Step 8: Run focused tests, regression, and build（运行聚焦测试、回归与构建）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx src/services/logging.test.ts
pnpm test
pnpm build
```

Expected（预期）:

```text
PASS（通过） focused tests.
PASS（通过） full frontend tests.
PASS（通过） build, with existing Vite chunk-size warning（包体积告警） allowed.
```

- [x] **Step 9: Update task progress and commit when possible（回写任务进度并在可用时提交）**

Update this file’s `Progress（进度）` after each completed step.

Run:

```bash
git status --short --branch
```

If a Git repository（Git 仓库） is available in the execution environment, commit message（提交消息）:

```text
feat: 接入 QT App 锁模提交和当前作业刷新
```

## Acceptance Criteria（验收标准）

1. Confirmed lock calls `POST /api/qt/press-working/mold-locks` through injected app callback（应用回调）.
2. Request body（请求体） contains `operatorId`, `teamId`, `processId`, `selectedRows`, and `correlationId`.
3. Request body（请求体） contains no raw `deviceId/ip/port（设备/网络字段）`.
4. Success refreshes only current jobs（当前作业）.
5. Success does not call bootstrap retry（启动重试）, lease refresh（租约刷新）, Driver Service（驱动服务）, polling（轮询）, or WebSocket（网页套接字）.
6. Failure messages are Chinese and sanitized.
7. Diagnostic logging（诊断日志） records only whitelist summary（白名单摘要）.

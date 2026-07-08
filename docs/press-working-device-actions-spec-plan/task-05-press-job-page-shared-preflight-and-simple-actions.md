# Task 05: PressJobPage Shared Preflight And Simple Actions

> @file PressJobPage（压机作业页）通用前置校验与简单动作任务
> @author PopoY
> @created 2026-07-02
> @purpose 将七按钮中的简单设备动作接入 `PressJobPage（压机作业页）`，并补齐 shared preflight（通用前置校验）、loading state（加载状态）和 fail closed（失败关闭）边界。

## Goal（目标）

Turn placeholder（占位） handlers for `建立通信 / 移入 / 普通移出 / 入线 / 普通出线` into real actions using injected callbacks（注入回调）. This task deliberately leaves `开始加工 / 完成加工` and completion reuse（完工复用） for Task 06, because those flows need ERP transaction order（企业资源计划事务顺序）, rollback（回滚）, cleanup（收尾）, and monitor（监测）.

## Status（状态）

- `Completed（已完成）`: 本轮只处理 Task 05，shared preflight（通用前置校验）、simple actions（简单动作）和 no-git state（非 Git 状态）记录已完成；未推进 Task 06+。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/9`。
- `2026-07-02`: 本轮开始执行 Task 05；`git status --short --branch` 在 wrapper（外层目录）、`driver-service`、`qt-app` 均返回 `fatal: not a git repository (or any of the parent directories): .git`，当前进度 `0/9`。
- `2026-07-02`: Step 1 completed（已完成），已在 `PressJobPage.test.tsx` 增加 shared preflight（通用前置校验）、action identity（动作身份）、simple action flow（简单动作流程）和 injected callback（注入回调）契约测试；当前进度 `1/9`。
- `2026-07-02`: Step 2 completed（已完成），运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 得到 expected RED（预期失败）：45 tests（测试）中 5 failed（失败），失败点为 Task 05 尚未实现的 helper（辅助函数）/flow（流程）/injected props（注入属性）；当前进度 `2/9`。
- `2026-07-02`: Step 3 completed（已完成），`PressJobPage.tsx` 已新增 `executePressDeviceCommand`、`updatePressMachineStatus`、`refreshSignalSnapshot`、`recordPressDeviceActionDiagnostic` injected props（注入属性），未直接导入 Driver/ERP/logging clients（客户端）；当前进度 `3/9`。
- `2026-07-02`: Step 4 completed（已完成），已实现 `createPressDeviceActionIdentity`、`validateSharedPressDeviceActionPreflight`、`readPrimaryCurrentJob`、`isCurrentJobStateKnown`，并保持中文 fail-closed（失败关闭）提示；当前进度 `4/9`。
- `2026-07-02`: Step 5 completed（已完成），`建立通信` 已接入 retry（重试）与 `connectMes`，按 `OK/PARTIAL_OK` 展示中文反馈并刷新 signal snapshot（信号快照）；当前进度 `5/9`。
- `2026-07-02`: Step 6 completed（已完成），`移入/普通移出` 已分别接入 `moveIn/moveOut`，成功后刷新 signal snapshot（信号快照），失败展示统一中文诊断提示；当前进度 `6/9`。
- `2026-07-02`: Step 7 completed（已完成），`入线/普通出线` 已用同一个 `correlationId` 并联 Driver command（驱动命令）与 ERP machine status（企业资源计划设备状态），并按成功侧刷新 snapshot/current jobs（快照/当前作业）；当前进度 `7/9`。
- `2026-07-02`: Step 8 completed（已完成），运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx`，结果 `45 tests passed（45 个测试通过）`；当前进度 `8/9`。
- `2026-07-02`: Regression verification（回归验证）已运行：`pnpm test` 通过 `18 files / 166 tests`，`pnpm build` exit 0（保留 Vite chunk size warning，非失败）。
- `2026-07-02`: Step 9 completed（已完成），wrapper（外层目录）、`driver-service`、`qt-app` 再次执行 `git status --short --branch` 均返回 `fatal: not a git repository (or any of the parent directories): .git`；未创建 commit（提交）；当前进度 `9/9`。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modify: `qt-app/frontend/src/domain/pressJob.ts`

## Preflight（前置校验）

Required for high-risk actions（高风险动作）:

```text
bootstrap session ready（启动会话就绪）
driver lease active（驱动租约活跃）
deviceSessionState == Connected（设备会话已连接）
teamId selected（已选班组）
operatorId selected（已选人员）
processId selected（已选预选工艺）
current jobs query succeeded / state known（当前作业查询成功/状态已知）
same button not pending（同一按钮无挂起请求）
```

`建立通信` special rule（特殊规则）:

```text
If driver is not Connected（已连接）, it may call existing driver retry（既有驱动重试） first. Retry must reuse applyLeaseAndConfig/getSignalSnapshot（应用租约/获取快照） only.
```

## Steps（步骤）

- [x] **Step 1: Write RED PressJobPage tests（编写失败的页面测试）**

Modify `PressJobPage.test.tsx`.

Test cases（测试用例）:

1. Missing team/operator/process（缺少班组/人员/工艺） shows Chinese message（中文提示） before command call（命令调用）.
2. Driver not connected（驱动未连接） blocks `移入 / 移出 / 入线 / 出线`.
3. `建立通信` calls retry first when driver is not connected（未连接时先重试）.
4. `建立通信` calls command `connectMes`.
5. `移入` calls command `moveIn` and refreshes signal snapshot（刷新信号快照）.
6. Normal `移出` calls command `moveOut` and refreshes signal snapshot（刷新信号快照）.
7. `入线` calls Driver command（驱动命令） and ERP machine status（设备状态） with same `correlationId（关联 ID）`.
8. Normal `出线` calls `lineOut` and status `9`.
9. Pending button（挂起按钮） disables duplicate click（重复点击）.
10. State unknown（状态未知） fail closed（失败关闭） for high-risk buttons.

Expected RED（预期失败）:

```text
Placeholder handlers still only show "功能建设中".
```

- [x] **Step 2: Run page tests and confirm RED（运行页面测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） because real action callbacks are not wired.
```

- [x] **Step 3: Add PressJobPage action props（新增页面动作属性）**

Modify `PressJobPage.tsx`.

Add props（新增属性）:

```text
executePressDeviceCommand(input): Promise<PressDeviceCommandResponse>
updatePressMachineStatus(input): Promise<PressMachineStatusUpdateResult>
refreshSignalSnapshot(): Promise<unknown>
recordPressDeviceActionDiagnostic(summary): void
```

Rules（规则）:

1. Keep clients injected（保持客户端注入）.
2. Do not import `driverClient（驱动客户端）`, `erpClient（企业资源计划客户端）`, or `logging（日志服务）`.
3. Do not pass raw token/lease/signalConfig（令牌/租约/信号配置） into props（属性）.

- [x] **Step 4: Add identity and preflight helpers（新增身份与前置校验辅助函数）**

Modify `PressJobPage.tsx`.

Helper behavior（辅助行为）:

```text
createPressDeviceActionIdentity(buttonKey, currentJobRow?)
validateSharedPressDeviceActionPreflight(buttonKey, filters, driverSession, currentJobRows)
readPrimaryCurrentJob(currentJobRows)
isCurrentJobStateKnown(currentJobRows)
```

Messages（提示）:

```text
请先选择班组。
请先选择人员。
请先选择预选工艺。
当前作业状态未确认，请刷新后重试。
设备授权未就绪，请稍后重试。
```

- [x] **Step 5: Implement `建立通信`（实现建立通信）**

Rules（规则）:

1. If driver not connected（驱动未连接）, call existing `driverSession.retry（重试）` if available.
2. After retry（重试）, only continue if active lease（活跃租约） and connected（已连接）.
3. Call `executePressDeviceCommand（执行驱动命令）` with `connectMes`.
4. `PARTIAL_OK（部分成功）` message: `通信已建立，附属步骤需要关注，请查看诊断日志。`
5. Success message（成功提示）: `通信已建立。`
6. Refresh signal snapshot（刷新信号快照） after driver success/partial success（成功/部分成功）.

- [x] **Step 6: Implement `移入 / 普通移出`（实现移入与普通移出）**

Rules（规则）:

1. `移入` calls command（命令） `moveIn`.
2. Normal `移出` calls command（命令） `moveOut`.
3. Success messages（成功提示）:

```text
移入信号已下发。
移出信号已下发。
```

4. Driver failure（驱动失败） shows `设备动作失败，请查看诊断日志后重试。`
5. Refresh signal snapshot（刷新信号快照） after command success（命令成功）.

- [x] **Step 7: Implement `入线 / 普通出线`（实现入线与普通出线）**

Rules（规则）:

1. `入线` calls command（命令） `lineIn` and ERP status（企业资源计划状态） `0`, reason（原因） `lineIn`.
2. Normal `出线` calls command（命令） `lineOut` and ERP status（企业资源计划状态） `9`, reason（原因） `lineOut`.
3. Use the same `correlationId（关联 ID）` for Driver and ERP.
4. Use `Promise.allSettled（全部完成结算）`.
5. If one side succeeds and one fails, show `部分动作完成，请查看诊断日志。`
6. Refresh signal snapshot（信号快照） when Driver succeeds.
7. Refresh current jobs（当前作业） when ERP succeeds.

- [x] **Step 8: Run focused page tests（运行页面聚焦测试）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
PASS（通过） shared preflight and simple action tests.
```

- [x] **Step 9: Commit or record no-git state（提交或记录非 Git 状态）**

If a Git repository（Git 仓库） is available:

```bash
git add qt-app/frontend/src/components qt-app/frontend/src/domain docs/press-working-device-actions-spec-plan/task-05-press-job-page-shared-preflight-and-simple-actions.md
git commit -m "feat: 接入压机设备简单动作"
```

If no Git repository（Git 仓库） is available, update this task `Status（状态）` and `Progress（进度）` with the exact `git status --short --branch` result.

## Acceptance（验收）

- `建立通信 / 移入 / 普通移出 / 入线 / 普通出线` are real action entries（真实动作入口）.
- High-risk actions（高风险动作） fail closed（失败关闭） when driver/current job state（驱动/当前作业状态） is unknown.
- Every button has independent loading state（独立加载状态） and duplicate click protection（防重复点击）.
- `入线 / 出线` share `correlationId（关联 ID）` across Driver and ERP.
- No Web polling（网页轮询） is introduced.

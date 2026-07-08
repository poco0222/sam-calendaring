# Task 06: Start Complete And Reused Completion Workflows

> @file 开始加工、完成加工与复用完工流程任务
> @author PopoY
> @created 2026-07-02
> @purpose 实现 `开始加工 / 完成加工` 真实业务流，并让加工中 `移出 / 出线` 复用 completion workflow（完工流程）。

## Goal（目标）

Implement the two risky workflows（高风险流程） with correct order and compensation（补偿）: `开始加工` runs Driver precheck/start before ERP start and rolls back Driver if ERP fails; `完成加工` records final parameters before ERP completion and only cleans up Driver after ERP success. `移出` with change mold（换模） and `出线` while running（加工中） must reuse the same completion workflow（完工流程）.

## Status（状态）

- `Completed（已完成）`: 本轮续接只处理 Task 06，已修复非加工中 `出线` shared preflight（通用前置校验）回归并完成 focused/regression frontend verification（聚焦/回归前端验证）；未推进 Task 07。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/10`。
- `2026-07-02`: Step 1 已完成，已在 `PressJobPage.test.tsx` 和 `App.test.tsx` 新增开始加工、完成加工、复用完工、阈值事件和无前端 polling（轮询）RED tests（失败测试），当前进度 `1/10`。
- `2026-07-02`: Step 2 已完成，运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx`，确认新增 RED tests（失败测试）因 Task6 workflow/helper/App handler 尚未实现而失败：`7 failed | 51 passed`，当前进度 `2/10`。
- `2026-07-02`: Step 3 已完成，`PressJobPage` 已新增 start/complete/parameter/final snapshot props（属性）和 start/complete request builder（请求构造）及 preflight helpers（前置校验辅助函数），当前进度 `3/10`。
- `2026-07-02`: Step 4 已完成，开始加工 workflow（流程）已按 `precheckForStart -> startDeviceSession -> ERP start -> rollback/monitor` 顺序实现，当前进度 `4/10`。
- `2026-07-02`: Step 5 已完成，完成加工 workflow（流程）已按 `final snapshot -> type=end parameter -> ERP complete -> cleanup` 顺序实现，当前进度 `5/10`。
- `2026-07-02`: Step 6 已完成，加工中 `移出` 已通过确认路径复用 completion workflow（完工流程）后再执行 `moveOut`，当前进度 `6/10`。
- `2026-07-02`: Step 7 已完成，加工中 `出线` 已按中文确认后复用 completion workflow（完工流程），再执行 `lineOut` 和 ERP status `9`，当前进度 `7/10`。
- `2026-07-02`: Step 8 已完成，`App.tsx` 已接入 Driver event stream（驱动事件流）并用 `localJobSessionId + type=start` dedupe（去重）记录开始参数，当前进度 `8/10`。
- `2026-07-02`: Step 9 已完成，运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx`，结果 `2 passed / 58 passed`，当前进度 `9/10`。
- `2026-07-02`: Step 10 已完成，当前目录不是 Git repository（Git 仓库），`git status --short --branch` 输出 `fatal: not a git repository (or any of the parent directories): .git`；额外运行 `pnpm test` 结果 `18 passed / 174 passed`，`pnpm build` 成功但保留 Vite chunk size warning（分块大小警告），当前进度 `10/10`。
- `2026-07-02`: 续接 Step 9 复核时新增非加工中 `出线` shared preflight（通用前置校验）regression test（回归测试），确认 RED（失败）：`1 failed | 58 passed`，失败点为 `executePressJobLineOutWorkflow` 未先拦截缺少 `processId（工艺 ID）`，当前进度 `9/10`。
- `2026-07-02`: 续接 Step 9 已修复非加工中 `出线` shared preflight（通用前置校验）回归，运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx`，结果 `2 passed / 59 passed`，当前进度 `9/10`。
- `2026-07-02`: 续接 Step 10 已完成，运行 `pnpm test` 结果 `18 passed / 175 passed`；运行 `pnpm build` 成功，保留 Vite chunk size warning（分块大小警告）；当前目录不是 Git repository（Git 仓库），`git status --short --branch` 输出 `fatal: not a git repository (or any of the parent directories): .git`，当前进度 `10/10`。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`

## Workflow Order（流程顺序）

Start processing（开始加工）:

```text
validate pending job + locked mold + expectedDuration
execute precheckForStart
execute startDeviceSession
ERP startPressJob
if ERP fails -> execute rollbackStartSignal
if needParameterRecords -> execute startPressDownCountMonitor
refresh current jobs + signal snapshot
```

Complete processing（完成加工）:

```text
validate running job + locked mold + localJobSessionId
get final signal snapshot
ERP recordPressJobParameters(type=end)
ERP completePressJob(status=3)
execute cleanupDeviceSession
refresh current jobs + signal snapshot
```

## Steps（步骤）

- [x] **Step 1: Write RED workflow tests（编写失败的流程测试）**

Modify `PressJobPage.test.tsx` and `App.test.tsx`.

Test cases（测试用例）:

1. `开始加工` rejects status not `0（待加工）`.
2. `开始加工` rejects missing locked mold（缺少已锁模）.
3. `开始加工` validates `expectedDuration（预计时长）` as positive integer or one-decimal number（正整数或一位小数）.
4. `开始加工` runs `precheckForStart -> startDeviceSession -> ERP start`.
5. ERP start failure（开始落库失败） calls `rollbackStartSignal（回滚开始信号）`.
6. Monitor start failure（监测启动失败） does not rollback successful ERP start（不回滚已开始加工）.
7. `完成加工` runs `final snapshot -> type=end parameter -> ERP complete -> cleanup`.
8. Parameter failure（参数失败） prevents ERP complete（阻止完工落库）.
9. ERP complete failure（完工失败） prevents cleanup（阻止收尾）.
10. Cleanup failure（收尾失败） shows cleanup pending message（清理待完成提示）.
11. Running `出线` confirms and reuses completion workflow（加工中出线确认并复用完工）.
12. Change mold `移出` confirms and reuses completion workflow（换模移出确认并复用完工）.
13. Frontend source（前端源码） contains no `setInterval/requestAnimationFrame（定时器/动画帧）` for `pressDownCount（下压计数）`.

Expected RED（预期失败）:

```text
Start and complete handlers are still placeholders or simple actions only.
```

- [x] **Step 2: Run workflow tests and confirm RED（运行流程测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx
```

Expected（预期）:

```text
FAIL（失败） because start/complete workflows are not implemented.
```

- [x] **Step 3: Add workflow props and helpers（新增流程属性与辅助函数）**

Modify `PressJobPage.tsx`.

Add props（新增属性）:

```text
startPressJob(input)
recordPressJobParameters(input)
completePressJob(input)
getFinalSignalSnapshot(input)
```

Add helpers（新增辅助函数）:

```text
validateStartPressJobPreflight
validateCompletePressJobPreflight
buildPressJobStartRequest
buildPressJobCompleteRequest
buildPressJobParameterRequest
runCompletePressJobWorkflow
```

Rules（规则）:

1. Use current row `localJobSessionId（本地作业会话 ID）` when available.
2. Generate `press-device-action-*` only when no current job row（当前作业行） is available for simple device action（简单设备动作）.
3. Keep parameter snapshot（参数快照） out of diagnostic summary（诊断摘要）.

- [x] **Step 4: Implement start workflow（实现开始加工流程）**

Rules（规则）:

1. Status must be `0`.
2. At least one locked mold（已锁定模具） must exist.
3. `expectedDuration（预计时长）` must match:

```text
^(?:[1-9]\d*|0\.[1-9]|[1-9]\d*\.\d)$
```

4. Reject `CleanupPending（清理待完成）`.
5. Execute Driver `precheckForStart（开始前检查）`.
6. Execute Driver `startDeviceSession（启动设备会话）`.
7. Call ERP `startPressJob（开始加工）`.
8. If ERP start fails（开始落库失败）, call Driver `rollbackStartSignal（回滚开始信号）`.
9. If `needParameterRecords（需要参数记录）` is true, call Driver `startPressDownCountMonitor（启动下压计数监测）`.
10. Monitor failure（监测失败） shows: `开始加工已完成，开始参数监听未启动，请查看诊断日志。`

- [x] **Step 5: Implement complete workflow（实现完成加工流程）**

Rules（规则）:

1. Status must be `1`.
2. At least one locked mold（已锁定模具） must exist.
3. `localJobSessionId（本地作业会话 ID）` must be present.
4. Fetch final signal snapshot（最终信号快照） using existing Driver snapshot callback（快照回调）.
5. Call ERP `recordPressJobParameters（记录参数）` with `type=end`.
6. Call ERP `completePressJob（完成加工）` with `status=3`.
7. Only after ERP success（成功） call Driver `cleanupDeviceSession（清理设备会话）`.
8. Cleanup failure（收尾失败） shows: `完成加工已落库，设备收尾失败，请查看诊断日志并处理。`

- [x] **Step 6: Reuse completion for change-mold move out（换模移出复用完工）**

Rules（规则）:

1. Add change mold（换模） confirm path（确认路径） for `移出`.
2. If current job status（状态） is `1`, show Chinese confirm（中文确认） before workflow（流程）.
3. If confirm accepted（确认）, run complete workflow（完工流程） first.
4. Only after complete workflow success（完工成功） execute `moveOut（移出）`.
5. Any failed stage（失败阶段） shows partial result（部分结果） and records diagnostic summary（诊断摘要）.

- [x] **Step 7: Reuse completion for running line out（加工中出线复用完工）**

Rules（规则）:

1. If current job status（状态） is `1`, show: `当前有正在加工的模具，出线将自动完成加工，是否确认出线？`
2. If canceled（取消）, do not call Driver or ERP.
3. If confirmed（确认）, run complete workflow（完工流程） first.
4. Then run `lineOut（出线）` Driver command（驱动命令） and ERP status（状态） `9` with same `correlationId（关联 ID）`.
5. If current jobs failed or status missing（状态缺失）, fail closed（失败关闭）.

- [x] **Step 8: Wire App handlers for parameter threshold events（接入 App 阈值事件处理）**

Modify `App.tsx`.

Handler behavior（处理行为）:

```text
handlePressParameterThresholdReached(event)
```

Rules（规则）:

1. Only handle `eventName=pressDownCountThresholdReached`.
2. Use `event.parameterIdempotencyKey（参数幂等键）` as ERP parameter `idempotencyKey（幂等键）`.
3. Use `type=start`.
4. Send only `event.snapshotValues（事件快照值）`.
5. Deduplicate same `localJobSessionId + type=start（本地作业会话 ID + 类型）`.
6. Duplicate event（重复事件） records light diagnostic summary（轻量诊断摘要） and does not call ERP again.

- [x] **Step 9: Run focused workflow tests（运行流程聚焦测试）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx
```

Expected（预期）:

```text
PASS（通过） start, complete, rollback, cleanup, and reused completion workflows.
```

- [x] **Step 10: Commit or record no-git state（提交或记录非 Git 状态）**

If a Git repository（Git 仓库） is available:

```bash
git add qt-app/frontend/src docs/press-working-device-actions-spec-plan/task-06-start-complete-and-reused-completion-workflows.md
git commit -m "feat: 实现压机开始完工动作编排"
```

If no Git repository（Git 仓库） is available, update this task `Status（状态）` and `Progress（进度）` with the exact `git status --short --branch` result.

## Acceptance（验收）

- `开始加工` order（顺序） and rollback（回滚） match spec（规格）.
- `完成加工` does not cleanup（收尾） until parameter record（参数记录） and ERP complete（完工落库） succeed.
- Cleanup failure（收尾失败） leaves visible `CleanupPending（清理待完成）` behavior.
- Running `出线` and change-mold `移出` reuse the same completion workflow（完工流程）.
- Frontend（前端） does not poll（轮询） `pressDownCount（下压计数）`.

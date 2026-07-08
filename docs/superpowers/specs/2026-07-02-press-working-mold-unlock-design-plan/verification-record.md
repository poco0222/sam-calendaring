# Press Working Mold Unlock Verification Record

> @file QT App 解锁模具验证记录
> @author PopoY
> @created 2026-07-02
> @purpose 记录 PressJobPage（压机作业页）unlock mold（解锁模具）Task4 后的自动化与边界验证。

## Automated Gates（自动化门禁）

| Gate（门禁） | Command（命令） | Result（结果） | Notes（备注） |
| --- | --- | --- | --- |
| RED test（失败测试） | `./node_modules/.bin/vitest run src/App.test.tsx` | PASS as RED（按预期失败） | 新增 App wiring（应用接线）测试先失败：`src/App.test.tsx` 5 tests（测试）中 1 failed（失败），失败点为 `App.tsx` 缺少 `PressMoldUnlockRequest` 与 unlock callbacks（解锁回调）。 |
| App GREEN（应用接线通过） | `./node_modules/.bin/vitest run src/App.test.tsx` | PASS（通过） | `src/App.test.tsx` 5 tests passed（5 个测试通过）。 |
| Focused tests（聚焦测试） | `./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx` | PASS（通过） | 3 test files（测试文件）passed；64 tests（测试）passed。 |
| Frontend regression（前端回归） | `pnpm test` | PASS（通过） | 17 test files（测试文件）passed；151 tests（测试）passed。 |
| Frontend build（前端构建） | `pnpm build` | PASS（通过） | Vite build（构建）成功；存在既有 chunk-size warning（包体积告警）：`index-CnRUDNLN.js` 约 1069.69 kB。 |
| TypeScript typecheck（类型检查） | `./node_modules/.bin/tsc --noEmit` | PASS（通过） | TypeScript strict typecheck（严格类型检查）通过，无输出。 |
| Post-review focused test（复核修复聚焦测试） | `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` | PASS（通过） | 38 tests（测试）passed；覆盖空 `operatorId（人员 ID）` 和缺失 `status（状态）` fail closed（失败关闭）。 |
| Visual smoke（视觉冒烟） | `pnpm dev -- --host 127.0.0.1` + Browser 1280x720 check（浏览器检查） | PASS（通过） | `http://localhost:5173/` 在 1280x720 viewport（视口）下渲染 App shell（应用外壳）、topbar（顶部栏）和 `压机作业` navigation（导航）；页面文本未发现 `secret-session-token/sessionToken/signedLease/signature/signalConfig`。 |

## Boundary Checks（边界检查）

| Boundary（边界） | Result（结果） | Evidence（证据） |
| --- | --- | --- |
| Git repository（Git 仓库）状态 | Unavailable（不可用） | `git status --short --branch` 在 repo root（仓库根）与 `qt-app/frontend` 均返回 `fatal: not a git repository`，因此本轮不生成 commit（提交）。 |
| `driver-service/**` source unchanged（源码未修改） | PASS with generated-artifact note（通过，带生成物说明） | `find driver-service qt-app/native -type f -newermt 2026-07-02 ! -path '*/bin/*' ! -path '*/obj/*' ! -path '*/build/*' -print` 对 forbidden source boundary（禁止源码边界）无输出；`driver-service/**/bin` 下存在 2026-07-02 generated artifacts（生成物），不作为源码改动证明。 |
| `qt-app/native/**` source unchanged（源码未修改） | PASS with generated-artifact note（通过，带生成物说明） | `find driver-service qt-app/native -type f -newermt 2026-07-02 ! -path '*/bin/*' ! -path '*/obj/*' ! -path '*/build/*' -print` 对 forbidden source boundary（禁止源码边界）无输出；`qt-app/native/build/**` 下存在 2026-07-02 build artifacts（构建产物），不作为源码改动证明。 |
| No raw `deviceId/ip/port（设备/网络字段）` in unlock request（解锁请求） | PASS（通过） | Focused tests（聚焦测试）覆盖 `erpClient.ts` request narrowing（请求收窄）和 `App.tsx` unlock callback（解锁回调）源码片段；新增 App callback（应用回调）只传 `erpBaseUrl/sessionToken/request/correlationId`。 |
| `PressJobPage（压机作业页）` never receives `sessionToken（会话令牌）` | PASS（通过） | `src/App.test.tsx` 断言 `PressJobPage` props（属性）片段不包含 `sessionToken`。 |
| Diagnostic summary（诊断摘要） whitelist（白名单） | PASS（通过） | `recordPressMoldUnlockDiagnostic` 只接收 `correlationId/durationMs/moldNos/operatorId/resultCode`，并补充 `commandName: "pressMoldUnlock"` 与 `stationAccountId`。 |
| No sensitive data（敏感数据） in UI/logs（界面/日志） | PASS with note（通过，带说明） | Browser visual smoke（浏览器视觉冒烟）未在页面文本发现敏感字段；dev server（开发服务器）console（控制台）只出现 bootstrap diagnostic summary（启动诊断摘要）`UNKNOWN_ERROR`，未包含 token（令牌）、lease（租约）或 signal config（信号配置）原文。 |

## Acceptance Coverage Matrix（验收覆盖矩阵）

| Acceptance（验收项） | Result（结果） | Evidence（证据） |
| --- | --- | --- |
| `moldNo（模具号）` 列不是 unlock mold（解锁模具）入口 | PASS（通过） | `PressJobPage.test.tsx` verifies（验证）当前作业 `moldNo` column（列）只调用 `formatCurrentJobCell`，不包含 `Button/href/confirmMoldUnlock`。 |
| “解锁模具”按钮位于“当前作业信息”标题栏右侧 | PASS（通过） | `PressJobPage.test.tsx` verifies（验证）按钮存在于 `aria-label="当前作业信息"` section（区块），且不在 `aria-label="压机作业操作区"`。 |
| 当前没有已锁定模具时不能进入有效解锁提交 | PASS（通过） | `validatePressMoldUnlockSelection` test（测试）覆盖 empty locked molds（空已锁定模具）返回 `当前没有可解锁模具。`。 |
| Drawer（抽屉）打开时查询一次已锁定模具 | PASS（通过） | `openMoldUnlockDrawer` calls（调用）`loadLockedMoldsOnce`；source-level test（源码级测试）覆盖 `loadPressLockedMolds({ correlationId })` 和 stale response（过期响应）保护。 |
| Drawer Table（抽屉表格）保留 8 个业务字段 | PASS（通过） | `PressJobPage.test.tsx` verifies（验证）模具号、工序号、制造令号、工艺名称、工时类型、开始时间、作业员、操作。 |
| Drawer（抽屉）不包含刷新按钮 | PASS（通过） | `PressJobPage.test.tsx` verifies（验证）unlock Drawer source（解锁抽屉源码）不包含 `>刷新<`。 |
| 支持 single unlock（单套解锁）和 batch unlock（批量解锁） | PASS（通过） | Row action（行操作）和 footer action（底部操作）均调用 `confirmMoldUnlock`，再进入同一个 submit helper（提交辅助函数）。 |
| 提交前使用 Modal.confirm（确认框）二次确认 | PASS（通过） | `confirmMoldUnlock` uses（使用）`modal.confirm`，并设置 `okText: "确认解锁"` 与 danger（危险）按钮。 |
| 加工中不能解锁最后一套模具，提示“请使用完成加工功能。” | PASS（通过） | `validatePressMoldUnlockSelection` tests（测试）覆盖 status（状态）为 `1/3/进行中` 与缺失 `status` 时清空全部已锁定模具均返回该提示。 |
| 解锁请求不包含 `deviceId/ip/port（设备/网络字段）` | PASS（通过） | `erpClient.test.ts` verifies（验证）`unlockPressMolds` request body（请求体）只包含 `operatorId/moldNos/correlationId`。 |
| 解锁成功后关闭 Drawer（抽屉），刷新 current jobs（当前作业） | PASS（通过） | `submitPressMoldUnlockRequest` calls（调用）`submitPressMoldUnlockWithRefresh`，成功后 `setIsMoldUnlockDrawerOpen(false)` 并 `resetMoldUnlockDrawerState()`；tests（测试）覆盖 refresh failure（刷新失败）不归类为 unlock failure（解锁失败）。 |
| 解锁失败展示中文安全错误，不泄漏 sensitive data（敏感数据） | PASS（通过） | `resolvePressMoldUnlockErrorMessage` tests（测试）覆盖安全中文业务错误保留，`sessionToken`、network endpoint（网络端点）和 raw response（原始响应）走统一兜底。 |
| `operatorId（人员 ID）` 必填后才能提交解锁 | PASS（通过） | Post-review test（复核测试）覆盖空白 `operatorId` 返回 `请选择人员`，避免发送空人员 ID。 |

## Task4 Scope（任务四范围）

- Modified（已修改）: `qt-app/frontend/src/App.tsx`
- Modified（已修改）: `qt-app/frontend/src/App.test.tsx`
- Modified（已修改）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/task-04-app-wiring-and-verification-record.md`
- Created（已创建）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/verification-record.md`
- Not modified（未修改）: `driver-service/**`, `qt-app/native/**`, `qt-app/frontend/src/services/driverClient.ts`, `qt-app/frontend/src/hooks/useBootstrapSession.ts`, `qt-app/frontend/src/hooks/useDriverSession.ts`

## Post-review Scope（复核修复范围）

- Modified（已修改）: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modified（已修改）: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modified（已修改）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/00-overview.md`
- Modified（已修改）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/task-02-unlock-validation-and-submit-flow.md`
- Modified（已修改）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/task-04-app-wiring-and-verification-record.md`
- Modified（已修改）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/verification-record.md`

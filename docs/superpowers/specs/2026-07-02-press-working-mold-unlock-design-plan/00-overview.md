# Press Working Mold Unlock Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file QT App 压机作业解锁模具实现计划总览
> @author PopoY
> @created 2026-07-02
> @purpose 基于 `2026-07-02-press-working-mold-unlock-design.md` 拆分 PressJobPage（压机作业页）unlock mold（解锁模具）最小实现任务。

**Goal（目标）:** Add a clear `unlock mold（解锁模具）` entry in the existing `PressJobPage（压机作业页）`, support single unlock（单套解锁） and batch unlock（批量解锁）, then refresh only `current jobs（当前作业）`.

**Architecture（架构）:** Reuse the existing React（前端框架） page, Ant Design（组件库） `Drawer（抽屉）` and `Modal.confirm（确认框）`, and the current `App.tsx` callback injection（回调注入） pattern. Extend `pressJob.ts（压机作业领域模型）` and `erpClient.ts（ERP 客户端）` with the smallest unlock surface; keep `sessionToken（会话令牌）` inside App/ERP client（应用层/客户端） and keep `Driver Service（驱动服务）` untouched.

**Tech Stack（技术栈）:** React 19, TypeScript, TSX, Ant Design 6.4.5（组件库）, Vite（构建工具）, Vitest（测试框架）.

**Source Spec（来源规格）:** `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design.md`

---

## Status（状态）

- `Completed with post-review fixes（已完成并处理复核修复）`: Task 01 through Task 04 均已完成；后续复核发现的 `operatorId（人员 ID）` 必填校验、缺失 `status（状态）` fail closed（失败关闭）保护、verification record（验证记录）验收矩阵和边界说明已补齐。

---

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Unlock Domain And ERP Client](./task-01-unlock-domain-and-erp-client.md) | 新增 unlock mold（解锁模具）领域模型、Qt endpoint（Qt 端点）client（客户端）和字段白名单 narrowing（收窄）。 | None |
| 2 | [Task 02: Unlock Validation And Submit Flow](./task-02-unlock-validation-and-submit-flow.md) | 新增解锁前端 validation（校验）、request builder（请求构造）和 refresh-aware submit helper（带刷新提交流程）。 | Task 01 |
| 3 | [Task 03: Unlock Drawer UI](./task-03-unlock-drawer-ui.md) | 在“当前作业信息”标题栏接入“解锁模具”按钮、Drawer（抽屉）、Table（表格）、single/batch unlock（单套/批量解锁）。 | Task 01, Task 02 |
| 4 | [Task 04: App Wiring And Verification Record](./task-04-app-wiring-and-verification-record.md) | 在 `App.tsx` 注入 ERP callbacks（企业资源计划回调）和 diagnostic summary（诊断摘要），落库 verification record（验证记录）。 | Task 01 through Task 03 |

## File Boundary（文件边界）

### Frontend（前端）

- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

### Docs（文档）

- Create during Task 04（任务四执行时创建）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/verification-record.md`
- Update during execution（执行时回写）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/task-*.md`

### Do Not Touch（不得触碰）

- Do not modify（不要修改）: `driver-service/**`
- Do not modify（不要修改）: `qt-app/native/**`
- Do not modify（不要修改）: `qt-app/frontend/src/services/driverClient.ts`
- Do not modify（不要修改）: `qt-app/frontend/src/hooks/useBootstrapSession.ts`
- Do not modify（不要修改）: `qt-app/frontend/src/hooks/useDriverSession.ts`
- Do not add（不要新增）: `router（路由）`, `state store（状态仓库）`, component library（组件库）, icon dependency（图标依赖）, `polling（轮询）`, or `WebSocket（网页套接字）`.

## Execution Notes（执行说明）

1. Use `RED -> GREEN -> verification（失败 -> 通过 -> 验证）` inside every implementation Task（实现任务）.
2. Keep `moldNo（模具号）` in the Current Job Table（当前作业表） as plain text; do not turn it into a link（链接）.
3. Place the “解锁模具” button only in the “当前作业信息” section header（区块标题栏）.
4. Drawer（抽屉） loads `locked molds（已锁定模具）` once on open; do not add a refresh button（刷新按钮）.
5. Unlock success closes the Drawer（抽屉） and refreshes only `current jobs（当前作业）`.
6. Do not call `bootstrapSession.retry（启动会话重试）`, do not re-request `signedLease（签名租约）`, and do not call `applyLeaseAndConfig（应用租约和配置）`.
7. All unlock calls must send `X-Correlation-Id（关联 ID 请求头）`; no request body may include raw `deviceId/ip/port（设备/网络字段）`.
8. All added or changed code comments must include `@author PopoY` in file headers and use Chinese or Chinese-English mixed wording.
9. Generated commit message（提交消息）, if a Git repository（Git 仓库） is available later, must be Chinese except English technical terms（专业术语）.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| `moldNo（模具号）` 列不是 unlock mold（解锁模具）入口 | Task 03 |
| “解锁模具”按钮位于“当前作业信息”标题栏右侧 | Task 03 |
| 当前没有已锁定模具时不能进入有效解锁提交 | Task 02, Task 03 |
| Drawer（抽屉）打开时查询一次已锁定模具 | Task 01, Task 03 |
| Drawer Table（抽屉表格）保留 8 个业务字段 | Task 01, Task 03 |
| Drawer（抽屉）不包含刷新按钮 | Task 03 |
| 支持 single unlock（单套解锁）和 batch unlock（批量解锁） | Task 02, Task 03 |
| 提交前使用 Modal.confirm（确认框）二次确认 | Task 03 |
| 加工中不能解锁最后一套模具，提示“请使用完成加工功能。” | Task 02 |
| 解锁请求不包含 `deviceId/ip/port（设备/网络字段）` | Task 01, Task 04 |
| 解锁成功后关闭 Drawer（抽屉），刷新 current jobs（当前作业） | Task 02, Task 03, Task 04 |
| 解锁失败展示中文安全错误，不泄漏 sensitive data（敏感数据） | Task 01, Task 02, Task 04 |

## Verification Gates（验证门禁）

Focused tests（聚焦测试）:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx
```

Frontend regression（前端回归）:

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

Visual smoke（视觉冒烟）:

```bash
cd qt-app/frontend
pnpm dev
```

Then verify at `1280x720 viewport（视口）`:

1. “解锁模具” appears in the Current Job section header（当前作业标题栏）, not the top action area（顶部操作区）.
2. `moldNo（模具号）` column stays plain text.
3. Drawer（抽屉） shows status bar（状态条）, locked mold table（已锁定模具表）, footer actions（底部操作）.
4. Drawer（抽屉） has no refresh button（刷新按钮）.
5. Row “解锁” and footer “确认解锁 N 套” share the same confirm/submit path（确认/提交路径）.
6. Success refreshes only current jobs（当前作业） and does not change Driver Service（驱动服务） status.
7. UI（界面） and logs contain no `sessionToken（会话令牌）`, `signedLease（签名租约）`, `signature（签名）`, `signalConfig（信号配置）`, raw `ip/port/deviceId（网络和设备字段）`, or full selected rows（选中行）JSON.

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: sections 1 through 13 map to Tasks 01 through 04.
- Placeholder scan（占位扫描）: no banned placeholder wording or unspecified implementation bucket is used.
- YAGNI（你不会需要它） decision: no backend（后端） work, no native（原生） work, no `router（路由）`, no new store（状态仓库）, no new dependency（依赖）, no refresh button（刷新按钮）.

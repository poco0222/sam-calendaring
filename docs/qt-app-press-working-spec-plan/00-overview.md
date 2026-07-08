# QT App Press Working Page Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file QT App 压机作业页面实现计划总览
> @author PopoY
> @created 2026-06-30
> @purpose 基于 `qt-app-press-working-spec.md` 拆分 Press Working Page（压机作业页面）frontend-only（仅前端）最小实现任务。

**Goal（目标）:** Add a `Press Working Page（压机作业页面）` shell for 1280x720 `touch IPC（触控工控机）`, showing filters, action placeholders, an empty current-job table, and reused realtime signal snapshot data.

**Architecture（架构）:** Keep the page as a new React component（React 组件） behind the existing `App.tsx` `view state（视图状态）`. Reuse existing `bootstrapSession（启动会话）`, `driverSession（驱动会话）`, and `SignalSnapshotTable（信号快照表）`; do not add a `router（路由）`, new service（服务）, new `Driver Service（驱动服务）` command, or mock data（模拟数据）.

**Tech Stack（技术栈）:** React, TypeScript, TSX, Ant Design 6.4.5（组件库）, Vite（构建工具）, Vitest（测试框架）.

**Source Spec（来源规格）:** `docs/qt-app-press-working-spec.md`

---

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Press Working Page Shell](./task-01-press-working-page-shell.md) | 新增压机作业页面外壳、一级导航入口、静态渲染测试和 1280x720 样式约束。 | None |
| 2 | [Task 02: Press Job Lookup Cascade](./task-02-press-job-lookup-cascade.md) | 接入班组、人员、预选工艺 lookup data（查询数据）展示和班组变更级联逻辑。 | Task 01 |
| 3 | [Task 03: Current Job Query And Display](./task-03-current-job-query-display.md) | 接入 sam-erp 当前作业查询并在 Current Job Table（当前作业表）展示白名单字段。 | Task 02 |

## File Boundary（文件边界）

### Frontend（前端）

- Create: `qt-app/frontend/src/components/PressJobPage.tsx`
- Create: `qt-app/frontend/src/components/PressJobPage.css`
- Create: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Optional Modify（可选修改）: `qt-app/frontend/src/App.css` only if the third top-level `Segmented（分段控件）` option overflows at 1280x720.
- Create: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

### Do Not Touch（不得触碰）

- Do not modify（不要修改）: `driver-service/**`
- Do not modify（不要修改）: `qt-app/frontend/src/services/driverClient.ts`
- Do not modify（不要修改）: `qt-app/frontend/src/hooks/useBootstrapSession.ts`
- Do not modify（不要修改）: `qt-app/frontend/src/hooks/useDriverSession.ts`
- Do not add（不要新增）: `react-router（路由库）`, new component library（组件库）, new icon dependency（图标依赖）, new theme system（主题体系）, or mock data（模拟数据）.

## Execution Notes（执行说明）

1. Task 01（任务一） stays as one Task（任务） because the original spec（规格） is a narrow `frontend-only page shell（仅前端页面外壳）`.
2. Use TDD（测试驱动开发） inside the Task（任务）: write `PressJobPage.test.tsx` and update `App.test.tsx` before implementation.
3. `PressJobPage（压机作业页）` props must be `bootstrapSession?: UseBootstrapSessionResult` and `driverSession?: UseDriverSessionResult`.
4. Internal state（内部状态） may only store `teamId`, `operatorId`, and `processId`.
5. `handler（处理函数）` placeholders must not call `fetch（网络请求）`, Driver Service client（驱动服务客户端）, ERP client（企业资源计划客户端）, `localStorage（本地存储）`, logging（日志）, notification（通知）, or state-changing business logic（业务状态变更逻辑）.
6. Realtime Signals（实时信号） must reuse `SignalSnapshotTable（信号快照表）` instead of copying signal grouping（信号分组）, packing（打包）, yes/no conversion（是/否转换）, or unit display（单位展示） logic.
7. All new code file headers and explanatory comments must include `@author PopoY` and Chinese or mixed Chinese-English text.
8. Generated commit message（提交消息）, when a Git repository（Git 仓库） is available, must be Chinese except English technical terms（专业术语）.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| 顶部一级导航出现“压机作业” | Task 01 Step 1, Step 5 |
| 首屏可见四行区域 | Task 01 Step 1, Step 4, Step 7 |
| 三个 Select（选择器）为空选项且中文 placeholder（占位提示） | Task 01 Step 1, Step 4 |
| 8 个操作按钮和“当前状态：未启动” | Task 01 Step 1, Step 4 |
| 空 Table（表格）列固定且空态为“暂无当前作业” | Task 01 Step 1, Step 4 |
| 复用 SignalSnapshotTable（信号快照表）和现有空态 | Task 01 Step 1, Step 4 |
| 点击按钮不产生真实业务效果、不模拟状态变化、不发请求 | Task 01 Step 1, Step 4 |
| 不新增第三方依赖 | Task 01 Step 6 |
| 注释包含 `@author PopoY` 且说明非全英文 | Task 01 Step 4, Step 5 |
| `pnpm test` 相关前端测试通过 | Task 01 Step 2, Step 6 |

## Verification Gates（验证门禁）

Focused tests（聚焦测试）:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx
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

1. “压机作业” appears in the top-level navigation（一级导航）.
2. Press Working Page（压机作业页面） shows filters, actions, current job table, and realtime signals in one screen.
3. The outer page does not scroll; the signal area may scroll locally.
4. Three Select（选择器） controls have no fake options（假选项）.
5. Buttons do not trigger requests, notifications, status changes, or logs.
6. No sensitive fields or raw device endpoint（设备端点） values appear.

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: sections 1 through 10 map to Task 01.
- Placeholder scan（占位扫描）: no banned placeholder wording or unspecified implementation buckets are used.
- YAGNI（你不会需要它） decision: one Task（任务）, no backend（后端） work, no `router（路由）`, no new dependency（依赖）, no mock data（模拟数据）.

# Press Working Tour Guidance Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file QT App 压机作业 Tour guidance（漫游式指导）实现计划总览
> @author PopoY
> @created 2026-07-03
> @purpose 基于 `2026-07-03-press-working-tour-guidance-design.md` 拆分 PressJobPage（压机作业页）三入口 Tour guidance（漫游式指导）最小实现任务。

**Goal（目标）:** Add three independent semi-mandatory Tour guidance（半强制漫游式指导） entries to `PressJobPage（压机作业页）`: start processing（开始加工）, complete processing（完成加工）, and unlock mold（解锁模具）.

**Architecture（架构）:** Reuse the existing React（前端框架） component, Ant Design `Tour（漫游式引导）`, local component state（组件内状态）, and current validation helpers（校验辅助函数）. Keep guidance launcher（指导启动按钮） separate from real production action buttons（真实生产动作按钮）; Tour steps only guide and validate, never auto-submit production actions.

**Tech Stack（技术栈）:** React 19, TypeScript, TSX, Ant Design 6.4.5（组件库）, Vite（构建工具）, Vitest（测试框架）.

**Source Spec（来源规格）:** `docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design.md`

---

## Status（状态）

- `Task 01 Completed（任务一已完成）`: 已完成 Tour state（漫游状态）、target refs（目标引用）和 controlled Tour（受控漫游）基础。
- `Task 02 Completed（任务二已完成）`: 已完成顶部筛选区 guidance launcher（指导启动按钮）、compact filter layout（紧凑筛选布局）和真实 action button target wrappers（动作按钮目标包装）。
- `Task 03 Completed（任务三已完成）`: 已完成开始加工/完成加工两条独立 Tour flow（漫游流程）和 condition check（条件检查）。
- `Task 04 Completed（任务四已完成）`: 已完成 Unlock Drawer（解锁抽屉）内“解锁模具指导”、5-step unlock Tour flow（五步解锁漫游流程）和 condition check（条件检查）。
- `Task 05 Completed（任务五已完成）`: 已完成 focused tests（聚焦测试）、frontend regression（前端回归）、build（构建）、1280x720 visual smoke（视觉冒烟）和 `verification-record.md` 验证记录。
- `Post-review Fix Completed（复核修复已完成）`: 已修复 `Finish（完成）` 绕过 guard（条件检查）、Unlock Drawer（解锁抽屉）关闭残留 unlock Tour（解锁漫游）、File Boundary（文件边界）证据不足和 Visual Smoke（视觉冒烟）原始证据不足。

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Tour State And Targets](./task-01-tour-state-and-targets.md) | 引入 Ant Design `Tour（漫游式引导）`，建立 `activeTour/currentTourStep` 和页面目标 refs（引用）。 | None |
| 2 | [Task 02: Top Filter Guidance Launchers](./task-02-top-filter-guidance-launchers.md) | 调整顶部筛选区布局，并新增“开始加工指导”“完成加工指导”按钮。 | Task 01 |
| 3 | [Task 03: Start And Complete Tour Flow](./task-03-start-and-complete-tour-flow.md) | 实现开始加工/完成加工两条独立 Tour flow（漫游流程）和 condition check（条件检查）。 | Task 01, Task 02 |
| 4 | [Task 04: Unlock Drawer Tour Flow](./task-04-unlock-drawer-tour-flow.md) | 在 Unlock Drawer（解锁抽屉）内新增“解锁模具指导”并实现解锁 Tour flow（漫游流程）。 | Task 01, Task 03 |
| 5 | [Task 05: Tests And Visual Verification](./task-05-tests-and-visual-verification.md) | 补齐 focused tests（聚焦测试）、regression gates（回归门禁）和 1280x720 visual verification（视觉验证）记录。 | Task 01 through Task 04 |

## File Boundary（文件边界）

### Frontend（前端）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

### Docs（文档）

- Update during execution（执行时回写）: `docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/task-*.md`
- Create during Task 05（任务五执行时创建）: `docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/verification-record.md`

### Do Not Touch（不得触碰）

- Do not modify（不要修改）: `driver-service/**`
- Do not modify（不要修改）: `qt-app/native/**`
- Do not modify（不要修改）: `qt-app/frontend/src/App.tsx`
- Do not modify（不要修改）: `qt-app/frontend/src/services/**`
- Do not add（不要新增）: router（路由）, global state store（全局状态仓库）, workflow engine（工作流引擎）, new dependency（新依赖）, or custom Tour component（自研漫游组件）.

## Implementation Notes（实现说明）

1. Use controlled Ant Design `Tour（漫游式引导）`: `open`, `current`, `steps`, `onChange`, `onClose`, and `onFinish`.
2. Keep state local: `activeTour: "start" | "complete" | "unlock" | null` and `currentTourStep: number`.
3. Use wrapper `ref（引用）` targets around existing controls instead of querying raw DOM by CSS selector.
4. Use existing validation helpers first: `validateStartPressJobPreflight`, `validateCompletePressJobPreflight`, and `validatePressMoldUnlockSelection`.
5. Do not use `Form inline（内联表单）`; keep Ant Design `Row（行）` and `Col（列）` grid（栅格）.
6. Guidance launcher（指导启动按钮） must not call `handleStartProcessing`, `handleCompleteProcessing`, or `confirmMoldUnlock`.
7. All Tour copy（漫游文案） must be Chinese, with English technical terms（专业术语） only where useful.
8. All changed code comments must include `@author PopoY` in file headers and use Chinese or Chinese-English mixed wording.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| 三个 independent guidance launcher（独立指导入口） | Task 02, Task 04 |
| 顶部班组/人员缩小，预选工艺保持宽度，按钮右对齐 | Task 02 |
| 使用 Ant Design `Tour（漫游式引导）`，不自研浮层 | Task 01 |
| Tour close（关闭）清空 `activeTour/currentTourStep` | Task 01 |
| Tour Next（下一步）先执行 condition check（条件检查） | Task 01, Task 03, Task 04 |
| 开始加工指导覆盖班组、人员、预选工艺、锁模、预计时长、真实开始按钮 | Task 03 |
| 完成加工指导覆盖当前作业、实时信号、真实完成按钮 | Task 03 |
| 解锁模具指导只在 Unlock Drawer（解锁抽屉）内出现 | Task 04 |
| 解锁指导覆盖三个 Tag（标签）、选择列、真实确认解锁按钮 | Task 04 |
| 不触碰 Driver Service（驱动服务）或 ERP Server（企业资源计划服务器）接口契约 | File Boundary |
| 不记录 sensitive data（敏感数据）或完整 selected rows（选中行） | Task 05 |

## Verification Gates（验证门禁）

Focused tests（聚焦测试）:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
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

1. Top filters（顶部筛选） stay on one row.
2. “开始加工指导” and “完成加工指导” are right-aligned.
3. Real action buttons（真实动作按钮） still remain in the action row（操作区）.
4. Unlock Drawer（解锁抽屉） status tags（状态标签） are left-aligned and “解锁模具指导” is right-aligned.
5. Each Tour（漫游式引导） can be closed and does not block exception handling paths（异常处理路径）.
6. UI（界面） and logs contain no `sessionToken（会话令牌）`, `signedLease（签名租约）`, `signature（签名）`, `signalConfig（信号配置）`, raw `ip/port/deviceId（网络和设备字段）`, or full selected rows（选中行）JSON.

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: sections 1 through 10 map to Tasks 01 through 05.
- Placeholder scan（占位扫描）: no banned placeholder wording, unbounded "handle later（以后处理）", or unspecified implementation bucket is used.
- YAGNI（你不会需要它） decision: no backend（后端） work, no native（原生） work, no new framework（框架）, no new dependency（依赖）, no reusable Tour framework（可复用漫游框架）.

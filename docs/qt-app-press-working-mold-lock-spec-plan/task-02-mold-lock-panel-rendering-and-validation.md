# Task 02: Mold Lock Panel Rendering And Validation

> @file QT App 锁模面板渲染与校验任务
> @author PopoY
> @created 2026-06-30
> @purpose 在 PressJobPage（压机作业页）中接入锁模入口、面板、remote search（远程搜索）、单选候选表和前端校验。

## Goal（目标）

Turn the existing no-op `handleLockMold（锁定模具处理函数）` into the real entry for a compact `Mold Lock Panel（模具锁定面板）`. The Task（任务） covers UI（界面） rendering, candidate search（候选查询）, selection（选择）, default craft（默认工艺）, and frontend validation（前端校验） only; actual lock submission（提交锁模） is wired in Task 03（任务三）.

## Status（状态）

- `Completed（已完成）`: Task2 已实现并通过自动化验证；当前目录不是 Git repository（Git 仓库），未执行 commit（提交）。

## Progress（进度）

- `2026-06-30`: Step 8 已完成，review fix（审查修复）已接通 App layer search injection（应用层搜索注入），focused tests（聚焦测试）24/24 passed，`pnpm build` exit 0 且仅有既有 Vite chunk-size warning（包体积告警）；`git status --short --branch` 返回当前目录不是 Git repository（Git 仓库），未提交；当前进度 `8/8`。

## Files（文件）

- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## Panel Contract（面板契约）

The panel（面板） must use existing Ant Design（组件库） controls only:

```text
Drawer（抽屉）
  toolbar row（工具栏行）: moldNo Select（模具号选择器） + 搜索 + 重置 + 确认锁定 + 取消锁定
  table（表格）: 单选 + 制造令号 + 模具号 + 工序号 + 选择工艺
```

Do not place cards（卡片） inside the Drawer（抽屉）. Do not add help copy（说明文案） beyond labels and validation messages（校验消息）.

## Steps（步骤）

- [x] **Step 1: Write RED UI and validation tests（编写失败的界面与校验测试）**

Modify `qt-app/frontend/src/components/PressJobPage.test.tsx`.

Add tests（测试） for:

1. Missing `teamId（班组 ID）` shows `请选择班组`.
2. Missing `operatorId（人员 ID）` shows `请选择人员`.
3. Missing `processId（工艺 ID）` shows `请选择预选工艺`.
4. Five locked molds（五套已锁模具） blocks panel opening with `当前已锁定五套模具,已达到上限!`.
5. Valid filters open `Mold Lock Panel（模具锁定面板）`.
6. Search calls injected `searchPressMoldCandidates（查询候选模具）` with `moldNo`, `lockedMoldNos`, and `correlationId`.
7. Candidate table shows only `makeOrderNumber`, `moldNo`, `stages`, `projectCode`, `name`, and selected `craftCode（工艺编码）`.
8. Candidate row without `craftCode（工艺编码）` defaults to current `processId（预选工艺）`.
9. Cross-project selection returns `不可跨项目作业！当前设备正在作业项目 [P123]，所选模具属于项目 [P456]`.
10. Cancel closes the panel and clears candidate state without calling a backend function（后端函数）.

Expected RED（预期失败）:

```text
Mold Lock Panel（模具锁定面板） does not exist yet.
Validation helper（校验辅助函数） does not exist yet.
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） because lock panel（锁模面板） and validation（校验） are not implemented.
```

- [x] **Step 3: Add minimal props and local state（新增最小属性与本地状态）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Extend `PressJobPageProps（页面属性）`:

```ts
searchPressMoldCandidates?: (input: {
  moldNo: string;
  lockedMoldNos: string[];
  correlationId: string;
}) => Promise<PressMoldCandidate[]>;
currentJobRows?: PressJobCurrentJobRow[];
```

Add local state（本地状态）:

```text
isMoldLockPanelOpen（锁模面板打开状态）
moldSearchText（模具号搜索文本）
moldCandidates（候选模具）
selectedMoldNo（当前选中模具号）
moldCandidateLoading（候选加载状态）
```

Rules:

1. `currentJobRows（当前作业行）` prop（属性） overrides `bootstrapSession.data.pressJobCurrentJobs` only when passed.
2. `sessionToken（会话令牌）` must not be added to props（属性）.
3. Keep the existing action buttons（操作按钮） and current job table（当前作业表）.

- [x] **Step 4: Add pure validation helpers（新增纯校验辅助函数）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Export helpers for testability（可测试性）:

```ts
export function validateMoldLockPreflight(
  filters: PressJobFilterState,
  currentJobRows: PressJobCurrentJobRow[],
): string | null;

export function createPressMoldLockSelection(
  candidate: PressMoldCandidate,
  processId: string,
): PressMoldLockSelection;

export function validatePressMoldLockSelection(
  selection: PressMoldLockSelection | null,
  currentJobRows: PressJobCurrentJobRow[],
): string | null;
```

Validation rules（校验规则）:

1. Missing `teamId（班组 ID）` -> `请选择班组`.
2. Missing `operatorId（人员 ID）` -> `请选择人员`.
3. Missing `processId（工艺 ID）` -> `请选择预选工艺`.
4. Five locked molds（五套已锁模具） -> `当前已锁定五套模具,已达到上限!`.
5. No selected mold（未选模具） -> `请先选择模具。`.
6. Missing `makeOrderNumber（制造令号）` or `craftCode（工艺编码）` -> `制造令号与工艺不能为空。`.
7. Cross-project（跨项目） -> `不可跨项目作业！当前设备正在作业项目 [<current>]，所选模具属于项目 [<selected>]`.

Project code（项目号） resolution:

```text
candidate.projectCode if present（优先候选项目号）
else candidate.moldNo split before first "-"（否则取模具号前缀）
```

- [x] **Step 5: Render Drawer panel and candidate table（渲染抽屉面板与候选表）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Implementation rules（实现规则）:

1. `handleLockMold（锁定模具处理函数）` runs `validateMoldLockPreflight（前置校验）` first.
2. Use Ant Design `App.useApp()` to show Chinese `message（消息提示）`.
3. Only open the `Drawer（抽屉）` when preflight passes（前置校验通过）.
4. `moldNo Select（模具号选择器）` uses the search text and candidate list; do not display raw response（原始响应）.
5. Search button（搜索按钮） calls `searchPressMoldCandidates（查询候选模具）`.
6. Reset button（重置按钮） clears search text, candidates, selected row, and loading state.
7. Cancel button（取消按钮） closes the panel and clears local candidate state.
8. Candidate table（候选表） uses `rowSelection={{ type: "radio" }}` or equivalent single-select behavior.

- [x] **Step 6: Add compact 1280x720 styles（新增紧凑视口样式）**

Modify `qt-app/frontend/src/components/PressJobPage.css`.

Rules:

1. Drawer body（抽屉内容） must use a two-row layout: toolbar and table.
2. Toolbar controls（工具栏控件） must fit on one row at 1280x720.
3. Table body（表格内容） may scroll locally.
4. Do not add gradients（渐变）, decorative orbs（装饰光球）, nested cards（嵌套卡片）, or new color system（颜色体系）.
5. Keep button and select touch target（触控目标） at least 44px where feasible.

- [x] **Step 7: Run focused tests and build（运行聚焦测试与构建）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx
pnpm build
```

Expected（预期）:

```text
PASS（通过） focused tests.
PASS（通过） build, with existing Vite chunk-size warning（包体积告警） allowed.
```

- [x] **Step 8: Update task progress and commit when possible（回写任务进度并在可用时提交）**

Update this file’s `Progress（进度）` after each completed step.

Run:

```bash
git status --short --branch
```

If a Git repository（Git 仓库） is available in the execution environment, commit message（提交消息）:

```text
feat: 增加 QT App 锁模面板和前端校验
```

## Acceptance Criteria（验收标准）

1. “锁定模具” enforces required `team/operator/process（班组/人员/工艺）`.
2. Five locked molds（五套已锁模具） blocks panel opening.
3. Panel uses existing Ant Design（组件库） controls and current visual system（视觉体系）.
4. Candidate search（候选查询） is invoked through an injected prop（注入属性）.
5. Candidate table（候选表） supports single selection（单选）.
6. Missing candidate craft（候选工艺） defaults to current `processId（预选工艺）`.
7. Cross-project（跨项目） selection is blocked before backend submit（后端提交）.
8. Cancel closes the panel and does not call ERP（企业资源计划系统）.

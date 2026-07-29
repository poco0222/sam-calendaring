---
change: fix-press-job-history-filter-container-sizing
design-doc: docs/superpowers/specs/2026-07-29-compress-press-job-guidance-buttons-design.md
base-ref: e8c832b1d45663d496f0e9c9a71b69bd39984142
---

<!--
@file 2026-07-29-compress-press-job-guidance-buttons.md
@author PopoY
@created 2026-07-29 10:59:40
@editor PopoY
@edited 2026-07-29 11:08:06
@purpose 将已批准的压机作业指导按钮紧凑化设计拆成最小 TDD 实施和验证步骤。
-->

# 压机作业指导按钮紧凑化 Implementation Plan（实施计划）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让压机作业顶部“开始加工指导”和“完成加工指导”按钮与历史作业“查询”按钮同为 Ant Design medium（中号）默认 `32px` 高，同时保持下方生产操作按钮 `44px` 不变。

**Architecture:** 删除指导按钮作用域内唯一的 `min-height: 44px`，继续继承现有 `ConfigProvider componentSize="medium"`，不新增硬编码尺寸或组件属性。测试先锁定禁止恢复该覆盖规则，再用同一真实 `1280×720` 页面测量指导按钮、历史查询按钮和生产操作按钮的边界框。

**Tech Stack:** React 19、TypeScript 6、Ant Design 6、Vitest、CSS、Playwright CLI、Comet/OpenSpec。

## Global Constraints

- 只压缩 `.press-job-page__guidance-launchers` 下的两个指导按钮；宽度继续随图标和中文文案自适应。
- 保留 `white-space: nowrap`、右对齐、`gap: 8px`、`Form + Row + Col` 和现有列宽。
- `.press-job-page__actions .ant-btn` 及 mold-lock（锁模）等其他独立按钮规则必须保持 `44px`。
- 不修改 Tour（引导）步骤、事件处理、业务状态、API、Driver Service、依赖或主题 Provider（提供器）。
- 不显式增加 `height: 32px`、`min-height: 32px` 或 `size="middle"`；以组件库 medium 默认尺寸为唯一基准。
- 修改已有文件时保留原作者，并追加或更新时间为执行时本地实际时间的 `@editor PopoY`、`@edited yyyy-MM-dd HH:mm:ss`。
- 保留当前工作区中属于同一 Comet change 的状态文件和验证报告；不得使用 `git add .`，不得推送远端。

**Approved Design（已批准设计）：** [2026-07-29-compress-press-job-guidance-buttons-design.md](/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/docs/superpowers/specs/2026-07-29-compress-press-job-guidance-buttons-design.md)

---

## 文件结构与职责

| 文件 | 职责 |
| --- | --- |
| `openspec/changes/fix-press-job-history-filter-container-sizing/proposal.md` | 补充压机指导按钮与历史查询按钮的实际高度偏差和范围 |
| `openspec/changes/fix-press-job-history-filter-container-sizing/design.md` | 记录删除指导按钮专属 `44px` 覆盖的决策和边界 |
| `openspec/changes/fix-press-job-history-filter-container-sizing/tasks.md` | 增加并跟踪指导按钮 RED/GREEN 与真实页面验证 |
| `qt-app/frontend/src/components/PressJobPage.test.tsx` | 回归禁止指导按钮恢复专属 `44px` 高度 |
| `qt-app/frontend/src/components/PressJobPage.css` | 删除指导按钮唯一的 `min-height: 44px`，保留不换行 |
| `docs/superpowers/reports/2026-07-29-fix-press-job-history-filter-container-sizing-verify.md` | 更新最终尺寸、测试、构建和两路布局复核证据 |

### Task 1：指导按钮继承 medium 默认高度

**Files:**
- Modify: `openspec/changes/fix-press-job-history-filter-container-sizing/proposal.md`
- Modify: `openspec/changes/fix-press-job-history-filter-container-sizing/design.md`
- Modify: `openspec/changes/fix-press-job-history-filter-container-sizing/tasks.md`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx:283-293`
- Modify: `qt-app/frontend/src/components/PressJobPage.css:1-57`

**Interfaces:**
- Consumes: Ant Design `ConfigProvider componentSize="medium"` 和现有 `.press-job-page__guidance-launchers`。
- Produces: 两个指导按钮可见高度 `32px`；`white-space: nowrap`、右对齐和点击行为保持不变。

- [x] **Step 1：把已批准范围同步到活跃 Comet artifacts（产物）**

  将 proposal/design 补充以下明确决策，并在 tasks 增加未完成项 `1.4` 与重新打开的验证项：

  ```markdown
  - [ ] 1.4 先补充压机指导按钮不得单独锁定 `44px` 的契约并记录 RED，再删除该高度覆盖并确认 GREEN。
  - [ ] 2.1 执行聚焦测试、完整测试、类型检查、生产构建、两路布局复扫、1280×720 真实尺寸检查和 `git diff --check`。
  ```

- [x] **Step 2：写失败测试**

  在 `PressJobPage.test.tsx` 将原“touch ready”测试替换为精确契约：

  ```tsx
  it("keeps top guidance launchers right aligned at the medium control height", () => {
    expect(pageCss).toContain(".press-job-page__filter-row");
    expect(pageCss).toContain("flex-wrap: nowrap");
    expect(pageCss).toContain(".press-job-page__guidance-launchers");
    expect(pageCss).toContain("justify-content: flex-end");
    expect(pageCss).toMatch(
      /\.press-job-page__guidance-launchers \.ant-btn\s*\{[^}]*white-space: nowrap;/,
    );
    expect(pageCss).not.toMatch(
      /\.press-job-page__guidance-launchers \.ant-btn\s*\{[^}]*min-height: 44px;/,
    );
  });
  ```

- [x] **Step 3：运行聚焦测试并确认 RED（失败）**

  Run：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vitest run src/components/PressJobPage.test.tsx
  ```

  Expected：157 项中仅新的 medium 高度契约失败；失败内容指出现有 selector 仍包含 `min-height: 44px`。

- [x] **Step 4：实施最小 CSS 删除**

  将 `PressJobPage.css` 的规则改为：

  ```css
  .press-job-page__guidance-launchers .ant-btn {
    white-space: nowrap;
  }
  ```

  同步更新 CSS 和测试文件头的 `@editor/@edited`，不修改 `.press-job-page__actions .ant-btn`。

- [x] **Step 5：运行聚焦测试并确认 GREEN（通过）**

  Run：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vitest run src/components/PressJobPage.test.tsx
  ```

  Expected：`PressJobPage.test.tsx` 157/157 通过。

### Task 2：真实页面和完整验证

**Files:**
- Modify: `openspec/changes/fix-press-job-history-filter-container-sizing/tasks.md`
- Modify: `docs/superpowers/reports/2026-07-29-fix-press-job-history-filter-container-sizing-verify.md`
- Verify only: `qt-app/frontend/src/components/PressJobPage.tsx`
- Verify only: `qt-app/frontend/src/components/PressJobHistoryPage.tsx`

**Interfaces:**
- Consumes: Task 1 的 CSS 和测试结果。
- Produces: 压机指导按钮 `32px`、历史查询按钮 `32px`、生产操作按钮 `44px` 的真实浏览器证据。

- [x] **Step 1：启动真实前端并采集 1280×720 尺寸**

  Run：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vite --host localhost --port 5173
  ```

  使用 `/Users/popoy/.codex/skills/playwright/scripts/playwright_cli.sh` 打开 `http://localhost:5173`、调整为 `1280×720`，依次测量：

  ```js
  {
    guidanceButtons: await page.locator(".press-job-page__guidance-launchers .ant-btn").evaluateAll(
      (buttons) => buttons.map((button) => button.getBoundingClientRect().height),
    ),
    actionButton: await page.locator(".press-job-page__actions .ant-btn").first().evaluate(
      (button) => button.getBoundingClientRect().height,
    ),
  }
  ```

  切换“历史作业”后测量：

  ```js
  await page.locator(".press-job-history-page__query").evaluate(
    (button) => button.getBoundingClientRect().height,
  );
  ```

  Expected：`guidanceButtons=[32,32]`、历史查询 `32`、生产操作 `44`。保存压机作业和历史作业两张 viewport screenshot（视口截图）。

- [x] **Step 2：执行两路 Impeccable layout（布局）复核**

  布局代理检查 Spacing、Hierarchy、Grid、Rhythm、Density；机械代理运行：

  ```bash
  node /Users/popoy/.agents/skills/impeccable/scripts/detect.mjs --json --scope layout qt-app/frontend/src/components/PressJobPage.css qt-app/frontend/src/components/PressJobPage.tsx
  ```

  Expected：两路均无未解决项，detector JSON 为 `[]`。

- [x] **Step 3：运行完整自动化验证**

  分别运行：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm test
  pnpm exec tsc --noEmit
  pnpm build
  ```

  Expected：21/21 test files、370/370 tests；TypeScript 退出码 0；Vite 1144 个模块构建完成，允许既有大 chunk 警告。

- [x] **Step 4：完成任务、报告和 diff 检查**

  将 `tasks.md` 的 `1.4`、`2.1` 标为 `[x]`，更新验证报告的真实 bounding box（边界框）和命令证据，然后运行：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  git diff --check
  git status --short
  ```

  Expected：`git diff --check` 退出码 0；产品改动只涉及 `PressJobPage.css`、`PressJobPage.test.tsx`，其余均为当前 Comet change 的 artifacts、计划和验证报告。

- [ ] **Step 5：提交实现并重新通过 Comet verify（验证）**

  仅暂存本计划列出的归属路径和当前 change 的 Comet 状态文件，检查 staged diff（暂存差异）后提交：

  ```bash
  git commit -m "fix: 压缩压机作业指导按钮"
  ```

  重新记录 build/verify 命令证据并运行 phase guard（阶段守卫），最终停在 archive（归档）确认点；不归档、不推送，等待用户明确选择。

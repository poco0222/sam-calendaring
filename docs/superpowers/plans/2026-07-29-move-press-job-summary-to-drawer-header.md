<!--
@file 2026-07-29-move-press-job-summary-to-drawer-header.md
@author PopoY
@created 2026-07-29 17:04:34
@purpose 将已批准的历史作业概要标题栏整合设计拆成最小 TDD 实施与验证步骤。
-->

# 历史作业概要标题栏整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用现有四列两行蓝色作业概要替换 Drawer（抽屉）的重复文字标题，把释放出的高度交给参数记录和操作记录，并将操作记录调整为每页 10 条。

**Architecture:** 只调整 `PressJobHistoryPage` 的现有展示组合：详情成功时把概要作为 `Drawer.title` 的 ReactNode（React 节点），加载或失败时继续使用短文本标题；`HistoryDetailContent` 只保留两个记录面板。分页继续由唯一的 `OPERATION_PAGE_SIZE` 常量控制，不修改请求、状态机、数据类型或 ERP API（接口）。

**Tech Stack:** React 19、TypeScript 6、Ant Design 6、Vitest 4、CSS、Vite 8。

## Global Constraints

- 详情成功后必须完整展示现有八项概要，并保持四列两行；不得增加或删除字段。
- `loading` 和 `error` 状态继续显示“作业详情 · 模具号”，正文继续使用现有 Skeleton（骨架屏）和错误重试。
- Drawer 宽度保持 `80%`；参数与操作面板横向比例保持 `64% / 36%`。
- 参数表 `.ant-spin` 高度链、表体局部滚动、操作时间线局部滚动和底部分页不得回退。
- 操作记录每页固定 10 条；第 11 条进入第 2 页；切换作业时仍回到第 1 页。
- 不修改 ERP、View Model（视图模型）、请求竞态、焦点归还、主题、依赖或历史主列表服务端分页。
- 不新增文件级组件、配置项、响应式断点、高度计算或第二套滚动容器。
- 修改现有文件时保留 `@author PopoY`，并把 `@editor PopoY`、`@edited` 更新为执行时 `date '+%Y-%m-%d %H:%M:%S'` 的本地实际时间。
- 仅暂存本计划列出的文件；不得使用 `git add .`，不得推送远端。

**Approved Design（已批准设计）：** [2026-07-29-move-press-job-summary-to-drawer-header-design.md](/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/docs/superpowers/specs/2026-07-29-move-press-job-summary-to-drawer-header-design.md)

---

## 文件结构与职责

| 文件 | 职责 |
| --- | --- |
| `qt-app/frontend/src/components/PressJobHistoryPage.tsx` | 组合 Drawer 标题、概要、参数/操作正文，并通过唯一常量控制操作分页 |
| `qt-app/frontend/src/components/PressJobHistoryPage.css` | 约束标题栏概要、Drawer body 和两个记录面板的固定视口布局 |
| `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx` | 锁定 10 条分页、标题栏概要、状态回退和局部滚动契约 |

### Task 1：将操作记录调整为每页 10 条

**Files:**
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx:589-625`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.tsx:55-58`

**Interfaces:**
- Consumes: `detail.operationRecords`、`operationPage` 和现有 `Pagination`。
- Produces: `OPERATION_PAGE_SIZE = 10`，统一控制数组 `slice`、分页器阈值和 `Pagination.pageSize`。

- [ ] **Step 1：写入 10 条分页失败测试**

  把现有 `paginates compact operation records...` 测试中的记录数量和分页断言改为：

  ```tsx
  const html = renderHistoryDetail(
    Array.from({ length: 11 }, (_, index) => ({
      operationTime: `2026-07-27 12:${String(index).padStart(2, "0")}:00`,
      operationName: `操作-${index + 1}`,
      result: index === 0 ? "失败" : "成功",
      teamName: index === 1 ? undefined : "夜班",
      operatorName: index === 1 ? undefined : "张三",
    })),
  );
  const operations = html.slice(html.indexOf('aria-label="操作记录"'));

  expect(operations).toContain("操作-1");
  expect(operations).toContain("操作-10");
  expect(operations).not.toContain("操作-11");
  expect(operations).toContain("班组 / 作业人员：夜班 / 张三");
  expect(operations).toContain("班组 / 作业人员：未记录 / 未记录");
  expect(operations).not.toContain("内容：");
  expect(operations).toContain("ant-timeline");
  expect(
    operations.match(
      /<li[^>]*class="[^"]*\bant-timeline-item(?=[\s"])[^"]*"/g,
    ),
  ).toHaveLength(10);
  expect(operations).toContain(
    "press-job-history-detail__operation-pagination",
  );
  ```

- [ ] **Step 2：运行聚焦测试并确认 RED（失败）**

  Run：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vitest run src/components/PressJobHistoryPage.test.tsx
  ```

  Expected：命令非零退出；新断言显示“操作-10”不可见或 Timeline item（时间轴项）仍为 9 条。

- [ ] **Step 3：实施最小分页修改**

  在 `PressJobHistoryPage.tsx` 只修改现有常量：

  ```tsx
  const OPERATION_PAGE_SIZE = 10;
  ```

  同步把 TSX 和测试文件头的 `@edited` 更新为本地实际时间；不改 `slice`、分页器判断或 `Pagination.pageSize` 的调用方式。

- [ ] **Step 4：运行聚焦测试并确认 GREEN（通过）**

  Run：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vitest run src/components/PressJobHistoryPage.test.tsx
  ```

  Expected：命令退出码 0；第 1 至 10 条可见、第 11 条不可见，分页器仍存在。

- [ ] **Step 5：提交分页修改**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  git add -- qt-app/frontend/src/components/PressJobHistoryPage.tsx qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
  git diff --cached --check
  git commit -m "fix: 调整历史作业操作记录分页"
  ```

### Task 2：用四列两行概要替换 Drawer 文字标题

**Files:**
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx:20-113,631-720`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.tsx:1158-1262,1339-1343`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.css:142-177`

**Interfaces:**
- Consumes: `detail: PressJobHistoryDetail`、`operatorLabelByValue`、`craftLabelByValue` 和现有四个 formatter（格式化函数）。
- Produces: `HistoryDetailSummary` 只读展示组件；`HistoryDetailContent` 只接收 `detail` 并占满 Drawer body。

- [ ] **Step 1：重用固定详情数据并写入失败测试**

  在测试 import 中加入 `HistoryDetailSummary`，把现有 fixture（固定数据）提取为以下函数，并让两个渲染 helper（辅助函数）分别渲染概要和正文：

  ```tsx
  function createHistoryDetail(
    operationRecords: PressJobHistoryDetail["operationRecords"],
    parameterStates: Pick<
      PressJobHistoryDetail,
      "startParameterState" | "endParameterState"
    > = {
      startParameterState: "missing",
      endParameterState: "missing",
    },
    detailOverrides: Partial<PressJobHistoryDetail> = {},
  ): PressJobHistoryDetail {
    return {
      moldJobId: "job-1",
      moldNo: "M-01",
      pressName: "一号压机",
      operatorId: "operator-1",
      craftCode: "craft-1",
      startedAt: "2026-07-27 11:00:00",
      completedAt: "2026-07-27 12:34:56",
      actualDurationHours: "1.5",
      status: "3",
      ...parameterStates,
      startParameters: [],
      endParameters: [],
      operationRecords,
      ...detailOverrides,
    };
  }

  function renderHistoryDetail(
    operationRecords: PressJobHistoryDetail["operationRecords"],
    parameterStates?: Pick<
      PressJobHistoryDetail,
      "startParameterState" | "endParameterState"
    >,
    detailOverrides: Partial<PressJobHistoryDetail> = {},
  ): string {
    return renderToStaticMarkup(
      <AntdRootProvider>
        <HistoryDetailContent
          detail={createHistoryDetail(
            operationRecords,
            parameterStates,
            detailOverrides,
          )}
        />
      </AntdRootProvider>,
    );
  }

  function renderHistorySummary(
    detailOverrides: Partial<PressJobHistoryDetail> = {},
  ): string {
    return renderToStaticMarkup(
      <AntdRootProvider>
        <HistoryDetailSummary
          craftLabelByValue={new Map([["craft-1", "冲压工艺"]])}
          detail={createHistoryDetail([], undefined, detailOverrides)}
          operatorLabelByValue={new Map([["operator-1", "张三"]])}
        />
      </AntdRootProvider>,
    );
  }
  ```

  增加以下标题栏与高度契约测试：

  ```tsx
  it("moves the full job summary into the Drawer title and expands the body", () => {
    const summary = renderHistorySummary();

    for (const label of [
      "压机",
      "模具号",
      "作业状态",
      "实际时长",
      "班组 / 作业人员",
      "工艺",
      "开始时间",
      "完成时间",
    ]) {
      expect(summary).toContain(label);
    }
    expect(pageSource).toContain("<HistoryDetailSummary");
    expect(pageSource).toContain("title={");
    expect(
      pageSource.match(/className="press-job-history-detail__summary"/g),
    ).toHaveLength(1);
    expect(pageSource).not.toContain("press-job-history-detail__layout");
    expect(pageCss).toMatch(
      /\.press-job-history-detail \.ant-drawer-header\s*\{[^}]*padding: 8px 24px;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-detail__body\s*\{[^}]*height: 100%;/,
    );
  });
  ```

  把“进行中作业”测试改为组合概要和正文，继续覆盖“进行中 / 未完成 / 完工参数 / 未记录”：

  ```tsx
  it("renders a running job with unfinished completion fields", () => {
    const overrides = {
      actualDurationHours: undefined,
      completedAt: undefined,
      status: "1",
    };
    const html = `${renderHistorySummary(overrides)}${renderHistoryDetail(
      [],
      undefined,
      overrides,
    )}`;

    expect(html).toContain("作业状态");
    expect(html).toContain("进行中");
    expect(html).toContain("未完成");
    expect(html).toContain("完工参数");
    expect(html).toContain("未记录");
  });
  ```

- [ ] **Step 2：运行聚焦测试并确认 RED（失败）**

  Run：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vitest run src/components/PressJobHistoryPage.test.tsx
  ```

  Expected：命令非零退出；TypeScript/Vitest 报告 `HistoryDetailSummary` 尚未导出，或标题栏/CSS 新契约尚未满足。

- [ ] **Step 3：迁移现有概要 JSX，不复制字段或 formatter**

  在 `HistoryDetailContent` 前增加同文件展示组件，内容直接从现有概要节点移动：

  ```tsx
  /**
   * @brief 渲染 Drawer header（抽屉标题栏）中的四列两行历史作业概要。
   * @author PopoY
   */
  export function HistoryDetailSummary({
    detail,
    operatorLabelByValue,
    craftLabelByValue,
  }: {
    detail: PressJobHistoryDetail;
    operatorLabelByValue: Map<string, string>;
    craftLabelByValue: Map<string, string>;
  }) {
    const operator = formatDictValue(operatorLabelByValue, detail.operatorId);

    return (
      <Descriptions
        className="press-job-history-detail__summary"
        column={4}
        items={[
          { key: "press", label: "压机", children: formatHistoryCell(detail.pressName) },
          { key: "mold", label: "模具号", children: detail.moldNo },
          { key: "status", label: "作业状态", children: formatHistoryStatus(detail.status) },
          {
            key: "duration",
            label: "实际时长",
            children: formatHistoryDuration(detail.status, detail.actualDurationHours),
          },
          { key: "operator", label: "班组 / 作业人员", children: `未记录 / ${operator}` },
          {
            key: "craft",
            label: "工艺",
            children: formatDictValue(craftLabelByValue, detail.craftCode),
          },
          { key: "start", label: "开始时间", children: formatHistoryCell(detail.startedAt) },
          {
            key: "end",
            label: "完成时间",
            children: formatHistoryCompletedAt(detail.status, detail.completedAt),
          },
        ]}
      />
    );
  }
  ```

  将 Drawer 的 `title` 和成功正文改为：

  ```tsx
  title={
    detail ? (
      <HistoryDetailSummary
        craftLabelByValue={craftLabelByValue}
        detail={detail}
        operatorLabelByValue={operatorLabelByValue}
      />
    ) : (
      `作业详情 · ${selectedRow?.moldNo ?? "未记录"}`
    )
  }
  ```

  ```tsx
  ) : detail ? (
    <HistoryDetailContent detail={detail} />
  ) : null}
  ```

  把 `HistoryDetailContent` 的参数收窄为：

  ```tsx
  export function HistoryDetailContent({
    detail,
  }: {
    detail: PressJobHistoryDetail;
  }) {
  ```

  删除其中 `operator` 计算、概要 `Descriptions` 和外层 `press-job-history-detail__layout`；返回节点直接以现有 `press-job-history-detail__body` 为根。不得改参数表、Timeline 或 Pagination 内容。

- [ ] **Step 4：把概要样式限定到标题栏并让正文占满高度**

  将现有详情顶部 CSS 调整为以下最小规则；后续参数表和时间线规则原样保留：

  ```css
  .press-job-history-detail .ant-drawer-close {
    width: 44px;
    height: 44px;
  }

  .press-job-history-detail .ant-drawer-header {
    padding: 8px 24px;
  }

  .press-job-history-detail .ant-drawer-title {
    min-width: 0;
  }

  .press-job-history-detail .ant-drawer-body {
    min-height: 0;
    padding: 12px 24px;
    overflow: hidden;
  }

  .press-job-history-detail__summary {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--qt-app-control-blue-line);
    border-radius: 6px;
    background: var(--qt-app-control-blue-soft);
  }

  .press-job-history-detail__summary .ant-descriptions-item-content {
    overflow-wrap: anywhere;
  }

  .press-job-history-detail__body {
    display: grid;
    grid-template-columns: minmax(0, 64fr) minmax(260px, 36fr);
    gap: 16px;
    height: 100%;
    min-height: 0;
  }
  ```

  删除 `.press-job-history-detail__layout`。同步更新 TSX、CSS 和测试文件头的 `@edited` 为同一轮本地实际时间。

- [ ] **Step 5：运行聚焦测试并确认 GREEN（通过）**

  Run：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vitest run src/components/PressJobHistoryPage.test.tsx
  ```

  Expected：命令退出码 0；八项概要、进行中状态、标题栏位置、正文满高、10 条分页和既有滚动契约全部通过。

- [ ] **Step 6：提交标题栏布局修改**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  git add -- qt-app/frontend/src/components/PressJobHistoryPage.tsx qt-app/frontend/src/components/PressJobHistoryPage.css qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
  git diff --cached --check
  git commit -m "fix: 整合历史作业概要标题栏"
  ```

### Task 3：完整回归与固定视口验证

**Files:**
- Verify only: `qt-app/frontend/src/components/PressJobHistoryPage.tsx`
- Verify only: `qt-app/frontend/src/components/PressJobHistoryPage.css`
- Verify only: `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx`
- Temporary ignored evidence: `qt-app/frontend/output/playwright/history-summary-header/`

**Interfaces:**
- Consumes: Task 1 和 Task 2 的两个本地提交。
- Produces: 完整自动化结果、`1280×720` 浅色/深色布局证据和干净工作树证明。

- [ ] **Step 1：运行完整前端验证**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm test
  pnpm exec tsc --noEmit
  pnpm build
  ```

  Expected：三条命令均退出码 0；允许 Vite 既有的大 chunk（大分块）警告，但不得出现新增 TypeScript、Vitest 或构建错误。

- [ ] **Step 2：使用固定本地数据做 1280×720 双主题检查**

  使用 `apply_patch` 在已忽略目录创建 `output/playwright/history-summary-header/preview.html`：

  ```html
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>历史作业概要标题栏验证</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="./preview.tsx"></script>
    </body>
  </html>
  ```

  同目录创建 `preview.tsx`。该临时页面只组合实际组件和固定数据，不复制生产布局逻辑：

  ```tsx
  import { Drawer, theme } from "antd";
  import type { CSSProperties } from "react";
  import { createRoot } from "react-dom/client";

  import { AntdRootProvider } from "../../../src/app/AntdRootProvider";
  import {
    HistoryDetailContent,
    HistoryDetailSummary,
  } from "../../../src/components/PressJobHistoryPage";
  import type { PressJobHistoryDetail } from "../../../src/domain/pressJob";
  import "../../../src/global.css";

  const detail: PressJobHistoryDetail = {
    moldJobId: "preview-job",
    moldNo: "E220-061",
    pressName: "1600T",
    operatorId: "operator-1",
    craftCode: "craft-1",
    startedAt: "2026-07-29 13:42:40",
    completedAt: "2026-07-29 15:46:37",
    actualDurationHours: "2.1",
    status: "3",
    startParameterState: "recorded",
    endParameterState: "recorded",
    startParameters: Array.from({ length: 12 }, (_, index) => ({
      parameterName: `参数-${index + 1}`,
      status: "recorded" as const,
      unit: "mm",
      value: index,
    })),
    endParameters: Array.from({ length: 12 }, (_, index) => ({
      parameterName: `参数-${index + 1}`,
      status: "recorded" as const,
      unit: "mm",
      value: index + 1,
    })),
    operationRecords: Array.from({ length: 11 }, (_, index) => ({
      operationTime: `2026-07-29 15:${String(index).padStart(2, "0")}:00`,
      operationName: `操作-${index + 1}`,
      result: "成功",
      teamName: "Q2",
      operatorName: "艾杨",
    })),
  };

  function Preview() {
    const {
      token: { colorPrimary, colorPrimaryBg, colorPrimaryBorder },
    } = theme.useToken();
    const rootStyle = {
      "--qt-app-control-blue": colorPrimary,
      "--qt-app-control-blue-soft": colorPrimaryBg,
      "--qt-app-control-blue-line": colorPrimaryBorder,
    } as CSSProperties;

    return (
      <Drawer
        className="press-job-history-detail"
        getContainer={false}
        open
        rootStyle={rootStyle}
        size="80%"
        title={
          <HistoryDetailSummary
            craftLabelByValue={new Map([["craft-1", "拉延研合后调试准备"]])}
            detail={detail}
            operatorLabelByValue={new Map([["operator-1", "艾杨"]])}
          />
        }
      >
        <HistoryDetailContent detail={detail} />
      </Drawer>
    );
  }

  const root = document.getElementById("root");
  if (!root) throw new Error("缺少视觉验证根节点。");

  createRoot(root).render(
    <AntdRootProvider>
      <Preview />
    </AntdRootProvider>,
  );
  ```

  该文件属于一次性、已忽略的验证输入，不添加文件头或业务注释。随后启动本地 Vite：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  pnpm exec vite --host 127.0.0.1 --port 5173
  ```

  使用 `playwright` Skill(技能)打开 `http://127.0.0.1:5173/output/playwright/history-summary-header/preview.html`，把 viewport 设置为 `1280×720`。先执行 `localStorage.setItem("qt-app-theme-mode", "light")` 并刷新，保存 `light-1280x720.png`；再写入 `dark`、刷新并保存 `dark-1280x720.png`。逐项读取 DOM bounding box（边界框）并检查：

  - Drawer 保持右侧 `80%` 宽度，关闭按钮可见且为 `44×44px`。
  - 标题栏只出现一次蓝色概要；四列两行共八项，无独立“作业详情 · 模具号”标题。
  - 参数和操作面板从 Drawer body 顶部开始，保持 `64% / 36%`，底边不越过 Drawer。
  - 参数表体、操作时间线均在面板内滚动；分页器固定在操作面板底部。
  - 11 条固定操作记录中第 1 至 10 条属于第 1 页，第 11 条只出现在第 2 页。

  Expected：浅色和深色均满足五项检查；浏览器控制台无新增 error（错误）或 Ant Design warning（警告）。所有固定数据和截图均保留在已忽略的 `output/`，不得提交。

- [ ] **Step 3：检查范围和工作树**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  git diff --check 6ea660b..HEAD
  git log --oneline --max-count=3
  git status --short
  ```

  Expected：`git diff --check` 退出码 0；`6ea660b` 之后只有本计划允许的计划/分页/标题栏提交；工作树无未提交产品文件，忽略的 `output/` 不出现在 `git status --short`。

## 完成条件

- 操作记录每页 10 条，切换作业仍重置第 1 页。
- 成功详情的 Drawer header 完整展示四列两行概要，正文不重复概要。
- 加载和失败状态保留短文本标题及现有反馈。
- 参数、时间线和分页在 `1280×720` 浅色/深色主题下不越界。
- 聚焦测试、完整测试、类型检查、生产构建和 `git diff --check` 全部通过。

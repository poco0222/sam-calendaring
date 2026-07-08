# Task 01: Press Working Page Shell

> @file QT App 压机作业页面外壳任务
> @author PopoY
> @created 2026-06-30
> @purpose 新增 Press Working Page（压机作业页面）frontend-only（仅前端）页面外壳，复用现有 signal snapshot（信号快照）展示。

## Goal（目标）

Add a `PressJobPage（压机作业页）` component（组件） and wire it into the existing `App.tsx` top-level `view state（视图状态）`. The page must render the four required rows at 1280x720, keep all action handlers（处理函数） as no-effect placeholders（无业务效果占位）, and reuse `SignalSnapshotTable（信号快照表）` without adding services（服务）, mock data（模拟数据）, or dependencies（依赖）.

## Status（状态）

- `Completed（已完成）`: Task 01 已按 frontend-only（仅前端）范围完成，未执行后续任务。

## Progress（进度）

- `2026-06-30`: 计划已落库，当前进度 `0/8`。
- `2026-06-30`: Step 1 started（开始）- 编写 `PressJobPage.test.tsx` 和 `App.test.tsx` failing tests（失败测试）。
- `2026-06-30`: Step 1 completed（完成）- 已新增 `PressJobPage.test.tsx` 并更新 `App.test.tsx` 一级导航断言，当前进度 `1/8`。
- `2026-06-30`: Step 2 completed（完成）- focused tests（聚焦测试）按预期 RED（失败）：缺失 `./PressJobPage`，且一级导航未包含“压机作业”，当前进度 `2/8`。
- `2026-06-30`: Step 3 completed（完成）- 已新增 `PressJobPage.css` 四行布局、触控按钮高度和实时信号局部滚动样式，当前进度 `3/8`。
- `2026-06-30`: Step 4 completed（完成）- 已新增 `PressJobPage.tsx`，只保存 `teamId/operatorId/processId`，操作 handler（处理函数）无业务副作用并复用 `SignalSnapshotTable`，当前进度 `4/8`。
- `2026-06-30`: Step 5 completed（完成）- 已在 `App.tsx` 增加 `pressJob` view state（视图状态）、“压机作业”一级导航和页面渲染分支，当前进度 `5/8`。
- `2026-06-30`: Step 6 completed（完成）- focused tests（聚焦测试）通过：`src/components/PressJobPage.test.tsx` 4 tests（测试）和 `src/App.test.tsx` 2 tests（测试）全部通过，当前进度 `6/8`。
- `2026-06-30`: Step 7 completed（完成）- regression（回归）通过：`pnpm test` 16 files/96 tests passed（通过），`pnpm build` completed（构建完成，保留既有 chunk size warning），1280x720 visual smoke（视觉冒烟）确认四区可见、外层无滚动、8 个按钮点击后仍为“未启动”且无通知/对话框，当前进度 `7/8`。
- `2026-06-30`: Step 8 completed（完成）- 当前工作区不是 Git repository（Git 仓库），`git status --short --branch` 返回 `fatal: not a git repository`，跳过 commit（提交），当前进度 `8/8`。

## Files（文件）

- Create: `qt-app/frontend/src/components/PressJobPage.tsx`
- Create: `qt-app/frontend/src/components/PressJobPage.css`
- Create: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write failing render tests（编写失败渲染测试）**

Create `qt-app/frontend/src/components/PressJobPage.test.tsx`:

```tsx
/**
 * @file PressJobPage.test.tsx - 验证 Press Working Page（压机作业页面）。
 * @author PopoY
 * @created 2026-06-30
 * @brief 锁定 frontend-only（仅前端）压机作业页的四行布局、空数据和安全边界。
 */

// @ts-ignore @author PopoY: 当前项目未安装 Node types（Node 类型），此测试运行时由 Vitest（测试框架）提供 node:fs。
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import { PressJobPage } from "./PressJobPage";

const pageCssUrl = new URL("./PressJobPage.css", import.meta.url);
const pageCss = existsSync(pageCssUrl) ? readFileSync(pageCssUrl, "utf8") : "";
const pageSourceUrl = new URL("./PressJobPage.tsx", import.meta.url);
const pageSource = existsSync(pageSourceUrl)
  ? readFileSync(pageSourceUrl, "utf8")
  : "";

/**
 * @brief 渲染 PressJobPage（压机作业页）为 static HTML（静态 HTML）。
 * @author PopoY
 * @param page 被测试的 React element（React 元素）。
 * @returns server-rendered HTML（服务端渲染 HTML）。
 */
function renderPage(page = <PressJobPage />): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      {page}
    </AntdRootProvider>,
  );
}

describe("PressJobPage", () => {
  /**
   * @brief 断言页面渲染 spec（规格）要求的四行区域和空数据状态。
   * @author PopoY
   */
  it("renders the four frontend-only rows without mock data", () => {
    const html = renderPage();

    expect(html).toContain("press-job-page");
    expect(html).toContain("aria-label=\"压机作业筛选区\"");
    expect(html).toContain("班组");
    expect(html).toContain("人员");
    expect(html).toContain("预选工艺");
    expect(html).toContain("请选择班组");
    expect(html).toContain("请选择人员");
    expect(html).toContain("请选择预选工艺");

    expect(html).toContain("aria-label=\"压机作业操作区\"");
    expect(html).toContain("建立通信");
    expect(html).toContain("锁定模具");
    expect(html).toContain("开始加工");
    expect(html).toContain("完成加工");
    expect(html).toContain("移入");
    expect(html).toContain("移出");
    expect(html).toContain("入线");
    expect(html).toContain("出线");
    expect(html).toContain("当前状态：");
    expect(html).toContain("未启动");

    expect(html).toContain("aria-label=\"当前作业信息\"");
    expect(html).toContain("压机");
    expect(html).toContain("模具号");
    expect(html).toContain("预计时长(小时)");
    expect(html).toContain("实际时长(小时)");
    expect(html).toContain("开始时间");
    expect(html).toContain("当前状态");
    expect(html).toContain("暂无当前作业");

    expect(html).toContain("aria-label=\"实时信号\"");
    expect(html).toContain("暂无信号快照数据。");
    expect(html).not.toContain("示例");
    expect(html).not.toContain("mock");
  });

  /**
   * @brief 断言页面只读取已有 signal snapshot（信号快照），不展示 bootstrap（启动）敏感字段。
   * @author PopoY
   */
  it("does not render sensitive bootstrap or device endpoint fields", () => {
    const html = renderPage(
      <PressJobPage
        bootstrapSession={{
          status: "success",
          config: null,
          data: {
            sessionToken: "secret-session-token",
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
            },
            signedLease: {
              leaseId: "lease-secret-01",
              signature: "secret-signature",
              targetDeviceId: "raw-device-01",
            },
            signalConfig: {
              privateKey: "private-key-secret",
              credential: "credential-secret",
            },
            parameterGroupOptions: [{ dictValue: "4", dictLabel: "压机动作参数" }],
          },
          error: null,
          retry: async () => {},
        }}
        driverSession={{
          status: "success",
          data: {
            applyResult: null,
            signalSnapshot: {
              correlationId: "cid-snapshot-01",
              resultCode: "OK",
              signalValues: null as unknown as Record<string, unknown>,
            },
          },
          error: null,
          retry: async () => {},
          refreshSnapshot: async () => {},
        }}
      />,
    );

    expect(html).not.toContain("secret-session-token");
    expect(html).not.toContain("lease-secret-01");
    expect(html).not.toContain("secret-signature");
    expect(html).not.toContain("private-key-secret");
    expect(html).not.toContain("credential-secret");
    expect(html).not.toContain("raw-device-01");
    expect(html).not.toContain("signedLease");
    expect(html).not.toContain("sessionToken");
    expect(html).not.toContain("signalConfig");
    expect(html).not.toContain("privateKey");
    expect(html).not.toContain("credential");
  });

  /**
   * @brief 断言 action handlers（操作处理函数）保持 frontend-only（仅前端）无副作用。
   * @author PopoY
   */
  it("keeps action handlers free of network, storage, logging, and notifications", () => {
    expect(pageSource).toContain("handleConnect");
    expect(pageSource).toContain("handleLockMold");
    expect(pageSource).toContain("handleStartProcessing");
    expect(pageSource).toContain("handleCompleteProcessing");
    expect(pageSource).toContain("handleMoveIn");
    expect(pageSource).toContain("handleMoveOut");
    expect(pageSource).toContain("handleLineIn");
    expect(pageSource).toContain("handleLineOut");
    expect(pageSource).not.toContain("fetch(");
    expect(pageSource).not.toContain("driverClient");
    expect(pageSource).not.toContain("erpClient");
    expect(pageSource).not.toContain("localStorage");
    expect(pageSource).not.toContain("message.");
    expect(pageSource).not.toContain("notification.");
    expect(pageSource).not.toContain("logDiagnostic");
  });

  /**
   * @brief 断言 1280x720 touch IPC（触控工控机）样式保持固定外层和局部滚动。
   * @author PopoY
   */
  it("keeps the 1280x720 page shell compact and touch-ready", () => {
    expect(pageCss).toContain(".press-job-page");
    expect(pageCss).toContain("height: 100%");
    expect(pageCss).toContain("overflow: hidden");
    expect(pageCss).toContain("grid-template-rows:");
    expect(pageCss).toContain(".press-job-page__actions .ant-btn");
    expect(pageCss).toContain("min-height: 44px");
    expect(pageCss).toContain(".press-job-page__signals-body");
    expect(pageCss).toContain("overflow-y: auto");
    expect(pageCss).not.toContain("linear-gradient");
    expect(pageCss).not.toContain("backdrop-filter");
  });
});
```

Update `qt-app/frontend/src/App.test.tsx` inside the first test:

```tsx
    expect(html).toContain("启动仪表盘");
    expect(html).toContain("诊断日志");
    expect(html).toContain("压机作业");
```

- [x] **Step 2: Run tests and confirm RED（运行测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx
```

Expected（预期）:

```text
FAIL src/components/PressJobPage.test.tsx
Error: Failed to resolve import "./PressJobPage"
```

If `App.test.tsx` runs before the missing component failure, it should fail because “压机作业” is not yet rendered in the top-level navigation（一级导航）.

- [x] **Step 3: Create PressJobPage CSS（创建压机页样式）**

Create `qt-app/frontend/src/components/PressJobPage.css`:

```css
/**
 * @file PressJobPage.css - 定义 Press Working Page（压机作业页面）样式。
 * @author PopoY
 * @created 2026-06-30
 * @brief 约束 1280x720 touch IPC（触控工控机）四行布局和局部滚动。
 */

.press-job-page {
  display: grid;
  grid-template-rows: 82px 56px 178px minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.press-job-page__filters,
.press-job-page__actions-row,
.press-job-page__job-table,
.press-job-page__signals {
  min-width: 0;
  border: 1px solid var(--qt-app-control-blue-line);
  border-radius: 6px;
  background: color-mix(in srgb, var(--qt-app-control-blue-soft) 36%, transparent);
}

.press-job-page__filters {
  box-sizing: border-box;
  padding: 8px 10px 0;
}

.press-job-page__filters .ant-form-item {
  margin-bottom: 0;
}

.press-job-page__filters .ant-select-selector {
  min-height: 44px;
}

.press-job-page__actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 10px;
}

.press-job-page__actions {
  min-width: 0;
}

.press-job-page__actions .ant-space-item {
  display: inline-flex;
}

.press-job-page__actions .ant-btn {
  min-height: 44px;
  padding-inline: 12px;
}

.press-job-page__status {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.press-job-page__job-table,
.press-job-page__signals {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.press-job-page__section-title {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  min-height: 34px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  padding-inline: 10px;
}

.press-job-page__table-body,
.press-job-page__signals-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 8px 10px;
}

.press-job-page__table-body {
  overflow: hidden;
}

.press-job-page__signals-body {
  overflow-x: hidden;
  overflow-y: auto;
}

.press-job-page__table-body .ant-table-wrapper,
.press-job-page__table-body .ant-spin-nested-loading,
.press-job-page__table-body .ant-spin-container {
  height: 100%;
}

.press-job-page__table-body .ant-table {
  height: 100%;
}

.press-job-page__table-body .ant-table-container {
  min-width: 0;
}

.press-job-page__table-body .ant-table-thead > tr > th,
.press-job-page__table-body .ant-table-tbody > tr > td {
  padding-block: 6px;
}

.press-job-page__signals-body .signal-snapshot-table {
  min-height: 0;
}

.press-job-page__signals-body .signal-snapshot-groups {
  gap: 8px;
  overflow-x: hidden;
  overflow-y: auto;
}
```

- [x] **Step 4: Create PressJobPage component（创建压机页组件）**

Create `qt-app/frontend/src/components/PressJobPage.tsx`:

```tsx
/**
 * @file PressJobPage.tsx - 渲染 Press Working Page（压机作业页面）。
 * @author PopoY
 * @created 2026-06-30
 * @brief 提供 frontend-only（仅前端）压机作业页面外壳，并复用 SignalSnapshotTable（信号快照表）。
 */

import { Button, Col, Empty, Form, Row, Select, Space, Table, Tag, Typography } from "antd";
import type { ButtonProps, TableProps } from "antd";
import { useState } from "react";

import type { UseBootstrapSessionResult } from "../hooks/useBootstrapSession";
import type { UseDriverSessionResult } from "../hooks/useDriverSession";
import { SignalSnapshotTable } from "./SignalSnapshotTable";
import "./PressJobPage.css";

/**
 * @brief 定义 PressJobPage（压机作业页）接收的 props（属性）。
 * @author PopoY
 */
export type PressJobPageProps = {
  bootstrapSession?: UseBootstrapSessionResult;
  driverSession?: UseDriverSessionResult;
};

type PressJobFilterState = {
  teamId?: string;
  operatorId?: string;
  processId?: string;
};

type SelectOption = {
  label: string;
  value: string;
};

type CurrentJobRow = {
  localJobSessionId: string;
  pressName?: string;
  moldNo?: string;
  plannedDurationHours?: number;
  actualDurationHours?: number;
  startedAt?: string;
  status?: string;
};

type ActionButtonConfig = {
  key: string;
  label: string;
  type?: ButtonProps["type"];
  onClick: () => void;
};

// PopoY: 第一版禁止 mock data（模拟数据），Select（选择器）只保留空 options（选项）。
const EMPTY_SELECT_OPTIONS: SelectOption[] = [];

// PopoY: 当前作业数据源由后续真实业务接入，第一版必须为空。
const EMPTY_CURRENT_JOB_ROWS: CurrentJobRow[] = [];

const CURRENT_JOB_COLUMNS: NonNullable<TableProps<CurrentJobRow>["columns"]> = [
  {
    title: "压机",
    dataIndex: "pressName",
    width: 120,
  },
  {
    title: "模具号",
    dataIndex: "moldNo",
    width: 140,
  },
  {
    title: "预计时长(小时)",
    dataIndex: "plannedDurationHours",
    width: 140,
  },
  {
    title: "实际时长(小时)",
    dataIndex: "actualDurationHours",
    width: 140,
  },
  {
    title: "开始时间",
    dataIndex: "startedAt",
    width: 180,
  },
  {
    title: "当前状态",
    dataIndex: "status",
    width: 120,
    render: (status: CurrentJobRow["status"]) => <Tag>{status || "未启动"}</Tag>,
  },
];

/**
 * @brief 渲染 frontend-only（仅前端）压机作业页面外壳。
 * @author PopoY
 * @param props App shell（应用外壳）传入的启动会话与驱动会话。
 * @returns 用于现场工控机的 React element（React 元素）。
 */
export function PressJobPage({
  bootstrapSession,
  driverSession,
}: PressJobPageProps = {}) {
  const [filters, setFilters] = useState<PressJobFilterState>({});
  const signalValues = driverSession?.data?.signalSnapshot?.signalValues ?? null;
  const parameterGroupOptions =
    bootstrapSession?.data?.parameterGroupOptions ?? [];

  /**
   * @brief 保存 teamId（班组）当前选择，不发起任何请求。
   * @author PopoY
   * @param teamId 选中的班组 ID。
   */
  const handleTeamChange = (teamId?: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, teamId }));
  };

  /**
   * @brief 保存 operatorId（人员）当前选择，不发起任何请求。
   * @author PopoY
   * @param operatorId 选中的人员 ID。
   */
  const handleOperatorChange = (operatorId?: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, operatorId }));
  };

  /**
   * @brief 保存 processId（预选工艺）当前选择，不发起任何请求。
   * @author PopoY
   * @param processId 选中的工艺 ID。
   */
  const handleProcessChange = (processId?: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, processId }));
  };

  /**
   * @brief 预留建立通信 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleConnect = () => {
    void filters;
  };

  /**
   * @brief 预留锁定模具 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleLockMold = () => {
    void filters;
  };

  /**
   * @brief 预留开始加工 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleStartProcessing = () => {
    void filters;
  };

  /**
   * @brief 预留完成加工 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleCompleteProcessing = () => {
    void filters;
  };

  /**
   * @brief 预留移入 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleMoveIn = () => {
    void filters;
  };

  /**
   * @brief 预留移出 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleMoveOut = () => {
    void filters;
  };

  /**
   * @brief 预留入线 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleLineIn = () => {
    void filters;
  };

  /**
   * @brief 预留出线 handler（处理函数），第一版不产生业务效果。
   * @author PopoY
   */
  const handleLineOut = () => {
    void filters;
  };

  const actionButtons: ActionButtonConfig[] = [
    { key: "connect", label: "建立通信", type: "primary", onClick: handleConnect },
    { key: "lockMold", label: "锁定模具", onClick: handleLockMold },
    { key: "startProcessing", label: "开始加工", onClick: handleStartProcessing },
    { key: "completeProcessing", label: "完成加工", onClick: handleCompleteProcessing },
    { key: "moveIn", label: "移入", onClick: handleMoveIn },
    { key: "moveOut", label: "移出", onClick: handleMoveOut },
    { key: "lineIn", label: "入线", onClick: handleLineIn },
    { key: "lineOut", label: "出线", onClick: handleLineOut },
  ];

  return (
    <div className="press-job-page">
      <Form
        aria-label="压机作业筛选区"
        className="press-job-page__filters"
        component="section"
        layout="vertical"
      >
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="班组" name="teamId">
              <Select
                allowClear
                aria-label="班组选择器"
                onChange={handleTeamChange}
                options={EMPTY_SELECT_OPTIONS}
                placeholder="请选择班组"
                value={filters.teamId}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="人员" name="operatorId">
              <Select
                allowClear
                aria-label="人员选择器"
                onChange={handleOperatorChange}
                options={EMPTY_SELECT_OPTIONS}
                placeholder="请选择人员"
                value={filters.operatorId}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="预选工艺" name="processId">
              <Select
                allowClear
                aria-label="预选工艺选择器"
                onChange={handleProcessChange}
                options={EMPTY_SELECT_OPTIONS}
                placeholder="请选择预选工艺"
                value={filters.processId}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <section aria-label="压机作业操作区" className="press-job-page__actions-row">
        <Space className="press-job-page__actions" size={8} wrap>
          {actionButtons.map((actionButton) => (
            <Button
              key={actionButton.key}
              onClick={actionButton.onClick}
              type={actionButton.type}
            >
              {actionButton.label}
            </Button>
          ))}
        </Space>
        <div className="press-job-page__status">
          <Typography.Text strong>当前状态：</Typography.Text>
          <Tag>未启动</Tag>
        </div>
      </section>

      <section aria-label="当前作业信息" className="press-job-page__job-table">
        <header className="press-job-page__section-title">
          <Typography.Text strong>当前作业信息</Typography.Text>
        </header>
        <div className="press-job-page__table-body">
          <Table<CurrentJobRow>
            columns={CURRENT_JOB_COLUMNS}
            dataSource={EMPTY_CURRENT_JOB_ROWS}
            locale={{
              emptyText: (
                <Empty
                  description="暂无当前作业"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={false}
            rowKey="localJobSessionId"
            scroll={{ x: 840, y: 98 }}
            size="small"
          />
        </div>
      </section>

      <section aria-label="实时信号" className="press-job-page__signals">
        <header className="press-job-page__section-title">
          <Typography.Text strong>实时信号</Typography.Text>
        </header>
        <div className="press-job-page__signals-body">
          <SignalSnapshotTable
            parameterGroupOptions={parameterGroupOptions}
            signalValues={signalValues}
          />
        </div>
      </section>
    </div>
  );
}
```

- [x] **Step 5: Wire App view state（接入 App 视图状态）**

Modify `qt-app/frontend/src/App.tsx` imports:

```tsx
import { PressJobPage } from "./components/PressJobPage";
```

Modify `AppView`:

```tsx
type AppView = "dashboard" | "diagnostics" | "pressJob";
```

Modify `Segmented（分段控件）` options:

```tsx
            options={[
              { label: "启动仪表盘", value: "dashboard" },
              { label: "诊断日志", value: "diagnostics" },
              { label: "压机作业", value: "pressJob" },
            ]}
```

Modify the body render branch:

```tsx
      <section className="qt-app-shell__body">
        {currentView === "dashboard" ? (
          <BootstrapDashboard
            bootstrapSession={bootstrapSession}
            driverSession={driverSession}
          />
        ) : currentView === "diagnostics" ? (
          <DiagnosticLogsPage driverBaseUrl={bootstrapSession.config?.driverBaseUrl} />
        ) : (
          <PressJobPage
            bootstrapSession={bootstrapSession}
            driverSession={driverSession}
          />
        )}
      </section>
```

- [x] **Step 6: Run focused GREEN（运行聚焦通过测试）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx
```

Expected（预期）:

```text
PASS src/components/PressJobPage.test.tsx
PASS src/App.test.tsx
```

If `PressJobPage.test.tsx` fails because Ant Design SSR（服务端渲染） does not expose placeholder（占位提示） text, keep the component behavior unchanged and change only the assertion to target the component source for the three exact placeholder strings:

```tsx
    expect(pageSource).toContain("placeholder=\"请选择班组\"");
    expect(pageSource).toContain("placeholder=\"请选择人员\"");
    expect(pageSource).toContain("placeholder=\"请选择预选工艺\"");
```

- [x] **Step 7: Run regression and visual smoke（运行回归与视觉冒烟）**

Run frontend regression（前端回归）:

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

Expected（预期）:

```text
All Vitest suites pass.
Vite build completes. Existing chunk size warnings are acceptable if no new warning class appears.
```

Run visual smoke（视觉冒烟）:

```bash
cd qt-app/frontend
pnpm dev
```

At `1280x720 viewport（视口）`, verify:

1. Top navigation（顶部导航） shows “压机作业”.
2. Press Working Page（压机作业页） shows four visible rows: filters（筛选区）, actions/status（操作区/状态）, current job table（当前作业表）, realtime signals（实时信号）.
3. Outer page has no full-page scroll; realtime signals（实时信号） can scroll locally when needed.
4. Buttons keep at least 44px touch height（触控高度）.
5. Clicking any operation button does not change “未启动”, does not show notification（通知）, and does not send network requests（网络请求）.
6. Current job table（当前作业表） empty state is “暂无当前作业”.
7. Realtime signals（实时信号） empty state is “暂无信号快照数据。”.
8. No sensitive fields（敏感字段） or raw device endpoint（设备端点） values appear.

- [x] **Step 8: Commit or record skipped commit（提交或记录跳过提交）**

Check Git repository（Git 仓库） availability:

```bash
git status --short --branch
```

If this command succeeds, commit:

```bash
git add qt-app/frontend/src/App.tsx qt-app/frontend/src/App.test.tsx qt-app/frontend/src/components/PressJobPage.tsx qt-app/frontend/src/components/PressJobPage.css qt-app/frontend/src/components/PressJobPage.test.tsx
git commit -m "feat: 新增 QT App Press Working Page 页面外壳"
```

If this command fails because the current directory is not a Git repository（Git 仓库）, update this Task（任务） Progress（进度） with:

```markdown
- `2026-06-30`: 当前工作区不是 Git repository（Git 仓库），跳过 commit（提交）。
```

## Final Verification Record（最终验证记录）

- `2026-06-30`: `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx` passed（通过）: 2 test files passed（测试文件通过）, 6 tests passed（测试通过）.
- `2026-06-30`: `pnpm test` passed（通过）: 16 test files passed（测试文件通过）, 96 tests passed（测试通过）.
- `2026-06-30`: `pnpm build` passed（通过）: Vite build completed（构建完成）in 159ms; retained existing chunk size warning（保留既有代码块体积警告）.
- `2026-06-30`: `1280x720 visual smoke（视觉冒烟）` passed（通过）: viewport（视口）1280x720, four regions（四个区域）全部可见，outer page（外层页面）无滚动，8 个 buttons（按钮）高度 44px，点击后 status（状态）保持“当前状态：未启动”，无 notification（通知）/dialog（对话框），当前作业空态“暂无当前作业”和实时信号空态“暂无信号快照数据。”可见，无 sensitive text（敏感文本）.
- `2026-06-30`: commit（提交）skipped（已跳过）: current workspace（当前工作区）is not a Git repository（Git 仓库），`git status --short --branch` failed with `fatal: not a git repository`.

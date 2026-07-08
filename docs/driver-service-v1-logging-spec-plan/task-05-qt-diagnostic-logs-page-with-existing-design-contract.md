# Task 05: QT Diagnostic Logs Page With Existing Design Contract

> @file QT App 诊断日志页面任务
> @author PopoY
> @created 2026-06-27
> @purpose 新增独立 Diagnostic Logs Page（诊断日志页面），复用现有 PRODUCT.md（产品说明）、DESIGN.md（设计说明）和 Ant Design（组件库）约束。

## Goal（目标）

Add an independent `Diagnostic Logs Page（诊断日志页面）` for field troubleshooting without embedding log controls inside `Bootstrap Dashboard（启动仪表盘）`.

## Status（状态）

- `Completed（已完成）`: Task5（任务5）已完成；当前工作区不是 Git repository（Git 仓库），提交已按计划跳过并记录。

## Progress（进度）

- `2026-06-27`: 计划已落库，当前进度 `0/8`。
- `2026-06-27`: Step 1 完成，新增 `diagnosticLogClient.test.ts`，当前进度 `1/8`。
- `2026-06-27`: Step 2 完成，新增 `DiagnosticLogsPage.test.tsx`，当前进度 `2/8`。
- `2026-06-27`: Step 3 完成，`vitest` 确认测试因实现文件缺失失败，当前进度 `3/8`。
- `2026-06-27`: Step 4 完成，新增 `diagnosticLog.ts` 与 `diagnosticLogClient.ts`，`diagnosticLogClient.test.ts` 通过，当前进度 `4/8`。
- `2026-06-27`: Step 5 完成，新增 `DiagnosticLogsPage.tsx` 与 `DiagnosticLogsPage.css`，`DiagnosticLogsPage.test.tsx` 通过，当前进度 `5/8`。
- `2026-06-27`: Step 6 完成，`App.tsx` 新增 `dashboard/diagnostics` view state（视图状态）切换，当前进度 `6/8`。
- `2026-06-27`: Step 7 完成，`vitest` 指定 16 项测试通过，`vite build` 通过但保留 chunk size warning（分块体积告警）；1280x720 light/dark visual smoke（浅色/深色视觉冒烟）通过，当前进度 `7/8`。
- `2026-06-27`: Step 8 完成，根目录与 `qt-app/frontend` 均不是 Git repository（Git 仓库），无法执行 commit（提交），已跳过提交，当前进度 `8/8`。
- `2026-06-27`: reviewer（评审）跟进完成，`DiagnosticLogsPage.test.tsx` 已避免新增 Node types（Node 类型）错误；`tsc --noEmit` 仍因既有 `BootstrapDashboard.test.tsx` 的 `node:fs` 类型缺失失败，未纳入 Task5 修改范围。

## Files（文件）

- Modify: `qt-app/frontend/src/App.tsx`
- Create: `qt-app/frontend/src/domain/diagnosticLog.ts`
- Create: `qt-app/frontend/src/services/diagnosticLogClient.ts`
- Create: `qt-app/frontend/src/services/diagnosticLogClient.test.ts`
- Create: `qt-app/frontend/src/components/DiagnosticLogsPage.tsx`
- Create: `qt-app/frontend/src/components/DiagnosticLogsPage.test.tsx`
- Create: `qt-app/frontend/src/components/DiagnosticLogsPage.css`

## Steps（步骤）

- [x] **Step 1: Write failing diagnostic client tests（编写失败客户端测试）**

Create `qt-app/frontend/src/services/diagnosticLogClient.test.ts`:

```ts
/**
 * @file diagnosticLogClient.test.ts
 * @author PopoY
 * @created 2026-06-27
 * @brief 验证 Diagnostic Logs API（诊断日志接口）客户端的 GET（读取）契约。
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildDiagnosticLogsUrl,
  fetchDiagnosticLogs,
  type GetJson,
} from "./diagnosticLogClient";

describe("diagnosticLogClient", () => {
  /**
   * @brief 断言查询参数只包含 statusClass（状态分类）、category（分类）、correlationId（关联 ID）和 limit（数量限制）。
   */
  it("builds the whitelisted diagnostic logs URL", () => {
    const url = buildDiagnosticLogsUrl("http://127.0.0.1:5096", {
      statusClass: "abnormal",
      category: "device",
      correlationId: "cid-001",
      limit: 100,
    });

    expect(url).toBe(
      "http://127.0.0.1:5096/diagnosticLogs?statusClass=abnormal&category=device&correlationId=cid-001&limit=100",
    );
    expect(url).not.toContain("ip=");
    expect(url).not.toContain("port=");
    expect(url).not.toContain("deviceId=");
  });

  /**
   * @brief 断言客户端使用 GET（读取）并返回白名单 logs（日志）数组。
   */
  it("fetches diagnostic logs through GET", async () => {
    const getJson: GetJson = vi.fn().mockResolvedValue({
      resultCode: "OK",
      logs: [
        {
          createdAt: "2026-06-27T10:00:00Z",
          level: "Error",
          category: "Device",
          statusClass: "Abnormal",
          eventName: "SignalReadFailed",
          eventStage: "Failed",
          correlationId: "cid-001",
          commandName: "getSignalSnapshot",
          resultCode: "DEVICE_TIMEOUT",
          httpStatusCode: 504,
          durationMs: 5000,
          message: "设备通信超时",
          exceptionType: "TimeoutException",
        },
      ],
    });

    const result = await fetchDiagnosticLogs(getJson, {
      driverBaseUrl: "http://127.0.0.1:5096",
      statusClass: "abnormal",
      category: "device",
      limit: 100,
    });

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:5096/diagnosticLogs?statusClass=abnormal&category=device&limit=100",
      5000,
    );
    expect(result.logs).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("signedLease");
    expect(JSON.stringify(result)).not.toContain("sessionToken");
  });
});
```

- [x] **Step 2: Write failing page rendering tests（编写失败页面渲染测试）**

Create `qt-app/frontend/src/components/DiagnosticLogsPage.test.tsx`:

```tsx
/**
 * @file DiagnosticLogsPage.test.tsx
 * @author PopoY
 * @created 2026-06-27
 * @brief 验证 Diagnostic Logs Page（诊断日志页面）的独立页面、固定筛选器和白名单展示契约。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AntdRootProvider } from "../app/AntdRootProvider";
import type { DiagnosticLogRecord } from "../domain/diagnosticLog";
import { DiagnosticLogsPage } from "./DiagnosticLogsPage";

const pageCss = readFileSync(
  new URL("./DiagnosticLogsPage.css", import.meta.url),
  "utf8",
);

const sampleLogs: DiagnosticLogRecord[] = Array.from({ length: 8 }, (_, index) => ({
  createdAt: `2026-06-27T10:00:0${index}Z`,
  level: index === 0 ? "Error" : "Warning",
  category: "Device",
  statusClass: "Abnormal",
  eventName: "SignalReadFailed",
  eventStage: "Failed",
  correlationId: `cid-diagnostic-${index}`,
  commandName: "getSignalSnapshot",
  resultCode: "DEVICE_TIMEOUT",
  httpStatusCode: 504,
  durationMs: 5000,
  message: "设备通信超时",
  exceptionType: "TimeoutException",
}));

/**
 * @brief 渲染诊断日志页面为静态 HTML（超文本标记语言）。
 */
function renderPage(logs: DiagnosticLogRecord[] = sampleLogs): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      <DiagnosticLogsPage
        driverBaseUrl="http://127.0.0.1:5096"
        initialLogs={logs}
      />
    </AntdRootProvider>,
  );
}

describe("DiagnosticLogsPage", () => {
  /**
   * @brief 断言页面默认展示异常筛选、固定分类筛选和固定表格列。
   */
  it("renders fixed filters and table columns", () => {
    const html = renderPage();

    expect(html).toContain("诊断日志");
    expect(html).toContain("异常");
    expect(html).toContain("正常");
    expect(html).toContain("全部");
    expect(html).toContain("启动");
    expect(html).toContain("请求");
    expect(html).toContain("执行");
    expect(html).toContain("设备");
    expect(html).toContain("响应");
    expect(html).toContain("审计");
    expect(html).toContain("时间");
    expect(html).toContain("状态");
    expect(html).toContain("分类");
    expect(html).toContain("命令");
    expect(html).toContain("结果码");
    expect(html).toContain("耗时");
    expect(html).toContain("说明");
    expect(html).toContain("correlationId");
    expect(html).toContain("刷新日志");
    expect(html).toContain("自动刷新");
  });

  /**
   * @brief 断言空异常日志展示中文 empty（空状态）文案。
   */
  it("renders an abnormal-empty message in Chinese", () => {
    const html = renderPage([]);

    expect(html).toContain("当前没有异常日志");
    expect(html).not.toContain("No data");
  });

  /**
   * @brief 断言页面只展示白名单字段，不泄露敏感授权载荷。
   */
  it("does not render sensitive field names", () => {
    const html = renderPage();

    expect(html).not.toContain("signedLease");
    expect(html).not.toContain("signaturePayload");
    expect(html).not.toContain("signalConfig");
    expect(html).not.toContain("sessionToken");
    expect(html).not.toContain("privateKey");
  });

  /**
   * @brief 断言 1280x720 IPC（工控机）视口使用紧凑表格和稳定工具布局。
   */
  it("keeps a compact 1280x720 diagnostic layout", () => {
    expect(pageCss).toContain(".diagnostic-logs-page");
    expect(pageCss).toContain("height: calc(100vh - 24px)");
    expect(pageCss).toContain(".diagnostic-logs-page .ant-table.ant-table-small");
    expect(pageCss).toContain("--diagnostic-toolbar-height:");
    expect(pageCss).toContain("--diagnostic-detail-height:");
    expect(pageCss).not.toContain("linear-gradient");
    expect(pageCss).not.toContain("backdrop-filter");
  });
});
```

- [x] **Step 3: Run tests to confirm RED（确认失败状态）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/diagnosticLogClient.test.ts src/components/DiagnosticLogsPage.test.tsx
```

Expected（期望）: FAIL because diagnostic domain, client, page, and CSS files do not exist yet.

- [x] **Step 4: Add diagnostic log domain and client（新增领域类型与客户端）**

Create `qt-app/frontend/src/domain/diagnosticLog.ts`:

```ts
/**
 * @file diagnosticLog.ts
 * @author PopoY
 * @created 2026-06-27
 * @brief 定义 Diagnostic Logs Page（诊断日志页面）允许展示的白名单字段。
 */

export type DiagnosticStatusClassFilter = "abnormal" | "normal" | "all";
export type DiagnosticCategoryFilter =
  | "all"
  | "startup"
  | "request"
  | "execution"
  | "device"
  | "response"
  | "audit";

export type DiagnosticLogRecord = {
  createdAt: string;
  level: "Information" | "Warning" | "Error";
  category: "Startup" | "Request" | "Execution" | "Device" | "Response" | "Audit";
  statusClass: "Normal" | "Abnormal";
  eventName: string;
  eventStage?: "Start" | "Completed" | "Failed" | "Skipped";
  correlationId?: string;
  commandName?: string;
  resultCode?: string;
  httpStatusCode?: number;
  durationMs?: number;
  leaseState?: string;
  deviceSessionState?: string;
  leaseId?: string;
  targetDeviceId?: string;
  fencingToken?: string | number;
  exceptionType?: string;
  message: string;
};

export type DiagnosticLogsQuery = {
  statusClass: DiagnosticStatusClassFilter;
  category: DiagnosticCategoryFilter;
  correlationId?: string;
  limit: number;
};

export type DiagnosticLogsResponse = {
  resultCode: "OK";
  logs: DiagnosticLogRecord[];
};
```

Create `qt-app/frontend/src/services/diagnosticLogClient.ts`:

```ts
/**
 * @file diagnosticLogClient.ts
 * @author PopoY
 * @created 2026-06-27
 * @brief 实现 GET /diagnosticLogs（诊断日志接口）的最小 typed client（类型化客户端）。
 */
import type {
  DiagnosticLogsQuery,
  DiagnosticLogsResponse,
} from "../domain/diagnosticLog";

export type GetJson = <TResponse>(url: string, timeoutMs: number) => Promise<TResponse>;

export type DiagnosticLogsInput = DiagnosticLogsQuery & {
  driverBaseUrl: string;
  timeoutMs?: number;
};

/**
 * @brief 构建 Diagnostic Logs API（诊断日志接口）URL（统一资源定位符）。
 */
export function buildDiagnosticLogsUrl(
  driverBaseUrl: string,
  query: DiagnosticLogsQuery,
): string {
  const url = new URL("/diagnosticLogs", driverBaseUrl);
  url.searchParams.set("statusClass", query.statusClass);
  url.searchParams.set("category", query.category);
  if (query.correlationId) {
    url.searchParams.set("correlationId", query.correlationId);
  }
  url.searchParams.set("limit", String(query.limit));
  return url.toString();
}

/**
 * @brief 拉取 diagnostic logs（诊断日志）并保留白名单响应字段。
 */
export async function fetchDiagnosticLogs(
  getJson: GetJson,
  input: DiagnosticLogsInput,
): Promise<DiagnosticLogsResponse> {
  return getJson<DiagnosticLogsResponse>(
    buildDiagnosticLogsUrl(input.driverBaseUrl, input),
    input.timeoutMs ?? 5000,
  );
}

/**
 * @brief 通过 fetch（浏览器请求）执行 JSON GET（读取）请求。
 */
export async function getJson<TResponse>(
  url: string,
  timeoutMs: number,
): Promise<TResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const body = (await response.json()) as TResponse;
    if (!response.ok) {
      return body;
    }

    return body;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
```

- [x] **Step 5: Add page component and CSS（新增页面组件与样式）**

Create `DiagnosticLogsPage.tsx` using only allowed components:

```tsx
/**
 * @file DiagnosticLogsPage.tsx
 * @author PopoY
 * @created 2026-06-27
 * @brief 渲染独立 Diagnostic Logs Page（诊断日志页面）。
 */
import { Button, Col, Descriptions, Empty, Input, Row, Segmented, Switch, Table, Tag, Tooltip, Typography } from "antd";
import type { TableProps } from "antd";
import { useMemo, useState } from "react";
import type { DiagnosticCategoryFilter, DiagnosticLogRecord, DiagnosticStatusClassFilter } from "../domain/diagnosticLog";
import "./DiagnosticLogsPage.css";

export type DiagnosticLogsPageProps = {
  driverBaseUrl?: string;
  initialLogs?: DiagnosticLogRecord[];
};

const statusOptions = [
  { label: "异常", value: "abnormal" },
  { label: "正常", value: "normal" },
  { label: "全部", value: "all" },
] satisfies Array<{ label: string; value: DiagnosticStatusClassFilter }>;

const categoryOptions = [
  { label: "全部", value: "all" },
  { label: "启动", value: "startup" },
  { label: "请求", value: "request" },
  { label: "执行", value: "execution" },
  { label: "设备", value: "device" },
  { label: "响应", value: "response" },
  { label: "审计", value: "audit" },
] satisfies Array<{ label: string; value: DiagnosticCategoryFilter }>;

const columns: TableProps<DiagnosticLogRecord>["columns"] = [
  { title: "时间", dataIndex: "createdAt", width: 150, ellipsis: true },
  {
    title: "状态",
    dataIndex: "statusClass",
    width: 72,
    render: (statusClass: DiagnosticLogRecord["statusClass"]) => (
      <Tag color={statusClass === "Abnormal" ? "error" : "success"}>
        {statusClass === "Abnormal" ? "异常" : "正常"}
      </Tag>
    ),
  },
  { title: "分类", dataIndex: "category", width: 72, ellipsis: true },
  { title: "命令", dataIndex: "commandName", width: 150, ellipsis: true },
  { title: "结果码", dataIndex: "resultCode", width: 160, ellipsis: true },
  { title: "耗时", dataIndex: "durationMs", width: 80, render: (durationMs?: number) => durationMs === undefined ? "-" : `${durationMs}ms` },
  { title: "说明", dataIndex: "message", ellipsis: true },
  { title: "correlationId", dataIndex: "correlationId", width: 180, ellipsis: true },
];

/**
 * @brief 渲染现场排障用的诊断日志工具页。
 */
export function DiagnosticLogsPage({
  driverBaseUrl,
  initialLogs = [],
}: DiagnosticLogsPageProps) {
  const [statusClass, setStatusClass] = useState<DiagnosticStatusClassFilter>("abnormal");
  const [category, setCategory] = useState<DiagnosticCategoryFilter>("all");
  const [correlationId, setCorrelationId] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DiagnosticLogRecord | null>(initialLogs[0] ?? null);

  const filteredLogs = useMemo(() => {
    return initialLogs.filter((log) => {
      const statusMatches = statusClass === "all" || log.statusClass.toLowerCase() === statusClass;
      const categoryMatches = category === "all" || log.category.toLowerCase() === category;
      const correlationMatches = !correlationId || log.correlationId === correlationId;
      return statusMatches && categoryMatches && correlationMatches;
    });
  }, [category, correlationId, initialLogs, statusClass]);
  const detailItems = selectedLog
    ? Object.entries(selectedLog).map(([key, value]) => ({
        key,
        label: key,
        children: value === undefined || value === null ? "-" : String(value),
      }))
    : [];

  return (
    <section className="diagnostic-logs-page">
      <Row align="middle" className="diagnostic-logs-page__toolbar" gutter={[8, 8]}>
        <Col flex="none">
          <Typography.Title level={2}>诊断日志</Typography.Title>
        </Col>
        <Col flex="none">
          <Segmented options={statusOptions} value={statusClass} onChange={(value) => setStatusClass(value as DiagnosticStatusClassFilter)} />
        </Col>
        <Col flex="none">
          <Segmented options={categoryOptions} value={category} onChange={(value) => setCategory(value as DiagnosticCategoryFilter)} />
        </Col>
        <Col flex="auto">
          <Input.Search placeholder="correlationId" allowClear onSearch={setCorrelationId} />
        </Col>
        <Col flex="none">
          <Tooltip title="刷新日志">
            <Button disabled={!driverBaseUrl}>
              刷新日志
            </Button>
          </Tooltip>
        </Col>
        <Col flex="none">
          <Switch checked={autoRefresh} checkedChildren="自动刷新" unCheckedChildren="自动刷新" onChange={setAutoRefresh} />
        </Col>
      </Row>
      <Table
        className="diagnostic-logs-page__table"
        columns={columns}
        dataSource={filteredLogs}
        locale={{ emptyText: statusClass === "abnormal" ? <Empty description="当前没有异常日志" /> : <Empty description="当前没有日志" /> }}
        onRow={(record) => ({ onClick: () => setSelectedLog(record) })}
        pagination={false}
        rowKey={(record) => `${record.createdAt}-${record.eventName}-${record.correlationId ?? ""}`}
        size="small"
      />
      <Descriptions className="diagnostic-logs-page__detail" column={4} items={detailItems} size="small" title="日志详情" />
    </section>
  );
}
```

Create `DiagnosticLogsPage.css` with stable height variables:

```css
/**
 * @file DiagnosticLogsPage.css
 * @author PopoY
 * @created 2026-06-27
 * @brief 保持 Diagnostic Logs Page（诊断日志页面）在 1280x720 IPC（工控机）视口内紧凑可读。
 */

.diagnostic-logs-page {
  --diagnostic-toolbar-height: 48px;
  --diagnostic-detail-height: 148px;
  display: grid;
  grid-template-rows: var(--diagnostic-toolbar-height) minmax(0, 1fr) var(--diagnostic-detail-height);
  gap: 8px;
  height: calc(100vh - 24px);
  overflow: hidden;
}

.diagnostic-logs-page__toolbar {
  min-height: 44px;
}

.diagnostic-logs-page .ant-table.ant-table-small .ant-table-cell {
  padding-block: 5px;
}

.diagnostic-logs-page__detail {
  overflow: hidden;
}
```

- [x] **Step 6: Add App Shell view state（新增应用外壳视图状态）**

Modify `App.tsx`:

1. Import `useState（状态 hook）`, `Segmented（分段控件）`, and `DiagnosticLogsPage（诊断日志页面）`.
2. Add `currentView = "dashboard" | "diagnostics"`.
3. Render navigation above the current page.
4. Do not place log table, filters, or detail panel inside `BootstrapDashboard（启动仪表盘）`.

Minimal shape（最小结构）:

```tsx
const [currentView, setCurrentView] = useState<"dashboard" | "diagnostics">("dashboard");

return (
  <main className="qt-app-shell">
    <Segmented
      options={[
        { label: "启动仪表盘", value: "dashboard" },
        { label: "诊断日志", value: "diagnostics" },
      ]}
      value={currentView}
      onChange={(value) => setCurrentView(value as "dashboard" | "diagnostics")}
    />
    {currentView === "dashboard" ? (
      <BootstrapDashboard bootstrapSession={bootstrapSession} driverSession={driverSession} />
    ) : (
      <DiagnosticLogsPage driverBaseUrl={bootstrapSession.config?.driverBaseUrl} />
    )}
  </main>
);
```

- [x] **Step 7: Run frontend verification（运行前端验证）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/diagnosticLogClient.test.ts src/components/DiagnosticLogsPage.test.tsx src/components/BootstrapDashboard.test.tsx
./node_modules/.bin/vite build
```

Expected（期望）: tests PASS; build succeeds. If Vite（构建工具） reports existing chunk size warning（分块体积告警）, record it without treating it as functional failure.

- [x] **Step 8: Commit（提交）**

```bash
git add qt-app/frontend/src/App.tsx qt-app/frontend/src/domain/diagnosticLog.ts qt-app/frontend/src/services/diagnosticLogClient.ts qt-app/frontend/src/services/diagnosticLogClient.test.ts qt-app/frontend/src/components/DiagnosticLogsPage.tsx qt-app/frontend/src/components/DiagnosticLogsPage.test.tsx qt-app/frontend/src/components/DiagnosticLogsPage.css
git commit -m "feat: 新增 QT App diagnostic logs page"
```

If this workspace remains not a Git repository（Git 仓库）, skip commit and record that in the execution note.

## Verification（验证）

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/diagnosticLogClient.test.ts src/components/DiagnosticLogsPage.test.tsx src/components/BootstrapDashboard.test.tsx
./node_modules/.bin/vite build
```

Visual smoke（视觉冒烟）:

1. `1280x720 light theme（浅色主题）`: Diagnostic Logs Page（诊断日志页面） shows toolbar, table header, and at least 8 rows when sample data exists.
2. `1280x720 dark theme（深色主题）`: status tags（状态标签） and detail panel（详情区） remain readable.
3. Bootstrap Dashboard（启动仪表盘） contains only navigation entry, not log table or filters.

/**
 * @file DiagnosticLogsPage.test.tsx - 验证 Diagnostic Logs Page（诊断日志页面）。
 * @author PopoY
 * @created 2026-06-27
 * @editor PopoY
 * @edited 2026-07-29 12:11:37
 * @brief 验证 Diagnostic Logs Page（诊断日志页面）的独立页面、固定筛选器和白名单展示契约。
 */

// @ts-ignore PopoY: 当前项目未安装 Node types（Node 类型），此测试运行时由 Vitest（测试框架）提供 node:fs。
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import type { DiagnosticLogRecord } from "../domain/diagnosticLog";
import {
  DiagnosticLogsPage,
  applyDiagnosticLogRowClick,
  createTimelineLogs,
} from "./DiagnosticLogsPage";

const pageCss = readFileSync(
  new URL("./DiagnosticLogsPage.css", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("./DiagnosticLogsPage.tsx", import.meta.url),
  "utf8",
);

const sampleLogs: DiagnosticLogRecord[] = Array.from({ length: 12 }, (_, index) => ({
  createdAt:
    index === 0
      ? "2026-06-29T02:06:59.884895+00:00"
      : `2026-06-27T10:00:${String(index).padStart(2, "0")}Z`,
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

const chainLogs: DiagnosticLogRecord[] = [
  {
    ...sampleLogs[0],
    createdAt: "2026-06-27T02:00:03Z",
    category: "Response",
    eventName: "ResponseSent",
    eventStage: "Completed",
    message: "响应已发送",
    correlationId: "cid-linear-chain",
  },
  {
    ...sampleLogs[0],
    createdAt: "2026-06-27T02:00:01Z",
    category: "Request",
    eventName: "RequestReceived",
    eventStage: "Start",
    message: "请求已接收",
    correlationId: "cid-linear-chain",
  },
  {
    ...sampleLogs[0],
    createdAt: "2026-06-27T02:00:02Z",
    category: "Execution",
    eventName: "ActionCompleted",
    eventStage: "Completed",
    message: "动作已完成",
    correlationId: "cid-linear-chain",
  },
];

/**
 * @brief 渲染诊断日志页面为 static HTML（静态超文本标记语言）。
 * @param logs 页面初始 diagnostic logs（诊断日志）数据。
 * @returns server-rendered HTML（服务端渲染超文本标记语言）。
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

    expect(html).not.toContain("诊断日志");
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
    expect(html).toContain("操作");
    expect(html).toContain("时间线");
    expect(html).not.toContain("correlationId");
    expect(html).not.toContain("cid-diagnostic");
    expect(html).not.toContain("查看链路");
    expect(html).toContain("刷新日志");
    expect(html).toContain("diagnostic-logs-page__toolbar-icon");
    expect(html).toContain("自动刷新");
  });

  /**
   * @brief 断言 raw ISO timestamp（原始 ISO 时间戳）会转换为现场可读时间。
   * @author PopoY
   */
  it("formats timestamps for field operators", () => {
    const html = renderPage();

    expect(html).toContain("2026-06-29 10:06:59.884");
    expect(html).not.toContain("2026-06-29T02:06:59.884895+00:00");
  });

  /**
   * @brief 断言 backend（后端）返回 null duration（空耗时）时不会拼出 nullms。
   * @author PopoY
   */
  it("renders null duration as a placeholder", () => {
    const html = renderPage([{ ...sampleLogs[0], durationMs: null }]);

    expect(html).toContain(">-<");
    expect(html).not.toContain("nullms");
  });

  /**
   * @brief 断言 resultCode（结果码）列展示中文说明，保留底层稳定码给 API（接口）使用。
   * @author PopoY
   */
  it("renders diagnostic command names and result codes in Chinese", () => {
    const html = renderPage([
      {
        ...sampleLogs[0],
        message: "命令已拒绝",
        commandName: "connectMes",
        resultCode: "COMMAND_NOT_ALLOWED",
      },
    ]);

    expect(html).toContain("建立通信（connectMes）");
    expect(html).toContain("命令未获授权或不在白名单");
  });

  /**
   * @brief 断言详情区使用中文 label（标签）和值。
   * @author PopoY
   */
  it("renders diagnostic detail labels and fixed values in Chinese", () => {
    const html = renderPage();

    expect(html).toContain("创建时间");
    expect(html).toContain("级别");
    expect(html).toContain("错误");
    expect(html).toContain("分类");
    expect(html).toContain("设备");
    expect(html).toContain("状态分类");
    expect(html).toContain("异常");
    expect(html).toContain("事件阶段");
    expect(html).toContain("失败");
    expect(html).toContain("说明");
    expect(html).not.toContain("关联 ID");
    expect(html).not.toContain(">createdAt<");
    expect(html).not.toContain(">eventName<");
    expect(html).not.toContain(">statusClass<");
  });

  /**
   * @brief 断言页面通过 Drawer（抽屉）入口打开 chronological timeline（时间顺序线性视图），底部详情区不再被时间线占用。
   * @author PopoY
   */
  it("keeps the timeline behind a drawer entry point and sorts the active chain", () => {
    const html = renderPage(chainLogs);
    const timelineLogs = createTimelineLogs(chainLogs[0], chainLogs);

    expect(html).toContain("时间线");
    expect(html).not.toContain("diagnostic-logs-page__timeline-list");
    expect(timelineLogs.map((log) => log.eventName)).toEqual([
      "RequestReceived",
      "ActionCompleted",
      "ResponseSent",
    ]);
  });

  /**
   * @brief 断言关联链使用 Ant Design Timeline（时间轴）内建节点和连接线，不保留手写 marker（圆点）。
   * @author PopoY
   */
  it("uses Ant Design Timeline without handwritten markers or rails", () => {
    expect(pageSource).toContain("<Timeline");
    expect(pageSource).toContain("items={timelineLogs.map");
    expect(pageSource).toContain("content: (");
    expect(pageSource).not.toContain("children: (");
    expect(pageSource).toContain('aria-current={isActive ? "true" : undefined}');
    expect(pageSource).not.toContain("diagnostic-logs-page__timeline-marker");
    expect(pageCss).not.toContain("diagnostic-logs-page__timeline-marker");
    expect(pageCss).not.toContain(".ant-timeline-item-tail");
  });

  /**
   * @brief 断言日志超过单页时展示 Ant Design Table pagination（表格分页）。
   * @author PopoY
   */
  it("renders table pagination for multi-page diagnostic logs", () => {
    const html = renderPage();

    expect(html).toContain("ant-pagination");
    expect(html).toContain("共 12 条");
  });

  /**
   * @brief 断言空日志展示中文 empty（空状态）文案。
   * @author PopoY
   */
  it("renders an empty diagnostic log message in Chinese", () => {
    const html = renderPage([]);

    expect(html).toContain("当前没有日志");
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
   * @author PopoY
   */
  it("keeps a compact 1280x720 diagnostic layout", () => {
    expect(pageCss).toContain(".diagnostic-logs-page");
    expect(pageCss).toContain("height: 100%");
    expect(pageCss).toContain(".diagnostic-logs-page .ant-table.ant-table-small");
    expect(pageCss).toContain("--diagnostic-toolbar-height: 36px");
    expect(pageCss).toContain("--diagnostic-detail-height: 184px");
    expect(pageCss).toContain(".diagnostic-logs-page__toolbar-main");
    expect(pageCss).not.toContain(".diagnostic-logs-page__toolbar-filters");
    expect(pageCss).toContain(".diagnostic-logs-page__table {\n  height: 100%");
    expect(pageCss).toContain(".diagnostic-logs-page__toolbar .ant-btn {\n  min-height: 36px");
    expect(pageCss).toContain(".diagnostic-logs-page__toolbar .ant-segmented {\n  min-height: 36px");
    expect(pageCss).not.toContain(".diagnostic-logs-page__toolbar .ant-input-search");
    expect(pageCss).not.toContain(".diagnostic-logs-page__toolbar .ant-typography");
    expect(pageCss).not.toContain("border-radius: 0 0 6px 6px");
    expect(pageCss).not.toContain("border: 1px solid var(--qt-app-control-blue-line)");
    expect(pageCss).not.toContain("border-top: 0");
    expect(pageCss).not.toContain("background: var(--qt-app-control-blue-soft)");
    expect(pageCss).toContain("margin-inline: 0 !important");
    expect(pageCss).toContain("column-gap: 8px");
    expect(pageCss).toContain(".diagnostic-logs-page__table.ant-table-wrapper .ant-table-pagination.ant-pagination");
    expect(pageCss).toContain("margin: 0 !important");
    expect(pageCss).toContain("margin-top: auto !important");
    expect(pageCss).toContain("box-sizing: border-box");
    expect(pageCss).toContain("padding-bottom: 6px");
    expect(pageCss).toContain("padding-top: 6px");
    expect(pageCss).toContain("justify-content: flex-end");
    expect(pageCss).toContain("flex-direction: column");
    expect(pageCss).toContain("grid-template-columns: 96px minmax(0, 1fr)");
    expect(pageCss).toContain(".diagnostic-logs-page__detail-grid");
    expect(pageCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(pageCss).toContain("overflow: hidden");
    expect(pageCss).toContain(".diagnostic-logs-page__timeline-drawer");
    expect(pageCss).toContain(".diagnostic-logs-page__detail-value");
    expect(pageCss).toContain("white-space: nowrap");
    expect(pageCss).toContain("text-overflow: ellipsis");
    expect(pageCss).toContain("table-layout: fixed");
    expect(pageCss).not.toContain("linear-gradient");
    expect(pageCss).not.toContain("backdrop-filter");
  });

  /**
   * @brief 断言 row click（行点击）只更新详情，不再应用隐藏 filter（筛选器）。
   * @author PopoY
   */
  it("selects the clicked row without applying a hidden correlation filter", () => {
    const setSelectedLog = vi.fn();

    applyDiagnosticLogRowClick(sampleLogs[2], setSelectedLog);

    expect(setSelectedLog).toHaveBeenCalledWith(sampleLogs[2]);
  });
});

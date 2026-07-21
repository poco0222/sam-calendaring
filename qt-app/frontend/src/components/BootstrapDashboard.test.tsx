/**
 * @file BootstrapDashboard.test.tsx - 验证 Bootstrap Dashboard（启动仪表盘）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 touch IPC（触控工控机）bootstrap dashboard（启动仪表盘）的紧凑渲染契约。
 */

import { renderToStaticMarkup } from "react-dom/server";
// @ts-ignore @author PopoY: 当前项目未安装 Node types（Node 类型），此测试运行时由 Vitest（测试框架）提供 node:fs。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import { BootstrapDashboard } from "./BootstrapDashboard";

const dashboardCss = readFileSync(
  new URL("./BootstrapDashboard.css", import.meta.url),
  "utf8",
);

/**
 * @brief 将 React element（React 元素）渲染成 static HTML（静态 HTML），便于断言可见文本。
 * @author PopoY
 * @param dashboard 被测试的 Bootstrap dashboard（启动仪表盘）元素。
 * @returns React tree（React 树）生成的 HTML 字符串。
 */
function renderDashboard(dashboard = <BootstrapDashboard />): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      {dashboard}
    </AntdRootProvider>,
  );
}

describe("BootstrapDashboard", () => {
  /**
   * @brief 断言 dashboard（仪表盘）渲染紧凑 no-scroll（无滚动）区块和允许的中文按钮。
   * @author PopoY
   */
  it("renders compact bootstrap sections and only the allowed action buttons in Chinese", () => {
    const html = renderDashboard();

    expect(html).toContain("data-theme=\"light\"");
    expect(html).not.toContain("启动仪表盘");
    expect(html).not.toContain("aria-label=\"启动链路\"");
    expect(html).not.toContain("bootstrap-dashboard__flow");
    expect(html).not.toContain("bootstrap-dashboard__flow-step");
    expect(html).not.toContain("aria-label=\"驱动服务状态\"");
    expect(html).not.toContain("设备会话");
    expect(html).toContain("工控机绑定信息");
    expect(html).toContain("ERP 登录状态");
    expect(html).toContain("信号快照");
    expect(html).toContain("错误面板");
    expect(html).not.toContain("工控机启动链路状态总览");
    expect(html).not.toContain("租约授权状态");

    expect(html).not.toContain("aria-label=\"主题模式\"");
    expect(html).not.toContain("aria-label=\"浅色\"");
    expect(html).not.toContain("aria-label=\"深色\"");
    expect(html).not.toContain("aria-label=\"跟随系统\"");

    expect(html).toContain("重试登录");
    expect(html).toContain("重获授权");
    expect(html).not.toContain("重试应用租约");
    expect(html).toContain("刷新快照");
    expect(countMatches(html, "bootstrap-dashboard__toolbar-icon")).toBe(3);
    expect(countMatches(html, "<button")).toBe(3);

    // PopoY: Task5 必须替换 landing placeholder（占位首页），不能和新界面同时渲染。
    expect(html).not.toContain("QT App Frontend Shell");
    expect(html).not.toContain("Bootstrap Dashboard");
    expect(html).not.toContain("Retry Login");
    expect(html).not.toContain("Unavailable");
  });

  /**
   * @brief 启动仪表盘右侧同时显示 ErrorPanel（错误面板）和 BootstrapConfigPanel（启动配置面板）。
   * @author PopoY
   */
  it("renders error panel and bootstrap config panel in the right column", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        bootstrapSession={{
          status: "success",
          config: {
            stationAccountId: "station-account-01",
            granteeHostId: "host-01",
            stationId: "station-01",
            erpBaseUrl: "http://127.0.0.1:8080",
            driverBaseUrl: "http://127.0.0.1:5000",
            configVersion: "v1",
          },
          data: {
            sessionToken: "secret-session-token",
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
              granteeHostId: "host-01",
            },
            defaultDeviceScope: {
              deviceIds: ["device-01"],
            },
            businessContext: {},
            signedLease: {
              leaseId: "lease-01",
              targetDeviceId: "device-01",
            },
            signalConfig: {
              signals: [{ name: "ready", address: 100 }],
            },
            bootstrapConfigEditable: false,
            bootstrapConfigApprovalState: "readonly",
          },
          error: null,
          retry: async () => {},
        }}
      />,
    );

    expect(html).toContain("错误面板");
    expect(html).toContain("启动配置");
    expect(html).toContain("配置修改未授权或开关不可用");
    expect(html).not.toContain("secret-session-token");
    expect(html).not.toContain("lease-01");
    expect(html).not.toContain("signalConfig");
  });

  /**
   * @brief 断言 readonly notice（只读提示）放在启动配置 Card header（卡片标题区），不侵占 Form（表单）。
   * @author PopoY
   */
  it("renders readonly config notice in the startup config card header", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        bootstrapSession={{
          status: "success",
          config: {
            stationAccountId: "station-account-01",
            granteeHostId: "host-01",
            stationId: "station-01",
            erpBaseUrl: "http://127.0.0.1:8080",
            driverBaseUrl: "http://127.0.0.1:5000",
            configVersion: "v1",
          },
          data: {
            sessionToken: "secret-session-token",
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
              granteeHostId: "host-01",
            },
            defaultDeviceScope: { deviceIds: ["device-01"] },
            businessContext: {},
            signedLease: {
              leaseId: "lease-01",
              targetDeviceId: "device-01",
            },
            signalConfig: { signals: [{ name: "ready", address: 100 }] },
            bootstrapConfigEditable: false,
            bootstrapConfigApprovalState: "readonly",
          },
          error: null,
          retry: async () => {},
        }}
      />,
    );
    const titleIndex = html.indexOf("启动配置");
    const noticeIndex = html.indexOf("配置修改未授权或开关不可用", titleIndex);
    const formPanelIndex = html.indexOf("aria-label=\"启动配置\"", titleIndex);

    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(noticeIndex).toBeGreaterThan(titleIndex);
    expect(formPanelIndex).toBeGreaterThan(noticeIndex);
  });

  /**
   * @brief 断言 editable action（可编辑动作）放在启动配置 Card header（卡片标题区），不在 Form（表单）内占位。
   * @author PopoY
   */
  it("renders startup config save action in the card header when editable", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        bootstrapSession={{
          status: "success",
          config: {
            stationAccountId: "station-account-01",
            granteeHostId: "host-01",
            stationId: "station-01",
            erpBaseUrl: "http://127.0.0.1:8080",
            driverBaseUrl: "http://127.0.0.1:5000",
            configVersion: "v1",
          },
          data: {
            sessionToken: "secret-session-token",
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
              granteeHostId: "host-01",
            },
            defaultDeviceScope: { deviceIds: ["device-01"] },
            businessContext: {},
            signedLease: {
              leaseId: "lease-01",
              targetDeviceId: "device-01",
            },
            signalConfig: { signals: [{ name: "ready", address: 100 }] },
            bootstrapConfigEditable: true,
            bootstrapConfigApprovalState: "editable",
          },
          error: null,
          retry: async () => {},
        }}
      />,
    );
    const titleIndex = html.indexOf("启动配置");
    const saveIndex = html.indexOf("保存配置", titleIndex);
    const formPanelIndex = html.indexOf("aria-label=\"启动配置\"", titleIndex);

    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(saveIndex).toBeGreaterThan(titleIndex);
    expect(formPanelIndex).toBeGreaterThan(saveIndex);
  });

  /**
   * @brief 断言 ERP failure（ERP 失败）渲染中文业务文案，不泄露 raw runtime message（原始运行时消息）。
   * @author PopoY
   */
  it("renders ERP failures in Chinese without leaking raw English messages", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        bootstrapSession={{
          status: "error",
          config: null,
          data: null,
          error: new Error("Failed to fetch ERP Server"),
          retry: async () => {},
        }}
      />,
    );

    expect(html).toContain("启动流程异常");
    expect(html).toContain("启动失败");
    expect(html).toContain("请查看诊断日志后重试。");
    expect(html).not.toContain("Failed to fetch");
    expect(html).not.toContain("Bootstrap Session");
    expect(html).not.toContain("Bootstrap errors detected.");
  });

  /**
   * @brief ERP 启动会话失败且本机配置已读取时，开放启动配置供现场恢复。
   * @author PopoY
   */
  it("allows config recovery editing before an ERP session is established", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        bootstrapSession={{
          status: "error",
          config: {
            stationAccountId: "station-account-01",
            granteeHostId: "host-01",
            stationId: "station-01",
            erpBaseUrl: "http://127.0.0.1:8080",
            driverBaseUrl: "http://127.0.0.1:5096",
            configVersion: "v1",
          },
          data: null,
          error: new Error("ERP session failed"),
          retry: async () => {},
        }}
      />,
    );

    expect(html).toContain("保存配置");
    expect(html).not.toContain("ant-input-disabled");
    expect(html).not.toContain("配置修改未授权或开关不可用");
  });

  /**
   * @brief 断言 dashboard（仪表盘）展示紧凑且 operator-safe（操作员安全）的字段，不展示 ERP internals（ERP 内部数据）。
   * @author PopoY
   */
  it("renders operator-safe startup copy without leaking ERP internals", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        bootstrapSession={{
          status: "success",
          config: {
            stationAccountId: "station-account-01",
            granteeHostId: "host-01",
            stationId: "station-01",
            erpBaseUrl: "http://127.0.0.1:8080",
            driverBaseUrl: "http://127.0.0.1:5000",
            configVersion: "v1",
          },
          data: {
            bootstrapConfigEditable: false,
            bootstrapConfigApprovalState: "readonly",
            sessionToken: "secret-session-token",
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
              granteeHostId: "host-01",
            },
            defaultDeviceScope: {
              deviceIds: ["device-01"],
            },
            businessContext: {
              workOrderNo: "wo-01",
            },
            signedLease: {
              leaseId: "lease-secret-01",
              targetDeviceId: "device-01",
              expiresAt: "2026-06-25T11:16:39Z",
            },
            signalConfig: {
              signals: [{ name: "ready", address: 100 }],
            },
          },
          error: null,
          retry: async () => {},
        }}
      />,
    );

    expect(html).toContain("工控机绑定信息");
    expect(html).toContain("授权主机 ID");
    expect(html).toContain("host-01");
    expect(html).toContain("配置版本");
    expect(html).toContain("v1");
    expect(html).toContain("工控机绑定校验");
    expect(html).toContain("已通过");
    expect(html).toContain("租约授权包");
    expect(html).toContain("已获取");
    expect(html).not.toContain("aria-label=\"驱动服务状态\"");

    expect(html).toContain("启动配置");
    expect(html).toContain("工位账号 ID");
    expect(html).toContain("station-account-01");
    expect(html).toContain("工位/设备 ID");
    expect(html).toContain("ERP 服务地址");
    expect(html).toContain("驱动服务地址");
    expect(html).not.toContain("工位 ID");
    expect(html).not.toContain("登录方式");
    expect(html).not.toContain("工控机免登录");
    expect(html).not.toContain("登录结果");
    expect(html).not.toContain("信号配置");
    expect(html).not.toContain("2026-06-25 19:16:39");

    expect(html).not.toContain("工位上下文");
    expect(html).not.toContain("显示本机启动配置和 ERP 免登录返回的工位信息。");
    expect(html).not.toContain("显示启动链路加载到的会话令牌和 ERP 上下文。");
    expect(html).not.toContain("显示驱动服务启动所需的 ERP 租约授权包。");
    expect(html).not.toContain("显示租约应用结果和设备会话状态。");
    expect(html).not.toContain("显示驱动服务最新只读信号值。");
    expect(html).not.toContain("显示启动链路和驱动服务的中文错误提示。");
    expect(html).not.toContain("会话令牌");
    expect(html).not.toContain("secret-session-token");
    expect(html).not.toContain("默认设备范围");
    expect(html).not.toContain("deviceIds");
    expect(html).not.toContain("业务上下文");
    expect(html).not.toContain("workOrderNo");
    expect(html).not.toContain("租约 ID");
    expect(html).not.toContain("lease-secret-01");
    expect(html).not.toContain("2026-06-25T11:16:39Z");
  });

  /**
   * @brief 断言 dashboard（仪表盘）不再重复渲染 App Shell（应用外壳）已有的 Driver Service（驱动服务）状态。
   * @author PopoY
   */
  it("does not duplicate the app shell Driver Service status inside the dashboard header", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        driverSession={{
          status: "error",
          data: {
            applyResult: {
              correlationId: "cid-apply-connected",
              resultCode: "OK",
              leaseState: "Active",
              deviceSessionState: "Connected",
            },
            signalSnapshot: {
              correlationId: "cid-snapshot-timeout",
              resultCode: "DEVICE_TIMEOUT",
              signalValues: {},
            },
          },
          error: {
            resultCode: "DEVICE_TIMEOUT",
          },
          retry: async () => {},
          refreshSnapshot: async () => {},
          applySignalSnapshotEvent: () => {},
        }}
      />,
    );
    const snapshotStatusHtml = sliceBetween(html, "信号快照", "错误面板");

    expect(html).not.toContain("aria-label=\"驱动服务状态\"");
    expect(html).not.toContain("设备会话：Connected");
    expect(snapshotStatusHtml).toContain("异常");
  });

  /**
   * @brief 信号快照标题右侧展示 refresh interval（刷新间隔）说明和成功刷新状态。
   * @author PopoY
   */
  it("renders signal snapshot refresh metadata in the card header", () => {
    const html = renderDashboard(
      <BootstrapDashboard
        driverSession={{
          status: "success",
          data: {
            applyResult: {
              correlationId: "cid-apply-connected",
              resultCode: "OK",
              leaseState: "Active",
              deviceSessionState: "Connected",
            },
            signalSnapshot: {
              correlationId: "cid-snapshot-ok",
              resultCode: "OK",
              signalValues: {},
            },
          },
          error: null,
          retry: async () => {},
          refreshSnapshot: async () => {},
          applySignalSnapshotEvent: () => {},
        }}
      />,
    );
    const snapshotStatusHtml = sliceBetween(html, "信号快照", "错误面板");

    expect(snapshotStatusHtml).toContain("当前信号刷新间隔为10秒");
    expect(snapshotStatusHtml).toContain("刷新成功");
  });

  /**
   * @brief 断言 Signal Snapshot（信号快照）外层和参数组保留 Card（卡片），参数组普通态不使用蓝色填充。
   * @author PopoY
   */
  it("keeps the signal snapshot and parameter groups as plain cards while signal items stay readable", () => {
    const html = renderDashboard();

    expect(html).not.toContain("bootstrap-dashboard__snapshot-surface");
    expect(dashboardCss).toContain(".bootstrap-dashboard__snapshot-panel > .ant-card");
    expect(dashboardCss).toContain("border: 1px solid color-mix(in srgb, currentColor 12%, transparent)");
    expect(dashboardCss).toContain("background: transparent");
    expect(dashboardCss).not.toContain("border: 1px solid var(--bootstrap-control-blue-line)");
    expect(dashboardCss).not.toContain(
      "background: color-mix(in srgb, var(--bootstrap-control-blue-soft) 42%, transparent)",
    );
    expect(dashboardCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(dashboardCss).toContain("justify-self: start");
    expect(dashboardCss).toContain("text-align: left");
    expect(dashboardCss).toContain("border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent)");
    expect(dashboardCss).not.toContain("border: 1px solid color-mix(in srgb, currentColor 14%, transparent)");
  });

  /**
   * @brief 断言 status card（状态卡片）保留基础 hover/focus（悬停/聚焦）交互反馈。
   * @author PopoY
   */
  it("keeps status card hover and focus feedback", () => {
    expect(dashboardCss).toContain("transition:");
    expect(dashboardCss).toContain(":is(:hover, :focus-within)");
    expect(dashboardCss).toContain("box-shadow: var(--bootstrap-lift-shadow)");
  });

  /**
   * @brief 断言 dark mode（深色模式）使用 macOS-like（类 macOS）高可读局部变量。
   * @author PopoY
   */
  it("keeps dark mode dashboard accents readable", () => {
    expect(dashboardCss).toContain("[data-theme=\"dark\"] .bootstrap-dashboard");
    expect(dashboardCss).toContain("--bootstrap-control-blue: #64d2ff");
    expect(dashboardCss).toContain("--bootstrap-ink-soft: #d1d1d6");
    expect(dashboardCss).toContain(
      "--bootstrap-lift-shadow: 0 0 0 1px rgba(100, 210, 255, 0.18)",
    );
  });

  /**
   * @brief 断言 signal snapshot rows（信号快照行）在 720px IPC（工控机）视口内保持紧凑密度。
   * @author PopoY
   */
  it("keeps the signal snapshot rows compact enough for the 720px IPC viewport", () => {
    expect(dashboardCss).toContain(".signal-snapshot-groups");
    expect(dashboardCss).toContain("overflow-y: auto");
    expect(dashboardCss).toContain(".signal-snapshot-group-row");
    expect(dashboardCss).toContain(
      "grid-template-columns: repeat(var(--signal-row-columns, 1), minmax(0, 1fr))",
    );
    expect(dashboardCss).toContain("grid-column: span var(--signal-group-span, 1)");
    expect(dashboardCss).toContain(
      "grid-template-columns: repeat(var(--signal-group-columns, 1), minmax(0, 1fr))",
    );
    expect(dashboardCss).toContain("min-height: 56px");
    expect(dashboardCss).not.toContain(".ant-table-wrapper");
    expect(dashboardCss).not.toContain(".signal-snapshot-table__pagination");
  });

  /**
   * @brief 断言 top status cards（上排状态卡片）保留底部呼吸空间，并避免 signal rows（信号行）改变主布局。
   * @author PopoY
   */
  it("keeps the top status cards roomy while bottom panels stay fixed", () => {
    expect(dashboardCss).toContain("grid-template-rows: 40px 108px minmax(0, 1fr)");
    expect(dashboardCss).not.toContain(".qt-app-shell--dashboard .bootstrap-dashboard__header");
    expect(dashboardCss).not.toContain("border-radius: 0 0 6px 6px");
    expect(dashboardCss).not.toContain("background: var(--bootstrap-control-blue-soft)");
    expect(dashboardCss).toContain("max-width: none !important");
    expect(dashboardCss).toContain(".bootstrap-dashboard > .ant-col:nth-child(2)");
    expect(dashboardCss).toContain("grid-column: 1 / 9");
    expect(dashboardCss).toContain(".bootstrap-dashboard > .ant-col:nth-child(3)");
    expect(dashboardCss).toContain("grid-column: 9 / 18");
    expect(dashboardCss).toContain(".bootstrap-dashboard__snapshot-panel {\n  grid-column: 1 / 18");
    expect(dashboardCss).toContain(".bootstrap-dashboard__right-column {\n  grid-column: 18 / -1");
    expect(dashboardCss).toContain("grid-row: 2 / 4");
    expect(dashboardCss).toContain("display: grid");
    expect(dashboardCss).toContain(
      "grid-template-rows: minmax(0, 0.44fr) minmax(220px, 0.56fr)",
    );
    expect(dashboardCss).toContain(".bootstrap-dashboard__snapshot-panel > .ant-card");
    expect(dashboardCss).toContain(".bootstrap-dashboard__right-column > .ant-card");
    expect(dashboardCss).toContain(
      ".bootstrap-dashboard__right-column > .ant-card > .ant-card-body",
    );
    expect(dashboardCss).toContain("height: 100%");
    expect(dashboardCss).not.toContain("overflow: auto");
  });

  /**
   * @brief 断言 right column（右侧列）在 720px IPC（工控机）视口内为启动配置保留首屏高度。
   * @author PopoY
   */
  it("keeps the bootstrap config panel visible in the 720px IPC viewport", () => {
    expect(dashboardCss).toContain(
      "grid-template-rows: minmax(0, 0.44fr) minmax(220px, 0.56fr)",
    );
    expect(dashboardCss).toContain(".bootstrap-dashboard__right-column > .ant-card {");
    expect(dashboardCss).toContain("overflow: hidden");
    expect(dashboardCss).toContain(
      ".bootstrap-dashboard__right-column > .ant-card > .ant-card-body",
    );
    expect(dashboardCss).not.toContain("flex: 0 0 auto");
  });

  /**
   * @brief 断言 dashboard actions（仪表盘操作）左对齐且保持更紧凑的视觉高度。
   * @author PopoY
   */
  it("left-aligns compact dashboard action buttons", () => {
    expect(dashboardCss).toContain(".bootstrap-dashboard__header");
    expect(dashboardCss).toContain("justify-content: flex-start");
    expect(dashboardCss).toContain(".bootstrap-dashboard__toolbar .ant-btn");
    expect(dashboardCss).toContain("min-height: 36px");
    expect(dashboardCss).toContain("padding-inline: 10px");
    expect(dashboardCss).toContain(".bootstrap-dashboard__toolbar .ant-btn::before");
  });

  /**
   * @brief 断言 signal snapshot（信号快照）行流被限制在固定面板内滚动。
   * @author PopoY
   */
  it("keeps the grouped signal snapshot inside the fixed panel", () => {
    expect(dashboardCss).toContain(".signal-snapshot-table");
    expect(dashboardCss).toContain(".signal-snapshot-groups");
    expect(dashboardCss).toContain("min-height: 0");
    expect(dashboardCss).toContain("overflow-x: hidden");
    expect(dashboardCss).toContain("overflow-y: auto");
  });

  /**
   * @brief 断言 error panel（错误面板）空状态不显示 ambiguous idle（歧义未启动）文案。
   * @author PopoY
   */
  it("does not show idle copy in the empty error panel", () => {
    const html = renderDashboard();
    const errorPanelHtml = html.slice(html.indexOf("错误面板"));

    expect(errorPanelHtml).toContain("暂无错误");
    expect(errorPanelHtml).not.toContain("未启动");
  });
});

/**
 * @brief 统计 static HTML（静态 HTML）中的重复片段，用于轻量渲染断言。
 * @author PopoY
 * @param value 完整渲染后的 HTML 字符串。
 * @param needle 需要计数的精确 substring（子串）。
 * @returns substring match（子串匹配）的总数。
 */
function countMatches(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

/**
 * @brief 截取两个可见 dashboard title（仪表盘标题）之间的 server-rendered HTML（服务端渲染 HTML）。
 * @author PopoY
 * @param value 完整渲染后的 HTML 字符串。
 * @param startText 区域起点的可见文本。
 * @param endText 区域终点的可见文本。
 * @returns 两个 marker（标记）之间的 HTML 子串。
 */
function sliceBetween(value: string, startText: string, endText: string): string {
  const startIndex = value.indexOf(startText);
  const endIndex = value.indexOf(endText, startIndex + startText.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return value.slice(startIndex, endIndex);
}

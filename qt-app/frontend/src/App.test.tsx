/**
 * @file App.test.tsx - 验证 Qt App（Qt 应用）应用外壳。
 * @author PopoY
 * @created 2026-06-27
 * @editor PopoY
 * @edited 2026-07-24 20:51:17
 * @brief 锁定 App Shell（应用外壳）顶部导航、主题切换和页面容器契约。
 */

// @ts-ignore @author PopoY: 当前项目未安装 Node types（Node 类型），此测试运行时由 Vitest（测试框架）提供 node:fs。
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "./app/AntdRootProvider";
import App, {
  applySavedPressJobExpectedDuration,
  createPressJobExpectedDurationCorrelationId,
  createPressJobPageDriverSession,
  handleDriverDeviceEvent,
  handlePressParameterThresholdReached,
  refreshLatestPressJobCurrentRows,
} from "./App";
import { BootstrapDashboard } from "./components/BootstrapDashboard";
import { PressJobPage } from "./components/PressJobPage";
import type { PressDeviceEvent } from "./domain/driver";
import type { PressJobCurrentJobRow } from "./domain/pressJob";
import type { UseBootstrapSessionResult } from "./hooks/useBootstrapSession";
import {
  applySignalSnapshotEventToData,
  type DriverSessionData,
  type UseDriverSessionResult,
} from "./hooks/useDriverSession";

const appCssUrl = new URL("./App.css", import.meta.url);
const appCss = existsSync(appCssUrl) ? readFileSync(appCssUrl, "utf8") : "";
const appSourceUrl = new URL("./App.tsx", import.meta.url);
const appSource = existsSync(appSourceUrl) ? readFileSync(appSourceUrl, "utf8") : "";

const bootstrapSessionMock = vi.hoisted(() => ({
  current: {
    status: "idle",
    config: {
      stationAccountId: "station-account-01",
      granteeHostId: "host-01",
      stationId: "station-01",
      erpBaseUrl: "http://127.0.0.1:8080",
      driverBaseUrl: "http://127.0.0.1:5000",
      configVersion: "v1",
    },
    data: null,
    error: null,
    retry: async () => {},
  } as UseBootstrapSessionResult,
}));

vi.mock("./hooks/useBootstrapSession", () => ({
  useBootstrapSession: () => bootstrapSessionMock.current,
}));

vi.mock("./hooks/useDriverSession", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./hooks/useDriverSession")>();

  return {
    ...actual,
    canRefreshSignalSnapshot: () => false,
    useDriverSession: () => ({
      status: "idle",
      data: null,
      error: null,
      retry: async () => {},
      refreshSnapshot: async () => {},
      applySignalSnapshotEvent: vi.fn(),
    }),
  };
});

/**
 * @brief 渲染 App Shell（应用外壳）为 static HTML（静态超文本标记语言）。
 * @author PopoY
 * @returns server-rendered HTML（服务端渲染超文本标记语言）。
 */
function renderApp(): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      <App />
    </AntdRootProvider>,
  );
}

/**
 * @brief 从 source（源码）中截取两个 marker（标记）之间的片段，用于锁定应用接线边界。
 * @author PopoY
 * @param source 完整源码。
 * @param startMarker 起始标记。
 * @param endMarker 结束标记。
 * @returns 命中的源码片段，未命中时返回空字符串。
 */
function extractSourceBetween(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);

  return startIndex >= 0 && endIndex > startIndex
    ? source.slice(startIndex, endIndex)
    : "";
}

/**
 * @brief 从最后一个 source marker（源码标记）截取 JSX props（属性）片段，避免命中 import/type（导入/类型）声明。
 * @author PopoY
 * @param source 完整源码。
 * @param startMarker 起始标记。
 * @param endMarker 结束标记。
 * @returns 命中的源码片段，未命中时返回空字符串。
 */
function extractLastSourceBetween(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const startIndex = source.lastIndexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);

  return startIndex >= 0 && endIndex > startIndex
    ? source.slice(startIndex, endIndex)
    : "";
}

/**
 * @brief 创建可手动完成的 Promise（异步结果），稳定复现 GET/PUT 乱序。
 * @author PopoY
 * @returns 可读取 promise（异步结果）并主动 resolve（完成）的测试控制器。
 */
function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

/**
 * @brief 创建 App Shell（应用外壳）测试用 bootstrapSession（启动会话）快照。
 * @author PopoY
 * @param retry bootstrap retry（启动重试）spy（侦测函数）。
 * @returns Dashboard（仪表盘）和 PressJobPage（压机作业页）共用的最小启动状态。
 */
function createSharedBootstrapSession(
  retry: () => Promise<void>,
): UseBootstrapSessionResult {
  return {
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
      sessionToken: "test-session-token",
      stationContext: {
        stationAccountId: "station-account-01",
        stationId: "station-01",
        granteeHostId: "host-01",
      },
      signalConfig: {},
      signedLease: { leaseId: "lease-001" },
      parameterGroupOptions: [],
    },
    error: null,
    retry,
  };
}

/**
 * @brief 创建 App Shell（应用外壳）测试用 driverSession（驱动会话）快照。
 * @author PopoY
 * @param signalValues 当前 signal snapshot（信号快照）值。
 * @param retry driver retry（驱动重试）spy（侦测函数）。
 * @returns Dashboard（仪表盘）和 PressJobPage（压机作业页）共用的驱动状态。
 */
function createSharedDriverSession(
  data: DriverSessionData,
  retry: () => Promise<void>,
): UseDriverSessionResult {
  return {
    status: "success",
    data,
    error: null,
    retry,
    refreshSnapshot: vi.fn(),
    applySignalSnapshotEvent: vi.fn(),
  };
}

beforeEach(() => {
  bootstrapSessionMock.current = {
    status: "idle",
    config: {
      stationAccountId: "station-account-01",
      granteeHostId: "host-01",
      stationId: "station-01",
      erpBaseUrl: "http://127.0.0.1:8080",
      driverBaseUrl: "http://127.0.0.1:5000",
      configVersion: "v1",
    },
    data: null,
    error: null,
    retry: async () => {},
  };
});

describe("App Shell", () => {
  /**
   * @brief 断言一级导航和主题切换属于唯一全局 top bar（顶部栏）。
   * @author PopoY
   */
  it("renders a single global top bar with navigation and theme mode controls", () => {
    const html = renderApp();

    expect(html).toContain("qt-app-shell--dashboard");
    expect(html).toContain("qt-app-shell__topbar");
    expect(html).toContain("aria-label=\"一级页面导航\"");
    expect(html).toContain("启动仪表盘");
    expect(html).toContain("诊断日志");
    expect(html).toContain("压机作业");
    expect(html).toContain("qt-app-shell__station-account");
    expect(html).toContain("aria-label=\"工位账号\"");
    expect(html).toContain("station-account-01");
    expect(html).toContain("设备会话：暂无数据");
    expect(html.indexOf("aria-label=\"工位账号\"")).toBeLessThan(
      html.indexOf("aria-label=\"驱动服务状态\""),
    );
    expect(html).not.toContain("启动链路状态");
    expect(html).not.toContain("本机诊断时间线");
    expect(html).toContain("aria-label=\"主题模式\"");
    expect(html).toContain("aria-label=\"浅色\"");
    expect(html).toContain("aria-label=\"深色\"");
    expect(html).toContain("aria-label=\"跟随系统\"");
  });

  /**
   * @brief 锁定历史作业第四入口、显式页面分支和 App layer（应用层）只读回调。
   * @author PopoY
   */
  it("wires the fourth press job history entry through explicit app branches", () => {
    const historyCallbacksSource = extractSourceBetween(
      appSource,
      "const loadPressJobHistory = useCallback",
      "const loadPressJobTeamOptions = useCallback",
    );

    expect(appSource).toContain(
      'type AppView = "dashboard" | "diagnostics" | "pressJob" | "pressJobHistory"',
    );
    expect(
      appSource.indexOf('{ label: "历史作业", value: "pressJobHistory" }'),
    ).toBeGreaterThan(
      appSource.indexOf('{ label: "压机作业", value: "pressJob" }'),
    );
    expect(appSource).toContain('currentView === "pressJob"');
    expect(appSource).toContain('currentView === "pressJobHistory"');
    expect(historyCallbacksSource).toContain("fetchPressJobHistory(getJson");
    expect(historyCallbacksSource).toContain("fetchPressJobHistoryDetail(getJson");
    expect(historyCallbacksSource.match(/ERP 会话尚未就绪。/g)).toHaveLength(2);
    expect(
      historyCallbacksSource.match(
        /\[bootstrapSession\.config, bootstrapSession\.data\]/g,
      ),
    ).toHaveLength(2);
  });

  /**
   * @brief 历史页面只接收字典 options（选项）和 loader callbacks（加载回调）。
   * @author PopoY
   */
  it("keeps ERP credentials and device context out of PressJobHistoryPage props", () => {
    const historyPropsSource = extractLastSourceBetween(
      appSource,
      "<PressJobHistoryPage",
      "/>",
    );
    const historyPropNames = Array.from(
      historyPropsSource.matchAll(/\b([a-zA-Z]\w*)=/g),
      (match) => match[1],
    ).sort();

    expect(historyPropNames).toEqual([
      "craftOptions",
      "loadHistoryDetail",
      "loadHistoryList",
      "operatorOptions",
    ]);
    expect(historyPropsSource).toContain(
      "craftOptions={bootstrapSession.data?.pressMoldCraftOptions ?? []}",
    );
    expect(historyPropsSource).toContain(
      "operatorOptions={bootstrapSession.data?.pressMoldOperatorOptions ?? []}",
    );
    expect(historyPropsSource).toContain(
      "loadHistoryDetail={loadPressJobHistoryDetail}",
    );
    expect(historyPropsSource).toContain("loadHistoryList={loadPressJobHistory}");
    for (const forbiddenName of [
      "sessionToken",
      "erpBaseUrl",
      "bootstrapSession",
      "driverSession",
      "deviceId",
      "network",
      "signedLease",
      "signalConfig",
    ]) {
      expect(historyPropNames).not.toContain(forbiddenName);
    }
  });

  /**
   * @brief 配置缺失时只显示 FirstRunConfigPage（首次启动配置页），不显示主导航。
   * @author PopoY
   */
  it("renders first-run config page instead of app navigation when config is missing", () => {
    bootstrapSessionMock.current = {
      status: "error",
      config: {
        stationAccountId: "",
        granteeHostId: "host-01",
        stationId: "station-01",
        erpBaseUrl: "http://127.0.0.1:8080",
        driverBaseUrl: "http://127.0.0.1:5000",
        configVersion: "v1",
      },
      data: null,
      error: { code: "CONFIG_INVALID", missingFields: ["stationAccountId"] },
      retry: vi.fn(),
    };

    const html = renderApp();

    expect(html).toContain("首次启动配置");
    expect(html).not.toContain("启动仪表盘");
    expect(html).not.toContain("诊断日志");
    expect(html).not.toContain("压机作业");
  });

  /**
   * @brief 非 CONFIG_INVALID（配置无效）错误即使携带 missingFields（缺失字段）也不触发首次启动页。
   * @author PopoY
   */
  it("keeps app navigation for non-config errors that carry missing fields", () => {
    bootstrapSessionMock.current = {
      status: "error",
      config: {
        stationAccountId: "station-account-01",
        granteeHostId: "host-01",
        stationId: "station-01",
        erpBaseUrl: "http://127.0.0.1:8080",
        driverBaseUrl: "http://127.0.0.1:5000",
        configVersion: "v1",
      },
      data: null,
      error: {
        code: "ERP_AUTO_LOGIN_FAILED",
        missingFields: ["stationAccountId"],
      },
      retry: vi.fn(),
    };

    const html = renderApp();

    expect(html).not.toContain("首次启动配置");
    expect(html).toContain("启动仪表盘");
    expect(html).toContain("诊断日志");
    expect(html).toContain("压机作业");
  });

  /**
   * @brief 断言子页面继承 App Shell（应用外壳）内容区高度。
   * @author PopoY
   */
  it("keeps the page body constrained by the app shell", () => {
    expect(appCss).toContain("grid-template-rows: 56px minmax(0, 1fr)");
    expect(appCss).toContain("gap: 8px");
    expect(appCss).toContain("border-radius: 6px");
    expect(appCss).toContain(".qt-app-shell__station-account");
    expect(appCss).toContain(".qt-app-shell__station-account-value");
    expect(appCss).toContain(".qt-app-shell__driver-session");
    expect(appCss).toContain(".qt-app-shell__body");
    expect(appCss).toContain("min-height: 0");
    expect(appCss).not.toContain("border-bottom: 0");
    expect(appCss).not.toContain("border-radius: 6px 6px 0 0");
    expect(appCss).not.toContain("linear-gradient");
    expect(appCss).not.toContain("backdrop-filter");
  });

  /**
   * @brief 断言 App layer（应用层）注入锁模查询、提交、局部刷新和诊断摘要。
   * @author PopoY
   */
  it("injects mold lock submit, current-job refresh, and diagnostic callbacks", () => {
    expect(appSource).toContain("fetchPressMoldCandidates");
    expect(appSource).toContain("fetchPressMoldInfoRows");
    expect(appSource).toContain("lockPressMold");
    expect(appSource).toContain("fetchPressJobCurrentJobs");
    expect(appSource).toContain("logDiagnostic");
    expect(appSource).toContain("pressJobCurrentRows");
    expect(appSource).toContain("setPressJobCurrentRows");
    expect(appSource).toContain("const searchPressMoldCandidates = useCallback");
    expect(appSource).toContain("fetchPressMoldCandidates(getJson");
    expect(appSource).toContain("const searchPressMoldInfoRows = useCallback");
    expect(appSource).toContain("fetchPressMoldInfoRows(getJson");
    expect(appSource).toContain("const lockPressMold = useCallback");
    expect(appSource).toContain("submitPressMoldLock(postErpJson");
    expect(appSource).toContain("const refreshPressJobCurrentJobs = useCallback");
    expect(appSource).toContain("fetchPressJobCurrentJobs(getJson");
    expect(appSource).toContain("refreshLatestPressJobCurrentRows(");
    expect(appSource).toContain("const recordPressMoldLockDiagnostic = useCallback");
    expect(appSource).toContain("sessionToken: bootstrapSession.data.sessionToken");
    expect(appSource).toContain("moldNo: input.moldNo");
    expect(appSource).toContain("lockedMoldNos: input.lockedMoldNos");
    expect(appSource).toContain("correlationId: input.correlationId");
    expect(appSource).toContain("searchPressMoldCandidates={searchPressMoldCandidates}");
    expect(appSource).toContain("searchPressMoldInfoRows={searchPressMoldInfoRows}");
    expect(appSource).toContain("lockPressMold={lockPressMold}");
    expect(appSource).toContain("refreshPressJobCurrentJobs={refreshPressJobCurrentJobs}");
    expect(appSource).toContain("recordPressMoldLockDiagnostic={recordPressMoldLockDiagnostic}");
    expect(appSource).toContain("currentJobRows={pressJobCurrentRows}");
    const refreshCallbackSource = appSource.slice(
      appSource.indexOf("const refreshPressJobCurrentJobs"),
      appSource.indexOf("const recordPressMoldLockDiagnostic"),
    );
    expect(refreshCallbackSource).not.toContain("bootstrapSession.retry");
    expect(refreshCallbackSource).not.toContain("applyLeaseAndConfig");
  });

  /**
   * @brief 保存成功后使旧 GET 失效并同步 App 行；随后新 GET 仍可接管最新 ERP 值。
   * @author PopoY
   */
  it("does not let an old current-jobs GET overwrite a saved expected duration", async () => {
    const requestVersionRef = { current: 0 };
    const oldGet = createDeferred<PressJobCurrentJobRow[]>();
    let currentRows: PressJobCurrentJobRow[] = [
      {
        localJobSessionId: "press-job-row-0",
        pressJobId: 101,
        plannedDurationHours: "1",
      },
    ];
    const setRows = (
      update: (rows: PressJobCurrentJobRow[]) => PressJobCurrentJobRow[],
    ) => {
      currentRows = update(currentRows);
    };
    const oldRefresh = refreshLatestPressJobCurrentRows(
      requestVersionRef,
      () => oldGet.promise,
      (nextRows) => {
        currentRows = nextRows;
      },
    );
    const updateExpectedDuration = vi.fn().mockResolvedValue(undefined);

    await updateExpectedDuration({ id: 101, expectedDuration: "3" });
    applySavedPressJobExpectedDuration(requestVersionRef, setRows, {
      id: 101,
      expectedDuration: "3",
    });

    expect(currentRows[0]?.plannedDurationHours).toBe("3");

    const oldRows: PressJobCurrentJobRow[] = [
      {
        localJobSessionId: "press-job-row-0",
        pressJobId: 101,
        plannedDurationHours: "1",
      },
    ];
    oldGet.resolve(oldRows);
    await expect(oldRefresh).resolves.toBe(oldRows);
    expect(currentRows[0]?.plannedDurationHours).toBe("3");

    const latestRows: PressJobCurrentJobRow[] = [
      {
        localJobSessionId: "press-job-row-0",
        pressJobId: 101,
        plannedDurationHours: "4",
      },
    ];
    await refreshLatestPressJobCurrentRows(
      requestVersionRef,
      async () => latestRows,
      (nextRows) => {
        currentRows = nextRows;
      },
    );

    expect(currentRows).toBe(latestRows);
    expect(updateExpectedDuration).toHaveBeenCalledOnce();
  });

  /**
   * @brief App refresh（刷新）与预计时长更新必须共享同一个 request version ref（请求版本引用）。
   * @author PopoY
   */
  it("wires current-job refresh and expected-duration update to one version ref", () => {
    const bootstrapRowsSyncSource = extractSourceBetween(
      appSource,
      "const diagnosticStationAccountId",
      "PressJobPage（压机作业页）只接收脱敏",
    );
    const callbacksSource = extractSourceBetween(
      appSource,
      "const refreshPressJobCurrentJobs",
      "const pressJobExpectedDurationProps",
    );

    expect(bootstrapRowsSyncSource).toContain(
      "pressJobCurrentRowsRefreshVersionRef.current += 1",
    );
    expect(callbacksSource).toContain("refreshLatestPressJobCurrentRows(");
    expect(callbacksSource).toContain("applySavedPressJobExpectedDuration(");
    expect(
      callbacksSource.match(/pressJobCurrentRowsRefreshVersionRef/g),
    ).toHaveLength(3);
  });

  /**
   * @brief 预计时长 PUT（更新）每次在 App layer（应用层）生成独立关联 ID，且不向页面暴露关联配置或令牌。
   * @author PopoY
   */
  it("adds a safe correlation ID to each expected-duration client call", () => {
    const randomUuid = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const callbackSource = extractSourceBetween(
      appSource,
      "const updatePressJobExpectedDuration = useCallback",
      "const pressJobExpectedDurationProps",
    );
    const generatorSource = extractSourceBetween(
      appSource,
      "export function createPressJobExpectedDurationCorrelationId",
      "export async function refreshLatestPressJobCurrentRows",
    );
    const pressJobPropsSource = extractLastSourceBetween(
      appSource,
      "<PressJobPage",
      "/>",
    );

    expect([
      createPressJobExpectedDurationCorrelationId(),
      createPressJobExpectedDurationCorrelationId(),
    ]).toEqual([
      "press-job-duration-00000000-0000-4000-8000-000000000001",
      "press-job-duration-00000000-0000-4000-8000-000000000002",
    ]);
    expect(randomUuid).toHaveBeenCalledTimes(2);
    expect(callbackSource).toContain(
      "correlationId: createPressJobExpectedDurationCorrelationId()",
    );
    expect(callbackSource).toContain("request,");
    expect(generatorSource).toContain("crypto.randomUUID()");
    expect(generatorSource).toContain("press-job-duration-");
    expect(generatorSource).not.toContain("sessionToken");
    expect(pressJobPropsSource).not.toContain("correlationId");
    expect(pressJobPropsSource).not.toContain("sessionToken");
  });

  /**
   * @brief 断言 App layer（应用层）注入解锁模具查询、提交和 diagnostic summary（诊断摘要）。
   * @author PopoY
   */
  it("injects mold unlock load, submit, and diagnostic callbacks", () => {
    expect(appSource).toContain("PressMoldUnlockRequest");
    expect(appSource).toContain("fetchPressLockedMolds");
    expect(appSource).toContain("unlockPressMolds as submitPressMoldUnlock");
    expect(appSource).toContain("const loadPressLockedMolds = useCallback");
    expect(appSource).toContain("fetchPressLockedMolds(getJson");
    expect(appSource).toContain("const unlockPressMolds = useCallback");
    expect(appSource).toContain("submitPressMoldUnlock(postErpJson");
    expect(appSource).toContain("const recordPressMoldUnlockDiagnostic = useCallback");
    expect(appSource).toContain('commandName: "pressMoldUnlock"');
    expect(appSource).toContain("loadPressLockedMolds={loadPressLockedMolds}");
    expect(appSource).toContain("unlockPressMolds={unlockPressMolds}");
    expect(appSource).toContain(
      "recordPressMoldUnlockDiagnostic={recordPressMoldUnlockDiagnostic}",
    );

    const unlockCallbackSource = extractSourceBetween(
      appSource,
      "const loadPressLockedMolds",
      "const refreshPressJobCurrentJobs",
    );
    expect(unlockCallbackSource).toContain("sessionToken: bootstrapSession.data.sessionToken");
    expect(unlockCallbackSource).toContain("correlationId: input.correlationId");
    expect(unlockCallbackSource).not.toContain("deviceId");
    expect(unlockCallbackSource).not.toContain("ip");
    expect(unlockCallbackSource).not.toContain("port");

    const pressJobPropsSource = extractLastSourceBetween(
      appSource,
      "<PressJobPage",
      "/>",
    );
    expect(pressJobPropsSource).not.toContain("sessionToken");
  });

  /**
   * @brief 断言 press job filters（压机作业筛选状态）提升到 App Shell（应用外壳）保存。
   * @author PopoY
   */
  it("keeps press job filter state in the app shell across page switches", () => {
    expect(appSource).toContain("pressJobFilters");
    expect(appSource).toContain("setPressJobFilters");
    expect(appSource).toContain("filterState={pressJobFilters}");
    expect(appSource).toContain("onFilterStateChange={setPressJobFilters}");
  });

  /**
   * @brief signalSnapshotChanged（信号快照变化）应刷新共享 driverSession（驱动会话），不触发 bootstrap retry（启动重试）。
   * @author PopoY
   */
  it("applies pushed signal snapshots through the shared driver session", async () => {
    const bootstrapRetrySpy = vi.fn();
    const driverRetrySpy = vi.fn();
    const event: PressDeviceEvent = {
      eventId: "evt-snapshot-001",
      correlationId: "signal-snapshot-publisher-001",
      localJobSessionId: "",
      eventName: "signalSnapshotChanged",
      commandName: "signalSnapshotPublisher",
      resultCode: "OK",
      occurredAt: "2026-07-03T00:00:00Z",
      snapshotValues: [{ signalCode: "pressure", value: 135 }],
    };
    let currentDriverData: DriverSessionData = {
      applyResult: {
        correlationId: "cid-apply-001",
        resultCode: "OK",
        leaseState: "Active",
        deviceSessionState: "Connected",
      },
      signalSnapshot: {
        correlationId: "signal-snapshot-before-event",
        resultCode: "OK",
        signalValues: { pressure: 100 },
      },
    };
    const bootstrapSession = createSharedBootstrapSession(bootstrapRetrySpy);
    const applySignalSnapshotEventSpy = vi.fn((incomingEvent: PressDeviceEvent) => {
      currentDriverData = applySignalSnapshotEventToData(
        currentDriverData,
        incomingEvent,
      )!;
    });
    const recordPressJobParametersSpy = vi.fn();

    await handleDriverDeviceEvent({
      event,
      applySignalSnapshotEvent: applySignalSnapshotEventSpy,
      recordDiagnostic: vi.fn(),
      recordPressJobParameters: recordPressJobParametersSpy,
      recordedStartParameterKeys: new Set(),
      stationAccountId: "station-account-01",
    });

    const driverSession = createSharedDriverSession(
      currentDriverData,
      driverRetrySpy,
    );
    const html = renderToStaticMarkup(
      <AntdRootProvider>
        <BootstrapDashboard
          bootstrapSession={bootstrapSession}
          driverSession={driverSession}
        />
        <PressJobPage
          bootstrapSession={{
            ...bootstrapSession,
            config: null,
          }}
          driverSession={createPressJobPageDriverSession(driverSession)}
        />
      </AntdRootProvider>,
    );
    const deviceEventSubscriptionSource = extractSourceBetween(
      appSource,
      "handleDriverDeviceEvent({",
      "return () =>",
    );

    expect(applySignalSnapshotEventSpy).toHaveBeenCalledWith(event);
    expect(recordPressJobParametersSpy).not.toHaveBeenCalled();
    expect(html.match(/135/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(deviceEventSubscriptionSource).toContain(
      "applySignalSnapshotEvent: driverSession.applySignalSnapshotEvent",
    );
    expect(deviceEventSubscriptionSource).not.toContain("bootstrapSession.retry");
    expect(bootstrapRetrySpy).not.toHaveBeenCalled();
    expect(driverRetrySpy).not.toHaveBeenCalled();
  });

  /**
   * @brief pressDownCount monitor（下压计数监测）事件处理失败时应收口 async error（异步错误）。
   * @author PopoY
   */
  it("contains press down count monitor async errors inside the device event handler", async () => {
    const recordDiagnostic = vi.fn();

    await expect(
      handleDriverDeviceEvent({
        event: {
          eventId: "event-press-down-001",
          correlationId: "event-cid-001",
          localJobSessionId: "job-01",
          eventName: "pressDownCountThresholdReached",
          commandName: "startPressDownCountMonitor",
          resultCode: "OK",
          parameterIdempotencyKey: "param-start-001",
          occurredAt: "2026-07-03T00:00:00Z",
          snapshotValues: [{ signalCode: "pressure", value: 135 }],
        },
        applySignalSnapshotEvent: vi.fn(),
        recordDiagnostic,
        recordPressJobParameters: vi.fn().mockRejectedValue(new Error("ERP 500")),
        recordedStartParameterKeys: new Set(),
        stationAccountId: "station-account-01",
      }),
    ).resolves.toBeUndefined();
    expect(recordDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "pressDownCountThresholdReached",
        resultCode: "START_PARAMETER_RECORD_FAILED",
      }),
    );
  });

  /**
   * @brief 断言 App（应用入口）把 Task7（任务七）动作回调和安全 props（属性）注入 PressJobPage（压机作业页）。
   * @author PopoY
   */
  it("wires Task7 press device callbacks without passing bootstrap secrets to PressJobPage", () => {
    expect(appSource).toContain("executePressDeviceCommand={executePressDeviceCommand}");
    expect(appSource).toContain("startPressJob={startPressJob}");
    expect(appSource).toContain("recordPressJobParameters={recordPressJobParameters}");
    expect(appSource).toContain("completePressJob={completePressJob}");
    expect(appSource).toContain("getFinalSignalSnapshot={getFinalSignalSnapshot}");
    expect(appSource).toContain("updatePressMachineStatus={updatePressMachineStatus}");
    expect(appSource).toContain("refreshSignalSnapshot={refreshSignalSnapshot}");
    expect(appSource).toContain(
      "recordPressDeviceActionDiagnostic={recordPressDeviceActionDiagnostic}",
    );
    expect(appSource).toContain("subscribeDriverDeviceEvents");
    expect(appSource).toContain("handlePressParameterThresholdReached");
    expect(appSource).toContain("handleDriverDeviceEvent({");
    expect(appSource).toContain(
      "applySignalSnapshotEvent: driverSession.applySignalSnapshotEvent",
    );

    const pressJobPropsSource = extractLastSourceBetween(
      appSource,
      "<PressJobPage",
      "/>",
    );
    expect(pressJobPropsSource).toContain("driverSession={pressJobPageDriverSession}");
    expect(pressJobPropsSource).not.toContain("driverSession={driverSession}");
    expect(pressJobPropsSource).not.toContain("bootstrapSession={bootstrapSession}");
    expect(pressJobPropsSource).not.toContain("sessionToken");
    expect(pressJobPropsSource).not.toContain("signedLease");
    expect(pressJobPropsSource).not.toContain("signalConfig");
    expect(pressJobPropsSource).not.toContain("driverBaseUrl");
    expect(pressJobPropsSource).not.toContain("erpBaseUrl");
  });

  /**
   * @brief 断言 App（应用入口）传给 PressJobPage（压机作业页）的 driverSession（驱动会话）会裁剪设备身份字段。
   * @author PopoY
   */
  it("sanitizes driver session data before passing it to PressJobPage", () => {
    const retry = vi.fn();
    const refreshSnapshot = vi.fn();
    const applySignalSnapshotEvent = vi.fn();

    const driverSession = createPressJobPageDriverSession({
      status: "success",
      data: {
        applyResult: {
          correlationId: "cid-apply-01",
          resultCode: "OK",
          message: "设备已连接",
          leaseState: "Active",
          deviceSessionState: "Connected",
          leaseId: "lease-01",
          targetDeviceId: "drop-device",
          fencingToken: "drop-fencing-token",
        },
        signalSnapshot: {
          correlationId: "cid-snapshot-01",
          resultCode: "OK",
          signalValues: {
            safePressDownCount: 5,
            deviceId: "drop-device",
            ip: "drop-ip",
            port: 502,
            rawRegisters: "drop-raw-registers",
            registerAddress: 100,
            signaturePayload: "drop-signature-payload",
            targetEndpoint: "drop-target-endpoint",
            writeValue: true,
          },
        },
      },
      error: null,
      retry,
      refreshSnapshot,
      applySignalSnapshotEvent,
    });

    expect(driverSession).toEqual({
      status: "success",
      data: {
        applyResult: {
          correlationId: "cid-apply-01",
          resultCode: "OK",
          message: "设备已连接",
          leaseState: "Active",
          deviceSessionState: "Connected",
        },
        signalSnapshot: {
          correlationId: "cid-snapshot-01",
          resultCode: "OK",
          signalValues: {
            safePressDownCount: 5,
          },
        },
      },
      error: null,
      retry,
      refreshSnapshot,
    });
    expect(JSON.stringify(driverSession)).not.toContain("drop-device");
    expect(JSON.stringify(driverSession)).not.toContain("drop-ip");
    expect(JSON.stringify(driverSession)).not.toContain("drop-raw-registers");
    expect(JSON.stringify(driverSession)).not.toContain("drop-signature-payload");
    expect(JSON.stringify(driverSession)).not.toContain("drop-target-endpoint");
    expect(JSON.stringify(driverSession)).not.toContain("registerAddress");
    expect(JSON.stringify(driverSession)).not.toContain("writeValue");
  });

  /**
   * @brief 断言 pressDownCount threshold event（下压计数阈值事件）只记录一次 start 参数。
   * @author PopoY
   */
  it("records start parameters once for press down count threshold events", async () => {
    const recordPressJobParameters = vi.fn().mockResolvedValue({
      correlationId: "event-cid-01",
      localJobSessionId: "job-01",
      resultCode: "OK",
    });
    const recordDiagnostic = vi.fn();
    const recordedStartParameterKeys = new Set<string>();
    const event = {
      eventId: "event-01",
      correlationId: "event-cid-01",
      localJobSessionId: "job-01",
      eventName: "pressDownCountThresholdReached" as const,
      commandName: "startPressDownCountMonitor" as const,
      resultCode: "OK" as const,
      parameterIdempotencyKey: "param-start-01",
      occurredAt: "2026-07-02T10:30:00Z",
      snapshotValues: [
        { signalCode: "safePressDownCount", value: 5 },
        { signalCode: "deviceId", value: "drop-device" },
        { signalCode: "rawRegisters", value: "drop-raw-registers" },
        { signalCode: "signaturePayload", value: "drop-signature-payload" },
        { signalCode: "targetEndpoint", value: "drop-target-endpoint" },
      ],
    };

    await expect(
      handlePressParameterThresholdReached({
        event,
        recordDiagnostic,
        recordPressJobParameters,
        recordedStartParameterKeys,
        stationAccountId: "station-a",
      }),
    ).resolves.toBe("RECORDED");
    await expect(
      handlePressParameterThresholdReached({
        event,
        recordDiagnostic,
        recordPressJobParameters,
        recordedStartParameterKeys,
        stationAccountId: "station-a",
      }),
    ).resolves.toBe("DUPLICATE");

    expect(recordPressJobParameters).toHaveBeenCalledTimes(1);
    expect(recordPressJobParameters).toHaveBeenCalledWith({
      correlationId: "event-cid-01",
      idempotencyKey: "param-start-01",
      parameterIdempotencyKey: "param-start-01",
      localJobSessionId: "job-01",
      type: "start",
      signalValues: { safePressDownCount: 5 },
    });
    expect(recordDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "pressDownCountThresholdReached",
        localJobSessionId: "job-01",
        resultCode: "DUPLICATE_START_PARAMETER_EVENT",
      }),
    );
  });
});

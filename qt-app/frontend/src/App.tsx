/**
 * @file App.tsx - 渲染 Qt App（Qt 应用）前端入口视图。
 * @author PopoY
 * @created 2026-06-25
 * @editor PopoY
 * @edited 2026-07-24 20:51:57
 * @brief 编排 bootstrap hooks（启动 hooks）并渲染 QT App（Qt 应用）四个一级页面的 app shell（应用外壳）。
 */

import { Segmented, Space, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useQtAppThemeMode, type QtAppThemeMode } from "./app/AntdRootProvider";
import { BootstrapDashboard } from "./components/BootstrapDashboard";
import { DiagnosticLogsPage } from "./components/DiagnosticLogsPage";
import { FirstRunConfigPage } from "./components/FirstRunConfigPage";
import { PressJobHistoryPage } from "./components/PressJobHistoryPage";
import { PressJobPage } from "./components/PressJobPage";
import type {
  PressJobFilterState,
  PressJobPageBootstrapSession,
  PressJobPageDriverSession,
} from "./components/PressJobPage";
import type {
  PressDeviceCommandRequest,
  PressDeviceEvent,
  PressDeviceEventSnapshotValue,
} from "./domain/driver";
import type { LogRecord } from "./domain/logRecord";
import type {
  PressJobCurrentJobRow,
  PressJobCompleteRequest,
  PressJobExpectedDurationUpdateRequest,
  PressJobHistoryQuery,
  PressJobParameterRecordRequest,
  PressJobStartRequest,
  PressMachineStatusUpdateRequest,
  PressMoldLockRequest,
  PressMoldUnlockRequest,
} from "./domain/pressJob";
import { useBootstrapSession } from "./hooks/useBootstrapSession";
import {
  useDriverSession,
  type UseDriverSessionResult,
} from "./hooks/useDriverSession";
import {
  REQUIRED_BOOTSTRAP_CONFIG_FIELDS,
  readMissingBootstrapConfigFields,
  type RequiredBootstrapConfigField,
} from "./services/bootstrapFlow";
import {
  fetchPressLockedMolds,
  fetchPressJobCurrentJobs,
  fetchPressJobHistory,
  fetchPressJobHistoryDetail,
  fetchPressJobTeamOptions,
  fetchPressMoldCandidates,
  fetchPressMoldInfoRows,
  getJson,
  completePressJob as submitCompletePressJob,
  lockPressMold as submitPressMoldLock,
  recordPressJobParameters as submitPressJobParameters,
  startPressJob as submitStartPressJob,
  unlockPressMolds as submitPressMoldUnlock,
  updatePressMachineStatus as submitPressMachineStatus,
  updatePressJobExpectedDuration as submitPressJobExpectedDuration,
  postJson as postErpJson,
} from "./services/erpClient";
import {
  executePressDeviceCommand as submitPressDeviceCommand,
  getSignalSnapshot,
  precheckPressDeviceCommand as submitPrecheckPressDeviceCommand,
  postJson as postDriverJson,
} from "./services/driverClient";
import { subscribeDriverDeviceEvents } from "./services/driverDeviceEventsClient";
import { logDiagnostic } from "./services/logging";
import type { NativeBootstrapConfig } from "./types/native";
import "./App.css";

type AppView = "dashboard" | "diagnostics" | "pressJob" | "pressJobHistory";

const UNKNOWN_STATION_ACCOUNT_ID = "UNKNOWN_STATION_ACCOUNT";
const PRESS_DEVICE_ACTION_TIMEOUT_MS = 5000;
const PRESS_JOB_DRIVER_SESSION_FORBIDDEN_SIGNAL_KEYS = new Set([
  "credential",
  "deviceid",
  "ip",
  "port",
  "privatekey",
  "rawregisters",
  "registeraddress",
  "sessiontoken",
  "signalconfig",
  "signature",
  "signaturepayload",
  "signedlease",
  "snapshotvalues",
  "signalvalues",
  "targetendpoint",
  "writevalue",
]);

/**
 * @brief 将 bootstrap（启动）与 driver（驱动）hooks 连接到 QT App（Qt 应用）页面。
 * @returns 带一级导航的 React element（React 元素）。
 */
export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [pressJobCurrentRows, setPressJobCurrentRows] = useState<
    PressJobCurrentJobRow[]
  >([]);
  const pressJobCurrentRowsRefreshVersionRef = useRef(0);
  // @author PopoY: 将压机筛选状态放在 App Shell（应用外壳），避免页面切换卸载后丢失。
  const [pressJobFilters, setPressJobFilters] = useState<PressJobFilterState>({});
  const { themeMode, setThemeMode } = useQtAppThemeMode();
  const bootstrapSession = useBootstrapSession();
  const driverInput = useMemo(() => {
    if (!bootstrapSession.config || !bootstrapSession.data) {
      return null;
    }

    return {
      driverBaseUrl: bootstrapSession.config.driverBaseUrl,
      stationAccountId:
        bootstrapSession.data.stationContext.stationAccountId ??
        bootstrapSession.config.stationAccountId,
      signedLease: bootstrapSession.data.signedLease,
      signalConfig: bootstrapSession.data.signalConfig,
    };
  }, [bootstrapSession.config, bootstrapSession.data]);
  const driverSession = useDriverSession(driverInput);
  // @author PopoY: 同一 localJobSessionId + start（本地会话 + 开始参数）只允许记录一次。
  const recordedStartParameterKeysRef = useRef<Set<string>>(new Set());
  const diagnosticStationAccountId =
    bootstrapSession.data?.stationContext.stationAccountId ??
    bootstrapSession.config?.stationAccountId ??
    UNKNOWN_STATION_ACCOUNT_ID;
  // @author PopoY: bootstrap rows（启动行）接管状态时失效旧会话仍 pending（等待中）的 current jobs GET。
  useEffect(() => {
    pressJobCurrentRowsRefreshVersionRef.current += 1;
    setPressJobCurrentRows(bootstrapSession.data?.pressJobCurrentJobs ?? []);
  }, [bootstrapSession.data?.pressJobCurrentJobs]);
  // @author PopoY: PressJobPage（压机作业页）只接收脱敏 bootstrap view model（启动视图模型）。
  const pressJobPageBootstrapSession = useMemo<PressJobPageBootstrapSession>(
    () => ({
      status: bootstrapSession.status,
      config: null,
      data: bootstrapSession.data
        ? {
            stationContext: bootstrapSession.data.stationContext,
            pressJobLookupData: bootstrapSession.data.pressJobLookupData,
            pressJobCurrentJobs: bootstrapSession.data.pressJobCurrentJobs,
            parameterGroupOptions: bootstrapSession.data.parameterGroupOptions,
            pressMoldWorkTypeOptions: bootstrapSession.data.pressMoldWorkTypeOptions,
            pressMoldCraftOptions: bootstrapSession.data.pressMoldCraftOptions,
            pressMoldOperatorOptions: bootstrapSession.data.pressMoldOperatorOptions,
          }
        : null,
      error: bootstrapSession.error,
      retry: bootstrapSession.retry,
    }),
    [
      bootstrapSession.data,
      bootstrapSession.error,
      bootstrapSession.retry,
      bootstrapSession.status,
    ],
  );
  const pressJobPageDriverSession = useMemo(
    () => createPressJobPageDriverSession(driverSession),
    [driverSession],
  );

  // @author PopoY: 历史页只接收脱敏查询，ERP 地址和 token（令牌）保留在 App 闭包。
  const loadPressJobHistory = useCallback(
    async (query: PressJobHistoryQuery) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("ERP 会话尚未就绪。");
      }

      return fetchPressJobHistory(getJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        query,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const loadPressJobHistoryDetail = useCallback(
    async (input: { moldJobId: string; correlationId: string }) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("ERP 会话尚未就绪。");
      }

      return fetchPressJobHistoryDetail(getJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        moldJobId: input.moldJobId,
        correlationId: input.correlationId,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const loadPressJobTeamOptions = useCallback(
    async (teamId: string) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        return {
          teamId,
          operatorOptions: [],
          processOptions: [],
        };
      }

      return fetchPressJobTeamOptions(getJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        teamId,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const searchPressMoldCandidates = useCallback(
    async (input: {
      moldNo: string;
      lockedMoldNos: string[];
      correlationId: string;
    }) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        return [];
      }

      return fetchPressMoldCandidates(getJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        moldNo: input.moldNo,
        lockedMoldNos: input.lockedMoldNos,
        correlationId: input.correlationId,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const searchPressMoldInfoRows = useCallback(
    async (input: {
      moldNo: string;
      lockedMoldNos: string[];
      correlationId: string;
    }) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        return [];
      }

      return fetchPressMoldInfoRows(getJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        moldNo: input.moldNo,
        lockedMoldNos: input.lockedMoldNos,
        correlationId: input.correlationId,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const lockPressMold = useCallback(
    async (request: PressMoldLockRequest) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("锁模前启动会话未就绪。");
      }

      return submitPressMoldLock(postErpJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        request,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  // @author PopoY: 解锁 Drawer（抽屉）只需要 App layer（应用层）代取已锁定模具，不暴露 sessionToken（会话令牌）。
  const loadPressLockedMolds = useCallback(
    async (input: { correlationId: string }) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        return [];
      }

      return fetchPressLockedMolds(getJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        correlationId: input.correlationId,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  // @author PopoY: 解锁提交只转发白名单 request（请求），设备网络字段仍由 ERP client（客户端）拦截。
  const unlockPressMolds = useCallback(
    async (request: PressMoldUnlockRequest) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("解锁模具前启动会话未就绪。");
      }

      return submitPressMoldUnlock(postErpJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        request,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const refreshPressJobCurrentJobs = useCallback(async () => {
    const config = bootstrapSession.config;
    const data = bootstrapSession.data;

    if (!config || !data) {
      pressJobCurrentRowsRefreshVersionRef.current += 1;
      setPressJobCurrentRows([]);
      return [];
    }

    return refreshLatestPressJobCurrentRows(
      pressJobCurrentRowsRefreshVersionRef,
      () =>
        fetchPressJobCurrentJobs(getJson, {
          erpBaseUrl: config.erpBaseUrl,
          sessionToken: data.sessionToken,
        }),
      setPressJobCurrentRows,
    );
  }, [bootstrapSession.config, bootstrapSession.data]);
  // @author PopoY: UI request（界面请求）只含业务字段，sessionToken（会话令牌）由 App 闭包补入认证 header（请求头）。
  const updatePressJobExpectedDuration = useCallback(
    async (request: PressJobExpectedDurationUpdateRequest) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("预计时长更新前启动会话未就绪。");
      }

      await submitPressJobExpectedDuration({
        correlationId: createPressJobExpectedDurationCorrelationId(),
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        request,
      });
      applySavedPressJobExpectedDuration(
        pressJobCurrentRowsRefreshVersionRef,
        setPressJobCurrentRows,
        request,
      );
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const pressJobExpectedDurationProps = { updatePressJobExpectedDuration };
  const executePressDeviceCommand = useCallback(
    async (request: PressDeviceCommandRequest) => {
      if (!bootstrapSession.config) {
        throw new Error("驱动服务地址未就绪。");
      }

      return submitPressDeviceCommand(postDriverJson, {
        ...request,
        driverBaseUrl: bootstrapSession.config.driverBaseUrl,
      });
    },
    [bootstrapSession.config],
  );
  const precheckPressDeviceCommand = useCallback(
    async (request: PressDeviceCommandRequest) => {
      if (!bootstrapSession.config) {
        throw new Error("驱动服务地址未就绪。");
      }

      return submitPrecheckPressDeviceCommand(postDriverJson, {
        ...request,
        driverBaseUrl: bootstrapSession.config.driverBaseUrl,
      });
    },
    [bootstrapSession.config],
  );
  const startPressJob = useCallback(
    async (request: PressJobStartRequest) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("开始加工前启动会话未就绪。");
      }

      return submitStartPressJob(postErpJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        request,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const recordPressJobParameters = useCallback(
    async (request: PressJobParameterRecordRequest) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("参数记录前启动会话未就绪。");
      }

      return submitPressJobParameters(postErpJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        request,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const completePressJob = useCallback(
    async (request: PressJobCompleteRequest) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("完成加工前启动会话未就绪。");
      }

      return submitCompletePressJob(postErpJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        request,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const updatePressMachineStatus = useCallback(
    async (request: PressMachineStatusUpdateRequest) => {
      if (!bootstrapSession.config || !bootstrapSession.data) {
        throw new Error("设备状态更新前启动会话未就绪。");
      }

      return submitPressMachineStatus(postErpJson, {
        erpBaseUrl: bootstrapSession.config.erpBaseUrl,
        sessionToken: bootstrapSession.data.sessionToken,
        request,
      });
    },
    [bootstrapSession.config, bootstrapSession.data],
  );
  const getFinalSignalSnapshot = useCallback(
    async (input: { correlationId: string }) => {
      if (!bootstrapSession.config) {
        throw new Error("驱动服务地址未就绪。");
      }

      const snapshot = await getSignalSnapshot(postDriverJson, {
        correlationId: input.correlationId,
        driverBaseUrl: bootstrapSession.config.driverBaseUrl,
        timeoutMs: PRESS_DEVICE_ACTION_TIMEOUT_MS,
      });

      return snapshot.signalValues;
    },
    [bootstrapSession.config],
  );
  // @author PopoY: 复用现有 driverSession（驱动会话）刷新逻辑，不新增租约流程。
  const refreshSignalSnapshot = useCallback(async () => {
    await driverSession.refreshSnapshot();
  }, [driverSession]);
  const recordPressMoldLockDiagnostic = useCallback(
    (summary: {
      correlationId: string;
      durationMs: number;
      moldNo?: string;
      operatorId?: string;
      teamId?: string;
      processId?: string;
      resultCode: string;
    }) => {
      logDiagnostic({
        ...summary,
        commandName: "pressMoldLock",
        stationAccountId:
          bootstrapSession.data?.stationContext.stationAccountId ??
          bootstrapSession.config?.stationAccountId ??
          UNKNOWN_STATION_ACCOUNT_ID,
      });
    },
    [bootstrapSession.config?.stationAccountId, bootstrapSession.data],
  );
  // @author PopoY: 解锁 diagnostic summary（诊断摘要）只追加 commandName（命令名）和 stationAccountId（工位账号）。
  const recordPressMoldUnlockDiagnostic = useCallback(
    (summary: {
      correlationId: string;
      durationMs: number;
      moldNos: string[];
      operatorId?: string;
      resultCode: string;
    }) => {
      logDiagnostic({
        ...summary,
        commandName: "pressMoldUnlock",
        stationAccountId:
          bootstrapSession.data?.stationContext.stationAccountId ??
          bootstrapSession.config?.stationAccountId ??
          UNKNOWN_STATION_ACCOUNT_ID,
      });
    },
    [bootstrapSession.config?.stationAccountId, bootstrapSession.data],
  );
  // @author PopoY: 设备动作 diagnostic summary（诊断摘要）只补站点字段，不追加 token（令牌）或租约原文。
  const recordPressDeviceActionDiagnostic = useCallback(
    (summary: Omit<LogRecord, "stationAccountId">) => {
      logDiagnostic({
        ...summary,
        stationAccountId: diagnosticStationAccountId,
      });
    },
    [diagnosticStationAccountId],
  );
  useEffect(() => {
    if (!bootstrapSession.config || !bootstrapSession.data) {
      return;
    }

    const subscription = subscribeDriverDeviceEvents(
      bootstrapSession.config.driverBaseUrl,
      (event) => {
        void handleDriverDeviceEvent({
          event,
          applySignalSnapshotEvent: driverSession.applySignalSnapshotEvent,
          recordDiagnostic: (summary) => logDiagnostic(summary),
          recordPressJobParameters,
          recordedStartParameterKeys: recordedStartParameterKeysRef.current,
          stationAccountId: diagnosticStationAccountId,
        });
      },
      () => {
        logDiagnostic({
          correlationId: `device-events-${Date.now()}`,
          commandName: "deviceEventsStream",
          durationMs: 0,
          resultCode: "EVENT_STREAM_UNAVAILABLE",
          stationAccountId: diagnosticStationAccountId,
        });
      },
    );

    return () => {
      subscription.close();
    };
  }, [
    bootstrapSession.config,
    bootstrapSession.data,
    diagnosticStationAccountId,
    driverSession.applySignalSnapshotEvent,
    recordPressJobParameters,
  ]);
  const appShellDriverStatus = formatAppShellDriverStatus(
    driverSession.status,
    driverSession.data?.applyResult,
  );
  const stationAccountId = formatAppShellDisplayValue(
    bootstrapSession.data?.stationContext.stationAccountId ??
      bootstrapSession.config?.stationAccountId,
  );
  const deviceSession = formatAppShellDisplayValue(
    driverSession.data?.applyResult?.deviceSessionState,
  );
  // @author PopoY: 所有 Hooks（钩子）已完成后再 gate（门控）首启页，避免违反 React Hooks rules（规则）。
  const firstRunConfig =
    bootstrapSession.config ?? readBootstrapConfigFromError(bootstrapSession.error);
  const missingFieldsFromConfig = firstRunConfig
    ? readMissingBootstrapConfigFields(firstRunConfig)
    : [];
  const missingConfigFields =
    missingFieldsFromConfig.length > 0
      ? missingFieldsFromConfig
      : readBootstrapErrorMissingFields(bootstrapSession.error);

  if (firstRunConfig && missingConfigFields.length > 0) {
    return (
      <FirstRunConfigPage
        initialConfig={firstRunConfig}
        missingFields={missingConfigFields}
        onSaved={bootstrapSession.retry}
      />
    );
  }

  return (
    <main className={`qt-app-shell qt-app-shell--${currentView}`}>
      <header className="qt-app-shell__topbar">
        <div className="qt-app-shell__topbar-left">
          <Segmented<AppView>
            aria-label="一级页面导航"
            onChange={setCurrentView}
            options={[
              { label: "启动仪表盘", value: "dashboard" },
              { label: "诊断日志", value: "diagnostics" },
              { label: "压机作业", value: "pressJob" },
              { label: "历史作业", value: "pressJobHistory" },
            ]}
            size="large"
            value={currentView}
          />
        </div>
        <Space className="qt-app-shell__topbar-right" size={8}>
          <div aria-label="工位账号" className="qt-app-shell__station-account">
            <Typography.Text strong>工位账号</Typography.Text>
            <Typography.Text className="qt-app-shell__station-account-value">
              {stationAccountId}
            </Typography.Text>
          </div>
          <div aria-label="驱动服务状态" className="qt-app-shell__driver-status">
            <Typography.Text strong>驱动服务</Typography.Text>
            <Tag color={pickAppShellStatusTagColor(appShellDriverStatus)}>
              {formatAppShellStatusText(appShellDriverStatus)}
            </Tag>
            <Typography.Text className="qt-app-shell__driver-session">
              设备会话：{deviceSession}
            </Typography.Text>
          </div>
          <Segmented<QtAppThemeMode>
            aria-label="主题模式"
            className="qt-app-shell__theme-toggle"
            onChange={(nextThemeMode) => {
              setThemeMode(nextThemeMode);
            }}
            options={[
              createThemeModeOption("light", "☀", "浅色"),
              createThemeModeOption("dark", "☾", "深色"),
              createThemeModeOption("system", "▣", "跟随系统"),
            ]}
            size="large"
            value={themeMode}
          />
        </Space>
      </header>
      <section className="qt-app-shell__body">
        {currentView === "dashboard" ? (
          <BootstrapDashboard
            bootstrapSession={bootstrapSession}
            driverSession={driverSession}
          />
        ) : currentView === "diagnostics" ? (
          <DiagnosticLogsPage driverBaseUrl={bootstrapSession.config?.driverBaseUrl} />
        ) : currentView === "pressJob" ? (
          <PressJobPage
            {...pressJobExpectedDurationProps}
            bootstrapSession={pressJobPageBootstrapSession}
            completePressJob={completePressJob}
            driverSession={pressJobPageDriverSession}
            executePressDeviceCommand={executePressDeviceCommand}
            filterState={pressJobFilters}
            getFinalSignalSnapshot={getFinalSignalSnapshot}
            loadPressJobTeamOptions={loadPressJobTeamOptions}
            loadPressLockedMolds={loadPressLockedMolds}
            lockPressMold={lockPressMold}
            onFilterStateChange={setPressJobFilters}
            precheckPressDeviceCommand={precheckPressDeviceCommand}
            recordPressDeviceActionDiagnostic={recordPressDeviceActionDiagnostic}
            recordPressJobParameters={recordPressJobParameters}
            recordPressMoldLockDiagnostic={recordPressMoldLockDiagnostic}
            recordPressMoldUnlockDiagnostic={recordPressMoldUnlockDiagnostic}
            refreshPressJobCurrentJobs={refreshPressJobCurrentJobs}
            refreshSignalSnapshot={refreshSignalSnapshot}
            searchPressMoldCandidates={searchPressMoldCandidates}
            searchPressMoldInfoRows={searchPressMoldInfoRows}
            startPressJob={startPressJob}
            unlockPressMolds={unlockPressMolds}
            updatePressMachineStatus={updatePressMachineStatus}
            currentJobRows={pressJobCurrentRows}
          />
        ) : currentView === "pressJobHistory" ? (
          <PressJobHistoryPage
            craftOptions={bootstrapSession.data?.pressMoldCraftOptions ?? []}
            loadHistoryDetail={loadPressJobHistoryDetail}
            loadHistoryList={loadPressJobHistory}
            operatorOptions={bootstrapSession.data?.pressMoldOperatorOptions ?? []}
          />
        ) : null}
      </section>
    </main>
  );
}

/**
 * @brief 为预计时长外部请求创建不含业务或敏感信息的 correlationId（关联 ID）。
 * @author PopoY
 * @returns 带稳定动作前缀的唯一关联 ID。
 */
export function createPressJobExpectedDurationCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `press-job-duration-${crypto.randomUUID()}`;
  }

  return `press-job-duration-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * @brief 仅允许最新 current jobs GET（当前作业读取）覆盖 App 行状态。
 * @author PopoY
 * @param requestVersionRef App 持有的单调请求版本引用。
 * @param loadRows 执行一次 ERP current jobs GET（当前作业读取）。
 * @param applyRows 将最新响应写入 App 行状态。
 * @returns 本次 GET 返回的行；陈旧响应仍返回给调用者但不写入状态。
 */
export async function refreshLatestPressJobCurrentRows(
  requestVersionRef: { current: number },
  loadRows: () => Promise<PressJobCurrentJobRow[]>,
  applyRows: (rows: PressJobCurrentJobRow[]) => void,
): Promise<PressJobCurrentJobRow[]> {
  const requestVersion = ++requestVersionRef.current;
  const rows = await loadRows();

  if (requestVersion === requestVersionRef.current) {
    applyRows(rows);
  }

  return rows;
}

/**
 * @brief 按 ERP pressJobId（压机作业 ID）同步已保存的预计时长。
 * @author PopoY
 * @param rows App 当前作业行。
 * @param request 已成功提交的预计时长白名单请求。
 * @returns 仅目标作业预计时长被替换的新行数组。
 */
export function replacePressJobExpectedDuration(
  rows: PressJobCurrentJobRow[],
  request: PressJobExpectedDurationUpdateRequest,
): PressJobCurrentJobRow[] {
  return rows.map((row) =>
    row.pressJobId === request.id
      ? { ...row, plannedDurationHours: request.expectedDuration }
      : row,
  );
}

/**
 * @brief PUT（更新）成功后使旧 GET 失效，并把保存值同步为 App source of truth（应用真值来源）。
 * @author PopoY
 * @param requestVersionRef refresh（刷新）与更新共享的请求版本引用。
 * @param applyRows React rows state（行状态）更新入口。
 * @param request 已成功提交的预计时长请求。
 */
export function applySavedPressJobExpectedDuration(
  requestVersionRef: { current: number },
  applyRows: (
    update: (rows: PressJobCurrentJobRow[]) => PressJobCurrentJobRow[],
  ) => void,
  request: PressJobExpectedDurationUpdateRequest,
): void {
  requestVersionRef.current += 1;
  applyRows((rows) => replacePressJobExpectedDuration(rows, request));
}

/**
 * @brief 从 CONFIG_INVALID（配置无效）错误读取 missingFields（缺失字段）。
 * @author PopoY
 * @param error bootstrap session（启动会话）捕获的未知错误。
 * @returns 有效字段名数组；错误结构不匹配时返回空数组。
 */
function readBootstrapErrorMissingFields(
  error: unknown,
): RequiredBootstrapConfigField[] {
  if (!isBootstrapConfigInvalidError(error)) {
    return [];
  }

  const missingFields = error.missingFields;

  if (!Array.isArray(missingFields)) {
    return [];
  }

  return missingFields.filter(isRequiredBootstrapConfigField);
}

/**
 * @brief 从 CONFIG_INVALID（配置无效）错误读取可预填的 native config（原生配置）。
 * @author PopoY
 * @param error bootstrap session（启动会话）捕获的未知错误。
 * @returns 完整 native config（原生配置）或 null。
 */
function readBootstrapConfigFromError(
  error: unknown,
): NativeBootstrapConfig | null {
  if (!isBootstrapConfigInvalidError(error)) {
    return null;
  }

  const config = error.config;

  return isNativeBootstrapConfig(config) ? config : null;
}

/**
 * @brief 判断 unknown（未知错误）是否为 CONFIG_INVALID（配置无效）错误。
 * @author PopoY
 * @param error bootstrap session（启动会话）捕获的未知错误。
 * @returns code（错误码）严格等于 CONFIG_INVALID 时返回 true。
 */
function isBootstrapConfigInvalidError(error: unknown): error is {
  code: "CONFIG_INVALID";
  config?: unknown;
  missingFields?: unknown;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "CONFIG_INVALID"
  );
}

/**
 * @brief 校验 required field（必填字段）是否属于 bootstrap config（启动配置）白名单。
 * @author PopoY
 * @param value 待校验字段名。
 * @returns 属于六个启动配置字段时返回 true。
 */
function isRequiredBootstrapConfigField(
  value: unknown,
): value is RequiredBootstrapConfigField {
  return (
    typeof value === "string" &&
    REQUIRED_BOOTSTRAP_CONFIG_FIELDS.includes(value as RequiredBootstrapConfigField)
  );
}

/**
 * @brief 校验 unknown（未知值）是否为完整 native bootstrap config（原生启动配置）。
 * @author PopoY
 * @param value 待校验的 unknown（未知值）。
 * @returns 六个 bootstrap config（启动配置）字段均为 string（字符串）时返回 true。
 */
function isNativeBootstrapConfig(value: unknown): value is NativeBootstrapConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return REQUIRED_BOOTSTRAP_CONFIG_FIELDS.every(
    (fieldName) => typeof (value as Record<string, unknown>)[fieldName] === "string",
  );
}

/**
 * @brief 处理 Driver event（驱动事件），先应用 signal snapshot（信号快照）再保留 pressDownCount monitor（下压计数监测）链路。
 * @author PopoY
 * @param input Driver event（驱动事件）处理所需的回调和去重状态。
 * @returns Promise（异步结果），内部已收口 pressDownCount monitor（下压计数监测）错误。
 */
export function handleDriverDeviceEvent(input: {
  event: PressDeviceEvent;
  applySignalSnapshotEvent: (event: PressDeviceEvent) => void;
  recordDiagnostic: (summary: LogRecord) => void;
  recordPressJobParameters: (
    request: PressJobParameterRecordRequest,
  ) => Promise<unknown>;
  recordedStartParameterKeys: Set<string>;
  stationAccountId: string;
}): Promise<void> {
  input.applySignalSnapshotEvent(input.event);
  return handlePressParameterThresholdReached({
    event: input.event,
    recordDiagnostic: input.recordDiagnostic,
    recordPressJobParameters: input.recordPressJobParameters,
    recordedStartParameterKeys: input.recordedStartParameterKeys,
    stationAccountId: input.stationAccountId,
  })
    .then(() => undefined)
    .catch(() => {
      // @author PopoY: handlePressParameterThresholdReached（下压计数处理）已写安全 diagnostic（诊断），这里避免 SSE callback（事件回调）泄露 unhandled rejection（未处理拒绝）。
    });
}

/**
 * @brief 创建 PressJobPage（压机作业页）可接收的脱敏 driver session（驱动会话）。
 * @author PopoY
 * @param driverSession useDriverSession（驱动会话 hook）返回的完整状态。
 * @returns 移除设备身份、租约令牌和敏感信号 key（键）后的页面状态。
 */
export function createPressJobPageDriverSession(
  driverSession: UseDriverSessionResult,
): PressJobPageDriverSession {
  return {
    status: driverSession.status,
    data: driverSession.data
      ? {
          applyResult: driverSession.data.applyResult
            ? {
                correlationId: driverSession.data.applyResult.correlationId,
                resultCode: driverSession.data.applyResult.resultCode,
                message: driverSession.data.applyResult.message,
                leaseState: driverSession.data.applyResult.leaseState,
                deviceSessionState:
                  driverSession.data.applyResult.deviceSessionState,
              }
            : null,
          signalSnapshot: driverSession.data.signalSnapshot
            ? {
                correlationId: driverSession.data.signalSnapshot.correlationId,
                resultCode: driverSession.data.signalSnapshot.resultCode,
                signalValues: pickPressJobSignalValues(
                  driverSession.data.signalSnapshot.signalValues,
                ),
              }
            : null,
        }
      : null,
    error: driverSession.error
      ? "驱动会话异常，请查看诊断日志。"
      : driverSession.error,
    retry: driverSession.retry,
    refreshSnapshot: driverSession.refreshSnapshot,
  };
}

/**
 * @brief 裁剪 PressJobPage（压机作业页）展示用 signalValues（信号值）。
 * @author PopoY
 * @param signalValues Driver Service（驱动服务）返回的信号快照。
 * @returns 移除敏感 key（键）后的安全信号快照。
 */
function pickPressJobSignalValues(
  signalValues: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(signalValues).filter(
      ([key]) =>
        !PRESS_JOB_DRIVER_SESSION_FORBIDDEN_SIGNAL_KEYS.has(
          key.trim().toLowerCase(),
        ),
    ),
  );
}

export type PressParameterThresholdResult =
  | "IGNORED"
  | "DUPLICATE"
  | "RECORDED";

/**
 * @brief 处理 pressDownCount threshold（下压计数阈值）事件并记录 start 参数。
 * @author PopoY
 * @param input Driver event（驱动事件）、ERP 参数回调和去重集合。
 * @returns 本次事件处理结果。
 */
export async function handlePressParameterThresholdReached(input: {
  event: PressDeviceEvent;
  recordDiagnostic: (summary: LogRecord) => void;
  recordPressJobParameters: (
    request: PressJobParameterRecordRequest,
  ) => Promise<unknown>;
  recordedStartParameterKeys: Set<string>;
  stationAccountId: string;
}): Promise<PressParameterThresholdResult> {
  if (
    input.event.eventName !== "pressDownCountThresholdReached" ||
    !input.event.parameterIdempotencyKey
  ) {
    return "IGNORED";
  }

  const startParameterKey = `${input.event.localJobSessionId}:start`;
  if (input.recordedStartParameterKeys.has(startParameterKey)) {
    input.recordDiagnostic({
      correlationId: input.event.correlationId,
      localJobSessionId: input.event.localJobSessionId,
      commandName: "pressDownCountThresholdReached",
      durationMs: 0,
      resultCode: "DUPLICATE_START_PARAMETER_EVENT",
      stationAccountId: input.stationAccountId,
    });

    return "DUPLICATE";
  }

  input.recordedStartParameterKeys.add(startParameterKey);

  try {
    await input.recordPressJobParameters({
      correlationId: input.event.correlationId,
      idempotencyKey: input.event.parameterIdempotencyKey,
      parameterIdempotencyKey: input.event.parameterIdempotencyKey,
      localJobSessionId: input.event.localJobSessionId,
      type: "start",
      signalValues: mapDeviceEventSnapshotValues(input.event.snapshotValues),
    });
  } catch (error) {
    input.recordedStartParameterKeys.delete(startParameterKey);
    input.recordDiagnostic({
      correlationId: input.event.correlationId,
      localJobSessionId: input.event.localJobSessionId,
      commandName: "pressDownCountThresholdReached",
      durationMs: 0,
      resultCode: "START_PARAMETER_RECORD_FAILED",
      stationAccountId: input.stationAccountId,
    });
    throw error;
  }

  return "RECORDED";
}

const DEVICE_EVENT_SIGNAL_VALUE_FORBIDDEN_KEYS = new Set([
  "credential",
  "deviceid",
  "ip",
  "port",
  "privatekey",
  "rawregisters",
  "registeraddress",
  "sessiontoken",
  "signalconfig",
  "signature",
  "signaturepayload",
  "signedlease",
  "targetendpoint",
  "writevalue",
]);

/**
 * @brief 将 Driver event snapshot（驱动事件快照）转换为 ERP parameter signalValues（参数信号值）。
 * @author PopoY
 * @param snapshotValues Driver Service（驱动服务）已收窄的快照值。
 * @returns 过滤敏感 key（键）后的参数对象。
 */
function mapDeviceEventSnapshotValues(
  snapshotValues: PressDeviceEventSnapshotValue[],
): Record<string, unknown> {
  return Object.fromEntries(
    snapshotValues
      .filter(
        (item) =>
          item.signalCode.trim() &&
          !DEVICE_EVENT_SIGNAL_VALUE_FORBIDDEN_KEYS.has(
            item.signalCode.toLowerCase(),
          ),
      )
      .map((item) => [item.signalCode, item.value]),
  );
}

/**
 * @brief 创建 App Shell（应用外壳）主题模式选项。
 * @author PopoY
 * @param value 持久化使用的 theme mode（主题模式）值。
 * @param icon Segmented（分段控件）内展示的图标。
 * @param title 中文 tooltip（提示）与 accessible label（无障碍标签）。
 * @returns Ant Design Segmented option（分段选项）。
 */
function createThemeModeOption(value: QtAppThemeMode, icon: string, title: string) {
  return {
    value,
    icon: (
      <span aria-label={title} role="img">
        {icon}
      </span>
    ),
    tooltip: title,
  };
}

/**
 * @brief 将 Driver Service（驱动服务）状态压缩为 App Shell（应用外壳）状态。
 * @author PopoY
 * @param status driver hook（驱动 hook）的组合状态。
 * @param applyResult Driver Service（驱动服务）最近返回的 applyLeaseAndConfig（应用租约配置）结果。
 * @returns App Shell（应用外壳）状态文本。
 */
function formatAppShellDriverStatus(
  status: string | undefined,
  applyResult:
    | { resultCode?: string; deviceSessionState?: string }
    | null
    | undefined,
): string | undefined {
  if (
    applyResult?.resultCode === "OK" &&
    applyResult.deviceSessionState === "Connected"
  ) {
    return "success";
  }

  return status;
}

/**
 * @brief 将 App Shell（应用外壳）状态映射成 Tag（标签）颜色。
 * @author PopoY
 * @param status 需要展示的状态。
 * @returns Ant Design Tag color token（标签颜色令牌）。
 */
function pickAppShellStatusTagColor(status: string | undefined): string {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === "success" || normalizedStatus === "active") {
    return "success";
  }

  if (normalizedStatus === "error" || normalizedStatus === "faulted") {
    return "error";
  }

  if (normalizedStatus === "loading" || normalizedStatus === "pending") {
    return "processing";
  }

  return "default";
}

/**
 * @brief 将 App Shell（应用外壳）状态转换为现场操作员可读中文。
 * @author PopoY
 * @param status 需要展示的状态。
 * @returns 中文状态文本。
 */
function formatAppShellStatusText(status: string | undefined): string {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === "success" || normalizedStatus === "active") {
    return "成功";
  }

  if (normalizedStatus === "error" || normalizedStatus === "faulted") {
    return "异常";
  }

  if (normalizedStatus === "loading" || normalizedStatus === "pending") {
    return "加载中";
  }

  return "未启动";
}

/**
 * @brief 将 App Shell（应用外壳）全局 identity（身份信息）渲染为稳定占位。
 * @author PopoY
 * @param value 启动配置或 ERP（企业资源计划系统）返回的 station account（工位账号）。
 * @returns 顶部栏使用的中文安全显示文本。
 */
function formatAppShellDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "暂无数据";
  }

  return String(value);
}

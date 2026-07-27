/**
 * @file PressJobPage.tsx - 渲染 Press Working Page（压机作业页面）。
 * @author PopoY
 * @created 2026-06-30
 * @editor PopoY
 * @edited 2026-07-27 11:37:10
 * @brief 展示压机作业 lookup data（查询数据）和 SignalSnapshotTable（信号快照表）。
 */

import {
  App as AntdApp,
  Button,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tour,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  PlayCircleOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import type { ButtonProps, TableProps, TourStepProps } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

import type {
  PressDeviceActionButtonKey,
  PressDeviceActionIdentity,
  PressJobCompleteRequest,
  PressJobCompleteResult,
  PressJobCurrentJobRow,
  PressJobExpectedDurationUpdateRequest,
  PressJobLookupData,
  PressJobOperatorOption,
  PressJobOperationCode,
  PressJobOperationLogRequest,
  PressJobParameterRecordRequest,
  PressJobParameterRecordResult,
  PressJobParameterRecordType,
  PressJobProcessOption,
  PressJobStartRequest,
  PressJobStartResult,
  PressLockedMoldRow,
  PressMachineStatusUpdateRequest,
  PressMachineStatusUpdateResult,
  PressMoldCandidate,
  PressMoldInfoRow,
  PressMoldLockRequest,
  PressMoldLockResult,
  PressMoldLockSelection,
  PressMoldUnlockRequest,
  PressMoldUnlockResult,
  PressJobTeamOptions,
} from "../domain/pressJob";
import type {
  DriverDeviceSessionState,
  DriverLeaseState,
  PressDeviceCommandName,
  PressDeviceCommandRequest,
  PressDeviceCommandResponse,
} from "../domain/driver";
import type { ErpDictOption } from "../domain/lease";
import type { LogRecord } from "../domain/logRecord";
import type { BootstrapSessionStatus } from "../hooks/useBootstrapSession";
import { NumericKeypad } from "./NumericKeypad";
import {
  SignalSnapshotRefreshMeta,
  SignalSnapshotTable,
} from "./SignalSnapshotTable";
import "./PressJobPage.css";

type PressJobPageBootstrapData = Pick<
  PressJobLookupDataContainer,
  | "parameterGroupOptions"
  | "pressJobCurrentJobs"
  | "pressJobLookupData"
  | "pressMoldCraftOptions"
  | "pressMoldOperatorOptions"
  | "pressMoldWorkTypeOptions"
  | "stationContext"
>;

type PressJobLookupDataContainer = {
  parameterGroupOptions?: ErpDictOption[];
  pressJobCurrentJobs?: PressJobCurrentJobRow[];
  pressJobLookupData?: PressJobLookupData;
  pressMoldCraftOptions?: ErpDictOption[];
  pressMoldOperatorOptions?: ErpDictOption[];
  pressMoldWorkTypeOptions?: ErpDictOption[];
  stationContext?: {
    stationAccountId?: string;
    stationId?: string;
  };
};

/**
 * @brief 定义 PressJobPage（压机作业页）可接收的 sanitized bootstrap session（脱敏启动会话）。
 * @author PopoY
 */
export type PressJobPageBootstrapSession = {
  status?: BootstrapSessionStatus;
  config?: null;
  data: PressJobPageBootstrapData | null;
  error?: unknown;
  retry?: () => Promise<void>;
};

/**
 * @brief 定义 PressJobPage（压机作业页）可接收的 sanitized driver session（脱敏驱动会话）。
 * @author PopoY
 */
export type PressJobPageDriverSession = {
  status?: "idle" | "loading" | "success" | "error";
  data: {
    applyResult: {
      correlationId?: string;
      resultCode?: string;
      message?: string;
      leaseState?: DriverLeaseState;
      deviceSessionState?: DriverDeviceSessionState;
    } | null;
    signalSnapshot: {
      correlationId?: string;
      resultCode?: string;
      signalValues: Record<string, unknown>;
    } | null;
  } | null;
  error?: unknown;
  retry?: () => Promise<void>;
  refreshSnapshot?: () => Promise<void>;
};

/**
 * @brief 定义 PressJobPage（压机作业页）接收的 props（属性）。
 * @author PopoY
 */
export type PressJobPageProps = {
  bootstrapSession?: PressJobPageBootstrapSession;
  currentJobRows?: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  filterState?: PressJobFilterState;
  loadPressJobTeamOptions?: (teamId: string) => Promise<PressJobTeamOptions>;
  onFilterStateChange?: (nextFilterState: PressJobFilterStateChange) => void;
  updatePressJobExpectedDuration?: (
    request: PressJobExpectedDurationUpdateRequest,
  ) => Promise<void>;
  searchPressMoldCandidates?: (input: {
    moldNo: string;
    lockedMoldNos: string[];
    correlationId: string;
  }) => Promise<PressMoldCandidate[]>;
  searchPressMoldInfoRows?: (input: {
    moldNo: string;
    lockedMoldNos: string[];
    correlationId: string;
  }) => Promise<PressMoldInfoRow[]>;
  lockPressMold?: (request: PressMoldLockRequest) => Promise<PressMoldLockResult>;
  loadPressLockedMolds?: (input: {
    correlationId: string;
  }) => Promise<PressLockedMoldRow[]>;
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  unlockPressMolds?: (
    request: PressMoldUnlockRequest,
  ) => Promise<PressMoldUnlockResult>;
  recordPressMoldLockDiagnostic?: (
    summary: PressMoldLockDiagnosticSummary,
  ) => void;
  recordPressMoldUnlockDiagnostic?: (
    summary: PressMoldUnlockDiagnosticSummary,
  ) => void;
  executePressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  precheckPressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  startPressJob?: (input: PressJobStartRequest) => Promise<PressJobStartResult>;
  recordPressJobParameters?: (
    input: PressJobParameterRecordRequest,
  ) => Promise<PressJobParameterRecordResult>;
  recordPressJobOperation?: (
    input: PressJobOperationLogRequest,
  ) => Promise<void>;
  completePressJob?: (
    input: PressJobCompleteRequest,
  ) => Promise<PressJobCompleteResult>;
  getFinalSignalSnapshot?: (input: {
    correlationId: string;
    localJobSessionId: string;
  }) => Promise<Record<string, unknown>>;
  updatePressMachineStatus?: (
    input: PressMachineStatusUpdateRequest,
  ) => Promise<PressMachineStatusUpdateResult>;
  refreshSignalSnapshot?: () => Promise<unknown>;
  recordPressDeviceActionDiagnostic?: (
    summary: PressJobDiagnosticSummary,
  ) => void;
};

export type PressJobFilterState = {
  teamId?: string;
  operatorId?: string;
  processId?: string;
};

/**
 * @brief 表示 filter state change（筛选状态变更），支持 React functional update（函数式更新）。
 * @author PopoY
 */
type PressJobFilterStateChange =
  | PressJobFilterState
  | ((currentFilters: PressJobFilterState) => PressJobFilterState);

type SelectOption = {
  label: string;
  value: string;
};

/**
 * @brief 表示当前班组可用的下级 cascade options（级联选项）。
 * @author PopoY
 */
type ActivePressJobTeamOptions = Pick<
  PressJobTeamOptions,
  "operatorOptions" | "processOptions"
>;

type PressJobActionButtonKey = PressDeviceActionButtonKey | "lockMold";

type ActionButtonConfig = {
  key: PressJobActionButtonKey;
  label: string;
  color?: ButtonProps["color"];
  iconSymbol: string;
  type?: ButtonProps["type"];
  variant?: ButtonProps["variant"];
  onClick: () => void;
};

/**
 * @brief 定义锁模 diagnostic summary（诊断摘要）白名单字段。
 * @author PopoY
 */
export type PressMoldLockDiagnosticSummary = {
  correlationId: string;
  durationMs: number;
  moldNo?: string;
  operatorId?: string;
  teamId?: string;
  processId?: string;
  commandName?: string;
  resultCode: string;
  stationAccountId?: string;
};

export type PressMoldLockSubmitFlowStatus = "OK" | "CURRENT_JOB_REFRESH_FAILED";

/**
 * @brief 定义锁模 submit flow（提交流程）的最小依赖，方便无 DOM（文档对象模型）测试。
 * @author PopoY
 */
export type PressMoldLockSubmitFlowInput = {
  request: PressMoldLockRequest;
  lockPressMold?: (request: PressMoldLockRequest) => Promise<PressMoldLockResult>;
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  recordPressMoldLockDiagnostic?: (
    summary: PressMoldLockDiagnosticSummary,
  ) => void;
  now?: () => number;
};

/**
 * @brief 定义解锁模具 diagnostic summary（诊断摘要）白名单字段。
 * @author PopoY
 */
export type PressMoldUnlockDiagnosticSummary = {
  correlationId: string;
  durationMs: number;
  moldNos: string[];
  operatorId?: string;
  commandName?: string;
  resultCode: string;
  stationAccountId?: string;
};

export type PressMoldUnlockSubmitFlowStatus =
  | "OK"
  | "CURRENT_JOB_REFRESH_FAILED";

/**
 * @brief 定义解锁模具 submit flow（提交流程）的最小依赖。
 * @author PopoY
 */
export type PressMoldUnlockSubmitFlowInput = {
  request: PressMoldUnlockRequest;
  unlockPressMolds?: (
    request: PressMoldUnlockRequest,
  ) => Promise<PressMoldUnlockResult>;
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  recordPressMoldUnlockDiagnostic?: (
    summary: PressMoldUnlockDiagnosticSummary,
  ) => void;
  now?: () => number;
};

type PressSimpleDeviceActionButtonKey =
  | "connect"
  | "moveIn"
  | "moveOut"
  | "lineIn"
  | "lineOut";

type PressWorkflowActionButtonKey = "startProcessing" | "completeProcessing";
type PressDeviceActionFeedbackType = "success" | "warning" | "error";

/**
 * @brief 定义 simple device action（简单设备动作）执行结果，供 UI（界面）展示中文反馈。
 * @author PopoY
 */
export type PressDeviceActionFlowResult = {
  feedbackMessage: string;
  feedbackType: PressDeviceActionFeedbackType;
  identity?: PressDeviceActionIdentity;
  resultCode: string;
};

/**
 * @brief 定义 simple device action（简单设备动作）的最小依赖，保持 clients（客户端）由外层注入。
 * @author PopoY
 */
export type PressDeviceActionFlowInput = {
  buttonKey: PressSimpleDeviceActionButtonKey;
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  executePressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  precheckPressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  filters: PressJobFilterState;
  now?: () => number;
  recordPressDeviceActionDiagnostic?: (
    summary: PressJobDiagnosticSummary,
  ) => void;
  recordPressJobOperation?: (
    request: PressJobOperationLogRequest,
  ) => Promise<void>;
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  refreshSignalSnapshot?: () => Promise<unknown>;
  updatePressMachineStatus?: (
    input: PressMachineStatusUpdateRequest,
  ) => Promise<PressMachineStatusUpdateResult>;
};

type PressDeviceActionDiagnosticInput = {
  filters: PressJobFilterState;
  now?: () => number;
  recordPressDeviceActionDiagnostic?: (
    summary: PressJobDiagnosticSummary,
  ) => void;
  recordPressJobOperation?: (
    request: PressJobOperationLogRequest,
  ) => Promise<void>;
};

type PressJobDiagnosticSummary = Omit<LogRecord, "stationAccountId">;

export type PressJobStartWorkflowInput = PressDeviceActionDiagnosticInput & {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  executePressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  precheckPressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  expectedDuration: string;
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  refreshSignalSnapshot?: () => Promise<unknown>;
  startPressJob?: (input: PressJobStartRequest) => Promise<PressJobStartResult>;
};

export type PressJobCompleteWorkflowInput = PressDeviceActionDiagnosticInput & {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  executePressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  precheckPressDeviceCommand?: (
    input: PressDeviceCommandRequest,
  ) => Promise<PressDeviceCommandResponse>;
  completePressJob?: (
    input: PressJobCompleteRequest,
  ) => Promise<PressJobCompleteResult>;
  getFinalSignalSnapshot?: (input: {
    correlationId: string;
    localJobSessionId: string;
  }) => Promise<Record<string, unknown>>;
  recordPressJobParameters?: (
    input: PressJobParameterRecordRequest,
  ) => Promise<PressJobParameterRecordResult>;
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  refreshSignalSnapshot?: () => Promise<unknown>;
};

export type PressJobLineOutWorkflowInput = PressJobCompleteWorkflowInput & {
  confirm?: (message: string) => Promise<boolean>;
  updatePressMachineStatus?: (
    input: PressMachineStatusUpdateRequest,
  ) => Promise<PressMachineStatusUpdateResult>;
};

export type PressJobMoveOutWorkflowInput = PressJobCompleteWorkflowInput & {
  changeMold?: boolean;
  confirm?: (message: string) => Promise<boolean>;
};

// PopoY: 当前作业数据源由后续真实业务接入，第一版必须为空。
const EMPTY_CURRENT_JOB_ROWS: PressJobCurrentJobRow[] = [];

const PRESS_DEVICE_ACTION_TIMEOUT_MS = 5000;

const PRESS_SIMPLE_DEVICE_ACTION_COMMANDS: Record<
  PressSimpleDeviceActionButtonKey,
  PressDeviceCommandName
> = {
  connect: "connectMes",
  moveIn: "moveIn",
  moveOut: "moveOut",
  lineIn: "lineIn",
  lineOut: "lineOut",
};

// PopoY: 压机作业页第四行完整归实时信号使用，可比启动仪表盘多放 1 个 signal（信号）。
const PRESS_JOB_MAX_SIGNALS_PER_ROW = 7;

// @author PopoY: 关闭 virtual scroll（虚拟滚动）后给 popup grid（浮层网格）保留完整高度。
const PRESS_JOB_TOUCH_SELECT_LIST_HEIGHT = 960;

const NUMERIC_KEYPAD_WIDTH = 248;
const NUMERIC_KEYPAD_HEIGHT = 252;
const NUMERIC_KEYPAD_VIEWPORT_GAP = 12;
const NUMERIC_KEYPAD_TRIGGER_GAP = 8;

type NumericKeypadTriggerRect = Pick<DOMRect, "bottom" | "left" | "top">;
type NumericKeypadPosition = Pick<CSSProperties, "left" | "top">;
type PlannedDurationEditBaseline = {
  hadDraft: boolean;
  persistedMarkerArmed?: boolean;
  value: string;
};
type PlannedDurationSaveRequestRef = { current: object | null };
type PlannedDurationCurrentRowsRef = { current: PressJobCurrentJobRow[] };
type PlannedDurationSaveStatus =
  | "failed"
  | "invalid"
  | "local"
  | "pending"
  | "saved"
  | "stale";
type PressJobTourKey = "start" | "complete" | "unlock" | "lock";
type PressJobTourStepGuard = () => string | null;
type PressJobTourStep = TourStepProps & {
  guard?: PressJobTourStepGuard;
};

type PressJobTourTargetRef = {
  current: HTMLElement | null;
};

/**
 * @brief 渲染 frontend-only（仅前端）压机作业页面外壳。
 * @author PopoY
 * @param props App shell（应用外壳）传入的启动会话与驱动会话。
 * @returns 用于现场工控机的 React element（React 元素）。
 */
export function PressJobPage({
  bootstrapSession,
  currentJobRows: injectedCurrentJobRows,
  driverSession,
  executePressDeviceCommand,
  filterState,
  loadPressJobTeamOptions,
  loadPressLockedMolds,
  lockPressMold,
  onFilterStateChange,
  precheckPressDeviceCommand,
  recordPressDeviceActionDiagnostic,
  startPressJob,
  recordPressJobParameters,
  recordPressJobOperation,
  completePressJob,
  getFinalSignalSnapshot,
  refreshPressJobCurrentJobs,
  refreshSignalSnapshot,
  recordPressMoldLockDiagnostic,
  recordPressMoldUnlockDiagnostic,
  searchPressMoldCandidates,
  searchPressMoldInfoRows,
  unlockPressMolds,
  updatePressJobExpectedDuration,
  updatePressMachineStatus,
}: PressJobPageProps = {}) {
  const { message: messageApi, modal } = AntdApp.useApp();
  const pressJobLookupData = bootstrapSession?.data?.pressJobLookupData;
  const [localFilters, setLocalFilters] = useState<PressJobFilterState>(() =>
    createInitialPressJobFilterState(pressJobLookupData),
  );
  const filters = filterState ?? localFilters;
  const [selectedTeamOptions, setSelectedTeamOptions] =
    useState<PressJobTeamOptions | null>(null);
  const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null);
  const [plannedDurationDrafts, setPlannedDurationDrafts] = useState<
    Record<string, string>
  >({});
  const [savingPlannedDurationRowId, setSavingPlannedDurationRowId] = useState<
    string | null
  >(null);
  const [activePlannedDurationRowId, setActivePlannedDurationRowId] = useState<
    string | null
  >(null);
  const [plannedDurationKeypadPosition, setPlannedDurationKeypadPosition] =
    useState<NumericKeypadPosition | null>(null);
  const [isMoldLockPanelOpen, setIsMoldLockPanelOpen] = useState(false);
  const [moldSearchText, setMoldSearchText] = useState("");
  const [moldCandidates, setMoldCandidates] = useState<PressMoldCandidate[]>([]);
  const [moldInfoRows, setMoldInfoRows] = useState<PressMoldInfoRow[]>([]);
  const [selectedMoldNo, setSelectedMoldNo] = useState<string | undefined>();
  const [selectedMoldInfoRowIndex, setSelectedMoldInfoRowIndex] =
    useState<number | undefined>();
  const [moldCandidateLoading, setMoldCandidateLoading] = useState(false);
  const [moldInfoLoading, setMoldInfoLoading] = useState(false);
  const [moldLockSubmitting, setMoldLockSubmitting] = useState(false);
  const [isMoldUnlockDrawerOpen, setIsMoldUnlockDrawerOpen] = useState(false);
  const [lockedMoldRows, setLockedMoldRows] = useState<PressLockedMoldRow[]>([]);
  const [selectedUnlockMoldNos, setSelectedUnlockMoldNos] = useState<string[]>([]);
  const [lockedMoldsLoading, setLockedMoldsLoading] = useState(false);
  const [moldUnlockSubmitting, setMoldUnlockSubmitting] = useState(false);
  const [pendingPressDeviceActionKeys, setPendingPressDeviceActionKeys] = useState<
    Partial<Record<PressDeviceActionButtonKey, boolean>>
  >({});
  const [isMoldSelectOpen, setIsMoldSelectOpen] = useState(false);
  const [moldNoKeypadPosition, setMoldNoKeypadPosition] =
    useState<NumericKeypadPosition | null>(null);
  const [activeTour, setActiveTour] = useState<PressJobTourKey | null>(null);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  // @author PopoY: Task1（任务一）只登记 Tour target refs（漫游目标引用），后续任务再绑定具体 UI（界面）。
  const teamTourTargetRef = useRef<HTMLDivElement | null>(null);
  const operatorTourTargetRef = useRef<HTMLDivElement | null>(null);
  const processTourTargetRef = useRef<HTMLDivElement | null>(null);
  const currentJobTableTourTargetRef = useRef<HTMLDivElement | null>(null);
  const lockMoldButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
  const moldLockInputTourTargetRef = useRef<HTMLDivElement | null>(null);
  const moldLockSearchButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
  const moldLockInfoTableTourTargetRef = useRef<HTMLDivElement | null>(null);
  const moldLockConfirmButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
  const plannedDurationTourTargetRef = useRef<HTMLDivElement | null>(null);
  const startButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
  const completeButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
  const signalSnapshotTourTargetRef = useRef<HTMLDivElement | null>(null);
  const unlockLockedTagTourTargetRef = useRef<HTMLSpanElement | null>(null);
  const unlockKeepTagTourTargetRef = useRef<HTMLSpanElement | null>(null);
  const unlockSelectedTagTourTargetRef = useRef<HTMLSpanElement | null>(null);
  const unlockTableTourTargetRef = useRef<HTMLDivElement | null>(null);
  const unlockConfirmButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
  const teamLoadVersionRef = useRef(0);
  const moldCandidateSearchVersionRef = useRef(0);
  const moldInfoSearchVersionRef = useRef(0);
  const lockedMoldLoadVersionRef = useRef(0);
  const activePlannedDurationInputRef = useRef<HTMLInputElement | null>(null);
  const plannedDurationSaveRequestRef = useRef<object | null>(null);
  const plannedDurationCurrentRowsRef = useRef<PressJobCurrentJobRow[]>([]);
  const persistedPlannedDurationDraftMarkersRef = useRef<Map<string, boolean>>(
    new Map(),
  );
  const plannedDurationEditBaselineRef = useRef<
    (PlannedDurationEditBaseline & { rowId: string }) | null
  >(null);
  const activeMoldNoInputRef = useRef<HTMLElement | null>(null);
  // @author PopoY: 用 ref（引用）同步拦截 Select focus（选择器聚焦）触发的 popup（浮层）。
  const moldNoKeypadOpenRef = useRef(false);
  // @author PopoY: 记录刚选中的 moldNo（模具号），避免 Select auto clear（自动清空）覆盖显示值。
  const pendingSelectedMoldNoRef = useRef<string | null>(null);
  const signalSnapshot = driverSession?.data?.signalSnapshot;
  const signalValues = signalSnapshot?.signalValues ?? null;
  const pressJobLineStatus = resolvePressJobLineStatus(signalValues);
  const currentJobRows =
    injectedCurrentJobRows ??
    bootstrapSession?.data?.pressJobCurrentJobs ?? EMPTY_CURRENT_JOB_ROWS;
  plannedDurationCurrentRowsRef.current = currentJobRows;
  const parameterGroupOptions =
    bootstrapSession?.data?.parameterGroupOptions ?? [];
  const pressMoldWorkTypeOptions =
    bootstrapSession?.data?.pressMoldWorkTypeOptions ?? [];
  const pressMoldCraftOptions = bootstrapSession?.data?.pressMoldCraftOptions ?? [];
  const pressMoldOperatorOptions =
    bootstrapSession?.data?.pressMoldOperatorOptions ?? [];
  const teamOptions = useMemo<SelectOption[]>(
    () =>
      (pressJobLookupData?.teamOptions ?? []).map((teamOption) => ({
        label: teamOption.teamName,
        value: teamOption.teamId,
      })),
    [pressJobLookupData?.teamOptions],
  );
  const activeTeamOptions = resolveActivePressJobTeamOptions(
    filters.teamId,
    pressJobLookupData,
    selectedTeamOptions,
  );
  const activeOperatorOptions = activeTeamOptions.operatorOptions;
  const activeProcessOptions = activeTeamOptions.processOptions;
  const operatorOptions = useMemo<SelectOption[]>(
    () =>
      activeOperatorOptions.map((operatorOption) => ({
        label: operatorOption.operatorName,
        value: operatorOption.operatorId,
      })),
    [activeOperatorOptions],
  );
  const processOptions = useMemo<SelectOption[]>(
    () =>
      activeProcessOptions.map((processOption) => ({
        label: processOption.processName,
        value: processOption.processId,
      })),
    [activeProcessOptions],
  );
  const moldCandidateOptions = useMemo<SelectOption[]>(
    () =>
      moldCandidates.map((candidate) => ({
        label: candidate.moldNo,
        title: formatPressMoldCandidateTitle(candidate),
        value: candidate.moldNo,
      })),
    [moldCandidates],
  );
  const isTeamOptionsLoading = loadingTeamId === filters.teamId;
  const primaryCurrentJob = readPrimaryCurrentJob(currentJobRows);
  const primaryPlannedDuration = primaryCurrentJob
    ? getPlannedDurationValue(primaryCurrentJob)
    : "";
  const selectedMoldInfoRow =
    selectedMoldInfoRowIndex === undefined
      ? null
      : moldInfoRows[selectedMoldInfoRowIndex] ?? null;
  const startTourSteps = useMemo<PressJobTourStep[]>(
    () => [
      {
        title: "确认班组",
        description: "请先确认本次作业班组。",
        target: createTourTarget(teamTourTargetRef),
        guard: () =>
          validateStartPressJobTourStep({
            currentJobRows,
            driverSession,
            expectedDuration: primaryPlannedDuration,
            filters,
            stepIndex: 0,
          }),
      },
      {
        title: "确认人员",
        description: "请选择当前操作员。",
        target: createTourTarget(operatorTourTargetRef),
        guard: () =>
          validateStartPressJobTourStep({
            currentJobRows,
            driverSession,
            expectedDuration: primaryPlannedDuration,
            filters,
            stepIndex: 1,
          }),
      },
      {
        title: "确认预选工艺",
        description: "请选择本次加工工艺。",
        target: createTourTarget(processTourTargetRef),
        guard: () =>
          validateStartPressJobTourStep({
            currentJobRows,
            driverSession,
            expectedDuration: primaryPlannedDuration,
            filters,
            stepIndex: 2,
          }),
      },
      {
        title: "确认模具锁定",
        description: "开始加工前请确认模具已锁定。",
        target: createTourTarget(lockMoldButtonTourTargetRef),
        guard: () =>
          validateStartPressJobTourStep({
            currentJobRows,
            driverSession,
            expectedDuration: primaryPlannedDuration,
            filters,
            stepIndex: 3,
          }),
      },
      {
        title: "确认预计加工时长",
        description: "请确认预计加工时长，系统会用于开始加工记录。",
        target: createTourTarget(plannedDurationTourTargetRef),
        guard: () =>
          validateStartPressJobTourStep({
            currentJobRows,
            driverSession,
            expectedDuration: primaryPlannedDuration,
            filters,
            stepIndex: 4,
          }),
      },
      {
        title: "执行开始加工",
        description: "确认无误后点击真实的开始加工按钮。",
        target: createTourTarget(startButtonTourTargetRef),
        guard: () =>
          validateStartPressJobTourStep({
            currentJobRows,
            driverSession,
            expectedDuration: primaryPlannedDuration,
            filters,
            stepIndex: 5,
          }),
      },
    ],
    [currentJobRows, driverSession, filters, primaryPlannedDuration],
  );
  const completeTourSteps = useMemo<PressJobTourStep[]>(
    () => [
      {
        title: "确认加工中作业",
        description: "请确认当前作业处于加工中。",
        target: createTourTarget(currentJobTableTourTargetRef),
        guard: () =>
          validateCompletePressJobTourStep({
            currentJobRows,
            driverSession,
            filters,
            stepIndex: 0,
          }),
      },
      {
        title: "确认实时信号",
        description: "完成加工会读取最终信号并记录参数。",
        target: createTourTarget(signalSnapshotTourTargetRef),
        guard: () =>
          validateCompletePressJobTourStep({
            currentJobRows,
            driverSession,
            filters,
            stepIndex: 1,
          }),
      },
      {
        title: "执行完成加工",
        description: "确认后点击真实的完成加工按钮，系统会执行 ERP complete（ERP 完工）和 Driver cleanup（驱动清理）。",
        target: createTourTarget(completeButtonTourTargetRef),
        guard: () =>
          validateCompletePressJobTourStep({
            currentJobRows,
            driverSession,
            filters,
            stepIndex: 2,
          }),
      },
    ],
    [currentJobRows, driverSession, filters],
  );
  const unlockTourSteps = useMemo<PressJobTourStep[]>(
    () => [
      {
        title: "查看已锁定数量",
        description: "这里显示当前可查看的已锁定模具数量。",
        target: createTourTarget(unlockLockedTagTourTargetRef),
        guard: () =>
          validateUnlockMoldTourStep({
            currentJobRows,
            isDrawerOpen: isMoldUnlockDrawerOpen,
            lockedMolds: lockedMoldRows,
            operatorId: filters.operatorId,
            selectedMoldNos: selectedUnlockMoldNos,
            stepIndex: 0,
          }),
      },
      {
        title: "确认保留规则",
        description: "加工中不能解锁最后一套，请先完成加工。",
        target: createTourTarget(unlockKeepTagTourTargetRef),
      },
      {
        title: "查看已选数量",
        description: "勾选模具后这里会同步显示已选数量。",
        target: createTourTarget(unlockSelectedTagTourTargetRef),
      },
      {
        title: "选择需解锁模具",
        description: "请选择需要解锁的模具。",
        target: createTourTarget(unlockTableTourTargetRef),
        guard: () =>
          validateUnlockMoldTourStep({
            currentJobRows,
            isDrawerOpen: isMoldUnlockDrawerOpen,
            lockedMolds: lockedMoldRows,
            operatorId: filters.operatorId,
            selectedMoldNos: selectedUnlockMoldNos,
            stepIndex: 3,
          }),
      },
      {
        title: "执行确认解锁",
        description: "确认选择后再点击真实的确认解锁按钮。",
        target: createTourTarget(unlockConfirmButtonTourTargetRef),
        guard: () =>
          validateUnlockMoldTourStep({
            currentJobRows,
            isDrawerOpen: isMoldUnlockDrawerOpen,
            lockedMolds: lockedMoldRows,
            operatorId: filters.operatorId,
            selectedMoldNos: selectedUnlockMoldNos,
            stepIndex: 4,
          }),
      },
    ],
    [
      currentJobRows,
      filters.operatorId,
      isMoldUnlockDrawerOpen,
      lockedMoldRows,
      selectedUnlockMoldNos,
    ],
  );
  const lockTourSteps = useMemo<PressJobTourStep[]>(
    () => [
      {
        title: "输入并选择模具号",
        description: "请输入模具号，使用候选结果确认本次要锁定的模具。",
        target: createTourTarget(moldLockInputTourTargetRef),
        guard: () =>
          validateLockMoldTourStep({
            currentJobRows,
            filters,
            isPanelOpen: isMoldLockPanelOpen,
            moldInfoRows,
            selectedMoldInfoRow,
            selectedMoldNo,
            stepIndex: 0,
          }),
      },
      {
        title: "查询模具明细",
        description: "选定候选模具后点击搜索，加载制造令、工序和工艺信息。",
        target: createTourTarget(moldLockSearchButtonTourTargetRef),
        guard: () =>
          validateLockMoldTourStep({
            currentJobRows,
            filters,
            isPanelOpen: isMoldLockPanelOpen,
            moldInfoRows,
            selectedMoldInfoRow,
            selectedMoldNo,
            stepIndex: 1,
          }),
      },
      {
        title: "选择明细和工艺",
        description: "在明细表中选择要锁定的记录，并确认工艺。",
        target: createTourTarget(moldLockInfoTableTourTargetRef),
        guard: () =>
          validateLockMoldTourStep({
            currentJobRows,
            filters,
            isPanelOpen: isMoldLockPanelOpen,
            moldInfoRows,
            selectedMoldInfoRow,
            selectedMoldNo,
            stepIndex: 2,
          }),
      },
      {
        title: "执行确认锁定",
        description: "确认无误后点击真实的确认锁定按钮。",
        target: createTourTarget(moldLockConfirmButtonTourTargetRef),
        guard: () =>
          validateLockMoldTourStep({
            currentJobRows,
            filters,
            isPanelOpen: isMoldLockPanelOpen,
            moldInfoRows,
            selectedMoldInfoRow,
            selectedMoldNo,
            stepIndex: 3,
          }),
      },
    ],
    [
      currentJobRows,
      filters,
      isMoldLockPanelOpen,
      moldInfoRows,
      selectedMoldInfoRow,
      selectedMoldNo,
    ],
  );
  const activeTourSteps =
    activeTour === "start"
      ? startTourSteps
      : activeTour === "complete"
        ? completeTourSteps
        : activeTour === "unlock"
          ? unlockTourSteps
          : activeTour === "lock"
            ? lockTourSteps
            : [];

  /**
   * @brief 将 ref（引用）转换为 Ant Design Tour（漫游式引导）target（目标）。
   * @author PopoY
   * @param ref 需要高亮的 DOM ref（文档对象模型引用）。
   * @returns Tour（漫游式引导）可识别的 target getter（目标获取器）。
   */
  function createTourTarget(ref: PressJobTourTargetRef): TourStepProps["target"] {
    return (() => ref.current) as () => HTMLElement;
  }

  /**
   * @brief 关闭 Tour guidance（漫游式指导）并重置步骤。
   * @author PopoY
   */
  const closePressJobTour = () => {
    setActiveTour(null);
    setCurrentTourStep(0);
  };

  /**
   * @brief 打开指定 Tour guidance（漫游式指导），不触发真实生产动作。
   * @author PopoY
   * @param tourKey 需要打开的 guidance（指导）类型。
   */
  const openPressJobTour = (tourKey: PressJobTourKey) => {
    if (tourKey === "unlock" && !isMoldUnlockDrawerOpen) {
      messageApi.warning("请先打开解锁抽屉。");
      return;
    }

    if (tourKey === "lock" && !isMoldLockPanelOpen) {
      messageApi.warning("请先打开模具锁定面板。");
      return;
    }

    setActiveTour(tourKey);
    setCurrentTourStep(0);
  };

  /**
   * @brief 切换 Tour（漫游式引导）步骤，向前推进前先执行当前步骤 condition check（条件检查）。
   * @author PopoY
   * @param nextStep 目标步骤下标。
   */
  const advancePressJobTour = (nextStep: number) => {
    if (nextStep > currentTourStep) {
      const warningMessage = activeTourSteps[currentTourStep]?.guard?.();

      if (warningMessage) {
        messageApi.warning(warningMessage);
        return;
      }
    }

    setCurrentTourStep(nextStep);
  };

  /**
   * @brief 完成 Tour（漫游式引导）前执行当前步骤 guard（条件检查），避免 Finish（完成）绕过校验。
   * @author PopoY
   */
  const finishPressJobTour = () => {
    const warningMessage = activeTourSteps[currentTourStep]?.guard?.();

    if (warningMessage) {
      messageApi.warning(warningMessage);
      return;
    }

    closePressJobTour();
  };

  /**
   * @brief 更新 press job filters（压机作业筛选），优先写回 App Shell（应用外壳）。
   * @author PopoY
   * @param nextFilterStateOrUpdater 下一个筛选状态或基于当前状态的 updater（更新器）。
   */
  const updatePressJobFilters = useCallback(
    (nextFilterStateOrUpdater: PressJobFilterStateChange) => {
      if (onFilterStateChange) {
        onFilterStateChange(nextFilterStateOrUpdater);
        return;
      }

      setLocalFilters(nextFilterStateOrUpdater);
    },
    [onFilterStateChange],
  );

  /**
   * @brief 读取预计时长 input（输入框）当前展示值，优先使用本地 draft（草稿）。
   * @author PopoY
   * @param row 当前作业行。
   * @returns 预计时长输入框展示值。
   */
  function getPlannedDurationValue(row: PressJobCurrentJobRow): string {
    const draftKey = resolvePlannedDurationDraftKey(row);

    return (
      plannedDurationDrafts[draftKey] ??
      formatCurrentJobCell(row.plannedDurationHours, "")
    );
  }

  /**
   * @brief 更新预计时长 draft（草稿），只保留数字和单个 decimal point（小数点）。
   * @author PopoY
   * @param draftKey 当前作业稳定 draft key（草稿键）。
   * @param nextValue 下一个输入值。
   */
  const updatePlannedDurationDraft = (draftKey: string, nextValue: string) => {
    setPlannedDurationDrafts((currentDrafts) => ({
      ...currentDrafts,
      [draftKey]: normalizePlannedDurationInput(nextValue),
    }));
  };

  /**
   * @brief 预计时长 input（输入框）聚焦时打开 NumericKeypad（数字键盘）。
   * @author PopoY
   * @param row 当前作业行。
   * @param inputElement 当前触发的 input（输入框）。
   */
  const handlePlannedDurationFocus = (
    row: PressJobCurrentJobRow,
    inputElement: HTMLInputElement,
  ) => {
    if (plannedDurationSaveRequestRef.current) {
      inputElement.blur();
      return;
    }

    const draftKey = resolvePlannedDurationDraftKey(row);
    const persistedMarkerArmed =
      persistedPlannedDurationDraftMarkersRef.current.get(draftKey);
    persistedPlannedDurationDraftMarkersRef.current.delete(draftKey);

    plannedDurationEditBaselineRef.current = {
      hadDraft: Object.prototype.hasOwnProperty.call(
        plannedDurationDrafts,
        draftKey,
      ),
      persistedMarkerArmed,
      rowId: draftKey,
      value: getPlannedDurationValue(row),
    };
    activePlannedDurationInputRef.current = inputElement;
    setActivePlannedDurationRowId(draftKey);
    setPlannedDurationKeypadPosition(
      resolveNumericKeypadPosition(
        inputElement.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
      ),
    );
  };

  /**
   * @brief 隐藏预计时长 NumericKeypad（数字键盘）并释放 input focus（输入焦点）。
   * @author PopoY
   */
  const finishPlannedDurationKeypad = (
    rowId = activePlannedDurationRowId,
    plannedDurationInput = activePlannedDurationInputRef.current,
  ) => {
    if (
      rowId !== activePlannedDurationRowId ||
      plannedDurationInput !== activePlannedDurationInputRef.current
    ) {
      return;
    }

    activePlannedDurationInputRef.current = null;
    plannedDurationEditBaselineRef.current = null;
    setActivePlannedDurationRowId(null);
    setPlannedDurationKeypadPosition(null);
    plannedDurationInput?.blur();
  };

  /**
   * @brief 关闭 NumericKeypad（数字键盘）并丢弃当前未确认 draft（草稿）。
   * @author PopoY
   */
  const closePlannedDurationKeypad = () => {
    if (plannedDurationSaveRequestRef.current) {
      return;
    }

    const rowId = activePlannedDurationRowId;
    const plannedDurationInput = activePlannedDurationInputRef.current;
    const baseline = plannedDurationEditBaselineRef.current;
    if (rowId) {
      setPlannedDurationDrafts((currentDrafts) =>
        discardPlannedDurationDraft(
          currentDrafts,
          rowId,
          plannedDurationSaveRequestRef,
          baseline?.rowId === rowId ? baseline : undefined,
        ),
      );
      if (
        baseline?.rowId === rowId &&
        baseline.persistedMarkerArmed !== undefined
      ) {
        persistedPlannedDurationDraftMarkersRef.current.set(
          rowId,
          baseline.persistedMarkerArmed,
        );
      }
    }

    finishPlannedDurationKeypad(rowId, plannedDurationInput);
  };

  /**
   * @brief 预计时长 input（输入框）失焦时关闭 NumericKeypad（数字键盘）。
   * @author PopoY
   */
  const handlePlannedDurationBlur = () => {
    if (activePlannedDurationInputRef.current) {
      closePlannedDurationKeypad();
    }
  };

  /**
   * @brief 处理预计时长 input（输入框）原生输入。
   * @author PopoY
   * @param row 当前作业行。
   * @param nextValue 下一个输入值。
   */
  const handlePlannedDurationInputChange = (
    row: PressJobCurrentJobRow,
    nextValue: string,
  ) => {
    updatePlannedDurationDraft(resolvePlannedDurationDraftKey(row), nextValue);
  };

  /**
   * @brief 处理 NumericKeypad（数字键盘）输入。
   * @author PopoY
   * @param nextValue 数字键盘计算后的输入值。
   */
  const handlePlannedDurationKeypadChange = (nextValue: string) => {
    if (!activePlannedDurationRowId) {
      return;
    }

    updatePlannedDurationDraft(activePlannedDurationRowId, nextValue);
  };

  const activePlannedDurationRow = currentJobRows.find(
    (row) =>
      resolvePlannedDurationDraftKey(row) === activePlannedDurationRowId,
  );
  const activePlannedDurationValue = activePlannedDurationRow
    ? getPlannedDurationValue(activePlannedDurationRow)
    : "";

  /**
   * @brief 确认预计时长，先规整并校验，再按 pressJobId（压机作业 ID）决定保存 ERP 或保留本地值。
   * @author PopoY
   */
  const confirmPlannedDurationInput = async () => {
    if (!activePlannedDurationRow) {
      return;
    }

    const row = activePlannedDurationRow;
    const rowId = resolvePlannedDurationDraftKey(row);
    const plannedDurationInput = activePlannedDurationInputRef.current;
    const baseline = plannedDurationEditBaselineRef.current;
    const rowBaseline: PlannedDurationEditBaseline =
      baseline?.rowId === rowId
        ? baseline
        : {
            hadDraft: false,
            value: formatCurrentJobCell(row.plannedDurationHours, ""),
          };
    setSavingPlannedDurationRowId(rowId);

    const result = await savePressJobExpectedDuration({
      baseline: rowBaseline,
      currentJobRowsRef: plannedDurationCurrentRowsRef,
      isSaving: false,
      requestRef: plannedDurationSaveRequestRef,
      row,
      updatePressJobExpectedDuration,
      value: getPlannedDurationValue(row),
    });
    applyPlannedDurationSaveCompletion({
      baseline: rowBaseline,
      draftMarkers: persistedPlannedDurationDraftMarkersRef.current,
      finishKeypad: () =>
        finishPlannedDurationKeypad(rowId, plannedDurationInput),
      notify: (feedback) => {
        if (feedback === "invalid") {
          messageApi.warning("请输入正整数或一位小数的预计时长。");
        } else if (feedback === "local") {
          messageApi.info("预计时长将在开始加工时提交。");
        } else if (feedback === "saved") {
          messageApi.success("预计时长保存成功");
        } else {
          messageApi.error("预计时长保存失败，请重试。");
        }
      },
      requestRef: plannedDurationSaveRequestRef,
      result,
      rowId,
      setDrafts: setPlannedDurationDrafts,
      setSavingRowId: setSavingPlannedDurationRowId,
    });
  };

  /**
   * @brief 更新单行 mold info（模具明细）的工艺选择，只写本地 Table（表格）状态。
   * @author PopoY
   * @param rowIndex 当前模具明细行下标。
   * @param processId 从预选工艺列表中选择的工艺 ID。
   */
  const updateMoldInfoRowProcess = (rowIndex: number, processId?: string) => {
    setMoldInfoRows((currentRows) =>
      currentRows.map((row, index) =>
        index === rowIndex ? { ...row, defaultProcessId: processId } : row,
      ),
    );
    setSelectedMoldInfoRowIndex(rowIndex);
  };

  const currentJobColumns: NonNullable<TableProps<PressJobCurrentJobRow>["columns"]> = [
    {
      title: "压机",
      dataIndex: "pressName",
      width: 120,
      render: (pressName: PressJobCurrentJobRow["pressName"]) =>
        formatCurrentJobCell(pressName),
    },
    {
      title: "模具号",
      dataIndex: "moldNo",
      width: 140,
      render: (moldNo: PressJobCurrentJobRow["moldNo"]) =>
        formatCurrentJobCell(moldNo, "未锁定"),
    },
    {
      title: "预计时长(小时)",
      dataIndex: "plannedDurationHours",
      width: 140,
      render: (_plannedDurationHours, row) => {
        const plannedDurationInput = (
          <Input
            aria-label={`预计时长 ${formatCurrentJobCell(row.pressName, row.localJobSessionId)}`}
            className="press-job-page__planned-duration-input"
            disabled={savingPlannedDurationRowId !== null}
            inputMode="decimal"
            onBlur={handlePlannedDurationBlur}
            onChange={(event) =>
              handlePlannedDurationInputChange(row, event.target.value)
            }
            onFocus={(event) =>
              handlePlannedDurationFocus(row, event.currentTarget)
            }
            value={getPlannedDurationValue(row)}
          />
        );

        return row.localJobSessionId === primaryCurrentJob?.localJobSessionId ? (
          <div ref={plannedDurationTourTargetRef}>{plannedDurationInput}</div>
        ) : (
          plannedDurationInput
        );
      },
    },
    {
      title: "实际时长(小时)",
      dataIndex: "actualDurationHours",
      width: 140,
      render: (
        actualDurationHours: PressJobCurrentJobRow["actualDurationHours"],
        row,
      ) =>
        formatCurrentJobCell(
          actualDurationHours ??
            formatPressJobActualDurationHours(row.startedAt, Date.now(), row.status),
        ),
    },
    {
      title: "开始时间",
      dataIndex: "startedAt",
      width: 180,
      render: (startedAt: PressJobCurrentJobRow["startedAt"]) =>
        formatCurrentJobCell(startedAt),
    },
    {
      title: "加工状态",
      dataIndex: "status",
      width: 120,
      render: (_status, row) =>
        formatCurrentJobCell(
          isPendingPressJob(row)
            ? "待加工"
            : isRunningPressJob(row)
              ? "进行中"
              : row.status,
        ),
    },
  ];
  const moldInfoColumns: NonNullable<TableProps<PressMoldInfoRow>["columns"]> = [
    {
      title: "制造令号",
      dataIndex: "makeOrderNumber",
      width: 150,
      render: (makeOrderNumber: PressMoldInfoRow["makeOrderNumber"]) =>
        formatCurrentJobCell(makeOrderNumber),
    },
    {
      title: "模具号",
      dataIndex: "moldNo",
      width: 150,
      render: (moldNo: PressMoldInfoRow["moldNo"]) => formatCurrentJobCell(moldNo),
    },
    {
      title: "工序号",
      dataIndex: "stages",
      width: 120,
      render: (stages: PressMoldInfoRow["stages"]) => formatCurrentJobCell(stages),
    },
    {
      title: "模具名称",
      dataIndex: "name",
      render: (name: PressMoldInfoRow["name"]) => formatCurrentJobCell(name),
    },
    {
      title: "选择工艺",
      dataIndex: "defaultProcessId",
      width: 220,
      render: (_defaultProcessId, row, index) => (
        <Select
          aria-label={`选择工艺 ${formatCurrentJobCell(row.moldNo, String(index))}`}
          classNames={{
            popup: {
              list: "press-job-page__select-list",
              listItem: "press-job-page__select-option",
              root: "press-job-page__select-popup press-job-page__select-popup--four-column press-job-page__mold-process-select-popup",
            },
          }}
          className="press-job-page__mold-process-select"
          listHeight={PRESS_JOB_TOUCH_SELECT_LIST_HEIGHT}
          onChange={(processId) => updateMoldInfoRowProcess(index, processId)}
          optionFilterProp="label"
          options={processOptions}
          placeholder="请选择工艺"
          popupMatchSelectWidth={false}
          showSearch
          value={resolveMoldInfoRowProcessId(row, filters.processId)}
          virtual={false}
        />
      ),
    },
  ];
  const lockedMoldColumns: NonNullable<TableProps<PressLockedMoldRow>["columns"]> = [
    {
      title: "模具号",
      dataIndex: "moldNo",
      width: 140,
      render: (moldNo: PressLockedMoldRow["moldNo"]) =>
        formatCurrentJobCell(moldNo),
    },
    {
      title: "工序号",
      dataIndex: "stages",
      width: 100,
      render: (stages: PressLockedMoldRow["stages"]) => formatCurrentJobCell(stages),
    },
    {
      title: "制造令号",
      dataIndex: "makeOrderNumber",
      width: 140,
      render: (makeOrderNumber: PressLockedMoldRow["makeOrderNumber"]) =>
        formatCurrentJobCell(makeOrderNumber),
    },
    {
      title: "工艺名称",
      dataIndex: "craftCode",
      width: 140,
      render: (_craftCode, row) =>
        formatPressLockedMoldCraftName(
          row,
          activeProcessOptions,
          pressMoldCraftOptions,
        ),
    },
    {
      title: "工时类型",
      dataIndex: "workTimeType",
      width: 120,
      render: (_workTimeType, row) =>
        formatPressLockedMoldWorkType(row, pressMoldWorkTypeOptions),
    },
    {
      title: "开始时间",
      dataIndex: "startedAt",
      width: 170,
      render: (startedAt: PressLockedMoldRow["startedAt"]) =>
        formatCurrentJobCell(startedAt),
    },
    {
      title: "作业员",
      dataIndex: "operatorId",
      width: 120,
      render: (_operatorId, row) =>
        formatPressLockedMoldOperatorName(
          row,
          activeOperatorOptions,
          pressMoldOperatorOptions,
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_value, row) => (
        <Button
          color="danger"
          icon={createMoldUnlockIcon()}
          onClick={(event) => {
            event.stopPropagation();
            confirmMoldUnlock([row.moldNo]);
          }}
          size="small"
          variant="outlined"
        >
          解锁
        </Button>
      ),
    },
  ];
  const moldInfoRowSelection: TableProps<PressMoldInfoRow>["rowSelection"] = {
    type: "radio",
    selectedRowKeys:
      selectedMoldInfoRowIndex === undefined
        ? []
        : [String(selectedMoldInfoRowIndex)],
    onChange: (nextSelectedRowKeys) => {
      const nextIndex = Number(nextSelectedRowKeys[0]);
      setSelectedMoldInfoRowIndex(
        Number.isInteger(nextIndex) ? nextIndex : undefined,
      );
    },
  };
  const lockedMoldRowSelection: TableProps<PressLockedMoldRow>["rowSelection"] = {
    selectedRowKeys: selectedUnlockMoldNos,
    onChange: (nextSelectedRowKeys) => {
      setSelectedUnlockMoldNos(nextSelectedRowKeys.map(String));
    },
  };

  useEffect(() => {
    const persistedDraftKeys =
      consumeArmedPersistedPlannedDurationDraftMarkers(
        persistedPlannedDurationDraftMarkersRef.current,
      );

    setPlannedDurationDrafts((currentDrafts) =>
      dropPersistedPlannedDurationDrafts(
        currentDrafts,
        persistedDraftKeys,
        currentJobRows,
      ),
    );
  }, [currentJobRows]);

  // @author PopoY: refresh cleanup（刷新清理）必须先运行，避免旧 refresh 消费同批保存刚登记的 marker（标记）。
  useEffect(() => {
    armPersistedPlannedDurationDraftMarkers(
      persistedPlannedDurationDraftMarkersRef.current,
    );
  });

  /**
   * @brief 点击 Unlock Drawer（解锁抽屉）表格行时切换 selection（选择）状态。
   * @author PopoY
   * @param moldNo 当前行 moldNo（模具号）。
   */
  const toggleUnlockMoldRow = (moldNo: string) => {
    const normalizedMoldNo = moldNo.trim();

    if (!normalizedMoldNo) {
      return;
    }

    setSelectedUnlockMoldNos((currentMoldNos) =>
      currentMoldNos.includes(normalizedMoldNo)
        ? currentMoldNos.filter((currentMoldNo) => currentMoldNo !== normalizedMoldNo)
        : [...currentMoldNos, normalizedMoldNo],
    );
  };

  /**
   * @brief 加载并缓存当前班组的 cascade options（级联选项）。
   * @author PopoY
   * @param teamId 需要加载人员和预选工艺的班组 ID。
   */
  const loadAndCachePressJobTeamOptions = useCallback(
    (teamId: string) => {
      if (!loadPressJobTeamOptions) {
        return;
      }

      const teamLoadVersion = teamLoadVersionRef.current + 1;
      teamLoadVersionRef.current = teamLoadVersion;
      setLoadingTeamId(teamId);

      void loadPressJobTeamOptions(teamId)
        .then((nextTeamOptions) => {
          if (teamLoadVersionRef.current === teamLoadVersion) {
            setSelectedTeamOptions(nextTeamOptions);
          }
        })
        .catch(() => {
          if (teamLoadVersionRef.current === teamLoadVersion) {
            setSelectedTeamOptions({
              teamId,
              operatorOptions: [],
              processOptions: [],
            });
          }
        })
        .finally(() => {
          if (teamLoadVersionRef.current === teamLoadVersion) {
            setLoadingTeamId(null);
          }
        });
    },
    [loadPressJobTeamOptions],
  );

  useEffect(() => {
    const nextDefaultFilters = resolvePressJobDefaultFilterState(
      filters,
      pressJobLookupData,
    );

    if (nextDefaultFilters) {
      updatePressJobFilters(nextDefaultFilters);
    }
  }, [filters, pressJobLookupData, updatePressJobFilters]);

  useEffect(() => {
    if (
      shouldLoadPersistedPressJobTeamOptions(
        filters.teamId,
        pressJobLookupData?.defaultTeamId,
        selectedTeamOptions,
        loadingTeamId,
        Boolean(loadPressJobTeamOptions),
      )
    ) {
      loadAndCachePressJobTeamOptions(filters.teamId);
    }
  }, [
    filters.teamId,
    loadAndCachePressJobTeamOptions,
    loadPressJobTeamOptions,
    loadingTeamId,
    pressJobLookupData?.defaultTeamId,
    selectedTeamOptions,
  ]);

  /**
   * @brief 保存 teamId（班组）当前选择，不发起任何请求。
   * @author PopoY
   * @param teamId 选中的班组 ID。
   */
  const handleTeamChange = (teamId?: string) => {
    updatePressJobFilters(createPressJobTeamChangeState(teamId));
    setSelectedTeamOptions(null);

    if (
      !teamId ||
      teamId === pressJobLookupData?.defaultTeamId ||
      !loadPressJobTeamOptions
    ) {
      return;
    }

    loadAndCachePressJobTeamOptions(teamId);
  };

  /**
   * @brief 保存 operatorId（人员）当前选择，不发起任何请求。
   * @author PopoY
   * @param operatorId 选中的人员 ID。
   */
  const handleOperatorChange = (operatorId?: string) => {
    updatePressJobFilters((currentFilters) => ({ ...currentFilters, operatorId }));
  };

  /**
   * @brief 保存 processId（预选工艺）当前选择，不发起任何请求。
   * @author PopoY
   * @param processId 选中的工艺 ID。
   */
  const handleProcessChange = (processId?: string) => {
    updatePressJobFilters((currentFilters) => ({ ...currentFilters, processId }));
  };

  /**
   * @brief 判断指定 press device action（压机设备动作）是否正在执行。
   * @author PopoY
   * @param buttonKey 当前按钮 key（键）。
   * @returns 当前按钮 pending（挂起）时返回 true。
   */
  const isPressDeviceActionPending = (
    buttonKey: string,
  ): buttonKey is PressDeviceActionButtonKey =>
    Boolean(pendingPressDeviceActionKeys[buttonKey as PressDeviceActionButtonKey]);

  /**
   * @brief 运行 Task5（任务五）simple device action（简单设备动作）并展示中文反馈。
   * @author PopoY
   * @param buttonKey 当前 simple action（简单动作）按钮 key（键）。
   */
  const runPressDeviceAction = async (
    buttonKey: PressSimpleDeviceActionButtonKey,
  ) => {
    if (isPressDeviceActionPending(buttonKey)) {
      return;
    }

    setPendingPressDeviceActionKeys((currentKeys) => ({
      ...currentKeys,
      [buttonKey]: true,
    }));

    try {
      const result = await executePressJobSimpleDeviceAction({
        buttonKey,
        currentJobRows,
        driverSession,
        executePressDeviceCommand,
        filters,
        precheckPressDeviceCommand,
        recordPressDeviceActionDiagnostic,
        recordPressJobOperation,
        refreshPressJobCurrentJobs,
        refreshSignalSnapshot: refreshSignalSnapshot ?? driverSession?.refreshSnapshot,
        updatePressMachineStatus,
      });

      messageApi[result.feedbackType](result.feedbackMessage);
    } finally {
      setPendingPressDeviceActionKeys((currentKeys) => {
        const { [buttonKey]: _finishedAction, ...remainingKeys } = currentKeys;
        return remainingKeys;
      });
    }
  };

  /**
   * @brief 用 Ant Design Modal（确认框）包装成 Promise，便于 workflow（流程）顺序控制。
   * @author PopoY
   * @param title 需要操作员确认的中文提示。
   * @returns 确认返回 true，取消返回 false。
   */
  const confirmPressDeviceWorkflow = (title: string): Promise<boolean> =>
    new Promise((resolve) => {
      modal.confirm({
        title,
        okText: "确认",
        cancelText: "取消",
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

  /**
   * @brief 运行高风险 workflow（流程）并维护单按钮 loading（加载）状态。
   * @author PopoY
   * @param buttonKey 当前高风险按钮 key（键）。
   * @param task 实际 workflow（流程）函数。
   */
  const runPressWorkflowAction = async (
    buttonKey: PressDeviceActionButtonKey,
    task: () => Promise<PressDeviceActionFlowResult>,
  ) => {
    if (isPressDeviceActionPending(buttonKey)) {
      return;
    }

    setPendingPressDeviceActionKeys((currentKeys) => ({
      ...currentKeys,
      [buttonKey]: true,
    }));

    try {
      const result = await task();
      messageApi[result.feedbackType](result.feedbackMessage);
    } finally {
      setPendingPressDeviceActionKeys((currentKeys) => {
        const { [buttonKey]: _finishedAction, ...remainingKeys } = currentKeys;
        return remainingKeys;
      });
    }
  };

  /**
   * @brief 建立通信 handler（处理函数），执行 connectMes（建立通信）语义命令。
   * @author PopoY
   */
  const handleConnect = () => {
    void runPressDeviceAction("connect");
  };

  /**
   * @brief 打开 Mold Lock Panel（模具锁定面板）前执行本地前置校验。
   * @author PopoY
   */
  const handleLockMold = () => {
    const validationMessage = validateMoldLockPreflight(filters, currentJobRows);

    if (validationMessage) {
      messageApi.warning(validationMessage);
      return;
    }

    setIsMoldLockPanelOpen(true);

    if (activeTour === "start") {
      setActiveTour("lock");
      setCurrentTourStep(0);
    }
  };

  /**
   * @brief 清理 Mold Lock Panel（模具锁定面板）本地候选状态。
   * @author PopoY
   */
  const resetMoldLockPanelState = () => {
    setMoldSearchText("");
    setMoldCandidates([]);
    setMoldInfoRows([]);
    setSelectedMoldNo(undefined);
    setSelectedMoldInfoRowIndex(undefined);
    setMoldCandidateLoading(false);
    setMoldInfoLoading(false);
    setIsMoldSelectOpen(false);
    setMoldNoKeypadPosition(null);
    moldNoKeypadOpenRef.current = false;
    pendingSelectedMoldNoRef.current = null;
    activeMoldNoInputRef.current = null;
  };

  /**
   * @brief 关闭 Mold Lock Panel（模具锁定面板）并清空候选数据。
   * @author PopoY
   */
  const cancelMoldLockPanel = () => {
    if (activeTour === "lock") {
      closePressJobTour();
    }

    setIsMoldLockPanelOpen(false);
    resetMoldLockPanelState();
  };

  /**
   * @brief 查询 Unlock Drawer（解锁抽屉）的 locked molds（已锁定模具），并忽略 stale response（过期响应）。
   * @author PopoY
   */
  const loadLockedMoldsOnce = () => {
    const loadVersion = lockedMoldLoadVersionRef.current + 1;
    lockedMoldLoadVersionRef.current = loadVersion;
    setLockedMoldsLoading(true);
    setLockedMoldRows([]);
    setSelectedUnlockMoldNos([]);

    if (!loadPressLockedMolds) {
      setLockedMoldsLoading(false);
      return;
    }

    void loadPressLockedMolds({
      correlationId: createPressMoldUnlockCorrelationId(),
    })
      .then((nextRows) => {
        if (lockedMoldLoadVersionRef.current === loadVersion) {
          setLockedMoldRows(nextRows);
        }
      })
      .catch(() => {
        if (lockedMoldLoadVersionRef.current === loadVersion) {
          setLockedMoldRows([]);
          messageApi.error("已锁定模具查询失败，请稍后重试。");
        }
      })
      .finally(() => {
        if (lockedMoldLoadVersionRef.current === loadVersion) {
          setLockedMoldsLoading(false);
        }
      });
  };

  /**
   * @brief 清理 Unlock Drawer（解锁抽屉）的 selection（选择）和本地数据。
   * @author PopoY
   */
  const resetMoldUnlockDrawerState = () => {
    setLockedMoldRows([]);
    setSelectedUnlockMoldNos([]);
    setLockedMoldsLoading(false);
  };

  /**
   * @brief 打开 Unlock Drawer（解锁抽屉）并只查询一次 locked molds（已锁定模具）。
   * @author PopoY
   */
  const openMoldUnlockDrawer = () => {
    if (!hasUnlockableCurrentMold(currentJobRows)) {
      messageApi.warning("当前没有可解锁模具。");
      return;
    }

    setIsMoldUnlockDrawerOpen(true);
    loadLockedMoldsOnce();
  };

  /**
   * @brief 关闭 Unlock Drawer（解锁抽屉）。
   * @author PopoY
   */
  const cancelMoldUnlockDrawer = () => {
    if (activeTour === "unlock") {
      closePressJobTour();
    }

    setIsMoldUnlockDrawerOpen(false);
    resetMoldUnlockDrawerState();
  };

  /**
   * @brief 调用注入的 remote search（远程查询）加载候选模具，并忽略 stale response（过期响应）。
   * @author PopoY
   * @param nextMoldNo 需要查询的模具号文本。
   */
  const searchMoldCandidates = useCallback(
    (nextMoldNo = moldSearchText) => {
      const moldNo = nextMoldNo.trim();
      const searchVersion = moldCandidateSearchVersionRef.current + 1;
      moldCandidateSearchVersionRef.current = searchVersion;

      if (!searchPressMoldCandidates || moldNo.length === 0) {
        setMoldCandidates([]);
        setMoldInfoRows([]);
        setSelectedMoldNo(undefined);
        setSelectedMoldInfoRowIndex(undefined);
        setMoldCandidateLoading(false);
        setIsMoldSelectOpen(false);
        return;
      }

      const correlationId = createPressMoldLockCorrelationId("search");
      setMoldCandidateLoading(true);
      setIsMoldSelectOpen(true);
      void searchPressMoldCandidates(
        createPressMoldCandidateSearchInput(moldNo, currentJobRows, correlationId),
      )
        .then((nextCandidates) => {
          if (moldCandidateSearchVersionRef.current !== searchVersion) {
            return;
          }

          setMoldCandidates(nextCandidates);
          setMoldInfoRows([]);
          setSelectedMoldNo(undefined);
          setSelectedMoldInfoRowIndex(undefined);
          setIsMoldSelectOpen(true);
        })
        .catch(() => {
          if (moldCandidateSearchVersionRef.current !== searchVersion) {
            return;
          }

          setMoldCandidates([]);
          setMoldInfoRows([]);
          setSelectedMoldNo(undefined);
          setSelectedMoldInfoRowIndex(undefined);
          setIsMoldSelectOpen(false);
          messageApi.error("模具查询失败，请稍后重试。");
        })
        .finally(() => {
          if (moldCandidateSearchVersionRef.current === searchVersion) {
            setMoldCandidateLoading(false);
          }
        });
    },
    [currentJobRows, messageApi, moldSearchText, searchPressMoldCandidates],
  );

  /**
   * @brief 处理 moldNo input（模具号输入框）文本变化。
   * @author PopoY
   * @param nextMoldNo 下一个模具号查询文本。
   */
  const handleMoldSearchTextChange = (nextMoldNo: string) => {
    const pendingSelectedMoldNo = pendingSelectedMoldNoRef.current;

    if (!nextMoldNo && pendingSelectedMoldNo) {
      setMoldSearchText(pendingSelectedMoldNo);
      setIsMoldSelectOpen(false);
      return;
    }

    pendingSelectedMoldNoRef.current = null;
    setMoldSearchText(nextMoldNo);
    setSelectedMoldNo(undefined);
    setMoldInfoRows([]);
    setSelectedMoldInfoRowIndex(undefined);
    setIsMoldSelectOpen(false);
  };

  /**
   * @brief moldNo input（模具号输入框）聚焦时打开 hyphen keypad（连字符键盘）。
   * @author PopoY
   * @param inputElement 当前触发输入框。
   */
  const handleMoldNoKeypadFocus = (inputElement: HTMLElement) => {
    activeMoldNoInputRef.current = inputElement;
    moldNoKeypadOpenRef.current = true;
    setIsMoldSelectOpen(false);
    setMoldNoKeypadPosition(
      resolveNumericKeypadPosition(
        inputElement.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
      ),
    );
  };

  /**
   * @brief 关闭 moldNo keypad（模具号键盘）。
   * @author PopoY
   */
  const closeMoldNoKeypad = (shouldBlur = true) => {
    moldNoKeypadOpenRef.current = false;
    setMoldNoKeypadPosition(null);

    if (shouldBlur) {
      activeMoldNoInputRef.current?.blur();
      activeMoldNoInputRef.current = null;
    }
  };

  /**
   * @brief 确认 moldNo keypad（模具号键盘）输入后再触发 remote search（远程查询）。
   * @author PopoY
   */
  const confirmMoldNoSearch = () => {
    searchMoldCandidates(moldSearchText);
    closeMoldNoKeypad(false);
  };

  /**
   * @brief 控制 moldNo Select popup（模具号选择器浮层），避免 keypad（键盘）打开时同时弹出筛选面板。
   * @author PopoY
   * @param nextOpen Ant Design Select（选择器）请求切换到的 open（展开）状态。
   */
  const handleMoldSelectOpenChange = (nextOpen: boolean) => {
    if (
      pendingSelectedMoldNoRef.current ||
      moldNoKeypadOpenRef.current ||
      moldNoKeypadPosition
    ) {
      setIsMoldSelectOpen(false);
      return;
    }

    setIsMoldSelectOpen(nextOpen && moldCandidates.length > 0);
  };

  /**
   * @brief 选择 10*10 grid（栅格）候选模具并回写 input（输入框）。
   * @author PopoY
   * @param candidate 当前点击的候选模具。
   */
  const handleMoldCandidateSelect = (candidate: PressMoldCandidate) => {
    pendingSelectedMoldNoRef.current = candidate.moldNo;
    setSelectedMoldNo(candidate.moldNo);
    setMoldSearchText(candidate.moldNo);
    setMoldInfoRows([]);
    setSelectedMoldInfoRowIndex(undefined);
    setIsMoldSelectOpen(false);
  };

  /**
   * @brief 通过 Select（选择器）选中值定位完整候选模具。
   * @author PopoY
   * @param moldNo 当前 Select（选择器）选中的模具号。
   */
  const handleMoldCandidateSelectByMoldNo = (moldNo?: string) => {
    const candidate = moldCandidates.find(
      (currentCandidate) => currentCandidate.moldNo === moldNo,
    );

    if (candidate) {
      handleMoldCandidateSelect(candidate);
      return;
    }

    handleMoldSearchTextChange("");
  };

  /**
   * @brief 点击 input（输入框）右侧确定后查询下方 Table（表格）明细。
   * @author PopoY
   */
  const confirmMoldInfoSearch = () => {
    const moldNo = selectedMoldNo?.trim();

    if (!moldNo) {
      messageApi.warning("请先选择候选模具号。");
      return;
    }

    const searchVersion = moldInfoSearchVersionRef.current + 1;
    moldInfoSearchVersionRef.current = searchVersion;

    if (!searchPressMoldInfoRows) {
      setMoldInfoRows([]);
      setSelectedMoldInfoRowIndex(undefined);
      return;
    }

    const correlationId = createPressMoldLockCorrelationId("info");
    setMoldInfoLoading(true);
    void searchPressMoldInfoRows(
      createPressMoldInfoSearchInput(moldNo, currentJobRows, correlationId),
    )
      .then((nextRows) => {
        if (moldInfoSearchVersionRef.current !== searchVersion) {
          return;
        }

        setMoldInfoRows(nextRows);
        setSelectedMoldInfoRowIndex(undefined);
      })
      .catch(() => {
        if (moldInfoSearchVersionRef.current !== searchVersion) {
          return;
        }

        setMoldInfoRows([]);
        setSelectedMoldInfoRowIndex(undefined);
        messageApi.error("模具明细查询失败，请稍后重试。");
      })
      .finally(() => {
        if (moldInfoSearchVersionRef.current === searchVersion) {
          setMoldInfoLoading(false);
        }
      });
  };

  /**
   * @brief 处理 moldNo keypad（模具号键盘）输入。
   * @author PopoY
   * @param nextMoldNo 数字键盘计算后的模具号文本。
   */
  const handleMoldNoKeypadChange = (nextMoldNo: string) => {
    handleMoldSearchTextChange(nextMoldNo);
  };

  /**
   * @brief 提交当前选中模具前二次校验，并打开 Modal.confirm（确认框）。
   * @author PopoY
   */
  const confirmMoldLockSelection = () => {
    const preflightMessage = validateMoldLockPreflight(filters, currentJobRows);

    if (preflightMessage) {
      messageApi.warning(preflightMessage);
      return;
    }

    const selection =
      selectedMoldInfoRow && filters.processId
        ? createPressMoldLockSelection(selectedMoldInfoRow, filters.processId)
        : null;
    const validationMessage = validatePressMoldLockSelection(selection, currentJobRows);

    if (validationMessage) {
      messageApi.warning(validationMessage);
      return;
    }

    if (!selection) {
      return;
    }

    const request = createPressMoldLockRequest(
      filters,
      selection,
      createPressMoldLockCorrelationId("lock"),
    );

    modal.confirm({
      title: `是否确认锁定「${selection.moldNo}」模具？`,
      okText: "确认锁定",
      cancelText: "取消",
      onOk: () => submitPressMoldLockRequest(request),
    });
  };

  /**
   * @brief 执行锁模提交、局部刷新和 diagnostic summary（诊断摘要）记录。
   * @author PopoY
   * @param request 已通过白名单构造的锁模请求。
   */
  const submitPressMoldLockRequest = async (request: PressMoldLockRequest) => {
    setMoldLockSubmitting(true);

    try {
      const status = await submitPressMoldLockWithRefresh({
        lockPressMold,
        refreshPressJobCurrentJobs,
        recordPressMoldLockDiagnostic,
        request,
      });

      if (status === "CURRENT_JOB_REFRESH_FAILED") {
        messageApi.warning("锁定完成，当前作业刷新失败，请手动刷新后确认。");
      } else {
        messageApi.success("锁定完成");
      }

      cancelMoldLockPanel();
    } catch (caughtError) {
      messageApi.error(resolvePressMoldLockErrorMessage(caughtError));
    } finally {
      setMoldLockSubmitting(false);
    }
  };

  /**
   * @brief 对 single/batch unlock（单套/批量解锁）执行统一校验和确认。
   * @author PopoY
   * @param moldNos 待解锁的 moldNo（模具号）数组。
   */
  const confirmMoldUnlock = (moldNos: string[]) => {
    const validationMessage = validatePressMoldUnlockSelection({
      lockedMolds: lockedMoldRows,
      operatorId: filters.operatorId,
      selectedMoldNos: moldNos,
      currentJobRows,
    });

    if (validationMessage) {
      messageApi.warning(validationMessage);
      return;
    }

    const request = createPressMoldUnlockRequest(
      filters,
      moldNos,
      createPressMoldUnlockCorrelationId(),
    );

    modal.confirm({
      title: `是否确认解锁「${request.moldNos.join("、")}」模具？`,
      okText: "确认解锁",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => submitPressMoldUnlockRequest(request),
    });
  };

  /**
   * @brief 执行解锁提交、关闭 Drawer（抽屉）并刷新 current jobs（当前作业）。
   * @author PopoY
   * @param request 已通过白名单构造的解锁请求。
   */
  const submitPressMoldUnlockRequest = async (
    request: PressMoldUnlockRequest,
  ) => {
    setMoldUnlockSubmitting(true);

    try {
      const status = await submitPressMoldUnlockWithRefresh({
        request,
        unlockPressMolds,
        refreshPressJobCurrentJobs,
        recordPressMoldUnlockDiagnostic,
      });

      if (status === "CURRENT_JOB_REFRESH_FAILED") {
        messageApi.warning("解锁完成，当前作业刷新失败，请手动切换页面后确认。");
      } else {
        messageApi.success("解锁完成");
      }

      cancelMoldUnlockDrawer();
    } catch (caughtError) {
      messageApi.error(resolvePressMoldUnlockErrorMessage(caughtError));
    } finally {
      setMoldUnlockSubmitting(false);
    }
  };

  /**
   * @brief 开始加工 handler（处理函数），执行 Driver precheck/start（驱动预检/启动）和 ERP start（开始落库）。
   * @author PopoY
   */
  const handleStartProcessing = () => {
    void runPressWorkflowAction("startProcessing", () =>
      executePressJobStartWorkflow({
        currentJobRows,
        driverSession,
        executePressDeviceCommand,
        expectedDuration: readPrimaryCurrentJob(currentJobRows)
          ? getPlannedDurationValue(readPrimaryCurrentJob(currentJobRows)!)
          : "",
        filters,
        precheckPressDeviceCommand,
        recordPressDeviceActionDiagnostic,
        recordPressJobOperation,
        refreshPressJobCurrentJobs,
        refreshSignalSnapshot: refreshSignalSnapshot ?? driverSession?.refreshSnapshot,
        startPressJob,
      }),
    );
  };

  /**
   * @brief 完成加工 handler（处理函数），执行 final snapshot（最终快照）、ERP complete（完工）和 cleanup（收尾）。
   * @author PopoY
   */
  const handleCompleteProcessing = () => {
    void runPressWorkflowAction("completeProcessing", () =>
      runCompletePressJobWorkflow({
        currentJobRows,
        driverSession,
        executePressDeviceCommand,
        completePressJob,
        filters,
        getFinalSignalSnapshot,
        precheckPressDeviceCommand,
        recordPressDeviceActionDiagnostic,
        recordPressJobOperation,
        recordPressJobParameters,
        refreshPressJobCurrentJobs,
        refreshSignalSnapshot: refreshSignalSnapshot ?? driverSession?.refreshSnapshot,
      }),
    );
  };

  /**
   * @brief 移入 handler（处理函数），执行 moveIn（移入）语义命令。
   * @author PopoY
   */
  const handleMoveIn = () => {
    void runPressDeviceAction("moveIn");
  };

  /**
   * @brief 移出 handler（处理函数），加工中先复用 complete workflow（完工流程）。
   * @author PopoY
   */
  const handleMoveOut = () => {
    void runPressWorkflowAction("moveOut", () =>
      executePressJobMoveOutWorkflow({
        changeMold: isRunningPressJob(readPrimaryCurrentJob(currentJobRows)),
        confirm: confirmPressDeviceWorkflow,
        currentJobRows,
        driverSession,
        executePressDeviceCommand,
        completePressJob,
        filters,
        getFinalSignalSnapshot,
        precheckPressDeviceCommand,
        recordPressDeviceActionDiagnostic,
        recordPressJobOperation,
        recordPressJobParameters,
        refreshPressJobCurrentJobs,
        refreshSignalSnapshot: refreshSignalSnapshot ?? driverSession?.refreshSnapshot,
      }),
    );
  };

  /**
   * @brief 入线 handler（处理函数），并联 Driver command（驱动命令）和 ERP status（企业资源计划状态）。
   * @author PopoY
   */
  const handleLineIn = () => {
    void runPressDeviceAction("lineIn");
  };

  /**
   * @brief 出线 handler（处理函数），加工中确认后先自动完成加工。
   * @author PopoY
   */
  const handleLineOut = () => {
    void runPressWorkflowAction("lineOut", () =>
      executePressJobLineOutWorkflow({
        confirm: confirmPressDeviceWorkflow,
        currentJobRows,
        driverSession,
        executePressDeviceCommand,
        completePressJob,
        filters,
        getFinalSignalSnapshot,
        precheckPressDeviceCommand,
        recordPressDeviceActionDiagnostic,
        recordPressJobOperation,
        recordPressJobParameters,
        refreshPressJobCurrentJobs,
        refreshSignalSnapshot: refreshSignalSnapshot ?? driverSession?.refreshSnapshot,
        updatePressMachineStatus,
      }),
    );
  };

  // @author PopoY: 建立通信保留 full primary（满底主按钮），其他动作使用 outlined color（描边颜色）。
  const actionButtons: ActionButtonConfig[] = [
    { key: "connect", label: "建立通信", iconSymbol: "↔", type: "primary", onClick: handleConnect },
    { key: "lockMold", label: "锁定模具", color: "primary", iconSymbol: "■", variant: "outlined", onClick: handleLockMold },
    { key: "startProcessing", label: "开始加工", color: "primary", iconSymbol: "▶", variant: "outlined", onClick: handleStartProcessing },
    { key: "completeProcessing", label: "完成加工", color: "green", iconSymbol: "✓", variant: "outlined", onClick: handleCompleteProcessing },
    { key: "moveIn", label: "移入", color: "primary", iconSymbol: "→", variant: "outlined", onClick: handleMoveIn },
    { key: "moveOut", label: "移出", color: "primary", iconSymbol: "←", variant: "outlined", onClick: handleMoveOut },
    { key: "lineIn", label: "入线", color: "green", iconSymbol: "↓", variant: "outlined", onClick: handleLineIn },
    { key: "lineOut", label: "出线", color: "danger", iconSymbol: "↑", variant: "outlined", onClick: handleLineOut },
  ];
  // @author PopoY: Task2（任务二）仅给真实动作按钮增加 Tour target（漫游目标），不改变 production action（生产动作）处理链。
  const actionButtonTourTargets: Partial<
    Record<PressJobActionButtonKey, PressJobTourTargetRef>
  > = {
    lockMold: lockMoldButtonTourTargetRef,
    startProcessing: startButtonTourTargetRef,
    completeProcessing: completeButtonTourTargetRef,
  };

  return (
    <div className="press-job-page">
      <Form
        aria-label="压机作业筛选区"
        className="press-job-page__filters"
        component="section"
        labelCol={{ flex: "72px" }}
        layout="horizontal"
        wrapperCol={{ flex: "1 1 0" }}
      >
        <Row className="press-job-page__filter-row" gutter={12} wrap={false}>
          <Col flex="0 0 220px">
            <div className="press-job-page__filter-target" ref={teamTourTargetRef}>
              <Form.Item label="班组">
                <Select
                  allowClear
                  aria-label="班组选择器"
                  classNames={{
                    popup: {
                      list: "press-job-page__select-list",
                      listItem: "press-job-page__select-option",
                      root: "press-job-page__select-popup press-job-page__select-popup--two-column",
                    },
                  }}
                  listHeight={PRESS_JOB_TOUCH_SELECT_LIST_HEIGHT}
                  onChange={handleTeamChange}
                  optionFilterProp="label"
                  options={teamOptions}
                  placeholder="请选择班组"
                  popupMatchSelectWidth={false}
                  showSearch
                  value={filters.teamId}
                  virtual={false}
                />
              </Form.Item>
            </div>
          </Col>
          <Col flex="0 0 220px">
            <div className="press-job-page__filter-target" ref={operatorTourTargetRef}>
              <Form.Item label="人员">
                <Select
                  allowClear
                  aria-label="人员选择器"
                  classNames={{
                    popup: {
                      list: "press-job-page__select-list",
                      listItem: "press-job-page__select-option",
                      root: "press-job-page__select-popup press-job-page__select-popup--two-column",
                    },
                  }}
                  listHeight={PRESS_JOB_TOUCH_SELECT_LIST_HEIGHT}
                  loading={isTeamOptionsLoading}
                  onChange={handleOperatorChange}
                  optionFilterProp="label"
                  options={operatorOptions}
                  placeholder="请选择人员"
                  popupMatchSelectWidth={false}
                  showSearch
                  value={filters.operatorId}
                  virtual={false}
                />
              </Form.Item>
            </div>
          </Col>
          <Col flex="0 0 360px">
            <div className="press-job-page__filter-target" ref={processTourTargetRef}>
              <Form.Item label="预选工艺">
                <Select
                  allowClear
                  aria-label="预选工艺选择器"
                  classNames={{
                    popup: {
                      list: "press-job-page__select-list",
                      listItem: "press-job-page__select-option",
                      root: "press-job-page__select-popup press-job-page__select-popup--four-column",
                    },
                  }}
                  listHeight={PRESS_JOB_TOUCH_SELECT_LIST_HEIGHT}
                  loading={isTeamOptionsLoading}
                  onChange={handleProcessChange}
                  optionFilterProp="label"
                  options={processOptions}
                  placeholder="请选择预选工艺"
                  popupMatchSelectWidth={false}
                  showSearch
                  value={filters.processId}
                  virtual={false}
                />
              </Form.Item>
            </div>
          </Col>
          <Col className="press-job-page__guidance-launchers" flex="auto">
            <Button
              icon={<PlayCircleOutlined aria-hidden="true" />}
              onClick={() => openPressJobTour("start")}
            >
              开始加工指导
            </Button>
            <Button
              icon={<CheckCircleOutlined aria-hidden="true" />}
              onClick={() => openPressJobTour("complete")}
            >
              完成加工指导
            </Button>
          </Col>
        </Row>
      </Form>

      <section aria-label="压机作业操作区" className="press-job-page__actions-row">
        <Space className="press-job-page__actions" size={8} wrap>
          {actionButtons.map((actionButton) => {
            const actionButtonTargetRef =
              actionButtonTourTargets[actionButton.key];

            return (
              <div
                className="press-job-page__action-button-target"
                key={actionButton.key}
                ref={actionButtonTargetRef as RefObject<HTMLDivElement>}
              >
                <Button
                  autoInsertSpace={false}
                  className={createActionButtonClassName(actionButton)}
                  color={actionButton.color}
                  disabled={isPressDeviceActionPending(actionButton.key)}
                  icon={createActionIcon(actionButton.iconSymbol)}
                  loading={isPressDeviceActionPending(actionButton.key)}
                  onClick={actionButton.onClick}
                  type={actionButton.type}
                  variant={actionButton.variant}
                >
                  {actionButton.label}
                </Button>
              </div>
            );
          })}
        </Space>
        <div className="press-job-page__status">
          <Typography.Text strong>当前状态：</Typography.Text>
          <Tag color={pressJobLineStatus.color}>{pressJobLineStatus.text}</Tag>
        </div>
      </section>

      <section aria-label="当前作业信息" className="press-job-page__job-table">
        <header className="press-job-page__section-title press-job-page__section-title--with-action">
          <Typography.Text strong>当前作业信息</Typography.Text>
          <Button
            color="danger"
            disabled={!hasUnlockableCurrentMold(currentJobRows)}
            icon={createMoldUnlockIcon()}
            onClick={openMoldUnlockDrawer}
            variant="outlined"
          >
            解锁模具
          </Button>
        </header>
        <div className="press-job-page__table-body" ref={currentJobTableTourTargetRef}>
          <Table<PressJobCurrentJobRow>
            columns={currentJobColumns}
            dataSource={currentJobRows}
            locale={{ emptyText: "暂无当前作业" }}
            pagination={false}
            rowClassName={(row) =>
              isPendingPressJob(row)
                ? "press-job-page__current-job-row--pending"
                : isRunningPressJob(row)
                  ? "press-job-page__current-job-row--running"
                  : ""
            }
            rowKey={resolvePlannedDurationDraftKey}
            size="small"
          />
        </div>
      </section>

      <Drawer
        className="press-job-page__mold-lock-drawer"
        extra={
          <Button
            icon={<PlayCircleOutlined aria-hidden="true" />}
            onClick={() => openPressJobTour("lock")}
          >
            锁定模具指导
          </Button>
        }
        onClose={cancelMoldLockPanel}
        open={isMoldLockPanelOpen}
        size={960}
        title="模具锁定面板"
      >
        <div className="press-job-page__mold-lock-layout">
          <div className="press-job-page__mold-lock-toolbar">
            <div
              className="press-job-page__mold-lock-input-target"
              ref={moldLockInputTourTargetRef}
            >
              <Select
                allowClear
                aria-label="模具号输入框"
                classNames={{
                  popup: {
                    list: "press-job-page__select-list",
                    listItem: "press-job-page__select-option",
                    root: "press-job-page__select-popup press-job-page__mold-select-popup",
                  },
                }}
                className="press-job-page__mold-lock-input"
                listHeight={PRESS_JOB_TOUCH_SELECT_LIST_HEIGHT}
                loading={moldCandidateLoading}
                onBlur={() => closeMoldNoKeypad()}
                onChange={handleMoldCandidateSelectByMoldNo}
                onOpenChange={handleMoldSelectOpenChange}
                onSearch={handleMoldSearchTextChange}
                onFocus={(event) => handleMoldNoKeypadFocus(event.currentTarget)}
                open={isMoldSelectOpen}
                optionFilterProp="label"
                options={moldCandidateOptions}
                placeholder="请输入模具号"
                popupMatchSelectWidth={false}
                searchValue={moldSearchText}
                showSearch
                value={selectedMoldNo}
                virtual={false}
              />
            </div>
            <div
              className="press-job-page__mold-lock-button-target"
              ref={moldLockSearchButtonTourTargetRef}
            >
              <Button
                color="primary"
                icon={createMoldLockButtonIcon("⌕")}
                loading={moldInfoLoading}
                onClick={confirmMoldInfoSearch}
                variant="outlined"
              >
                搜索
              </Button>
            </div>
            <Button
              color="orange"
              icon={createMoldLockButtonIcon("↺")}
              onClick={resetMoldLockPanelState}
              variant="outlined"
            >
              重置
            </Button>
            <div
              className="press-job-page__mold-lock-button-target"
              ref={moldLockConfirmButtonTourTargetRef}
            >
              <Button
                disabled={moldLockSubmitting}
                icon={createMoldLockButtonIcon("✓")}
                loading={moldLockSubmitting}
                type="primary"
                onClick={confirmMoldLockSelection}
              >
                确认锁定
              </Button>
            </div>
            <Button
              color="danger"
              icon={createMoldLockButtonIcon("×")}
              onClick={cancelMoldLockPanel}
              variant="outlined"
            >
              取消锁定
            </Button>
          </div>
          <div
            className="press-job-page__mold-info-table-target"
            ref={moldLockInfoTableTourTargetRef}
          >
            <Table<PressMoldInfoRow>
              className="press-job-page__mold-info-table"
              columns={moldInfoColumns}
              dataSource={moldInfoRows}
              loading={moldInfoLoading}
              locale={{ emptyText: "暂无模具明细" }}
              onRow={(_row, index) => ({
                onClick: () => {
                  if (index !== undefined) {
                    setSelectedMoldInfoRowIndex(index);
                  }
                },
              })}
              pagination={false}
              rowKey={(_row, index) => String(index ?? 0)}
              rowSelection={moldInfoRowSelection}
              size="small"
            />
          </div>
          {moldNoKeypadPosition ? (
            <NumericKeypad
              onChange={handleMoldNoKeypadChange}
              onClose={closeMoldNoKeypad}
              onConfirm={confirmMoldNoSearch}
              specialKey="-"
              style={moldNoKeypadPosition}
              value={moldSearchText}
            />
          ) : null}
        </div>
      </Drawer>

      <Drawer
        className="press-job-page__mold-unlock-drawer"
        onClose={cancelMoldUnlockDrawer}
        open={isMoldUnlockDrawerOpen}
        size={960}
        title="解锁模具"
      >
        <div className="press-job-page__mold-unlock-layout">
          <div className="press-job-page__mold-unlock-status-row">
            <div className="press-job-page__mold-unlock-status">
              <span ref={unlockLockedTagTourTargetRef}>
                <Tag>已锁定 {lockedMoldRows.length} 套</Tag>
              </span>
              <span ref={unlockKeepTagTourTargetRef}>
                <Tag>加工中需保留 1 套</Tag>
              </span>
              <span ref={unlockSelectedTagTourTargetRef}>
                <Tag color="processing">已选 {selectedUnlockMoldNos.length} 套</Tag>
              </span>
            </div>
            <Button
              icon={<UnlockOutlined aria-hidden="true" />}
              onClick={() => openPressJobTour("unlock")}
            >
              解锁模具指导
            </Button>
          </div>
          <div
            className="press-job-page__mold-unlock-table-target"
            ref={unlockTableTourTargetRef}
          >
            <Table<PressLockedMoldRow>
              className="press-job-page__mold-unlock-table"
              columns={lockedMoldColumns}
              dataSource={lockedMoldRows}
              loading={lockedMoldsLoading}
              locale={{ emptyText: "暂无已锁定模具" }}
              onRow={(row) => ({
                onClick: () => toggleUnlockMoldRow(row.moldNo),
              })}
              pagination={false}
              rowKey="moldNo"
              rowSelection={lockedMoldRowSelection}
              size="small"
            />
          </div>
          <div className="press-job-page__mold-unlock-footer">
            <Button
              icon={createMoldUnlockCancelIcon()}
              onClick={cancelMoldUnlockDrawer}
            >
              取消
            </Button>
            <div
              className="press-job-page__mold-unlock-confirm-target"
              ref={unlockConfirmButtonTourTargetRef}
            >
              <Button
                danger
                disabled={selectedUnlockMoldNos.length === 0 || moldUnlockSubmitting}
                icon={createMoldUnlockConfirmIcon()}
                loading={moldUnlockSubmitting}
                onClick={() => confirmMoldUnlock(selectedUnlockMoldNos)}
                type="primary"
              >
                确认解锁 {selectedUnlockMoldNos.length} 套
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      {activePlannedDurationRow && plannedDurationKeypadPosition ? (
        <NumericKeypad
          onChange={handlePlannedDurationKeypadChange}
          onClose={closePlannedDurationKeypad}
          onConfirm={confirmPlannedDurationInput}
          style={plannedDurationKeypadPosition}
          value={activePlannedDurationValue}
        />
      ) : null}

      <section aria-label="实时信号" className="press-job-page__signals">
        <header className="press-job-page__section-title press-job-page__section-title--with-action">
          <Typography.Text strong>实时信号</Typography.Text>
          <SignalSnapshotRefreshMeta
            refreshedKey={
              signalSnapshot?.resultCode === "OK"
                ? signalSnapshot.correlationId
                : undefined
            }
          />
        </header>
        <div className="press-job-page__signals-body" ref={signalSnapshotTourTargetRef}>
          <SignalSnapshotTable
            maxSignalsPerRow={PRESS_JOB_MAX_SIGNALS_PER_ROW}
            parameterGroupOptions={parameterGroupOptions}
            signalValues={signalValues}
          />
        </div>
      </section>
      <Tour
        current={currentTourStep}
        onChange={advancePressJobTour}
        onClose={closePressJobTour}
        onFinish={finishPressJobTour}
        open={activeTour !== null}
        steps={activeTourSteps}
      />
    </div>
  );
}

/**
 * @brief 创建 team change（班组变更）后的级联状态，下级人员和工艺必须清空。
 * @author PopoY
 * @param teamId 新选择的班组 ID。
 * @returns 清空 operatorId（人员）和 processId（预选工艺）后的筛选状态。
 */
export function createPressJobTeamChangeState(
  teamId?: string,
): PressJobFilterState {
  return {
    teamId,
    operatorId: undefined,
    processId: undefined,
  };
}

/**
 * @brief 解析当前班组对应的 operator/process options（人员/工艺选项）。
 * @author PopoY
 * @param teamId 当前选择的班组 ID。
 * @param lookupData 首屏 ERP lookup data（企业资源计划查询数据）。
 * @param selectedTeamOptions 异步加载得到的目标班组级联数据。
 * @returns 当前班组可以展示的下级级联选项。
 */
export function resolveActivePressJobTeamOptions(
  teamId: string | undefined,
  lookupData: PressJobLookupData | undefined,
  selectedTeamOptions: PressJobTeamOptions | null,
): ActivePressJobTeamOptions {
  if (selectedTeamOptions !== null && selectedTeamOptions.teamId === teamId) {
    return {
      operatorOptions: selectedTeamOptions.operatorOptions,
      processOptions: selectedTeamOptions.processOptions,
    };
  }

  if (!teamId || teamId === lookupData?.defaultTeamId) {
    return {
      operatorOptions: lookupData?.operatorOptions ?? [],
      processOptions: lookupData?.processOptions ?? [],
    };
  }

  return {
    operatorOptions: [],
    processOptions: [],
  };
}

/**
 * @brief 判断 remount（重新挂载）后是否需要恢复非默认班组 cascade options（级联选项）。
 * @author PopoY
 * @param teamId 当前已保存的班组 ID。
 * @param defaultTeamId ERP 默认班组 ID。
 * @param selectedTeamOptions 当前页面缓存的班组级联 options（选项）。
 * @param loadingTeamId 当前正在加载的班组 ID。
 * @param canLoad 当前是否存在班组 options loader（加载器）。
 * @returns true 表示需要按已保存班组补载人员和预选工艺。
 */
export function shouldLoadPersistedPressJobTeamOptions(
  teamId: string | undefined,
  defaultTeamId: string | undefined,
  selectedTeamOptions: PressJobTeamOptions | null,
  loadingTeamId: string | null,
  canLoad: boolean,
): teamId is string {
  return Boolean(
    canLoad &&
      teamId &&
      teamId !== defaultTeamId &&
      selectedTeamOptions?.teamId !== teamId &&
      loadingTeamId !== teamId,
  );
}

/**
 * @brief 读取 simple action（简单动作）使用的主 current job（当前作业）。
 * @author PopoY
 * @param currentJobRows 当前作业行。
 * @returns 第一条当前作业，缺失时返回 undefined。
 */
export function readPrimaryCurrentJob(
  currentJobRows: PressJobCurrentJobRow[],
): PressJobCurrentJobRow | undefined {
  return currentJobRows[0];
}

/**
 * @brief 判断 current job state（当前作业状态）是否已知。
 * @author PopoY
 * @param currentJobRows 当前作业行。
 * @returns 至少存在一条带 status（状态）的当前作业时返回 true。
 */
export function isCurrentJobStateKnown(
  currentJobRows: PressJobCurrentJobRow[],
): boolean {
  return currentJobRows.some((row) => isNonEmptyString(row.status));
}

/**
 * @brief 校验 Press Device Action（压机设备动作）通用前置条件。
 * @author PopoY
 * @param buttonKey 当前按钮 key（键）。
 * @param filters 当前班组、人员和预选工艺筛选。
 * @param driverSession Driver session（驱动会话）。
 * @param currentJobRows 当前作业行。
 * @returns 中文 validation message（校验消息），通过时返回 null。
 */
export function validateSharedPressDeviceActionPreflight(
  buttonKey: PressSimpleDeviceActionButtonKey,
  filters: PressJobFilterState,
  driverSession: PressJobPageDriverSession | undefined,
  currentJobRows: PressJobCurrentJobRow[],
): string | null {
  if (!isNonEmptyString(filters.teamId)) {
    return "请先选择班组。";
  }

  if (!isNonEmptyString(filters.operatorId)) {
    return "请先选择人员。";
  }

  if (!isNonEmptyString(filters.processId)) {
    return "请先选择预选工艺。";
  }

  if (!isCurrentJobStateKnown(currentJobRows)) {
    return "当前作业状态未确认，请刷新后重试。";
  }

  if (!isDriverLeaseActive(driverSession)) {
    return "设备授权未就绪，请稍后重试。";
  }

  if (buttonKey !== "connect" && !isDriverSessionConnected(driverSession)) {
    return "设备授权未就绪，请稍后重试。";
  }

  return null;
}

/**
 * @brief 创建 Press Device Action identity（压机设备动作身份），不包含裸设备字段。
 * @author PopoY
 * @param buttonKey 当前按钮 key（键）。
 * @param currentJobRow 当前主作业行。
 * @returns 可复用的 correlation/idempotency/local session（关联/幂等/本地会话）身份。
 */
export function createPressDeviceActionIdentity(
  buttonKey: PressSimpleDeviceActionButtonKey,
  currentJobRow?: PressJobCurrentJobRow,
): PressDeviceActionIdentity {
  const correlationId = `press-device-${buttonKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    buttonKey,
    commandName: PRESS_SIMPLE_DEVICE_ACTION_COMMANDS[buttonKey],
    correlationId,
    idempotencyKey: correlationId,
    localJobSessionId:
      currentJobRow?.localJobSessionId ?? `press-device-action-${correlationId}`,
  };
}

/**
 * @brief 执行 Task5（任务五）的 simple device action（简单设备动作）。
 * @author PopoY
 * @param input 页面注入回调、筛选、驱动状态和当前作业。
 * @returns UI（界面）可直接展示的中文反馈。
 */
export async function executePressJobSimpleDeviceAction(
  input: PressDeviceActionFlowInput,
): Promise<PressDeviceActionFlowResult> {
  const startedAt = (input.now ?? Date.now)();

  if (input.buttonKey === "connect" && !isDriverSessionConnected(input.driverSession)) {
    await input.driverSession?.retry?.();
  }

  const preflightMessage = validateSharedPressDeviceActionPreflight(
    input.buttonKey,
    input.filters,
    input.driverSession,
    input.currentJobRows,
  );

  if (preflightMessage) {
    return {
      feedbackMessage: preflightMessage,
      feedbackType: "warning",
      resultCode: "PREFLIGHT_FAILED",
    };
  }

  const identity = createPressDeviceActionIdentity(
    input.buttonKey,
    readPrimaryCurrentJob(input.currentJobRows),
  );
  const driverPrecheckResult = await precheckPressDeviceCommandBeforeWrite(
    input,
    identity,
    identity.commandName,
  );

  if (driverPrecheckResult) {
    return driverPrecheckResult;
  }

  return input.buttonKey === "lineIn" || input.buttonKey === "lineOut"
    ? executePressLineDeviceAction(input, identity, startedAt)
    : executePressDriverOnlyDeviceAction(input, identity, startedAt);
}

/**
 * @brief 校验 start workflow（开始加工流程）的业务前置条件。
 * @author PopoY
 * @param input 当前筛选、驱动会话、当前作业和预计时长。
 * @returns 中文 validation message（校验消息），通过时返回 null。
 */
export function validateStartPressJobPreflight(input: {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  expectedDuration: string;
  filters: PressJobFilterState;
}): string | null {
  const sharedMessage = validatePressJobWorkflowSharedPreflight(
    input.filters,
    input.driverSession,
    input.currentJobRows,
    true,
  );

  if (sharedMessage) {
    return sharedMessage;
  }

  if (isDriverSessionCleanupPending(input.driverSession)) {
    return "设备仍处于清理待完成状态，请处理后再开始加工。";
  }

  if (!isDriverSessionConnected(input.driverSession)) {
    return "设备授权未就绪，请稍后重试。";
  }

  const currentJob = readPrimaryCurrentJob(input.currentJobRows);
  if (!isPendingPressJob(currentJob)) {
    return "只有待加工作业可以开始加工。";
  }

  if (!hasLockedPressMold(input.currentJobRows)) {
    return "开始加工前请先锁定模具。";
  }

  if (!isValidExpectedDuration(input.expectedDuration)) {
    return "预计时长必须为正整数或一位小数。";
  }

  return null;
}

/**
 * @brief 校验 start guidance（开始加工指导）当前步骤能否进入下一步。
 * @author PopoY
 * @param input 当前 Tour（漫游）步骤和页面业务状态。
 * @returns 中文 warning（警告）文案；允许推进时返回 null。
 */
export function validateStartPressJobTourStep(input: {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  expectedDuration: string;
  filters: PressJobFilterState;
  stepIndex: number;
}): string | null {
  if (input.stepIndex === 0 && !input.filters.teamId?.trim()) {
    return "请先确认本次作业班组。";
  }

  if (input.stepIndex === 1 && !input.filters.operatorId?.trim()) {
    return "请选择当前操作员。";
  }

  if (input.stepIndex === 2 && !input.filters.processId?.trim()) {
    return "请选择本次加工工艺。";
  }

  if (input.stepIndex === 3) {
    const currentJob = readPrimaryCurrentJob(input.currentJobRows);
    if (!isPendingPressJob(currentJob)) {
      return "当前没有可开始的作业。";
    }

    if (!hasLockedPressMold(input.currentJobRows)) {
      return "开始加工前请确认模具已锁定。";
    }
  }

  if (input.stepIndex === 4 && !isValidExpectedDuration(input.expectedDuration)) {
    return "请确认预计加工时长。";
  }

  if (input.stepIndex === 5) {
    return validateStartPressJobPreflight(input);
  }

  return null;
}

/**
 * @brief 校验 complete workflow（完成加工流程）的业务前置条件。
 * @author PopoY
 * @param input 当前筛选、驱动会话和当前作业。
 * @returns 中文 validation message（校验消息），通过时返回 null。
 */
export function validateCompletePressJobPreflight(input: {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  filters: PressJobFilterState;
}): string | null {
  const sharedMessage = validatePressJobWorkflowSharedPreflight(
    input.filters,
    input.driverSession,
    input.currentJobRows,
    false,
  );

  if (sharedMessage) {
    return sharedMessage;
  }

  if (!isDriverSessionConnected(input.driverSession)) {
    return "设备授权未就绪，请稍后重试。";
  }

  const currentJob = readPrimaryCurrentJob(input.currentJobRows);
  if (!isRunningPressJob(currentJob)) {
    return "只有加工中作业可以完成加工。";
  }

  if (!hasLockedPressMold(input.currentJobRows)) {
    return "完成加工前请确认已锁定模具。";
  }

  if (!currentJob?.localJobSessionId?.trim()) {
    return "当前作业缺少本地会话 ID，请刷新后重试。";
  }

  return null;
}

/**
 * @brief 校验 complete guidance（完成加工指导）当前步骤能否进入下一步。
 * @author PopoY
 * @param input 当前 Tour（漫游）步骤和页面业务状态。
 * @returns 中文 warning（警告）文案；允许推进时返回 null。
 */
export function validateCompletePressJobTourStep(input: {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  filters: PressJobFilterState;
  stepIndex: number;
}): string | null {
  if (input.stepIndex === 0 && !isRunningPressJob(readPrimaryCurrentJob(input.currentJobRows))) {
    return "请先确认当前作业处于加工中。";
  }

  if (input.stepIndex === 1 && !isDriverSessionConnected(input.driverSession)) {
    return "Driver Session（驱动会话）未连接，请先恢复驱动连接。";
  }

  if (input.stepIndex === 2) {
    return validateCompletePressJobPreflight(input);
  }

  return null;
}

/**
 * @brief 构造 ERP start（企业资源计划开始加工）请求白名单字段。
 * @author PopoY
 * @param identity 同一次动作身份。
 * @param filters 当前班组、人员和工艺。
 * @param expectedDuration 已校验的预计时长。
 * @returns startPressJob（开始加工）请求。
 */
export function buildPressJobStartRequest(
  identity: PressDeviceActionIdentity,
  filters: PressJobFilterState,
  expectedDuration: string,
): PressJobStartRequest {
  return {
    correlationId: identity.correlationId,
    idempotencyKey: identity.idempotencyKey,
    localJobSessionId: identity.localJobSessionId,
    operatorId: filters.operatorId ?? "",
    teamId: filters.teamId ?? "",
    processId: filters.processId ?? "",
    expectedDuration: expectedDuration.trim(),
  };
}

/**
 * @brief 构造 ERP complete（企业资源计划完工）请求白名单字段。
 * @author PopoY
 * @param identity 同一次动作身份。
 * @param filters 当前班组、人员和工艺。
 * @returns completePressJob（完成加工）请求。
 */
export function buildPressJobCompleteRequest(
  identity: PressDeviceActionIdentity,
  filters: PressJobFilterState,
): PressJobCompleteRequest {
  return {
    correlationId: identity.correlationId,
    idempotencyKey: identity.idempotencyKey,
    localJobSessionId: identity.localJobSessionId,
    operatorId: filters.operatorId ?? "",
    status: "3",
  };
}

/**
 * @brief 构造 ERP parameter（参数记录）请求并过滤敏感 signal keys（信号键）。
 * @author PopoY
 * @param identity 同一次动作身份。
 * @param type 参数记录类型。
 * @param signalValues 安全快照字段。
 * @returns recordPressJobParameters（记录参数）请求。
 */
export function buildPressJobParameterRequest(
  identity: PressDeviceActionIdentity,
  type: PressJobParameterRecordType,
  signalValues: Record<string, unknown>,
): PressJobParameterRecordRequest {
  return {
    correlationId: identity.correlationId,
    idempotencyKey: identity.idempotencyKey,
    parameterIdempotencyKey: `${identity.idempotencyKey}-param-${type}`,
    localJobSessionId: identity.localJobSessionId,
    type,
    signalValues: narrowPressWorkflowSignalValues(signalValues),
  };
}

/**
 * @brief 发起不等待、不重试的 operation log（操作日志）请求，并把拒绝收口到现有脱敏诊断入口。
 * @author PopoY
 * @param input 严格六字段请求、日志客户端和现有诊断入口。
 */
export function reportPressJobOperationBestEffort(input: {
  recordDiagnostic?: (summary: PressJobDiagnosticSummary) => void;
  recordPressJobOperation?: (request: PressJobOperationLogRequest) => Promise<void>;
  request: PressJobOperationLogRequest;
}): void {
  void input.recordPressJobOperation?.(input.request).catch(() => {
    input.recordDiagnostic?.({
      correlationId: input.request.correlationId,
      commandName: input.request.operationCode,
      durationMs: 0,
      resultCode: "压机操作日志上报失败。",
    });
  });
}

/**
 * @brief 使用动作开始时保留的 session/team/operator context（会话/班组/人员上下文）上报 workflow（流程）结果。
 * @author PopoY
 * @param input 当前 workflow（流程）的注入回调和筛选上下文。
 * @param identity 动作开始时生成并保留的身份。
 * @param operationCode 固定操作码。
 * @param result 真实操作结果。
 */
function reportPressWorkflowOperation(
  input: PressDeviceActionDiagnosticInput,
  identity: PressDeviceActionIdentity,
  operationCode: PressJobOperationCode,
  result: boolean,
): void {
  reportPressJobOperationBestEffort({
    recordDiagnostic: input.recordPressDeviceActionDiagnostic,
    recordPressJobOperation: input.recordPressJobOperation,
    request: {
      correlationId: identity.correlationId,
      localJobSessionId: identity.localJobSessionId,
      operationCode,
      result,
      teamId: input.filters.teamId ?? "",
      operatorId: input.filters.operatorId ?? "",
    },
  });
}

/**
 * @brief 执行开始加工 workflow（流程）。
 * @author PopoY
 * @param input 页面注入的 Driver/ERP 回调和当前业务状态。
 * @returns UI（界面）可展示的中文结果。
 */
export async function executePressJobStartWorkflow(
  input: PressJobStartWorkflowInput,
): Promise<PressDeviceActionFlowResult> {
  const startedAt = (input.now ?? Date.now)();
  const currentJob = readPrimaryCurrentJob(input.currentJobRows);
  const identity = createPressWorkflowActionIdentity(
    "startProcessing",
    "startDeviceSession",
    currentJob,
  );
  const validationMessage = validateStartPressJobPreflight(input);

  if (validationMessage) {
    return createWorkflowResult(validationMessage, "warning", "PREFLIGHT_FAILED");
  }

  if (!input.executePressDeviceCommand || !input.startPressJob) {
    return createWorkflowResult(
      "开始加工服务未就绪，请稍后重试。",
      "error",
      "SERVICE_NOT_READY",
      identity,
    );
  }

  const startPrecheckResult = await precheckPressDeviceCommandBeforeWrite(
    input,
    identity,
    "startDeviceSession",
  );

  if (startPrecheckResult) {
    return startPrecheckResult;
  }

  const rollbackPrecheckResult = await precheckPressDeviceCommandBeforeWrite(
    input,
    identity,
    "rollbackStartSignal",
  );

  if (rollbackPrecheckResult) {
    return rollbackPrecheckResult;
  }

  try {
    await executeWorkflowDriverCommand(input, identity, "precheckForStart");
    await executeWorkflowDriverCommand(input, identity, "startDeviceSession");
  } catch {
    recordPressDeviceActionResult(input, identity, startedAt, {
      driverResultCode: "DRIVER_START_FAILED",
      resultCode: "DRIVER_START_FAILED",
    });

    return createWorkflowResult(
      "开始加工设备启动失败，请查看诊断日志后重试。",
      "error",
      "DRIVER_START_FAILED",
      identity,
    );
  }

  let erpStartSucceeded = false;
  try {
    const erpStartResult = await input.startPressJob(
      buildPressJobStartRequest(identity, input.filters, input.expectedDuration),
    );

    erpStartSucceeded = isPressErpActionSuccessful(erpStartResult.resultCode);
  } catch {
    erpStartSucceeded = false;
  }

  reportPressWorkflowOperation(input, identity, "START", erpStartSucceeded);

  if (!erpStartSucceeded) {
    await tryRollbackStartSignal(input, identity);
    recordPressDeviceActionResult(input, identity, startedAt, {
      erpResultCode: "ERP_START_FAILED",
      resultCode: "ERP_START_FAILED",
    });

    return createWorkflowResult(
      "开始加工落库失败，已尝试回滚设备开始信号。",
      "error",
      "ERP_START_FAILED",
      identity,
    );
  }

  if (currentJob?.needParameterRecords) {
    try {
      await executeWorkflowDriverCommand(
        input,
        identity,
        "startPressDownCountMonitor",
      );
    } catch {
      await refreshPressWorkflowViews(input);
      recordPressDeviceActionResult(input, identity, startedAt, {
        driverResultCode: "MONITOR_START_FAILED",
        resultCode: "MONITOR_START_FAILED",
      });

      return createWorkflowResult(
        "开始加工已完成，开始参数监听未启动，请查看诊断日志。",
        "warning",
        "MONITOR_START_FAILED",
        identity,
      );
    }
  }

  await refreshPressWorkflowViews(input);
  recordPressDeviceActionResult(input, identity, startedAt, {
    resultCode: "OK",
    driverResultCode: "OK",
    erpResultCode: "OK",
  });

  return createWorkflowResult("开始加工已完成。", "success", "OK", identity);
}

/**
 * @brief 执行完成加工 workflow（流程）。
 * @author PopoY
 * @param input 页面注入的 Driver/ERP 回调和当前业务状态。
 * @returns UI（界面）可展示的中文结果。
 */
export async function runCompletePressJobWorkflow(
  input: PressJobCompleteWorkflowInput & { identity?: PressDeviceActionIdentity },
): Promise<PressDeviceActionFlowResult> {
  const startedAt = (input.now ?? Date.now)();
  const currentJob = readPrimaryCurrentJob(input.currentJobRows);
  const identity =
    input.identity ??
    createPressWorkflowActionIdentity(
      "completeProcessing",
      "cleanupDeviceSession",
      currentJob,
    );
  const validationMessage = validateCompletePressJobPreflight(input);

  if (validationMessage) {
    return createWorkflowResult(validationMessage, "warning", "PREFLIGHT_FAILED");
  }

  if (
    !input.getFinalSignalSnapshot ||
    !input.recordPressJobParameters ||
    !input.completePressJob ||
    !input.executePressDeviceCommand
  ) {
    return createWorkflowResult(
      "完成加工服务未就绪，请稍后重试。",
      "error",
      "SERVICE_NOT_READY",
      identity,
    );
  }

  const cleanupPrecheckResult = await precheckPressDeviceCommandBeforeWrite(
    input,
    identity,
    "cleanupDeviceSession",
  );

  if (cleanupPrecheckResult) {
    return cleanupPrecheckResult;
  }

  let finalSignalSnapshot: Record<string, unknown>;
  try {
    finalSignalSnapshot = await input.getFinalSignalSnapshot({
      correlationId: identity.correlationId,
      localJobSessionId: identity.localJobSessionId,
    });
  } catch {
    recordPressDeviceActionResult(input, identity, startedAt, {
      resultCode: "FINAL_SNAPSHOT_FAILED",
    });

    return createWorkflowResult(
      "最终信号快照获取失败，请查看诊断日志后重试。",
      "error",
      "FINAL_SNAPSHOT_FAILED",
      identity,
    );
  }

  let parameterRecordSucceeded = false;
  try {
    const parameterResult = await input.recordPressJobParameters(
      buildPressJobParameterRequest(identity, "end", finalSignalSnapshot),
    );

    parameterRecordSucceeded = isPressErpActionSuccessful(
      parameterResult.resultCode,
    );
  } catch {
    parameterRecordSucceeded = false;
  }

  reportPressWorkflowOperation(
    input,
    identity,
    "PARAMETER_END",
    parameterRecordSucceeded,
  );

  if (!parameterRecordSucceeded) {
    recordPressDeviceActionResult(input, identity, startedAt, {
      erpResultCode: "PARAMETER_RECORD_FAILED",
      resultCode: "PARAMETER_RECORD_FAILED",
    });

    return createWorkflowResult(
      "完工参数记录失败，已阻止完工落库。",
      "error",
      "PARAMETER_RECORD_FAILED",
      identity,
    );
  }

  let completeSucceeded = false;
  try {
    const completeResult = await input.completePressJob(
      buildPressJobCompleteRequest(identity, input.filters),
    );

    completeSucceeded = isPressErpActionSuccessful(completeResult.resultCode);
  } catch {
    completeSucceeded = false;
  }

  reportPressWorkflowOperation(input, identity, "COMPLETE", completeSucceeded);

  if (!completeSucceeded) {
    recordPressDeviceActionResult(input, identity, startedAt, {
      erpResultCode: "ERP_COMPLETE_FAILED",
      resultCode: "ERP_COMPLETE_FAILED",
    });

    return createWorkflowResult(
      "完成加工落库失败，设备收尾未执行。",
      "error",
      "ERP_COMPLETE_FAILED",
      identity,
    );
  }

  try {
    await executeWorkflowDriverCommand(input, identity, "cleanupDeviceSession");
  } catch {
    await refreshPressWorkflowViews(input);
    recordPressDeviceActionResult(input, identity, startedAt, {
      driverResultCode: "CLEANUP_PENDING",
      erpResultCode: "OK",
      resultCode: "CLEANUP_PENDING",
    });

    return createWorkflowResult(
      "完成加工已落库，设备收尾失败，请查看诊断日志并处理。",
      "warning",
      "CLEANUP_PENDING",
      identity,
    );
  }

  await refreshPressWorkflowViews(input);
  recordPressDeviceActionResult(input, identity, startedAt, {
    driverResultCode: "OK",
    erpResultCode: "OK",
    resultCode: "OK",
  });

  return createWorkflowResult("完成加工已完成。", "success", "OK", identity);
}

/**
 * @brief 执行出线 workflow（流程），加工中时先复用完成加工。
 * @author PopoY
 * @param input 页面注入回调和确认函数。
 * @returns UI（界面）可展示的中文结果。
 */
export async function executePressJobLineOutWorkflow(
  input: PressJobLineOutWorkflowInput,
): Promise<PressDeviceActionFlowResult> {
  const currentJob = readPrimaryCurrentJob(input.currentJobRows);
  const identity = createPressWorkflowActionIdentity("lineOut", "lineOut", currentJob);
  const preflightMessage = validateSharedPressDeviceActionPreflight(
    "lineOut",
    input.filters,
    input.driverSession,
    input.currentJobRows,
  );

  if (preflightMessage) {
    return createWorkflowResult(preflightMessage, "warning", "PREFLIGHT_FAILED", identity);
  }

  const lineOutPrecheckResult = await precheckPressDeviceCommandBeforeWrite(
    input,
    identity,
    "lineOut",
  );

  if (lineOutPrecheckResult) {
    return lineOutPrecheckResult;
  }

  if (isRunningPressJob(currentJob)) {
    const confirmed = await input.confirm?.(
      "当前有正在加工的模具，出线将自动完成加工，是否确认出线？",
    );

    if (!confirmed) {
      return createWorkflowResult("已取消出线。", "warning", "CANCELED", identity);
    }

    const completeResult = await runCompletePressJobWorkflow({
      ...input,
      identity,
    });

    if (completeResult.feedbackType !== "success") {
      return completeResult;
    }
  }

  return executePressLineDeviceAction(
    {
      ...input,
      buttonKey: "lineOut",
    },
    identity,
    (input.now ?? Date.now)(),
  );
}

/**
 * @brief 执行移出 workflow（流程），换模且加工中时先复用完成加工。
 * @author PopoY
 * @param input 页面注入回调和确认函数。
 * @returns UI（界面）可展示的中文结果。
 */
export async function executePressJobMoveOutWorkflow(
  input: PressJobMoveOutWorkflowInput,
): Promise<PressDeviceActionFlowResult> {
  const currentJob = readPrimaryCurrentJob(input.currentJobRows);
  const identity = createPressWorkflowActionIdentity("moveOut", "moveOut", currentJob);

  if (input.changeMold && isRunningPressJob(currentJob)) {
    const preflightMessage = validateSharedPressDeviceActionPreflight(
      "moveOut",
      input.filters,
      input.driverSession,
      input.currentJobRows,
    );

    if (preflightMessage) {
      return createWorkflowResult(
        preflightMessage,
        "warning",
        "PREFLIGHT_FAILED",
        identity,
      );
    }

    const confirmed = await input.confirm?.(
      "当前模具正在加工，移出将自动完成加工，是否确认移出？",
    );

    if (!confirmed) {
      return createWorkflowResult("已取消移出。", "warning", "CANCELED", identity);
    }

    const moveOutPrecheckResult = await precheckPressDeviceCommandBeforeWrite(
      input,
      identity,
      "moveOut",
    );

    if (moveOutPrecheckResult) {
      return moveOutPrecheckResult;
    }

    const completeResult = await runCompletePressJobWorkflow({
      ...input,
      identity,
    });

    if (completeResult.feedbackType !== "success") {
      return completeResult;
    }

    return executePressDriverOnlyDeviceAction(
      {
        ...input,
        buttonKey: "moveOut",
      },
      identity,
      (input.now ?? Date.now)(),
    );
  }

  return executePressJobSimpleDeviceAction({
    ...input,
    buttonKey: "moveOut",
  });
}

/**
 * @brief 执行只写 Driver Service（驱动服务）的 simple action（简单动作）。
 * @author PopoY
 * @param input 页面注入回调和当前状态。
 * @param identity 本次动作身份。
 * @param startedAt 开始时间戳。
 * @returns UI（界面）反馈。
 */
async function executePressDriverOnlyDeviceAction(
  input: PressDeviceActionFlowInput,
  identity: PressDeviceActionIdentity,
  startedAt: number,
): Promise<PressDeviceActionFlowResult> {
  if (!input.executePressDeviceCommand) {
    return {
      feedbackMessage: "设备动作服务未就绪，请稍后重试。",
      feedbackType: "error",
      identity,
      resultCode: "SERVICE_NOT_READY",
    };
  }

  try {
    const driverResult = await input.executePressDeviceCommand(
      createPressDeviceCommandRequest(identity),
    );
    const resultCode = driverResult.resultCode;
    const isSuccess = isPressDriverCommandSuccessful(resultCode);
    const flowResult = resolveDriverOnlyActionFeedback(input.buttonKey, resultCode);

    recordPressDeviceActionResult(input, identity, startedAt, {
      driverResultCode: resultCode,
      resultCode: flowResult.resultCode,
    });

    if (isSuccess) {
      await input.refreshSignalSnapshot?.();
    }

    return {
      ...flowResult,
      identity,
    };
  } catch {
    recordPressDeviceActionResult(input, identity, startedAt, {
      driverResultCode: "DRIVER_COMMAND_FAILED",
      resultCode: "FAILED",
    });

    return {
      feedbackMessage:
        input.buttonKey === "connect"
          ? "建立通信失败，请检查设备连接后重试。"
          : "设备动作失败，请查看诊断日志后重试。",
      feedbackType: "error",
      identity,
      resultCode: "FAILED",
    };
  }
}

/**
 * @brief 执行 line in/out（入线/出线）并联 Driver（驱动）与 ERP（企业资源计划）动作。
 * @author PopoY
 * @param input 页面注入回调和当前状态。
 * @param identity 本次动作身份。
 * @param startedAt 开始时间戳。
 * @returns UI（界面）反馈。
 */
async function executePressLineDeviceAction(
  input: PressDeviceActionFlowInput,
  identity: PressDeviceActionIdentity,
  startedAt: number,
): Promise<PressDeviceActionFlowResult> {
  const driverPromise = input.executePressDeviceCommand
    ? input.executePressDeviceCommand(createPressDeviceCommandRequest(identity))
    : Promise.reject(new Error("Driver command callback is not ready."));
  const erpPromise = input.updatePressMachineStatus
    ? input.updatePressMachineStatus(createPressMachineStatusRequest(identity))
    : Promise.reject(new Error("ERP machine status callback is not ready."));
  const [driverSettled, erpSettled] = await Promise.allSettled([
    driverPromise,
    erpPromise,
  ]);
  const driverResultCode =
    driverSettled.status === "fulfilled"
      ? driverSettled.value.resultCode
      : "DRIVER_COMMAND_FAILED";
  const erpResultCode =
    erpSettled.status === "fulfilled"
      ? erpSettled.value.resultCode
      : "ERP_STATUS_FAILED";
  const driverSucceeded =
    driverSettled.status === "fulfilled" &&
    isPressDriverCommandSuccessful(driverSettled.value.resultCode);
  const erpSucceeded =
    erpSettled.status === "fulfilled" &&
    isPressErpActionSuccessful(erpSettled.value.resultCode);
  const resultCode =
    driverSucceeded && erpSucceeded
      ? "OK"
      : driverSucceeded || erpSucceeded
        ? "PARTIAL_OK"
        : "FAILED";

  reportPressWorkflowOperation(
    input,
    identity,
    input.buttonKey === "lineIn" ? "LINE_IN" : "LINE_OUT",
    resultCode === "OK",
  );

  recordPressDeviceActionResult(input, identity, startedAt, {
    driverResultCode,
    erpResultCode,
    resultCode,
  });

  if (driverSucceeded) {
    await input.refreshSignalSnapshot?.();
  }

  if (erpSucceeded) {
    await input.refreshPressJobCurrentJobs?.();
  }

  if (resultCode === "OK") {
    return {
      feedbackMessage:
        input.buttonKey === "lineIn" ? "入线动作已下发。" : "出线动作已下发。",
      feedbackType: "success",
      identity,
      resultCode,
    };
  }

  if (resultCode === "PARTIAL_OK") {
    return {
      feedbackMessage: "部分动作完成，请查看诊断日志。",
      feedbackType: "warning",
      identity,
      resultCode,
    };
  }

  return {
    feedbackMessage: "设备动作失败，请查看诊断日志后重试。",
    feedbackType: "error",
    identity,
    resultCode,
  };
}

/**
 * @brief 构造 Driver command（驱动命令）请求白名单字段。
 * @author PopoY
 * @param identity 本次动作身份。
 * @returns `/executeDeviceCommand` 请求体。
 */
function createPressDeviceCommandRequest(
  identity: PressDeviceActionIdentity,
): PressDeviceCommandRequest {
  return {
    correlationId: identity.correlationId,
    commandName: identity.commandName,
    localJobSessionId: identity.localJobSessionId,
    idempotencyKey: identity.idempotencyKey,
    timeoutMs: PRESS_DEVICE_ACTION_TIMEOUT_MS,
  };
}

/**
 * @brief 构造 ERP machine status（设备状态）请求白名单字段。
 * @author PopoY
 * @param identity 本次动作身份。
 * @returns ERP Qt machine status（设备状态）请求体。
 */
function createPressMachineStatusRequest(
  identity: PressDeviceActionIdentity,
): PressMachineStatusUpdateRequest {
  return {
    correlationId: identity.correlationId,
    idempotencyKey: identity.idempotencyKey,
    localJobSessionId: identity.localJobSessionId,
    reason: identity.buttonKey === "lineIn" ? "lineIn" : "lineOut",
    status: identity.buttonKey === "lineIn" ? "0" : "9",
  };
}

/**
 * @brief 记录 simple action（简单动作）diagnostic summary（诊断摘要）白名单字段。
 * @author PopoY
 * @param input 页面注入回调和筛选。
 * @param identity 本次动作身份。
 * @param startedAt 开始时间戳。
 * @param result 本次动作结果码。
 */
function recordPressDeviceActionResult(
  input: PressDeviceActionDiagnosticInput,
  identity: PressDeviceActionIdentity,
  startedAt: number,
  result: {
    driverResultCode?: string;
    erpResultCode?: string;
    resultCode: string;
  },
): void {
  const now = input.now ?? Date.now;

  input.recordPressDeviceActionDiagnostic?.({
    buttonKey: identity.buttonKey,
    commandName: identity.commandName,
    correlationId: identity.correlationId,
    durationMs: now() - startedAt,
    idempotencyKey: identity.idempotencyKey,
    localJobSessionId: identity.localJobSessionId,
    processId: input.filters.processId,
    resultCode: result.resultCode,
    teamId: input.filters.teamId,
    operatorId: input.filters.operatorId,
    driverResultCode: result.driverResultCode,
    erpResultCode: result.erpResultCode,
  });
}

/**
 * @brief 解析 Driver-only（仅驱动）动作反馈。
 * @author PopoY
 * @param buttonKey 当前按钮 key（键）。
 * @param resultCode Driver Service（驱动服务）结果码。
 * @returns UI（界面）反馈。
 */
function resolveDriverOnlyActionFeedback(
  buttonKey: PressSimpleDeviceActionButtonKey,
  resultCode: string,
): PressDeviceActionFlowResult {
  if (buttonKey === "connect" && resultCode === "PARTIAL_OK") {
    return {
      feedbackMessage: "通信已建立，附属步骤需要关注，请查看诊断日志。",
      feedbackType: "warning",
      resultCode,
    };
  }

  if (isPressDriverCommandSuccessful(resultCode)) {
    const successMessages: Record<PressSimpleDeviceActionButtonKey, string> = {
      connect: "通信已建立。",
      lineIn: "入线动作已下发。",
      lineOut: "出线动作已下发。",
      moveIn: "移入信号已下发。",
      moveOut: "移出信号已下发。",
    };

    return {
      feedbackMessage: successMessages[buttonKey],
      feedbackType: "success",
      resultCode,
    };
  }

  return {
    feedbackMessage:
      buttonKey === "connect"
        ? "建立通信失败，请检查设备连接后重试。"
        : "设备动作失败，请查看诊断日志后重试。",
    feedbackType: "error",
    resultCode,
  };
}

/**
 * @brief 判断 Driver Service（驱动服务）动作是否算作可继续刷新。
 * @author PopoY
 * @param resultCode Driver result code（结果码）。
 * @returns 成功、部分成功或幂等重放时返回 true。
 */
function isPressDriverCommandSuccessful(resultCode: string): boolean {
  return (
    resultCode === "OK" ||
    resultCode === "PARTIAL_OK" ||
    resultCode === "IDEMPOTENCY_REPLAY" ||
    resultCode === "MONITOR_ALREADY_RUNNING"
  );
}

/**
 * @brief 判断 ERP（企业资源计划）动作是否成功。
 * @author PopoY
 * @param resultCode ERP result code（结果码）。
 * @returns 成功或幂等重放时返回 true。
 */
function isPressErpActionSuccessful(resultCode: string): boolean {
  return resultCode === "OK" || resultCode === "IDEMPOTENCY_REPLAY";
}

/**
 * @brief 创建 workflow（流程）动作身份，复用当前作业 localJobSessionId（本地作业会话 ID）。
 * @author PopoY
 * @param buttonKey 当前按钮 key（键）。
 * @param commandName 当前主 Driver command（驱动命令）。
 * @param currentJobRow 当前主作业行。
 * @returns 高风险 workflow（流程）使用的动作身份。
 */
function createPressWorkflowActionIdentity(
  buttonKey: PressDeviceActionButtonKey,
  commandName: PressDeviceCommandName,
  currentJobRow?: PressJobCurrentJobRow,
): PressDeviceActionIdentity {
  const correlationId = `press-device-${buttonKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    buttonKey,
    commandName,
    correlationId,
    idempotencyKey: correlationId,
    localJobSessionId:
      currentJobRow?.localJobSessionId?.trim() ||
      `press-device-action-${correlationId}`,
  };
}

/**
 * @brief 创建 workflow（流程）统一返回值。
 * @author PopoY
 * @param feedbackMessage 中文反馈。
 * @param feedbackType 反馈类型。
 * @param resultCode 流程结果码。
 * @param identity 可选动作身份。
 * @returns UI（界面）可展示结果。
 */
function createWorkflowResult(
  feedbackMessage: string,
  feedbackType: PressDeviceActionFeedbackType,
  resultCode: string,
  identity?: PressDeviceActionIdentity,
): PressDeviceActionFlowResult {
  return {
    feedbackMessage,
    feedbackType,
    identity,
    resultCode,
  };
}

/**
 * @brief 调用 Driver preflight（驱动前置校验），在 signal write authorization（信号写入授权）失败时阻止后续动作。
 * @author PopoY
 * @param input 注入的前置校验回调。
 * @param identity 当前动作身份。
 * @param commandName 即将下发的 Driver command（驱动命令）。
 * @returns 需要阻止流程时返回 UI（界面）反馈，否则返回 null。
 */
async function precheckPressDeviceCommandBeforeWrite(
  input: {
    precheckPressDeviceCommand?: (
      input: PressDeviceCommandRequest,
    ) => Promise<PressDeviceCommandResponse>;
  },
  identity: PressDeviceActionIdentity,
  commandName: PressDeviceCommandName,
): Promise<PressDeviceActionFlowResult | null> {
  if (!input.precheckPressDeviceCommand) {
    return null;
  }

  try {
    const response = await input.precheckPressDeviceCommand(
      createPressDeviceCommandRequest({
        ...identity,
        commandName,
      }),
    );

    if (isPressDriverCommandSuccessful(response.resultCode)) {
      return null;
    }

    return createWorkflowResult(
      resolveDriverPrecheckFailureMessage(response),
      "warning",
      "PREFLIGHT_FAILED",
      identity,
    );
  } catch {
    return createWorkflowResult(
      "设备授权校验失败，请查看诊断日志后重试。",
      "error",
      "PREFLIGHT_FAILED",
      identity,
    );
  }
}

/**
 * @brief 将 Driver preflight（驱动前置校验）失败结果转换为现场可读中文。
 * @author PopoY
 * @param response Driver Service（驱动服务）响应。
 * @returns 中文反馈。
 */
function resolveDriverPrecheckFailureMessage(
  response: PressDeviceCommandResponse,
): string {
  if (response.resultCode === "SIGNAL_NOT_WRITABLE") {
    return "当前设备命令没有写权限，请刷新授权后重试。";
  }

  if (response.resultCode === "SIGNAL_NOT_CONFIGURED") {
    return "当前设备命令缺少信号配置，请刷新授权后重试。";
  }

  if (response.resultCode === "COMMAND_NOT_ALLOWED") {
    return "当前设备命令未在租约授权范围内，请刷新授权后重试。";
  }

  return response.message?.trim() || "设备授权校验未通过，请刷新授权后重试。";
}

/**
 * @brief 校验 start/complete workflow（开始/完工流程）的共享条件。
 * @author PopoY
 * @param filters 当前筛选。
 * @param driverSession Driver session（驱动会话）。
 * @param currentJobRows 当前作业。
 * @param requiresProcessId 当前动作是否要求预选工艺。
 * @returns 中文 validation message（校验消息），通过时返回 null。
 */
function validatePressJobWorkflowSharedPreflight(
  filters: PressJobFilterState,
  driverSession: PressJobPageDriverSession | undefined,
  currentJobRows: PressJobCurrentJobRow[],
  requiresProcessId: boolean,
): string | null {
  if (!isNonEmptyString(filters.teamId)) {
    return "请先选择班组。";
  }

  if (!isNonEmptyString(filters.operatorId)) {
    return "请先选择人员。";
  }

  if (requiresProcessId && !isNonEmptyString(filters.processId)) {
    return "请先选择预选工艺。";
  }

  if (!isCurrentJobStateKnown(currentJobRows)) {
    return "当前作业状态未确认，请刷新后重试。";
  }

  if (!isDriverLeaseActive(driverSession)) {
    return "设备授权未就绪，请稍后重试。";
  }

  return null;
}

/**
 * @brief 执行 Driver workflow command（驱动流程命令）并检查 resultCode（结果码）。
 * @author PopoY
 * @param input 注入回调。
 * @param identity 当前动作身份。
 * @param commandName 本阶段命令名。
 * @returns Driver Service（驱动服务）命令响应。
 */
async function executeWorkflowDriverCommand(
  input: {
    executePressDeviceCommand?: (
      input: PressDeviceCommandRequest,
    ) => Promise<PressDeviceCommandResponse>;
  },
  identity: PressDeviceActionIdentity,
  commandName: PressDeviceCommandName,
): Promise<PressDeviceCommandResponse> {
  if (!input.executePressDeviceCommand) {
    throw new Error("Driver command callback is not ready.");
  }

  const response = await input.executePressDeviceCommand(
    createPressDeviceCommandRequest({
      ...identity,
      commandName,
    }),
  );

  if (!isPressDriverCommandSuccessful(response.resultCode)) {
    throw new Error(response.resultCode);
  }

  return response;
}

/**
 * @brief ERP start（开始落库）失败后尝试 Driver rollback（驱动回滚）。
 * @author PopoY
 * @param input 注入回调。
 * @param identity 当前动作身份。
 */
async function tryRollbackStartSignal(
  input: {
    executePressDeviceCommand?: (
      input: PressDeviceCommandRequest,
    ) => Promise<PressDeviceCommandResponse>;
  },
  identity: PressDeviceActionIdentity,
): Promise<void> {
  try {
    await executeWorkflowDriverCommand(input, identity, "rollbackStartSignal");
  } catch {
    // @author PopoY: rollback（回滚）失败由 Driver diagnostic log（诊断日志）承接，前端只保留安全摘要。
  }
}

/**
 * @brief 刷新 workflow（流程）结束后的 current jobs（当前作业）和 signal snapshot（信号快照）。
 * @author PopoY
 * @param input 可选刷新回调。
 */
async function refreshPressWorkflowViews(input: {
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  refreshSignalSnapshot?: () => Promise<unknown>;
}): Promise<void> {
  await input.refreshPressJobCurrentJobs?.();
  await input.refreshSignalSnapshot?.();
}

/**
 * @brief 判断是否为待加工 current job（当前作业）。
 * @author PopoY
 * @param row 当前作业行。
 * @returns status（状态）为 0 时返回 true。
 */
function isPendingPressJob(row: PressJobCurrentJobRow | undefined): boolean {
  return row?.status?.trim() === "0";
}

/**
 * @brief 判断是否为 running current job（加工中作业）。
 * @author PopoY
 * @param row 当前作业行。
 * @returns status（状态）为 1 时返回 true。
 */
function isRunningPressJob(row: PressJobCurrentJobRow | undefined): boolean {
  return row?.status?.trim() === "1";
}

/**
 * @brief 判断当前是否至少有一套 locked mold（已锁定模具）。
 * @author PopoY
 * @param currentJobRows 当前作业行。
 * @returns 存在非空 moldNo（模具号）时返回 true。
 */
function hasLockedPressMold(currentJobRows: PressJobCurrentJobRow[]): boolean {
  return readLockedMoldNos(currentJobRows).length > 0;
}

/**
 * @brief 校验 expectedDuration（预计时长）是否为正整数或一位小数。
 * @author PopoY
 * @param value 输入框值。
 * @returns 合法时返回 true。
 */
function isValidExpectedDuration(value: string): boolean {
  return /^(?:[1-9]\d*|0\.[1-9]|[1-9]\d*\.\d)$/.test(value.trim());
}

/**
 * @brief 判断 Driver Service（驱动服务）是否处于 cleanup pending（清理待完成）。
 * @author PopoY
 * @param driverSession Driver session（驱动会话）。
 * @returns 清理待完成时返回 true。
 */
function isDriverSessionCleanupPending(
  driverSession: PressJobPageDriverSession | undefined,
): boolean {
  return driverSession?.data?.applyResult?.deviceSessionState === "CleanupPending";
}

const PRESS_WORKFLOW_SIGNAL_VALUE_FORBIDDEN_KEYS = new Set([
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
 * @brief 过滤 parameter snapshot（参数快照）中的敏感 key（键）。
 * @author PopoY
 * @param signalValues 原始安全快照候选。
 * @returns 过滤后的参数记录快照。
 */
function narrowPressWorkflowSignalValues(
  signalValues: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(signalValues).filter(
      ([key]) => !PRESS_WORKFLOW_SIGNAL_VALUE_FORBIDDEN_KEYS.has(key.toLowerCase()),
    ),
  );
}

/**
 * @brief 判断 Driver lease（驱动租约）是否 active（活跃）。
 * @author PopoY
 * @param driverSession Driver session（驱动会话）。
 * @returns 活跃时返回 true。
 */
function isDriverLeaseActive(
  driverSession: PressJobPageDriverSession | undefined,
): boolean {
  return driverSession?.data?.applyResult?.leaseState === "Active";
}

/**
 * @brief 判断 Driver device session（驱动设备会话）是否 connected（已连接）。
 * @author PopoY
 * @param driverSession Driver session（驱动会话）。
 * @returns 已连接时返回 true。
 */
function isDriverSessionConnected(
  driverSession: PressJobPageDriverSession | undefined,
): boolean {
  return driverSession?.data?.applyResult?.deviceSessionState === "Connected";
}

/**
 * @brief 校验打开 Mold Lock Panel（模具锁定面板）前的 operator context（操作上下文）。
 * @author PopoY
 * @param filters 当前班组、人员和预选工艺筛选。
 * @param currentJobRows 当前作业行，用于判断已锁定模具数量。
 * @returns 中文 validation message（校验消息），通过时返回 null。
 */
export function validateMoldLockPreflight(
  filters: PressJobFilterState,
  currentJobRows: PressJobCurrentJobRow[],
): string | null {
  if (!isNonEmptyString(filters.teamId)) {
    return "请选择班组";
  }

  if (!isNonEmptyString(filters.operatorId)) {
    return "请选择人员";
  }

  if (!isNonEmptyString(filters.processId)) {
    return "请选择预选工艺";
  }

  if (readLockedMoldNos(currentJobRows).length >= 5) {
    return "当前已锁定五套模具,已达到上限!";
  }

  return null;
}

/**
 * @brief 判断当前作业是否存在可解锁 moldNo（模具号）。
 * @author PopoY
 * @param currentJobRows 当前作业行。
 * @returns 任一当前作业存在非空 moldNo（模具号）时返回 true。
 */
function hasUnlockableCurrentMold(
  currentJobRows: PressJobCurrentJobRow[],
): boolean {
  return currentJobRows.some((row) => row.moldNo?.trim());
}

/**
 * @brief 从候选模具构造锁模 selection（选择），只保留 ERP whitelist（白名单）字段。
 * @author PopoY
 * @param candidate ERP 返回的安全候选模具。
 * @param processId 当前预选工艺，候选工艺为空时作为 fallback（兜底）。
 * @returns 可供 Task3（任务三）提交前复用的锁模选择行。
 */
export function createPressMoldLockSelection(
  candidate: PressMoldCandidate,
  processId: string,
): PressMoldLockSelection {
  const selection: PressMoldLockSelection = {
    moldNo: candidate.moldNo,
    makeOrderNumber: candidate.makeOrderNumber ?? "",
    craftCode: resolveMoldInfoRowProcessId(candidate, processId) ?? "",
  };

  if (candidate.stages !== undefined) {
    selection.stages = candidate.stages;
  }

  const projectCode = resolvePressMoldCandidateProjectCode(candidate);
  if (projectCode) {
    selection.projectCode = projectCode;
  }

  return selection;
}

/**
 * @brief 解析模具明细行当前展示工艺，优先使用本行选择，否则回退压机预选工艺。
 * @author PopoY
 * @param row 当前 mold info row（模具明细行）。
 * @param processId 压机作业页当前预选工艺 ID。
 * @returns Table（表格）行内工艺 Select（选择器）展示值。
 */
export function resolveMoldInfoRowProcessId(
  row: PressMoldInfoRow,
  processId?: string,
): string | undefined {
  return row.defaultProcessId?.trim() || processId;
}

/**
 * @brief 校验锁模 selection（选择），避免空选择、空制造令/工艺和跨项目提交。
 * @author PopoY
 * @param selection 当前单选候选构造出的锁模选择。
 * @param currentJobRows 当前作业行，用于推导当前项目号。
 * @returns 中文 validation message（校验消息），通过时返回 null。
 */
export function validatePressMoldLockSelection(
  selection: PressMoldLockSelection | null,
  currentJobRows: PressJobCurrentJobRow[],
): string | null {
  if (!selection) {
    return "请先选择模具。";
  }

  if (
    !isNonEmptyString(selection.makeOrderNumber) ||
    !isNonEmptyString(selection.craftCode)
  ) {
    return "制造令号与工艺不能为空。";
  }

  const currentProjectCode = resolveCurrentJobProjectCode(currentJobRows);
  const selectedProjectCode = resolvePressMoldSelectionProjectCode(selection);

  if (
    currentProjectCode &&
    selectedProjectCode &&
    currentProjectCode !== selectedProjectCode
  ) {
    return `不可跨项目作业！当前设备正在作业项目 [${currentProjectCode}]，所选模具属于项目 [${selectedProjectCode}]`;
  }

  return null;
}

/**
 * @brief 校验 lock mold guidance（锁模指导）当前步骤能否进入下一步。
 * @author PopoY
 * @param input Mold Lock Drawer（锁模抽屉）当前状态和选择状态。
 * @returns 中文 warning（警告）文案；允许推进时返回 null。
 */
export function validateLockMoldTourStep(input: {
  currentJobRows: PressJobCurrentJobRow[];
  filters: PressJobFilterState;
  isPanelOpen: boolean;
  moldInfoRows: PressMoldInfoRow[];
  selectedMoldInfoRow: PressMoldInfoRow | null;
  selectedMoldNo?: string;
  stepIndex: number;
}): string | null {
  if (!input.isPanelOpen) {
    return "请先打开模具锁定面板。";
  }

  if (input.stepIndex === 1 && !input.selectedMoldNo?.trim()) {
    return "请先选择候选模具号。";
  }

  if (input.stepIndex === 2 && input.moldInfoRows.length === 0) {
    return "请先搜索模具明细。";
  }

  if (input.stepIndex === 3) {
    if (!input.selectedMoldInfoRow) {
      return "请先选择模具明细。";
    }

    const preflightMessage = validateMoldLockPreflight(
      input.filters,
      input.currentJobRows,
    );

    if (preflightMessage) {
      return preflightMessage;
    }

    return validatePressMoldLockSelection(
      createPressMoldLockSelection(
        input.selectedMoldInfoRow,
        input.filters.processId ?? "",
      ),
      input.currentJobRows,
    );
  }

  return null;
}

/**
 * @brief 按工艺 dictionary（字典）展示已锁定模具的 craft name（工艺名称）。
 * @author PopoY
 * @param row 已锁定模具行。
 * @param processOptions 当前班组工艺 options（选项）。
 * @param craftOptions sam-erp 全量工艺 dictionary（字典）选项。
 * @returns 可直接展示的工艺名称。
 */
export function formatPressLockedMoldCraftName(
  row: PressLockedMoldRow,
  processOptions: PressJobProcessOption[],
  craftOptions: ErpDictOption[] = [],
): string {
  return formatCurrentJobCell(
    findDictLabel(craftOptions, row.craftCode) ??
      findProcessName(processOptions, row.craftCode) ??
      row.craftName ??
      row.craftCode,
  );
}

/**
 * @brief 按工时类型 dictionary（字典）展示已锁定模具的 work type（工时类型）。
 * @author PopoY
 * @param row 已锁定模具行。
 * @param workTypeOptions sam-erp mould_make_order_type 字典选项。
 * @returns 可直接展示的工时类型。
 */
export function formatPressLockedMoldWorkType(
  row: PressLockedMoldRow,
  workTypeOptions: ErpDictOption[],
): string {
  return formatCurrentJobCell(
    findDictLabel(workTypeOptions, row.workTimeType) ??
      row.workTimeTypeText ??
      row.workTimeType,
  );
}

/**
 * @brief 按人员 dictionary（字典）展示已锁定模具的 operator（作业员）。
 * @author PopoY
 * @param row 已锁定模具行。
 * @param operatorOptions 当前班组人员 options（选项）。
 * @param operatorDictOptions sam-erp 全量用户 dictionary（字典）选项。
 * @returns 可直接展示的作业员。
 */
export function formatPressLockedMoldOperatorName(
  row: PressLockedMoldRow,
  operatorOptions: PressJobOperatorOption[],
  operatorDictOptions: ErpDictOption[] = [],
): string {
  return formatCurrentJobCell(
    findDictLabel(operatorDictOptions, row.operatorId) ??
      findOperatorName(operatorOptions, row.operatorId) ??
      row.operatorName ??
      row.operatorId,
  );
}

/**
 * @brief 校验解锁模具 selection（选择），防止误解锁最后一套加工中模具。
 * @author PopoY
 * @param input 已锁定模具、操作员、待解锁模具号和当前作业行。
 * @returns 中文 validation message（校验消息），通过时返回 null。
 */
export function validatePressMoldUnlockSelection(input: {
  lockedMolds: Pick<PressLockedMoldRow, "moldNo">[];
  operatorId: string | undefined;
  selectedMoldNos: string[];
  currentJobRows: PressJobCurrentJobRow[];
}): string | null {
  if (input.lockedMolds.length === 0) {
    return "当前没有可解锁模具。";
  }

  if (input.selectedMoldNos.length === 0) {
    return "请先选择要解锁的模具。";
  }

  if (!isNonEmptyString(input.operatorId)) {
    return "请选择人员";
  }

  const lockedMoldNoSet = new Set(
    input.lockedMolds.flatMap((row) => {
      const moldNo = row.moldNo.trim();
      return moldNo ? [moldNo] : [];
    }),
  );
  const selectedMoldNoSet = new Set(
    input.selectedMoldNos.flatMap((moldNo) => {
      const value = moldNo.trim();
      return value ? [value] : [];
    }),
  );

  if (
    lockedMoldNoSet.size === 0 ||
    selectedMoldNoSet.size === 0 ||
    [...selectedMoldNoSet].some((moldNo) => !lockedMoldNoSet.has(moldNo))
  ) {
    return "请先选择要解锁的模具。";
  }

  if (
    shouldKeepOneLockedMold(input.currentJobRows) &&
    selectedMoldNoSet.size >= lockedMoldNoSet.size
  ) {
    return "当前正在加工不可全部解锁，如需全部解锁请使用完成加工功能。";
  }

  return null;
}

/**
 * @brief 校验 unlock guidance（解锁指导）当前步骤能否进入下一步。
 * @author PopoY
 * @param input 当前 Unlock Drawer（解锁抽屉）状态和选择状态。
 * @returns 中文 warning（警告）文案；允许推进时返回 null。
 */
export function validateUnlockMoldTourStep(input: {
  currentJobRows: PressJobCurrentJobRow[];
  isDrawerOpen: boolean;
  lockedMolds: Pick<PressLockedMoldRow, "moldNo">[];
  operatorId?: string;
  selectedMoldNos: string[];
  stepIndex: number;
}): string | null {
  if (!input.isDrawerOpen) {
    return "请先打开解锁抽屉。";
  }

  if (input.stepIndex === 0 && input.lockedMolds.length === 0) {
    return "当前没有可解锁模具。";
  }

  if (input.stepIndex === 3 && input.selectedMoldNos.length === 0) {
    return "请先选择需要解锁的模具。";
  }

  if (input.stepIndex === 4) {
    return validatePressMoldUnlockSelection({
      currentJobRows: input.currentJobRows,
      lockedMolds: input.lockedMolds,
      operatorId: input.operatorId,
      selectedMoldNos: input.selectedMoldNos,
    });
  }

  return null;
}

/**
 * @brief 构造 mold candidate search（候选模具查询）的注入回调参数。
 * @author PopoY
 * @param moldNo 操作员输入的模具号。
 * @param currentJobRows 当前作业行，用于排除已锁定模具。
 * @param correlationId 当前查询的关联 ID。
 * @returns 传给 App layer（应用层）搜索回调的参数。
 */
export function createPressMoldCandidateSearchInput(
  moldNo: string,
  currentJobRows: PressJobCurrentJobRow[],
  correlationId: string,
): {
  moldNo: string;
  lockedMoldNos: string[];
  correlationId: string;
} {
  return {
    moldNo: moldNo.trim(),
    lockedMoldNos: readLockedMoldNos(currentJobRows),
    correlationId,
  };
}

/**
 * @brief 构造 mold info search（模具明细查询）的注入回调参数。
 * @author PopoY
 * @param moldNo 已从候选 grid（栅格）选择并回写的模具号。
 * @param currentJobRows 当前作业行，用于排除已锁定模具。
 * @param correlationId 当前查询的关联 ID。
 * @returns 传给 App layer（应用层）明细查询回调的参数。
 */
export function createPressMoldInfoSearchInput(
  moldNo: string,
  currentJobRows: PressJobCurrentJobRow[],
  correlationId: string,
): {
  moldNo: string;
  lockedMoldNos: string[];
  correlationId: string;
} {
  return createPressMoldCandidateSearchInput(moldNo, currentJobRows, correlationId);
}

/**
 * @brief 构造解锁模具 request（请求），只保留 ERP contract（接口契约）字段。
 * @author PopoY
 * @param filters 当前筛选状态，用于读取 operatorId（人员 ID）。
 * @param moldNos 需要解锁的 moldNo（模具号）数组。
 * @param correlationId 当前解锁请求的关联 ID。
 * @returns 可传给 App layer（应用层）回调的解锁请求。
 */
export function createPressMoldUnlockRequest(
  filters: PressJobFilterState,
  moldNos: string[],
  correlationId: string,
): PressMoldUnlockRequest {
  return {
    operatorId: filters.operatorId ?? "",
    moldNos: Array.from(
      new Set(
        moldNos.flatMap((moldNo) => {
          const value = moldNo.trim();
          return value ? [value] : [];
        }),
      ),
    ),
    correlationId,
  };
}

/**
 * @brief 构造 Task3（任务三）锁模 submit request（提交请求），只放 ERP contract（接口契约）字段。
 * @author PopoY
 * @param filters 当前班组、人员和工艺筛选。
 * @param selection 已校验通过的一条模具选择。
 * @param correlationId 当前锁模请求的关联 ID。
 * @returns 可传给 App layer（应用层）回调的锁模请求。
 */
export function createPressMoldLockRequest(
  filters: PressJobFilterState,
  selection: PressMoldLockSelection,
  correlationId: string,
): PressMoldLockRequest {
  return {
    operatorId: filters.operatorId ?? "",
    teamId: filters.teamId ?? "",
    processId: filters.processId ?? "",
    selectedRows: [selection],
    correlationId,
  };
}

/**
 * @brief 将锁模失败转换为现场可读中文，并阻止 raw response（原始响应）泄漏。
 * @author PopoY
 * @param error 捕获到的未知错误。
 * @returns 可展示给操作员的中文错误。
 */
export function resolvePressMoldLockErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return isSafeChineseBusinessMessage(message)
    ? message
    : "锁定失败，请查看诊断信息后重试。";
}

/**
 * @brief 生成锁模 diagnostic summary（诊断摘要），忽略 selectedRows/raw response/token（选中行/原始响应/令牌）等字段。
 * @author PopoY
 * @param input 可能带额外字段的诊断输入。
 * @returns 只含白名单字段的诊断摘要。
 */
export function createPressMoldLockDiagnosticSummary(
  input: PressMoldLockDiagnosticSummary & Record<string, unknown>,
): PressMoldLockDiagnosticSummary {
  const summary: PressMoldLockDiagnosticSummary = {
    correlationId: input.correlationId,
    durationMs: input.durationMs,
    resultCode: input.resultCode,
  };

  if (input.moldNo) summary.moldNo = input.moldNo;
  if (input.operatorId) summary.operatorId = input.operatorId;
  if (input.teamId) summary.teamId = input.teamId;
  if (input.processId) summary.processId = input.processId;
  if (input.commandName) summary.commandName = input.commandName;
  if (input.stationAccountId) summary.stationAccountId = input.stationAccountId;

  return summary;
}

/**
 * @brief 执行锁模 submit（提交）后刷新 current jobs（当前作业），并区分刷新失败和锁模失败。
 * @author PopoY
 * @param input 锁模请求、注入回调和可选 clock（时钟）。
 * @returns 锁模流程结果，刷新失败不会被归类为锁模失败。
 */
export async function submitPressMoldLockWithRefresh(
  input: PressMoldLockSubmitFlowInput,
): Promise<PressMoldLockSubmitFlowStatus> {
  const now = input.now ?? Date.now;
  const startedAt = now();
  const selectedRow = input.request.selectedRows[0];
  const recordResult = (resultCode: string) => {
    input.recordPressMoldLockDiagnostic?.(
      createPressMoldLockDiagnosticSummary({
        correlationId: input.request.correlationId,
        durationMs: now() - startedAt,
        moldNo: selectedRow?.moldNo,
        operatorId: input.request.operatorId,
        teamId: input.request.teamId,
        processId: input.request.processId,
        resultCode,
      }),
    );
  };

  try {
    if (!input.lockPressMold) {
      throw new Error("锁模服务未就绪，请稍后重试。");
    }

    await input.lockPressMold(input.request);
  } catch (caughtError) {
    recordResult("ERP_MOLD_LOCK_FAILED");
    throw caughtError;
  }

  try {
    await input.refreshPressJobCurrentJobs?.();
  } catch {
    recordResult("CURRENT_JOB_REFRESH_FAILED");
    return "CURRENT_JOB_REFRESH_FAILED";
  }

  recordResult("OK");
  return "OK";
}

/**
 * @brief 将解锁失败转换为现场可读中文，并阻止 raw response（原始响应）泄漏。
 * @author PopoY
 * @param error 捕获到的未知错误。
 * @returns 可展示给操作员的中文错误。
 */
export function resolvePressMoldUnlockErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return isSafeChineseBusinessMessage(message)
    ? message
    : "解锁失败，请查看诊断信息后重试。";
}

/**
 * @brief 生成解锁模具 diagnostic summary（诊断摘要），忽略 raw response/token（原始响应/令牌）。
 * @author PopoY
 * @param input 可能带额外字段的诊断输入。
 * @returns 只含白名单字段的诊断摘要。
 */
export function createPressMoldUnlockDiagnosticSummary(
  input: PressMoldUnlockDiagnosticSummary & Record<string, unknown>,
): PressMoldUnlockDiagnosticSummary {
  const summary: PressMoldUnlockDiagnosticSummary = {
    correlationId: input.correlationId,
    durationMs: input.durationMs,
    moldNos: [...input.moldNos],
    resultCode: input.resultCode,
  };

  if (input.operatorId) summary.operatorId = input.operatorId;
  if (input.commandName) summary.commandName = input.commandName;
  if (input.stationAccountId) summary.stationAccountId = input.stationAccountId;

  return summary;
}

/**
 * @brief 执行解锁 submit（提交）后刷新 current jobs（当前作业），并区分刷新失败和解锁失败。
 * @author PopoY
 * @param input 解锁请求、注入回调和可选 clock（时钟）。
 * @returns 解锁流程结果，刷新失败不会被归类为解锁失败。
 */
export async function submitPressMoldUnlockWithRefresh(
  input: PressMoldUnlockSubmitFlowInput,
): Promise<PressMoldUnlockSubmitFlowStatus> {
  const now = input.now ?? Date.now;
  const startedAt = now();
  const recordResult = (resultCode: string) => {
    input.recordPressMoldUnlockDiagnostic?.(
      createPressMoldUnlockDiagnosticSummary({
        correlationId: input.request.correlationId,
        durationMs: now() - startedAt,
        moldNos: input.request.moldNos,
        operatorId: input.request.operatorId,
        resultCode,
      }),
    );
  };

  try {
    if (!input.unlockPressMolds) {
      throw new Error("解锁模具服务未就绪，请稍后重试。");
    }

    await input.unlockPressMolds(input.request);
  } catch (caughtError) {
    recordResult("ERP_MOLD_UNLOCK_FAILED");
    throw caughtError;
  }

  try {
    await input.refreshPressJobCurrentJobs?.();
  } catch {
    recordResult("CURRENT_JOB_REFRESH_FAILED");
    return "CURRENT_JOB_REFRESH_FAILED";
  }

  recordResult("OK");
  return "OK";
}

/**
 * @brief 判断当前作业状态是否需要保留至少一套 locked mold（已锁定模具）。
 * @author PopoY
 * @param currentJobRows 当前作业行。
 * @returns 任一当前作业非待加工/未开始时返回 true。
 */
function shouldKeepOneLockedMold(
  currentJobRows: PressJobCurrentJobRow[],
): boolean {
  return currentJobRows.some((row) => !isUnlockClearAllowedStatus(row.status));
}

/**
 * @brief 待加工/未开始状态允许清空全部已锁定模具，其余状态需要保留一套。
 * @author PopoY
 * @param status ERP 返回的当前作业状态。
 * @returns 是否允许清空全部 locked mold（已锁定模具）。
 */
function isUnlockClearAllowedStatus(status: string | undefined): boolean {
  const normalizedStatus = status?.trim();

  return (
    normalizedStatus === "0" ||
    normalizedStatus === "待加工" ||
    normalizedStatus === "待开始" ||
    normalizedStatus === "未开始"
  );
}

/**
 * @brief 读取当前已锁定 moldNo（模具号）列表，忽略空行。
 * @author PopoY
 * @param currentJobRows 当前作业行。
 * @returns 非空模具号数组。
 */
function readLockedMoldNos(currentJobRows: PressJobCurrentJobRow[]): string[] {
  return currentJobRows.flatMap((row) => {
    const moldNo = row.moldNo?.trim();
    return moldNo ? [moldNo] : [];
  });
}

/**
 * @brief 解析候选模具项目号，优先 projectCode（项目号），否则取 moldNo（模具号）首段。
 * @author PopoY
 * @param candidate 候选模具。
 * @returns 解析出的项目号或 undefined。
 */
function resolvePressMoldCandidateProjectCode(
  candidate: PressMoldCandidate,
): string | undefined {
  return candidate.projectCode?.trim() || readProjectCodeFromMoldNo(candidate.moldNo);
}

/**
 * @brief 解析 selection（选择）项目号，优先 projectCode（项目号），否则取 moldNo（模具号）首段。
 * @author PopoY
 * @param selection 锁模选择行。
 * @returns 解析出的项目号或 undefined。
 */
function resolvePressMoldSelectionProjectCode(
  selection: PressMoldLockSelection,
): string | undefined {
  return selection.projectCode?.trim() || readProjectCodeFromMoldNo(selection.moldNo);
}

/**
 * @brief 从当前作业行中读取第一个可用项目号。
 * @author PopoY
 * @param currentJobRows 当前作业行。
 * @returns 当前作业项目号或 undefined。
 */
function resolveCurrentJobProjectCode(
  currentJobRows: PressJobCurrentJobRow[],
): string | undefined {
  for (const row of currentJobRows) {
    const projectCode = row.moldNo ? readProjectCodeFromMoldNo(row.moldNo) : undefined;

    if (projectCode) {
      return projectCode;
    }
  }

  return undefined;
}

/**
 * @brief 从 moldNo（模具号）首个 hyphen（连字符）前推导项目号。
 * @author PopoY
 * @param moldNo 模具号。
 * @returns 项目号或 undefined。
 */
function readProjectCodeFromMoldNo(moldNo: string): string | undefined {
  const [projectCode] = moldNo.split("-");
  const trimmedProjectCode = projectCode?.trim();
  return trimmedProjectCode || undefined;
}

/**
 * @brief 查找工艺 code（编码）对应的中文 process name（工艺名称）。
 * @author PopoY
 * @param processOptions 当前班组工艺 options（选项）。
 * @param processId 工艺 code（编码）。
 * @returns 命中字典时返回工艺名称。
 */
function findProcessName(
  processOptions: PressJobProcessOption[],
  processId: string | undefined,
): string | undefined {
  const normalizedProcessId = processId?.trim();

  return normalizedProcessId
    ? processOptions.find((option) => option.processId === normalizedProcessId)
        ?.processName
    : undefined;
}

/**
 * @brief 查找人员 ID（标识）对应的中文 operator name（作业员）。
 * @author PopoY
 * @param operatorOptions 当前班组人员 options（选项）。
 * @param operatorId 作业员 ID（标识）。
 * @returns 命中字典时返回作业员名称。
 */
function findOperatorName(
  operatorOptions: PressJobOperatorOption[],
  operatorId: string | undefined,
): string | undefined {
  const normalizedOperatorId = operatorId?.trim();

  return normalizedOperatorId
    ? operatorOptions.find((option) => option.operatorId === normalizedOperatorId)
        ?.operatorName
    : undefined;
}

/**
 * @brief 查找 dictValue（字典值）对应的 dictLabel（字典标签）。
 * @author PopoY
 * @param dictOptions ERP 字典 options（选项）。
 * @param value 字典值。
 * @returns 命中字典时返回字典标签。
 */
function findDictLabel(
  dictOptions: ErpDictOption[],
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue
    ? dictOptions.find((option) => option.dictValue === normalizedValue)?.dictLabel
    : undefined;
}

/**
 * @brief 判断值是否为非空 string（字符串）。
 * @author PopoY
 * @param value 待校验值。
 * @returns 非空时返回 true。
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @brief 判断 ERP business message（业务消息）是否可直接展示。
 * @author PopoY
 * @param value 待展示的错误文本。
 * @returns 中文且不含敏感字段时返回 true。
 */
function isSafeChineseBusinessMessage(value: string): boolean {
  const bannedFragments = [
    "sessionToken",
    "signedLease",
    "signature",
    "signalConfig",
    "privateKey",
    "credential",
    "accessToken",
    "access token",
    "session token",
    "token",
    "selectedRows",
    "rawResponse",
    "deviceId",
    "ip",
    "port",
    "签名原文",
    "签名租约",
    "会话令牌",
    "信号配置",
    "网络地址",
    "设备ID",
    "设备 ID",
    "签名",
    "私钥",
    "凭据",
    "令牌",
    "端口",
  ];
  const lowerValue = value.toLowerCase();

  return (
    value.length > 0 &&
    value.length <= 160 &&
    /[\u4e00-\u9fff]/.test(value) &&
    !/[{}[\]<>]/.test(value) &&
    !containsNetworkEndpointFragment(value) &&
    !bannedFragments.some((fragment) => lowerValue.includes(fragment.toLowerCase()))
  );
}

/**
 * @brief 判断错误文本是否包含 raw network endpoint（原始网络端点）片段。
 * @author PopoY
 * @param value 待展示的错误文本。
 * @returns 命中 IPv4 literal（IPv4 字面量）或 host:port（主机端口）时返回 true。
 */
function containsNetworkEndpointFragment(value: string): boolean {
  const ipv4LiteralPattern =
    /(?:^|[^\d])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?=$|[^\d])/;
  const hostPortPattern =
    /(?:^|[^\w.-])(?:localhost|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+):\d{2,5}(?=$|[^\d])/;
  const urlHostPortPattern =
    /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/\s:]+:\d{2,5}(?=$|[^\d])/;
  const bracketedIpv6PortPattern = /\[[0-9a-fA-F:]+\]:\d{2,5}/;

  return (
    ipv4LiteralPattern.test(value) ||
    hostPortPattern.test(value) ||
    urlHostPortPattern.test(value) ||
    bracketedIpv6PortPattern.test(value)
  );
}

/**
 * @brief 创建前端 correlationId（关联 ID），Task3（任务三）会复用锁模提交 ID。
 * @author PopoY
 * @param scope 当前请求范围。
 * @returns 可传给 ERP query（查询）的关联 ID。
 */
function createPressMoldLockCorrelationId(scope: string): string {
  return `press-mold-${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * @brief 创建 unlock mold（解锁模具）的 correlationId（关联 ID）。
 * @author PopoY
 * @returns 可传给 ERP unlock（解锁）请求的关联 ID。
 */
function createPressMoldUnlockCorrelationId(): string {
  return `press-mold-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * @brief 创建首屏筛选初始值，SSR（服务端渲染）也能展示默认班组和人员。
 * @author PopoY
 * @param lookupData ERP lookup data（企业资源计划查询数据）。
 * @returns 初始筛选状态。
 */
function createInitialPressJobFilterState(
  lookupData?: PressJobLookupData,
): PressJobFilterState {
  return {
    teamId: lookupData?.defaultTeamId,
    operatorId: lookupData?.defaultOperatorId,
  };
}

/**
 * @brief 解析是否需要把 ERP default filters（默认筛选）写入 App Shell（应用外壳）。
 * @author PopoY
 * @param filters 当前筛选状态。
 * @param lookupData ERP lookup data（企业资源计划查询数据）。
 * @returns 需要写入的新筛选状态；无默认值或已有选择时返回 null。
 */
export function resolvePressJobDefaultFilterState(
  filters: PressJobFilterState,
  lookupData?: PressJobLookupData,
): PressJobFilterState | null {
  if (!lookupData || filters.teamId || filters.operatorId) {
    return null;
  }

  if (!lookupData.defaultTeamId && !lookupData.defaultOperatorId) {
    return null;
  }

  return {
    ...filters,
    teamId: lookupData.defaultTeamId,
    operatorId: lookupData.defaultOperatorId,
  };
}

/**
 * @brief 格式化 current job（当前作业）普通单元格空值。
 * @author PopoY
 * @param value 当前单元格值。
 * @param fallback 空值兜底中文文案。
 * @returns 可直接渲染的表格文本。
 */
function formatCurrentJobCell(value: unknown, fallback = "-"): string {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

/**
 * @brief 生成预计时长稳定 draft key（草稿键），ERP 作业优先使用 pressJobId（压机作业 ID）。
 * @author PopoY
 * @param row 当前作业行。
 * @returns ERP 作业键或无 ID 作业的本地会话键。
 */
export function resolvePlannedDurationDraftKey(
  row: Pick<PressJobCurrentJobRow, "localJobSessionId" | "pressJobId">,
): string {
  return row.pressJobId === undefined
    ? `local:${row.localJobSessionId}`
    : `erp:${row.pressJobId}`;
}

/**
 * @brief 刷新 current jobs（当前作业）时清理已保存 ERP 草稿和已离场的本地草稿。
 * @author PopoY
 * @param drafts 当前预计时长草稿映射。
 * @param persistedDraftKeys 已确认等待刷新清理的 ERP 草稿键。
 * @param currentJobRows 当前仍在场的作业；未提供时只处理 ERP 草稿。
 * @returns 删除已确认 ERP 草稿后的映射；无匹配项时复用原映射。
 */
export function dropPersistedPlannedDurationDrafts(
  drafts: Record<string, string>,
  persistedDraftKeys: ReadonlySet<string>,
  currentJobRows?: readonly PressJobCurrentJobRow[],
): Record<string, string> {
  let nextDrafts = drafts;
  const activeDraftKeys = currentJobRows
    ? new Set(currentJobRows.map(resolvePlannedDurationDraftKey))
    : undefined;

  for (const draftKey of Object.keys(drafts)) {
    const isOrphanedLocalDraft =
      activeDraftKeys !== undefined &&
      draftKey.startsWith("local:") &&
      !activeDraftKeys.has(draftKey);
    if (!persistedDraftKeys.has(draftKey) && !isOrphanedLocalDraft) {
      continue;
    }

    if (nextDrafts === drafts) {
      nextDrafts = { ...drafts };
    }
    delete nextDrafts[draftKey];
  }

  return nextDrafts;
}

/**
 * @brief 消费已激活的 persisted draft marker（持久化草稿标记），未激活标记留给 commit effect（提交副作用）。
 * @author PopoY
 * @param markers 按 draft key（草稿键）记录的 marker 激活状态。
 * @returns 当前 refresh（刷新）可以清理的草稿键。
 */
export function consumeArmedPersistedPlannedDurationDraftMarkers(
  markers: Map<string, boolean>,
): Set<string> {
  const persistedDraftKeys = new Set<string>();

  for (const [draftKey, armed] of markers) {
    if (armed) {
      persistedDraftKeys.add(draftKey);
      markers.delete(draftKey);
    }
  }

  return persistedDraftKeys;
}

/**
 * @brief 在 commit（提交）后的 effect（副作用）中激活新登记的 persisted draft marker（持久化草稿标记）。
 * @author PopoY
 * @param markers 按 draft key（草稿键）记录的 marker 激活状态。
 */
export function armPersistedPlannedDurationDraftMarkers(
  markers: Map<string, boolean>,
): void {
  for (const [draftKey, armed] of markers) {
    if (!armed) {
      markers.set(draftKey, true);
    }
  }
}

/**
 * @brief 将预计时长 completion（完成）结果应用到组件状态和反馈。
 * @author PopoY
 * @param input 保存结果、编辑基线和组件状态回调。
 */
export function applyPlannedDurationSaveCompletion(input: {
  baseline: PlannedDurationEditBaseline;
  draftMarkers: Map<string, boolean>;
  finishKeypad: () => void;
  notify: (feedback: "failed" | "invalid" | "local" | "saved") => void;
  requestRef?: PlannedDurationSaveRequestRef | null;
  result: { expectedDuration: string; status: PlannedDurationSaveStatus };
  rowId: string;
  setDrafts: (
    updateDrafts: (
      currentDrafts: Record<string, string>,
    ) => Record<string, string>,
  ) => void;
  setSavingRowId: (rowId: string | null) => void;
}): void {
  if (input.result.status === "pending") {
    return;
  }

  input.setSavingRowId(null);
  if (input.result.status === "stale") {
    input.setDrafts((currentDrafts) =>
      discardPlannedDurationDraft(currentDrafts, input.rowId),
    );
    input.finishKeypad();
    return;
  }

  if (input.result.status === "saved") {
    input.draftMarkers.set(input.rowId, false);
  } else if (
    input.result.status === "failed" &&
    input.baseline.persistedMarkerArmed !== undefined
  ) {
    input.draftMarkers.set(
      input.rowId,
      input.baseline.persistedMarkerArmed,
    );
  }
  input.setDrafts((currentDrafts) =>
    input.result.status === "failed"
      ? discardPlannedDurationDraft(
          currentDrafts,
          input.rowId,
          input.requestRef,
          input.baseline,
        )
      : {
          ...currentDrafts,
          [input.rowId]: input.result.expectedDuration,
        },
  );

  if (input.result.status === "invalid") {
    input.notify("invalid");
    return;
  }

  input.notify(input.result.status);
  input.finishKeypad();
}

/**
 * @brief 归一化预计时长 input（输入框），保留前导负号供后续校验拒绝负数。
 * @author PopoY
 * @param value 原始输入值。
 * @returns 只包含可选前导负号、数字和最多一个小数点的输入值。
 */
export function normalizePlannedDurationInput(value: string): string {
  let normalizedValue = "";
  let hasDecimalPoint = false;

  for (const character of value) {
    if (character === "-" && normalizedValue === "") {
      normalizedValue = character;
      continue;
    }

    if (character >= "0" && character <= "9") {
      normalizedValue += character;
      continue;
    }

    if (character === "." && !hasDecimalPoint) {
      normalizedValue += character;
      hasDecimalPoint = true;
    }
  }

  return normalizedValue;
}

/**
 * @brief 提交预计时长 draft（草稿）前规整小数中间态。
 * @author PopoY
 * @param value 输入框当前值。
 * @returns 可展示的 decimal number（十进制数字）或空值。
 */
export function commitPlannedDurationInput(value: string): string {
  const normalizedValue = normalizePlannedDurationInput(value);

  if (normalizedValue === ".") {
    return "";
  }

  if (normalizedValue.startsWith(".")) {
    return `0${normalizedValue}`;
  }

  return normalizedValue.endsWith(".")
    ? normalizedValue.slice(0, -1)
    : normalizedValue;
}

/**
 * @brief 执行预计时长保存的最小业务逻辑，返回页面可直接消费的安全结果。
 * @author PopoY
 * @param input 当前行、输入值、请求状态和 ERP 更新回调。
 * @returns 规整后的展示值与保存状态。
 */
export async function savePressJobExpectedDuration(input: {
  baseline?: PlannedDurationEditBaseline;
  currentJobRowsRef?: PlannedDurationCurrentRowsRef;
  isSaving: boolean;
  requestRef?: PlannedDurationSaveRequestRef;
  row: PressJobCurrentJobRow;
  updatePressJobExpectedDuration?: (
    request: PressJobExpectedDurationUpdateRequest,
  ) => Promise<void>;
  value: string;
}): Promise<{
  expectedDuration: string;
  status: "failed" | "invalid" | "local" | "pending" | "saved" | "stale";
}> {
  const expectedDuration = commitPlannedDurationInput(input.value);
  const baseline = input.baseline ?? {
    hadDraft: false,
    value: formatCurrentJobCell(input.row.plannedDurationHours, ""),
  };

  if (input.isSaving || input.requestRef?.current) {
    return { expectedDuration, status: "pending" };
  }

  const requestIdentity = {};
  if (input.requestRef) {
    input.requestRef.current = requestIdentity;
  }
  const isCompletionStale = () =>
    (input.requestRef !== undefined &&
      input.requestRef.current !== requestIdentity) ||
    (input.row.pressJobId !== undefined &&
      input.currentJobRowsRef !== undefined &&
      !input.currentJobRowsRef.current.some(
        (currentRow) => currentRow.pressJobId === input.row.pressJobId,
      ));

  try {
    if (!isValidExpectedDuration(expectedDuration)) {
      return { expectedDuration, status: "invalid" };
    }

    if (input.row.pressJobId === undefined) {
      return { expectedDuration, status: "local" };
    }

    if (!input.updatePressJobExpectedDuration) {
      return { expectedDuration: baseline.value, status: "failed" };
    }

    await input.updatePressJobExpectedDuration({
      id: input.row.pressJobId,
      expectedDuration,
    });

    if (isCompletionStale()) {
      return { expectedDuration: baseline.value, status: "stale" };
    }

    return { expectedDuration, status: "saved" };
  } catch {
    if (isCompletionStale()) {
      return { expectedDuration: baseline.value, status: "stale" };
    }

    return { expectedDuration: baseline.value, status: "failed" };
  } finally {
    if (input.requestRef?.current === requestIdentity) {
      input.requestRef.current = null;
    }
  }
}

/**
 * @brief 按编辑基线恢复单行 draft（草稿）；保存中保持不变，ERP 来源删除，本地来源恢复。
 * @author PopoY
 * @param drafts 当前预计时长草稿映射。
 * @param rowId 需要恢复或删除草稿的当前作业行 ID。
 * @param requestRef 当前保存请求引用；保存中不得改变草稿。
 * @param baseline 编辑开始时捕获的草稿来源和值。
 * @returns 保存中返回原映射；本地来源恢复值，ERP 来源删除目标行。
 */
export function discardPlannedDurationDraft(
  drafts: Record<string, string>,
  rowId: string,
  requestRef?: PlannedDurationSaveRequestRef | null,
  baseline?: PlannedDurationEditBaseline,
): Record<string, string> {
  if (requestRef?.current) {
    return drafts;
  }

  if (baseline?.hadDraft) {
    return { ...drafts, [rowId]: baseline.value };
  }

  const nextDrafts = { ...drafts };

  delete nextDrafts[rowId];
  return nextDrafts;
}

/**
 * @brief 根据触发 input（输入框）位置计算 NumericKeypad（数字键盘）fixed position（固定定位）。
 * @author PopoY
 * @param triggerRect 触发输入框的 viewport rect（视口矩形）。
 * @param viewportWidth 当前 viewport（视口）宽度。
 * @param viewportHeight 当前 viewport（视口）高度。
 * @returns 数字键盘 left/top（左/上）定位。
 */
export function resolveNumericKeypadPosition(
  triggerRect: NumericKeypadTriggerRect,
  viewportWidth: number,
  viewportHeight: number,
): NumericKeypadPosition {
  const maxLeft =
    viewportWidth - NUMERIC_KEYPAD_WIDTH - NUMERIC_KEYPAD_VIEWPORT_GAP;
  const left = Math.min(
    Math.max(triggerRect.left, NUMERIC_KEYPAD_VIEWPORT_GAP),
    maxLeft,
  );
  const belowTop = triggerRect.bottom + NUMERIC_KEYPAD_TRIGGER_GAP;
  const top =
    belowTop + NUMERIC_KEYPAD_HEIGHT <=
    viewportHeight - NUMERIC_KEYPAD_VIEWPORT_GAP
      ? belowTop
      : Math.max(
          NUMERIC_KEYPAD_VIEWPORT_GAP,
          triggerRect.top - NUMERIC_KEYPAD_HEIGHT - NUMERIC_KEYPAD_TRIGGER_GAP,
        );

  return { left, top };
}

/**
 * @brief 从 Driver snapshot（驱动快照）解析是否出线状态，未知值保持中性避免误报。
 * @author PopoY
 * @param signalValues scalar（标量）或带 metadata（元数据）的信号映射。
 * @returns 操作区和当前作业表共用的状态文案与 Tag color（标签颜色）。
 */
export function resolvePressJobLineStatus(
  signalValues?: Record<string, unknown> | null,
): { color?: "error" | "success"; text: "已出线" | "已入线" | "未知" } {
  let value = signalValues?.["是否出线"];

  if (value && typeof value === "object" && !Array.isArray(value)) {
    value = (value as Record<string, unknown>).value;
  }

  if (value === undefined && signalValues) {
    for (const candidate of Object.values(signalValues)) {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        continue;
      }

      const signal = candidate as Record<string, unknown>;
      if (
        signal.signalName === "是否出线" ||
        signal.name === "是否出线" ||
        signal.semanticKey === "是否出线"
      ) {
        value = signal.value;
        break;
      }
    }
  }

  if (
    value === false ||
    value === 0 ||
    (typeof value === "string" &&
      ["0", "false"].includes(value.trim().toLowerCase()))
  ) {
    return { color: "success", text: "已入线" };
  }

  if (
    value === true ||
    value === 1 ||
    (typeof value === "string" &&
      ["1", "true"].includes(value.trim().toLowerCase()))
  ) {
    return { color: "error", text: "已出线" };
  }

  return { text: "未知" };
}

/**
 * @brief 格式化候选 moldNo（模具号）按钮 title（标题），避免把多字段挤进十列网格。
 * @author PopoY
 * @param candidate 当前候选模具。
 * @returns 用于 hover/focus（悬停/聚焦）的候选摘要。
 */
function formatPressMoldCandidateTitle(candidate: PressMoldCandidate): string {
  return [
    `模具号：${candidate.moldNo}`,
    candidate.makeOrderNumber ? `制造令号：${candidate.makeOrderNumber}` : "",
    candidate.stages ? `工序号：${candidate.stages}` : "",
    candidate.name ? `模具名称：${candidate.name}` : "",
  ]
    .filter(Boolean)
    .join("；");
}

/**
 * @brief 计算 running job（加工中作业）的一位小数实际时长。
 * @author PopoY
 * @param startedAt ERP 返回的开始时间。
 * @param nowMs 当前时间戳。
 * @param status ERP 返回的作业状态码。
 * @returns 一位小数小时数，无法计算时返回 undefined。
 */
function formatPressJobActualDurationHours(
  startedAt: string | undefined,
  nowMs: number,
  status: string | undefined,
): string | undefined {
  if (status !== "1" || !startedAt) {
    return undefined;
  }

  const startedAtDate = parsePressJobLocalDateTime(startedAt);
  if (!startedAtDate) {
    return undefined;
  }

  const elapsedMs = nowMs - startedAtDate.getTime();
  return elapsedMs >= 0 ? (elapsedMs / 60 / 60 / 1000).toFixed(1) : undefined;
}

/**
 * @brief 解析 ERP local datetime（本地日期时间），避免浏览器差异。
 * @author PopoY
 * @param value ERP 返回的时间字符串。
 * @returns 可用 Date（日期）或 undefined。
 */
function parsePressJobLocalDateTime(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    value.trim(),
  );

  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const expectedParts = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ];
  const actualParts = [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ];

  return expectedParts.every((part, index) => part === actualParts[index])
    ? date
    : undefined;
}

/**
 * @brief 创建 action button（操作按钮）的 className（样式类名）。
 * @author PopoY
 * @param actionButton 当前动作按钮配置。
 * @returns 可传给 Ant Design Button（按钮）的 className（样式类名）。
 */
function createActionButtonClassName(actionButton: ActionButtonConfig): string {
  return [
    "press-job-page__action-button",
    `press-job-page__action-button--${actionButton.key}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * @brief 创建 action button（操作按钮）的轻量字符 icon（图标）。
 * @author PopoY
 * @param symbol 表达按钮动作的短字符。
 * @returns Ant Design Button（按钮）icon prop（图标属性）使用的 React element（React 元素）。
 */
function createActionIcon(symbol: string) {
  return (
    <span aria-hidden="true" className="press-job-page__action-icon">
      {symbol}
    </span>
  );
}

/**
 * @brief 创建 Mold Lock Panel（模具锁定面板）toolbar button（工具条按钮）图标。
 * @author PopoY
 * @param symbol 表达按钮动作的短字符。
 * @returns Ant Design Button（按钮）icon prop（图标属性）使用的 React element（React 元素）。
 */
function createMoldLockButtonIcon(symbol: string) {
  return (
    <span aria-hidden="true" className="press-job-page__mold-lock-button-icon">
      {symbol}
    </span>
  );
}

/**
 * @brief 创建 unlock mold（解锁模具）动作的语义化 icon（图标）。
 * @author PopoY
 * @returns Ant Design Button（按钮）icon prop（图标属性）使用的 React element（React 元素）。
 */
function createMoldUnlockIcon() {
  return (
    <UnlockOutlined
      aria-hidden="true"
      className="press-job-page__mold-lock-button-icon"
    />
  );
}

/**
 * @brief 创建 unlock drawer cancel（解锁抽屉取消）动作的语义化 icon（图标）。
 * @author PopoY
 * @returns Ant Design Button（按钮）icon prop（图标属性）使用的 React element（React 元素）。
 */
function createMoldUnlockCancelIcon() {
  return (
    <CloseOutlined
      aria-hidden="true"
      className="press-job-page__mold-lock-button-icon"
    />
  );
}

/**
 * @brief 创建 unlock confirm（确认解锁）动作的语义化 icon（图标）。
 * @author PopoY
 * @returns Ant Design Button（按钮）icon prop（图标属性）使用的 React element（React 元素）。
 */
function createMoldUnlockConfirmIcon() {
  return (
    <CheckOutlined
      aria-hidden="true"
      className="press-job-page__mold-lock-button-icon"
    />
  );
}

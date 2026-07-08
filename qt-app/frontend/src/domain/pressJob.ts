/**
 * @file pressJob.ts - 定义 Press Job（压机作业）前端 lookup data（查询数据）模型。
 * @author PopoY
 * @created 2026-06-30
 * @brief 承载 sam-erp 班组、人员和预选工艺级联展示需要的最小字段。
 */

import type { PressDeviceCommandName } from "./driver";

/**
 * @brief Model one team option（班组选项）from sam-erp pline（产线）data.
 * @author PopoY
 */
export type PressJobTeamOption = {
  teamId: string;
  teamName: string;
};

/**
 * @brief Model one operator option（人员选项）under a selected team（班组）.
 * @author PopoY
 */
export type PressJobOperatorOption = {
  operatorId: string;
  operatorName: string;
  teamId: string;
};

/**
 * @brief Model one process option（预选工艺选项）under a selected team（班组）.
 * @author PopoY
 */
export type PressJobProcessOption = {
  processId: string;
  processName: string;
  teamId: string;
};

/**
 * @brief Model first-screen lookup data（首屏查询数据）for PressJobPage（压机作业页）.
 * @author PopoY
 */
export type PressJobLookupData = {
  teamOptions: PressJobTeamOption[];
  operatorOptions: PressJobOperatorOption[];
  processOptions: PressJobProcessOption[];
  defaultTeamId?: string;
  defaultOperatorId?: string;
};

/**
 * @brief Model cascade data（级联数据）loaded after a team（班组）changes.
 * @author PopoY
 */
export type PressJobTeamOptions = {
  teamId: string;
  operatorOptions: PressJobOperatorOption[];
  processOptions: PressJobProcessOption[];
};

/**
 * @brief Model one current job row（当前作业行）displayed by PressJobPage（压机作业页）.
 * @author PopoY
 */
export type PressJobCurrentJobRow = {
  localJobSessionId: string;
  pressName?: string;
  moldNo?: string;
  needParameterRecords?: boolean;
  plannedDurationHours?: string;
  actualDurationHours?: string;
  startedAt?: string;
  status?: string;
};

/**
 * @brief Model one mold candidate（模具候选）returned by ERP Qt endpoint（端点）.
 * @author PopoY
 */
export type PressMoldCandidate = {
  moldNo: string;
  makeOrderNumber?: string;
  stages?: string;
  projectCode?: string;
  name?: string;
  defaultProcessId?: string;
};

/**
 * @brief Model one mold info row（模具明细行）returned after selected candidate（候选）search.
 * @author PopoY
 */
export type PressMoldInfoRow = PressMoldCandidate;

/**
 * @brief Model one selected mold lock row（锁模选中行）submitted to ERP.
 * @author PopoY
 */
export type PressMoldLockSelection = {
  moldNo: string;
  makeOrderNumber: string;
  stages?: string;
  craftCode: string;
  projectCode?: string;
};

/**
 * @brief Model the Qt-specific mold lock request（锁模请求）.
 * @author PopoY
 */
export type PressMoldLockRequest = {
  operatorId: string;
  teamId: string;
  processId: string;
  selectedRows: PressMoldLockSelection[];
  correlationId: string;
};

/**
 * @brief Model the Qt-specific mold lock result（锁模结果）.
 * @author PopoY
 */
export type PressMoldLockResult = {
  lockedMoldNos: string[];
};

/**
 * @brief Model one locked mold row（已锁定模具行）shown in Unlock Drawer（解锁抽屉）.
 * @author PopoY
 */
export type PressLockedMoldRow = {
  moldNo: string;
  stages?: string;
  makeOrderNumber?: string;
  craftCode?: string;
  craftName?: string;
  workTimeType?: string;
  workTimeTypeText?: string;
  startedAt?: string;
  operatorId?: string;
  operatorName?: string;
  moldJobId?: string;
};

/**
 * @brief Model the Qt-specific mold unlock request（解锁模具请求）.
 * @author PopoY
 */
export type PressMoldUnlockRequest = {
  operatorId: string;
  moldNos: string[];
  correlationId: string;
};

/**
 * @brief Model the Qt-specific mold unlock result（解锁模具结果）.
 * @author PopoY
 */
export type PressMoldUnlockResult = {
  unlockedMoldNos: string[];
};

/**
 * @brief 定义压机作业七个设备动作按钮 key（键），不包含锁模/解锁模具流程。
 * @author PopoY
 */
export type PressDeviceActionButtonKey =
  | "connect"
  | "startProcessing"
  | "completeProcessing"
  | "moveIn"
  | "moveOut"
  | "lineIn"
  | "lineOut";

/**
 * @brief 定义同一次用户动作内复用的 action identity（动作身份）。
 * @author PopoY
 */
export type PressDeviceActionIdentity = {
  buttonKey: PressDeviceActionButtonKey;
  commandName: PressDeviceCommandName;
  correlationId: string;
  idempotencyKey: string;
  localJobSessionId: string;
};

/**
 * @brief 定义压机设备动作 diagnostic summary（诊断摘要）白名单字段。
 * @author PopoY
 */
export type PressDeviceActionDiagnosticSummary = {
  correlationId: string;
  durationMs: number;
  localJobSessionId: string;
  idempotencyKey: string;
  buttonKey: PressDeviceActionButtonKey;
  commandName: PressDeviceCommandName;
  resultCode: string;
  driverResultCode?: string;
  erpResultCode?: string;
  operatorId?: string;
  teamId?: string;
  processId?: string;
};

/**
 * @brief 定义 ERP Qt start job（开始加工）请求白名单字段。
 * @author PopoY
 */
export type PressJobStartRequest = {
  correlationId: string;
  idempotencyKey: string;
  localJobSessionId: string;
  operatorId: string;
  teamId: string;
  processId: string;
  expectedDuration: string;
};

/**
 * @brief 定义 ERP Qt start job（开始加工）结果白名单字段。
 * @author PopoY
 */
export type PressJobStartResult = {
  correlationId: string;
  localJobSessionId: string;
  resultCode: string;
  message?: string;
};

/**
 * @brief 定义参数记录 type（类型），只允许开始与结束两类。
 * @author PopoY
 */
export type PressJobParameterRecordType = "start" | "end";

/**
 * @brief 定义 ERP Qt parameter record（参数记录）请求白名单字段。
 * @author PopoY
 */
export type PressJobParameterRecordRequest = {
  correlationId: string;
  idempotencyKey: string;
  parameterIdempotencyKey: string;
  localJobSessionId: string;
  type: PressJobParameterRecordType;
  signalValues: Record<string, unknown>;
};

/**
 * @brief 定义 ERP Qt parameter record（参数记录）结果白名单字段。
 * @author PopoY
 */
export type PressJobParameterRecordResult = {
  correlationId: string;
  localJobSessionId: string;
  resultCode: string;
  message?: string;
};

/**
 * @brief 定义 ERP Qt complete job（完成加工）请求白名单字段。
 * @author PopoY
 */
export type PressJobCompleteRequest = {
  correlationId: string;
  idempotencyKey: string;
  localJobSessionId: string;
  operatorId: string;
  status?: "3";
};

/**
 * @brief 定义 ERP Qt complete job（完成加工）结果白名单字段。
 * @author PopoY
 */
export type PressJobCompleteResult = {
  correlationId: string;
  localJobSessionId: string;
  resultCode: string;
  message?: string;
};

/**
 * @brief 定义 ERP machine status（设备状态）更新原因。
 * @author PopoY
 */
export type PressMachineStatusReason = "lineIn" | "lineOut";

/**
 * @brief 定义 ERP Qt machine status（设备状态）请求白名单字段。
 * @author PopoY
 */
export type PressMachineStatusUpdateRequest = {
  correlationId: string;
  idempotencyKey: string;
  localJobSessionId: string;
  status: "0" | "9";
  reason: PressMachineStatusReason;
};

/**
 * @brief 定义 ERP Qt machine status（设备状态）结果白名单字段。
 * @author PopoY
 */
export type PressMachineStatusUpdateResult = {
  correlationId: string;
  localJobSessionId: string;
  resultCode: string;
  status?: "0" | "9";
  message?: string;
};

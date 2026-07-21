/**
 * @file erpClient.ts - 实现 ERP（企业资源计划系统）auto-login（自动登录）和租约引导客户端。
 * @author PopoY
 * @created 2026-06-25
 * @brief 实现 ERP（企业资源计划系统）auto-login（自动登录）和租约引导客户端。
 */

import { createBootstrapError } from "../domain/errors";
import type {
  ErpDictOption,
  LeaseAuthorizationRequest,
  LeaseAuthorizationResponse,
  LeasePackage,
  ParameterGroupOption,
} from "../domain/lease";
import type {
  PressLockedMoldRow,
  PressMoldCandidate,
  PressMoldInfoRow,
  PressMoldLockRequest,
  PressMoldLockResult,
  PressMoldLockSelection,
  PressMoldUnlockRequest,
  PressMoldUnlockResult,
  PressJobCurrentJobRow,
  PressJobExpectedDurationUpdateRequest,
  PressJobCompleteRequest,
  PressJobCompleteResult,
  PressJobLookupData,
  PressJobOperatorOption,
  PressJobParameterRecordRequest,
  PressJobParameterRecordResult,
  PressJobProcessOption,
  PressJobStartRequest,
  PressJobStartResult,
  PressJobTeamOption,
  PressJobTeamOptions,
  PressMachineStatusUpdateRequest,
  PressMachineStatusUpdateResult,
} from "../domain/pressJob";
import type { AutoLoginRequest, AutoLoginResponse } from "../domain/session";
import type { NativeBootstrapConfig } from "../types/native";

const AUTO_LOGIN_PATH = "/api/qt/bootstrap/auto-login";
const LEASE_PACKAGE_PATH = "/api/qt/bootstrap/lease-package";
const PARAMETER_GROUP_DICT_PATH = "/system/dict/data/type/parameter_group";
const PRESS_MOLD_WORK_TYPE_DICT_PATH = "/system/dict/data/type/mould_make_order_type";
const PRESS_MOLD_CRAFT_OPTIONS_PATH =
  "/moldStandardCraft/moldStandardCraftController/getCraftList";
const PRESS_MOLD_OPERATOR_OPTIONS_PATH = "/system/user/getAllUserForOptions";
const PRESS_JOB_TEAM_DEPT_ID = "30";
const PRESS_JOB_DEVICE_TYPE = "0";
const PRESS_JOB_TEAM_OPTIONS_PATH = `/fm/pline/getPlnListByDept2/${PRESS_JOB_TEAM_DEPT_ID}`;
const PRESS_JOB_CURRENT_USER_PATH = "/rel/qtrel/getQtUserInfo";
const PRESS_JOB_CURRENT_JOBS_PATH = "/modbus/device/getPressJobByHandleIp";
const PRESS_JOB_EXPECTED_DURATION_PATH = "/modbus/pressjob";
const BOOTSTRAP_CONFIG_APPROVAL_PATH =
  "/system/config/configKey/approve.press.config";
const PRESS_MOLD_CANDIDATES_PATH = "/api/qt/press-working/mold-candidates";
const PRESS_MOLD_INFO_ROWS_PATH = "/api/qt/press-working/mold-info-rows";
const PRESS_MOLD_LOCKS_PATH = "/api/qt/press-working/mold-locks";
const PRESS_LOCKED_MOLDS_PATH = "/api/qt/press-working/locked-molds";
const PRESS_MOLD_UNLOCKS_PATH = "/api/qt/press-working/mold-unlocks";
const PRESS_JOB_STARTS_PATH = "/api/qt/press-working/press-job-starts";
const PRESS_JOB_PARAMETERS_PATH = "/api/qt/press-working/press-job-parameters";
const PRESS_JOB_COMPLETIONS_PATH = "/api/qt/press-working/press-job-completions";
const PRESS_MACHINE_STATUS_PATH = "/api/qt/press-working/machine-status";
const PRESS_SIGNAL_VALUE_FORBIDDEN_KEYS = new Set([
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
const BOOTSTRAP_PLACEHOLDER_MODE = "bootstrap-minimal";
const BOOTSTRAP_PLACEHOLDER_SIGNATURE = "UNSIGNED_BOOTSTRAP_PLACEHOLDER";
const BOOTSTRAP_PLACEHOLDER_ENDPOINT = "driver://pending";

/**
 * @brief Define the minimal JSON POST helper contract shared by the ERP bootstrap flow.
 * @author PopoY
 */
export type PostJson = <TResponse>(
  url: string,
  body: unknown,
  options?: ErpJsonRequestOptions,
) => Promise<TResponse>;

/**
 * @brief Define the minimal authenticated JSON GET helper contract used by ERP dict（字典）reads.
 * @author PopoY
 */
export type GetJson = <TResponse>(
  url: string,
  bearerToken?: string,
  options?: ErpJsonRequestOptions,
) => Promise<TResponse>;

/**
 * @brief Model optional ERP JSON request headers（请求头）without exposing tokens to UI（界面）.
 * @author PopoY
 */
export type ErpJsonRequestOptions = {
  bearerToken?: string;
  headers?: Record<string, string>;
};

/**
 * @brief 表示 bootstrap config approval（启动配置审批）读取后的编辑状态。
 * @author PopoY
 */
export type BootstrapConfigApprovalState =
  | "editable"
  | "readonly"
  | "unavailable";

/**
 * @brief 封装 dashboard config panel（仪表盘配置面板）需要的审批结果。
 * @author PopoY
 */
export type BootstrapConfigApproval = {
  bootstrapConfigEditable: boolean;
  bootstrapConfigApprovalState: BootstrapConfigApprovalState;
};

/**
 * @brief Combine the ERP login payload with the lease package required by later bootstrap tasks.
 * @author PopoY
 */
export type BootstrapSession = AutoLoginResponse &
  LeasePackage & {
    bootstrapConfigEditable: boolean;
    bootstrapConfigApprovalState: BootstrapConfigApprovalState;
    parameterGroupOptions?: ParameterGroupOption[];
    pressMoldWorkTypeOptions?: ErpDictOption[];
    pressMoldCraftOptions?: ErpDictOption[];
    pressMoldOperatorOptions?: ErpDictOption[];
    pressJobLookupData?: PressJobLookupData;
    pressJobCurrentJobs?: PressJobCurrentJobRow[];
  };

/**
 * @brief Define the request shape needed to fetch the ERP lease package.
 */
export type FetchLeasePackageInput = LeaseAuthorizationRequest & {
  erpBaseUrl: string;
};

/**
 * @brief Define the request shape needed to fetch ERP parameter_group dict（参数组别字典）options.
 * @author PopoY
 */
export type FetchParameterGroupOptionsInput = {
  erpBaseUrl: string;
  sessionToken: string;
};

/**
 * @brief Define the request shape needed to fetch press mold work type dict（解锁模具工时类型字典）options.
 * @author PopoY
 */
export type FetchPressMoldWorkTypeOptionsInput = FetchParameterGroupOptionsInput;

/**
 * @brief Define the request shape needed to fetch press mold display dict（展示字典）options.
 * @author PopoY
 */
export type FetchPressMoldDisplayOptionsInput = FetchParameterGroupOptionsInput;

/**
 * @brief Define the request shape needed to fetch press job lookup data（压机作业查询数据）.
 * @author PopoY
 */
export type FetchPressJobLookupDataInput = {
  erpBaseUrl: string;
  sessionToken: string;
};

/**
 * @brief Define the request shape needed to fetch cascade options（级联选项）for one team（班组）.
 * @author PopoY
 */
export type FetchPressJobTeamOptionsInput = FetchPressJobLookupDataInput & {
  teamId: string;
};

/**
 * @brief Define the request shape needed to fetch current jobs（当前作业）for the bound press terminal.
 * @author PopoY
 */
export type FetchPressJobCurrentJobsInput = FetchPressJobLookupDataInput;

/**
 * @brief Define expected duration（预计时长）update input，sessionToken（会话令牌）不进入 UI request（界面请求）。
 * @author PopoY
 */
export type UpdatePressJobExpectedDurationInput = FetchPressJobLookupDataInput & {
  correlationId: string;
  request: PressJobExpectedDurationUpdateRequest;
};

/**
 * @brief Define the request shape needed to search press mold candidates（压机模具候选）.
 * @author PopoY
 */
export type FetchPressMoldCandidatesInput = FetchPressJobLookupDataInput & {
  moldNo: string;
  lockedMoldNos: string[];
  correlationId: string;
};

/**
 * @brief Define the request shape needed to fetch selected mold info rows（已选模具明细行）.
 * @author PopoY
 */
export type FetchPressMoldInfoRowsInput = FetchPressMoldCandidatesInput;

/**
 * @brief Define the request shape needed to submit one press mold lock（压机锁模）operation.
 * @author PopoY
 */
export type LockPressMoldInput = FetchPressJobLookupDataInput & {
  request: PressMoldLockRequest;
};

/**
 * @brief Define the request shape needed to query locked molds（已锁定模具）.
 * @author PopoY
 */
export type FetchPressLockedMoldsInput = FetchPressJobLookupDataInput & {
  correlationId: string;
};

/**
 * @brief Define the request shape needed to submit mold unlock（解锁模具）.
 * @author PopoY
 */
export type UnlockPressMoldsInput = FetchPressJobLookupDataInput & {
  request: PressMoldUnlockRequest;
};

/**
 * @brief Define startPressJob（开始加工）client input（输入），sessionToken（会话令牌）只用于 header（请求头）。
 * @author PopoY
 */
export type StartPressJobInput = FetchPressJobLookupDataInput & {
  request: PressJobStartRequest;
};

/**
 * @brief Define recordPressJobParameters（记录压机参数）client input（输入）。
 * @author PopoY
 */
export type RecordPressJobParametersInput = FetchPressJobLookupDataInput & {
  request: PressJobParameterRecordRequest;
};

/**
 * @brief Define completePressJob（完成加工）client input（输入）。
 * @author PopoY
 */
export type CompletePressJobInput = FetchPressJobLookupDataInput & {
  request: PressJobCompleteRequest;
};

/**
 * @brief Define updatePressMachineStatus（更新设备状态）client input（输入）。
 * @author PopoY
 */
export type UpdatePressMachineStatusInput = FetchPressJobLookupDataInput & {
  request: PressMachineStatusUpdateRequest;
};

/**
 * @brief Post a JSON body with the platform-native fetch implementation.
 * @author PopoY
 * @param url Target ERP endpoint URL.
 * @param body JSON-serializable request body.
 * @param options Optional auth（认证）and diagnostic headers（诊断请求头）.
 * @returns Parsed JSON response body.
 */
export async function postJson<TResponse>(
  url: string,
  body: unknown,
  options: ErpJsonRequestOptions = {},
): Promise<TResponse> {
  const headers = buildErpJsonHeaders(
    {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    options,
  );

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

/**
 * @brief Read JSON from an ERP GET endpoint with the optional bearer token used by sam-erp dict API（字典接口）.
 * @author PopoY
 * @param url Target ERP endpoint URL.
 * @param bearerToken ERP session token（会话令牌）used as Authorization bearer when present.
 * @returns Parsed JSON response body.
 */
export async function getJson<TResponse>(
  url: string,
  bearerToken?: string,
  options: ErpJsonRequestOptions = {},
): Promise<TResponse> {
  const headers = buildErpJsonHeaders(
    {
      Accept: "application/json",
    },
    {
      ...options,
      bearerToken: bearerToken ?? options.bearerToken,
    },
  );

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

/**
 * @brief Merge safe ERP JSON headers（请求头）and keep bearer token（承载令牌）out of caller-visible data.
 * @author PopoY
 * @param baseHeaders Required JSON headers（基础请求头）for the HTTP method.
 * @param options Optional auth（认证）and diagnostic headers（诊断请求头）.
 * @returns Headers（请求头）used by native fetch（原生请求）.
 */
function buildErpJsonHeaders(
  baseHeaders: Record<string, string>,
  options: ErpJsonRequestOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    ...baseHeaders,
    ...(options.headers ?? {}),
  };

  delete headers.Authorization;

  if (options.bearerToken) {
    headers.Authorization = `Bearer ${options.bearerToken}`;
  }

  return headers;
}

/**
 * @brief Complete ERP auto-login with the fixed account information from native bootstrap config.
 * @param sendJson JSON POST helper used by production and tests.
 * @param config Native bootstrap config read from the Qt bridge.
 * @returns ERP login session payload used by the bootstrap flow.
 */
export async function autoLogin(
  sendJson: PostJson,
  config: NativeBootstrapConfig,
): Promise<AutoLoginResponse> {
  const request: AutoLoginRequest = {
    stationAccountId: config.stationAccountId,
    granteeHostId: config.granteeHostId,
    stationId: config.stationId,
  };

  try {
    const response = await sendJson<unknown>(
      buildErpUrl(config.erpBaseUrl, AUTO_LOGIN_PATH),
      request,
    );

    return narrowAutoLoginResponse(
      unwrapErpAjaxResult<AutoLoginResponse>(response),
    );
  } catch (error) {
    throw createBootstrapError(
      "ERP_AUTO_LOGIN_FAILED",
      "ERP auto-login failed.",
      error,
    );
  }
}

/**
 * @brief Fetch the bootstrap lease package and return only the approved fields.
 * @param sendJson JSON POST helper used by production and tests.
 * @param request Lease package request with the ERP base URL included.
 * @returns Narrowed lease package containing signalConfig and signedLease only.
 */
export async function fetchLeasePackage(
  sendJson: PostJson,
  request: FetchLeasePackageInput,
): Promise<LeasePackage> {
  const response = unwrapErpAjaxResult<LeaseAuthorizationResponse>(
    await sendJson<unknown>(
      buildErpUrl(request.erpBaseUrl, LEASE_PACKAGE_PATH),
      {
        sessionToken: request.sessionToken,
        stationId: request.stationId,
        granteeHostId: request.granteeHostId,
      } satisfies LeaseAuthorizationRequest,
    ),
  );

  const leasePackage = {
    signalConfig: parseLeaseJsonField(response.signalConfig, "signalConfig"),
    signedLease: parseLeaseJsonField(response.signedLease, "signedLease"),
  };

  rejectBootstrapPlaceholderLeasePackage(leasePackage);

  // PopoY: ERP may return deviceConnectionInfo, but bootstrap must never expose or forward it.
  return leasePackage;
}

/**
 * @brief Fetch ERP parameter_group dict（参数组别字典）options for signal snapshot group label translation.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL and session token（会话令牌）for authenticated dict access.
 * @returns Narrowed dict options with dictValue（字典值）and dictLabel（字典标签）only.
 */
export async function fetchParameterGroupOptions(
  readJson: GetJson,
  request: FetchParameterGroupOptionsInput,
): Promise<ParameterGroupOption[]> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PARAMETER_GROUP_DICT_PATH),
      request.sessionToken,
    ),
  );

  return narrowDictOptions(response);
}

/**
 * @brief Fetch ERP mould_make_order_type dict（模具工时类型字典）options for unlock mold table translation.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL and session token（会话令牌）for authenticated dict access.
 * @returns Narrowed dict options with dictValue（字典值）and dictLabel（字典标签）only.
 */
export async function fetchPressMoldWorkTypeOptions(
  readJson: GetJson,
  request: FetchPressMoldWorkTypeOptionsInput,
): Promise<ErpDictOption[]> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_MOLD_WORK_TYPE_DICT_PATH),
      request.sessionToken,
    ),
  );

  return narrowDictOptions(response);
}

/**
 * @brief Fetch sam-erp full craft dict（全量工艺字典）for locked mold translation（翻译）.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL and session token（会话令牌）for authenticated lookup reads.
 * @returns Dict options using craftCode（工艺编码）as value and craftName（工艺名称）as label.
 */
export async function fetchPressMoldCraftOptions(
  readJson: GetJson,
  request: FetchPressMoldDisplayOptionsInput,
): Promise<ErpDictOption[]> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_MOLD_CRAFT_OPTIONS_PATH),
      request.sessionToken,
    ),
  );

  return narrowCraftDictOptions(response);
}

/**
 * @brief Fetch sam-erp full user dict（全量用户字典）for locked mold operator translation（作业员翻译）.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL and session token（会话令牌）for authenticated lookup reads.
 * @returns Dict options using userName/dictValue（账号/字典值）as value and nickName/dictLabel（昵称/字典标签）as label.
 */
export async function fetchPressMoldOperatorOptions(
  readJson: GetJson,
  request: FetchPressMoldDisplayOptionsInput,
): Promise<ErpDictOption[]> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_MOLD_OPERATOR_OPTIONS_PATH),
      request.sessionToken,
    ),
  );

  return narrowUserDictOptions(response);
}

/**
 * @brief 读取 ERP config key（ERP 配置键），false 表示关闭审批并允许编辑启动配置。
 * @author PopoY
 * @param readJson 现有 GET JSON（GET 请求）辅助函数。
 * @param input ERP base URL（基础地址）和 sessionToken（会话令牌）。
 * @returns 可编辑状态；失败由调用方降级为 unavailable（不可用）。
 */
export async function fetchBootstrapConfigApproval(
  readJson: GetJson,
  input: FetchPressJobLookupDataInput,
): Promise<BootstrapConfigApproval> {
  const response = await readJson<unknown>(
    buildErpUrl(input.erpBaseUrl, BOOTSTRAP_CONFIG_APPROVAL_PATH),
    input.sessionToken,
  );
  const configValue = readBootstrapConfigApprovalValue(response);
  const editable = String(configValue ?? "").trim() === "false";

  return {
    bootstrapConfigEditable: editable,
    bootstrapConfigApprovalState: editable ? "editable" : "readonly",
  };
}

/**
 * @brief 读取 approve.press.config 的真实值，兼容 RuoYi AjaxResult（若依统一响应）String overload（字符串重载）。
 * @author PopoY
 * @param response ERP config key（配置键）接口的原始响应。
 * @returns config value（配置值），非 AjaxResult（统一响应）时返回原值。
 */
function readBootstrapConfigApprovalValue(response: unknown): unknown {
  const responseRecord = readRecord(response);

  if (!responseRecord || !("code" in responseRecord)) {
    return response;
  }

  if (responseRecord.code !== 200) {
    throw new Error(readAjaxResultMessage(responseRecord));
  }

  // PopoY: String config value（字符串配置值）在 RuoYi AjaxResult.success(String) 中会进入 msg（消息）字段。
  return "data" in responseRecord ? responseRecord.data : responseRecord.msg;
}

/**
 * @brief Fetch sam-erp press job lookup data（压机作业查询数据）for first-screen team/operator/process display.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL and session token（会话令牌）for authenticated lookup reads.
 * @returns Narrowed lookup data（查询数据）without sensitive fields.
 */
export async function fetchPressJobLookupData(
  readJson: GetJson,
  request: FetchPressJobLookupDataInput,
): Promise<PressJobLookupData> {
  const [teamPayload, currentUserPayload] = await Promise.all([
    readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_JOB_TEAM_OPTIONS_PATH),
      request.sessionToken,
    ),
    readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_JOB_CURRENT_USER_PATH),
      request.sessionToken,
    ),
  ]);
  const teamOptions = narrowPressJobTeamOptions(
    unwrapErpAjaxResult<unknown>(teamPayload),
  );
  const currentUser = narrowPressJobCurrentUser(
    unwrapErpAjaxResult<unknown>(currentUserPayload),
  );

  if (!currentUser.defaultTeamId) {
    return {
      teamOptions,
      operatorOptions: [],
      processOptions: [],
    };
  }

  const teamOptionsForDefault = await fetchPressJobTeamOptions(readJson, {
    ...request,
    teamId: currentUser.defaultTeamId,
  });

  return {
    teamOptions,
    operatorOptions: teamOptionsForDefault.operatorOptions,
    processOptions: teamOptionsForDefault.processOptions,
    defaultTeamId: currentUser.defaultTeamId,
    defaultOperatorId: currentUser.defaultOperatorId,
  };
}

/**
 * @brief Fetch sam-erp operator/process options（人员/工艺选项）for one selected team（班组）.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL, session token（会话令牌）, and selected team（班组）.
 * @returns Narrowed cascade options（级联选项）for the selected team（班组）.
 */
export async function fetchPressJobTeamOptions(
  readJson: GetJson,
  request: FetchPressJobTeamOptionsInput,
): Promise<PressJobTeamOptions> {
  const encodedTeamId = encodeURIComponent(request.teamId);
  const [operatorPayload, processPayload] = await Promise.all([
    readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, `/rel/qtrel/getQtUserList2/${encodedTeamId}`),
      request.sessionToken,
    ),
    readJson<unknown>(
      buildErpUrl(
        request.erpBaseUrl,
        `/samMesPlineCraft/samMesPlineCraftController/getCraftByPlineIdAndDeviceType/${encodedTeamId}/${PRESS_JOB_DEVICE_TYPE}`,
      ),
      request.sessionToken,
    ),
  ]);

  return {
    teamId: request.teamId,
    operatorOptions: narrowPressJobOperatorOptions(
      unwrapErpAjaxResult<unknown>(operatorPayload),
      request.teamId,
    ),
    processOptions: narrowPressJobProcessOptions(
      unwrapErpAjaxResult<unknown>(processPayload),
      request.teamId,
    ),
  };
}

/**
 * @brief Fetch sam-erp current jobs（当前作业）for the current press terminal.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL and session token（会话令牌）for authenticated current job reads.
 * @returns Narrowed current job rows（当前作业行）without raw device/network fields.
 */
export async function fetchPressJobCurrentJobs(
  readJson: GetJson,
  request: FetchPressJobCurrentJobsInput,
): Promise<PressJobCurrentJobRow[]> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_JOB_CURRENT_JOBS_PATH),
      request.sessionToken,
    ),
  );

  return narrowPressJobCurrentJobs(response);
}

/**
 * @brief 更新 ERP press job（压机作业）的 expected duration（预计时长）。
 * @author PopoY
 * @param input ERP 地址、认证令牌和已收窄请求体。
 */
export async function updatePressJobExpectedDuration(
  input: UpdatePressJobExpectedDurationInput,
): Promise<void> {
  const response = await fetch(
    buildErpUrl(input.erpBaseUrl, PRESS_JOB_EXPECTED_DURATION_PATH),
    {
      method: "PUT",
      headers: buildErpJsonHeaders(
        {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        {
          bearerToken: input.sessionToken,
          headers: {
            "X-Correlation-Id": input.correlationId,
          },
        },
      ),
      body: JSON.stringify({
        id: input.request.id,
        expectedDuration: input.request.expectedDuration,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  unwrapErpAjaxResult(await response.json());
}

/**
 * @brief Fetch Qt press mold candidates（压机模具候选）and keep only the approved display fields.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL, session token（会话令牌）, mold query（模具查询）and correlation ID（关联 ID）.
 * @returns Safe mold candidates（模具候选）for the lock flow.
 */
export async function fetchPressMoldCandidates(
  readJson: GetJson,
  request: FetchPressMoldCandidatesInput,
): Promise<PressMoldCandidate[]> {
  const moldNo = request.moldNo.trim();

  if (moldNo.length === 0) {
    return [];
  }

  const url = new URL(buildErpUrl(request.erpBaseUrl, PRESS_MOLD_CANDIDATES_PATH));
  url.searchParams.set("moldNo", moldNo);
  request.lockedMoldNos.forEach((lockedMoldNo) => {
    const value = readNonEmptyString(lockedMoldNo);

    if (value) {
      url.searchParams.append("lockedMoldNos", value);
    }
  });

  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(url.toString(), request.sessionToken, {
      headers: {
        "X-Correlation-Id": request.correlationId,
      },
    }),
  );

  return narrowPressMoldCandidates(response);
}

/**
 * @brief Fetch selected Qt press mold info rows（压机模具明细行）for the lower Table（表格）.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL, session token（会话令牌）, selected moldNo（已选模具号）and correlation ID（关联 ID）.
 * @returns Safe mold info rows（模具明细行）for the lock flow.
 */
export async function fetchPressMoldInfoRows(
  readJson: GetJson,
  request: FetchPressMoldInfoRowsInput,
): Promise<PressMoldInfoRow[]> {
  const moldNo = request.moldNo.trim();

  if (moldNo.length === 0) {
    return [];
  }

  const url = new URL(buildErpUrl(request.erpBaseUrl, PRESS_MOLD_INFO_ROWS_PATH));
  url.searchParams.set("moldNo", moldNo);
  request.lockedMoldNos.forEach((lockedMoldNo) => {
    const value = readNonEmptyString(lockedMoldNo);

    if (value) {
      url.searchParams.append("lockedMoldNos", value);
    }
  });

  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(url.toString(), request.sessionToken, {
      headers: {
        "X-Correlation-Id": request.correlationId,
      },
    }),
  );

  return narrowPressMoldCandidates(response);
}

/**
 * @brief Submit Qt press mold lock（压机锁模）request without forwarding device/network fields（设备/网络字段）.
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param input ERP base URL, session token（会话令牌）and lock request（锁模请求）.
 * @returns Narrowed lock result（锁模结果）from ERP.
 */
export async function lockPressMold(
  sendJson: PostJson,
  input: LockPressMoldInput,
): Promise<PressMoldLockResult> {
  const request = narrowPressMoldLockRequest(input.request);
  const response = unwrapErpAjaxResult<unknown>(
    await sendJson<unknown>(
      buildErpUrl(input.erpBaseUrl, PRESS_MOLD_LOCKS_PATH),
      request,
      {
        bearerToken: input.sessionToken,
        headers: {
          "X-Correlation-Id": request.correlationId,
        },
      },
    ),
  );

  return narrowPressMoldLockResult(response);
}

/**
 * @brief Fetch locked molds（已锁定模具）for Unlock Drawer（解锁抽屉）with safe field narrowing（字段收窄）.
 * @author PopoY
 * @param readJson JSON GET helper used by production and tests.
 * @param request ERP base URL, session token（会话令牌）and correlation ID（关联 ID）.
 * @returns Safe locked mold rows（已锁定模具行）for unlock mold（解锁模具）flow.
 */
export async function fetchPressLockedMolds(
  readJson: GetJson,
  request: FetchPressLockedMoldsInput,
): Promise<PressLockedMoldRow[]> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_LOCKED_MOLDS_PATH),
      request.sessionToken,
      {
        headers: {
          "X-Correlation-Id": request.correlationId,
        },
      },
    ),
  );

  return narrowPressLockedMolds(response);
}

/**
 * @brief Submit unlock mold（解锁模具）request without forwarding device/network fields（设备/网络字段）.
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param input ERP base URL, session token（会话令牌）and unlock request（解锁请求）.
 * @returns Narrowed unlock result（解锁结果）from ERP.
 */
export async function unlockPressMolds(
  sendJson: PostJson,
  input: UnlockPressMoldsInput,
): Promise<PressMoldUnlockResult> {
  const request = narrowPressMoldUnlockRequest(input.request);
  const response = unwrapErpAjaxResult<unknown>(
    await sendJson<unknown>(
      buildErpUrl(input.erpBaseUrl, PRESS_MOLD_UNLOCKS_PATH),
      request,
      {
        bearerToken: input.sessionToken,
        headers: {
          "X-Correlation-Id": request.correlationId,
        },
      },
    ),
  );

  return narrowPressMoldUnlockResult(response);
}

/**
 * @brief Submit ERP Qt start job（开始加工）request with auth（认证）and correlation header（关联请求头）。
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param input ERP base URL, session token（会话令牌）and start request（开始请求）.
 * @returns Narrowed start job（开始加工）result.
 */
export async function startPressJob(
  sendJson: PostJson,
  input: StartPressJobInput,
): Promise<PressJobStartResult> {
  return postPressWorkingRequest(
    sendJson,
    input,
    PRESS_JOB_STARTS_PATH,
    narrowPressJobStartRequest(input.request),
    narrowPressJobBaseResult,
  );
}

/**
 * @brief Submit ERP Qt parameter record（参数记录）request with safe signal snapshot（安全信号快照）。
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param input ERP base URL, session token（会话令牌）and parameter request（参数请求）.
 * @returns Narrowed parameter record（参数记录）result.
 */
export async function recordPressJobParameters(
  sendJson: PostJson,
  input: RecordPressJobParametersInput,
): Promise<PressJobParameterRecordResult> {
  return postPressWorkingRequest(
    sendJson,
    input,
    PRESS_JOB_PARAMETERS_PATH,
    narrowPressJobParameterRecordRequest(input.request),
    narrowPressJobBaseResult,
  );
}

/**
 * @brief Submit ERP Qt complete job（完成加工）request with auth（认证）and correlation header（关联请求头）。
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param input ERP base URL, session token（会话令牌）and complete request（完成请求）.
 * @returns Narrowed complete job（完成加工）result.
 */
export async function completePressJob(
  sendJson: PostJson,
  input: CompletePressJobInput,
): Promise<PressJobCompleteResult> {
  return postPressWorkingRequest(
    sendJson,
    input,
    PRESS_JOB_COMPLETIONS_PATH,
    narrowPressJobCompleteRequest(input.request),
    narrowPressJobBaseResult,
  );
}

/**
 * @brief Submit ERP Qt machine status（设备状态）update with auth（认证）and correlation header（关联请求头）。
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param input ERP base URL, session token（会话令牌）and status request（状态请求）.
 * @returns Narrowed machine status（设备状态）result.
 */
export async function updatePressMachineStatus(
  sendJson: PostJson,
  input: UpdatePressMachineStatusInput,
): Promise<PressMachineStatusUpdateResult> {
  return postPressWorkingRequest(
    sendJson,
    input,
    PRESS_MACHINE_STATUS_PATH,
    narrowPressMachineStatusUpdateRequest(input.request),
    narrowPressMachineStatusUpdateResult,
  );
}

/**
 * @brief Run the bootstrap ERP chain in order so lease fetch stops immediately when login fails.
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param config Native bootstrap config read from the Qt bridge.
 * @param readJson Optional JSON GET helper used to load ERP dict（字典）options after login.
 * @returns Combined bootstrap session payload for downstream driver setup.
 */
export async function loadBootstrapSession(
  sendJson: PostJson,
  config: NativeBootstrapConfig,
  readJson?: GetJson,
): Promise<BootstrapSession> {
  const loginSession = await autoLogin(sendJson, config);
  const leasePackage = await fetchLeasePackage(sendJson, {
    erpBaseUrl: config.erpBaseUrl,
    sessionToken: loginSession.sessionToken,
    stationId: config.stationId,
    granteeHostId: config.granteeHostId,
  });
  const bootstrapConfigApproval: BootstrapConfigApproval = readJson
    ? await fetchBootstrapConfigApproval(readJson, {
        erpBaseUrl: config.erpBaseUrl,
        sessionToken: loginSession.sessionToken,
      }).catch(() => ({
        bootstrapConfigEditable: false,
        bootstrapConfigApprovalState: "unavailable",
      }))
    : {
        bootstrapConfigEditable: false,
        bootstrapConfigApprovalState: "unavailable",
      };
  const parameterGroupOptions = readJson
    ? await fetchParameterGroupOptions(readJson, {
        erpBaseUrl: config.erpBaseUrl,
        sessionToken: loginSession.sessionToken,
      }).catch(() => [])
    : [];
  const pressMoldWorkTypeOptions = readJson
    ? await fetchPressMoldWorkTypeOptions(readJson, {
        erpBaseUrl: config.erpBaseUrl,
        sessionToken: loginSession.sessionToken,
      }).catch(() => [])
    : [];
  const pressMoldCraftOptions = readJson
    ? await fetchPressMoldCraftOptions(readJson, {
        erpBaseUrl: config.erpBaseUrl,
        sessionToken: loginSession.sessionToken,
      }).catch(() => [])
    : [];
  const pressMoldOperatorOptions = readJson
    ? await fetchPressMoldOperatorOptions(readJson, {
        erpBaseUrl: config.erpBaseUrl,
        sessionToken: loginSession.sessionToken,
      }).catch(() => [])
    : [];
  const pressJobLookupData = readJson
    ? await fetchPressJobLookupData(readJson, {
        erpBaseUrl: config.erpBaseUrl,
        sessionToken: loginSession.sessionToken,
      }).catch(() => ({
        teamOptions: [],
        operatorOptions: [],
        processOptions: [],
      }))
    : undefined;
  const pressJobCurrentJobs = readJson
    ? await fetchPressJobCurrentJobs(readJson, {
        erpBaseUrl: config.erpBaseUrl,
        sessionToken: loginSession.sessionToken,
      }).catch(() => [])
    : undefined;

  return {
    ...loginSession,
    ...leasePackage,
    ...bootstrapConfigApproval,
    parameterGroupOptions,
    pressMoldWorkTypeOptions,
    ...(readJson
      ? {
          pressMoldCraftOptions,
          pressMoldOperatorOptions,
          pressJobLookupData,
          pressJobCurrentJobs,
        }
      : {}),
  };
}

/**
 * @brief Build an ERP endpoint URL from the configured base URL and relative API path.
 * @param erpBaseUrl ERP service base URL from native config.
 * @param pathname Relative API path for the target endpoint.
 * @returns Absolute ERP endpoint URL.
 */
function buildErpUrl(erpBaseUrl: string, pathname: string): string {
  return new URL(pathname, erpBaseUrl).toString();
}

/**
 * @brief Normalize ERP lease fields that may arrive as objects or JSON strings.
 * @param value Raw ERP lease field value.
 * @param fieldName Field name used in parse failure messages.
 * @returns Parsed object value for downstream Driver Service calls.
 */
function parseLeaseJsonField<T>(value: T | string, fieldName: string): T {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Invalid ${fieldName} JSON.`, { cause: error });
  }
}

/**
 * @brief Narrow raw ERP dict（字典）payload into stable options for UI display.
 * @author PopoY
 * @param value ERP AjaxResult data（响应数据）or direct array payload.
 * @returns Safe dict options, dropping rows without usable value or label.
 */
function narrowDictOptions(value: unknown): ErpDictOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const dictValue = record?.dictValue;
    const dictLabel = record?.dictLabel;

    if (
      dictValue === undefined ||
      dictValue === null ||
      dictValue === "" ||
      typeof dictLabel !== "string" ||
      dictLabel.length === 0
    ) {
      return [];
    }

    return [
      {
        dictValue: String(dictValue),
        dictLabel,
      },
    ];
  });
}

/**
 * @brief Narrow craft rows（工艺行）into dict options（字典选项）for display mapping（显示映射）.
 * @author PopoY
 * @param value Raw ERP craft payload（工艺载荷）.
 * @returns craftCode to craftName dict options（工艺字典选项）.
 */
function narrowCraftDictOptions(value: unknown): ErpDictOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const dictValue = readNonEmptyString(record?.craftCode);
    const dictLabel = readNonEmptyString(record?.craftName);

    return dictValue && dictLabel ? [{ dictValue, dictLabel }] : [];
  });
}

/**
 * @brief Narrow user rows（用户行）into dict options（字典选项）for operator display mapping（作业员显示映射）.
 * @author PopoY
 * @param value Raw ERP user payload（用户载荷）.
 * @returns userName/dictValue to nickName/dictLabel dict options（用户字典选项）.
 */
function narrowUserDictOptions(value: unknown): ErpDictOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const dictValue =
      readNonEmptyString(record?.dictValue) ?? readNonEmptyString(record?.userName);
    const dictLabel =
      readNonEmptyString(record?.dictLabel) ?? readNonEmptyString(record?.nickName);

    return dictValue && dictLabel ? [{ dictValue, dictLabel }] : [];
  });
}

/**
 * @brief Narrow sam-erp team rows（班组行）into safe Select（选择器）options（选项）.
 * @author PopoY
 * @param value Raw ERP AjaxResult data（响应数据）or direct array payload.
 * @returns Safe team options（班组选项）.
 */
function narrowPressJobTeamOptions(value: unknown): PressJobTeamOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const teamId = readNonEmptyString(record?.code);
    const teamName = readNonEmptyString(record?.name);

    if (!teamId || !teamName) {
      return [];
    }

    return [{ teamId, teamName }];
  });
}

/**
 * @brief Narrow sam-erp current user（当前用户）payload into default press job selections（默认选择）.
 * @author PopoY
 * @param value Raw ERP AjaxResult data（响应数据）or direct object payload.
 * @returns Default team/operator IDs when ERP provides them.
 */
function narrowPressJobCurrentUser(value: unknown): {
  defaultTeamId?: string;
  defaultOperatorId?: string;
} {
  const record = readRecord(value);

  return {
    defaultTeamId: readNonEmptyString(record?.plineCode),
    defaultOperatorId: readNonEmptyString(record?.userName),
  };
}

/**
 * @brief Narrow sam-erp user rows（人员行）into safe Select（选择器）options（选项）.
 * @author PopoY
 * @param value Raw ERP AjaxResult data（响应数据）or direct array payload.
 * @param teamId Selected team（班组）used for cascade ownership.
 * @returns Safe operator options（人员选项）.
 */
function narrowPressJobOperatorOptions(
  value: unknown,
  teamId: string,
): PressJobOperatorOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const operatorId = readNonEmptyString(record?.userName);
    const operatorName = readNonEmptyString(record?.nickName) ?? operatorId;

    if (!operatorId || !operatorName) {
      return [];
    }

    return [{ operatorId, operatorName, teamId }];
  });
}

/**
 * @brief Narrow sam-erp craft rows（工艺行）into safe Select（选择器）options（选项）.
 * @author PopoY
 * @param value Raw ERP AjaxResult data（响应数据）or direct array payload.
 * @param teamId Selected team（班组）used for cascade ownership.
 * @returns Safe process options（预选工艺选项）.
 */
function narrowPressJobProcessOptions(
  value: unknown,
  teamId: string,
): PressJobProcessOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const processId = readNonEmptyString(record?.craftCode);
    const processName = readNonEmptyString(record?.craftName) ?? processId;

    if (!processId || !processName) {
      return [];
    }

    return [{ processId, processName, teamId }];
  });
}

/**
 * @brief Narrow sam-erp current job rows（当前作业行）into safe table rows（表格行）.
 * @author PopoY
 * @param value Raw ERP AjaxResult data（响应数据）or direct array payload.
 * @returns Safe current job rows（当前作业行）without raw device/network identifiers.
 */
function narrowPressJobCurrentJobs(value: unknown): PressJobCurrentJobRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const pressJobId =
      typeof record?.id === "number" && Number.isSafeInteger(record.id)
        ? record.id
        : undefined;
    const pressName = readNonEmptyString(record?.deviceName);
    const moldNo = readNonEmptyString(record?.mouldCode);
    const plannedDurationHours = readNonEmptyString(record?.expectedDuration);
    const startedAt = readNonEmptyString(record?.startTime);
    const status = readNonEmptyString(record?.status);

    if (!pressName && !moldNo && !plannedDurationHours && !startedAt && !status) {
      return [];
    }
    // @author PopoY: 无 ID 且缺少稳定安全业务字段时无法建立唯一身份，直接丢弃。
    if (pressJobId === undefined && !pressName && !moldNo && !startedAt) {
      return [];
    }

    return [
      {
        localJobSessionId: createPressJobLocalSessionId({
          pressJobId,
          pressName,
          moldNo,
          startedAt,
        }),
        ...(pressJobId === undefined ? {} : { pressJobId }),
        pressName: pressName ?? "已绑定压机",
        moldNo,
        plannedDurationHours,
        startedAt,
        status,
      },
    ];
  });
}

/**
 * @brief 仅用已收窄的稳定业务字段生成 current job（当前作业）本地身份。
 * @author PopoY
 * @param row ERP 作业 ID 或安全展示字段。
 * @returns 不受数组位置、预计时长和状态变化影响的确定性身份。
 */
function createPressJobLocalSessionId(
  row: Pick<
    PressJobCurrentJobRow,
    "pressJobId" | "pressName" | "moldNo" | "startedAt"
  >,
): string {
  if (row.pressJobId !== undefined) {
    return `press-job-id-${row.pressJobId}`;
  }

  return `press-job-local-${encodeURIComponent(
    JSON.stringify([
      row.pressName ?? "",
      row.moldNo ?? "",
      row.startedAt ?? "",
    ]),
  )}`;
}

/**
 * @brief Narrow ERP mold candidate（模具候选）rows into safe UI（界面）data.
 * @author PopoY
 * @param value Raw ERP candidate payload（候选载荷）.
 * @returns Candidate rows（候选行）without sensitive or device/network fields（敏感或设备网络字段）.
 */
function narrowPressMoldCandidates(value: unknown): PressMoldCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const moldNo =
      readNonEmptyString(record?.moldNo) ??
      readNonEmptyString(record?.mouldCode) ??
      readNonEmptyString(record?.code);

    if (!moldNo) {
      return [];
    }

    const candidate: PressMoldCandidate = { moldNo };
    const makeOrderNumber = readNonEmptyString(record?.makeOrderNumber);
    const stages = readNonEmptyString(record?.stages);
    const projectCode = readNonEmptyString(record?.projectCode);
    const name = readNonEmptyString(record?.name);
    const defaultProcessId = readNonEmptyString(record?.defaultProcessId);

    if (makeOrderNumber) candidate.makeOrderNumber = makeOrderNumber;
    if (stages) candidate.stages = stages;
    if (projectCode) candidate.projectCode = projectCode;
    if (name) candidate.name = name;
    if (defaultProcessId) candidate.defaultProcessId = defaultProcessId;

    return [candidate];
  });
}

/**
 * @brief Narrow ERP locked mold rows（已锁定模具行）to safe UI（界面）fields.
 * @author PopoY
 * @param value Raw ERP locked mold payload（已锁定模具载荷）.
 * @returns Locked mold rows（已锁定模具行）without sensitive or device/network fields（敏感或设备网络字段）.
 */
function narrowPressLockedMolds(value: unknown): PressLockedMoldRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const moldNo =
      readNonEmptyString(record?.moldNo) ??
      readNonEmptyString(record?.mouldCode) ??
      readNonEmptyString(record?.code);

    if (!moldNo) {
      return [];
    }

    const row: PressLockedMoldRow = { moldNo };
    const stages = readNonEmptyString(record?.stages);
    const makeOrderNumber = readNonEmptyString(record?.makeOrderNumber);
    const craftName = readNonEmptyString(record?.craftName);
    // @author PopoY: 兼容旧 endpoint（端点）误把 code（编码）放进展示字段的 locked molds（已锁定模具）响应。
    const craftCode = readNonEmptyString(record?.craftCode) ?? craftName;
    const workTimeTypeText = readNonEmptyString(record?.workTimeTypeText);
    const workTimeType =
      readNonEmptyString(record?.workTimeType) ??
      readNonEmptyString(record?.mouldMakeOrderType) ??
      workTimeTypeText;
    const startedAt =
      readNonEmptyString(record?.startedAt) ?? readNonEmptyString(record?.startTime);
    const operatorName = readNonEmptyString(record?.operatorName);
    const operatorId =
      readNonEmptyString(record?.operator) ??
      readNonEmptyString(record?.operatorId) ??
      readNonEmptyString(record?.userName) ??
      operatorName;
    const operatorDisplayName =
      operatorName ??
      readNonEmptyString(record?.operatorNickName) ??
      operatorId;
    const moldJobId = readNonEmptyString(record?.moldJobId);

    if (stages) row.stages = stages;
    if (makeOrderNumber) row.makeOrderNumber = makeOrderNumber;
    if (craftCode) row.craftCode = craftCode;
    if (craftName) row.craftName = craftName;
    if (workTimeType) row.workTimeType = workTimeType;
    if (workTimeTypeText) row.workTimeTypeText = workTimeTypeText;
    if (startedAt) row.startedAt = startedAt;
    if (operatorId) row.operatorId = operatorId;
    if (operatorDisplayName) row.operatorName = operatorDisplayName;
    if (moldJobId) row.moldJobId = moldJobId;

    return [row];
  });
}

/**
 * @brief Rebuild lock request（锁模请求）from whitelist fields before sending it to ERP.
 * @author PopoY
 * @param request UI-provided lock request（锁模请求）that may carry extra runtime fields.
 * @returns Request body（请求体）containing only the ERP contract（接口契约）fields.
 */
function narrowPressMoldLockRequest(
  request: PressMoldLockRequest,
): PressMoldLockRequest {
  return {
    operatorId: request.operatorId,
    teamId: request.teamId,
    processId: request.processId,
    selectedRows: request.selectedRows.map(narrowPressMoldLockSelection),
    correlationId: request.correlationId,
  };
}

/**
 * @brief Rebuild unlock request（解锁请求）from whitelist（白名单）fields before submit.
 * @author PopoY
 * @param request UI-provided unlock request（解锁请求）that may carry extra runtime fields.
 * @returns Request body（请求体）containing only the ERP unlock contract（解锁接口契约）fields.
 */
function narrowPressMoldUnlockRequest(
  request: PressMoldUnlockRequest,
): PressMoldUnlockRequest {
  return {
    operatorId: request.operatorId,
    moldNos: request.moldNos.flatMap((moldNo) => {
      const value = readNonEmptyString(moldNo);
      return value ? [value] : [];
    }),
    correlationId: request.correlationId,
  };
}

/**
 * @brief 发送 press working（压机作业）Qt POST 请求，并统一添加 auth/correlation headers（认证/关联请求头）。
 * @author PopoY
 * @param sendJson JSON POST helper used by production and tests.
 * @param input 包含 erpBaseUrl（企业资源计划地址）和 sessionToken（会话令牌）的输入。
 * @param pathname ERP Qt endpoint（端点）路径。
 * @param request 已收窄的 request body（请求体）。
 * @param narrowResult 响应收窄函数。
 * @returns 收窄后的响应结果。
 */
async function postPressWorkingRequest<TRequest extends { correlationId: string }, TResult>(
  sendJson: PostJson,
  input: FetchPressJobLookupDataInput,
  pathname: string,
  request: TRequest,
  narrowResult: (value: unknown) => TResult,
): Promise<TResult> {
  try {
    const response = unwrapErpAjaxResult<unknown>(
      await sendJson<unknown>(buildErpUrl(input.erpBaseUrl, pathname), request, {
        bearerToken: input.sessionToken,
        headers: {
          "X-Correlation-Id": request.correlationId,
        },
      }),
    );

    return narrowResult(response);
  } catch (error) {
    throw createPressWorkingClientError(error);
  }
}

/**
 * @brief 收窄 start job（开始加工）请求体，丢弃设备网络字段。
 * @author PopoY
 * @param request UI（界面）传入的请求对象。
 * @returns ERP Qt start job（开始加工）请求白名单字段。
 */
function narrowPressJobStartRequest(
  request: PressJobStartRequest,
): PressJobStartRequest {
  return {
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    localJobSessionId: request.localJobSessionId,
    operatorId: request.operatorId,
    teamId: request.teamId,
    processId: request.processId,
    expectedDuration: request.expectedDuration,
  };
}

/**
 * @brief 收窄 parameter record（参数记录）请求体，并过滤信号快照里的敏感键。
 * @author PopoY
 * @param request UI（界面）传入的参数记录请求。
 * @returns ERP Qt parameter record（参数记录）请求白名单字段。
 */
function narrowPressJobParameterRecordRequest(
  request: PressJobParameterRecordRequest,
): PressJobParameterRecordRequest {
  return {
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    parameterIdempotencyKey: request.parameterIdempotencyKey,
    localJobSessionId: request.localJobSessionId,
    type: request.type,
    signalValues: narrowPressSignalValues(request.signalValues),
  };
}

/**
 * @brief 收窄 complete job（完成加工）请求体，丢弃 raw signal config（原始信号配置）等字段。
 * @author PopoY
 * @param request UI（界面）传入的完成加工请求。
 * @returns ERP Qt complete job（完成加工）请求白名单字段。
 */
function narrowPressJobCompleteRequest(
  request: PressJobCompleteRequest,
): PressJobCompleteRequest {
  return {
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    localJobSessionId: request.localJobSessionId,
    operatorId: request.operatorId,
  };
}

/**
 * @brief 收窄 machine status（设备状态）请求体，只保留业务状态字段。
 * @author PopoY
 * @param request UI（界面）传入的设备状态请求。
 * @returns ERP Qt machine status（设备状态）请求白名单字段。
 */
function narrowPressMachineStatusUpdateRequest(
  request: PressMachineStatusUpdateRequest,
): PressMachineStatusUpdateRequest {
  return {
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    localJobSessionId: request.localJobSessionId,
    status: request.status,
    reason: request.reason,
  };
}

/**
 * @brief Rebuild one selected mold row（选中模具行）from lock whitelist（锁模白名单）fields.
 * @author PopoY
 * @param row UI-provided selected row（选中行）that may carry extra runtime fields.
 * @returns Selected row（选中行）safe for ERP lock submit（锁模提交）.
 */
function narrowPressMoldLockSelection(
  row: PressMoldLockSelection,
): PressMoldLockSelection {
  const selection: PressMoldLockSelection = {
    moldNo: row.moldNo,
    makeOrderNumber: row.makeOrderNumber,
    craftCode: row.craftCode,
  };

  if (row.stages !== undefined) {
    selection.stages = row.stages;
  }

  if (row.projectCode !== undefined) {
    selection.projectCode = row.projectCode;
  }

  return selection;
}

/**
 * @brief Narrow ERP lock result（锁模结果）to the locked mold numbers（已锁定模具号）only.
 * @author PopoY
 * @param value Raw ERP lock result payload（锁模结果载荷）.
 * @returns Safe lock result（锁模结果）with missing data normalized to an empty list.
 */
function narrowPressMoldLockResult(value: unknown): PressMoldLockResult {
  const record = readRecord(value);
  const lockedMoldNos = Array.isArray(record?.lockedMoldNos)
    ? record.lockedMoldNos.flatMap((item) => {
        const moldNo = readNonEmptyString(item);
        return moldNo ? [moldNo] : [];
      })
    : [];

  return { lockedMoldNos };
}

/**
 * @brief Narrow ERP unlock result（解锁结果）to unlocked mold numbers（已解锁模具号）only.
 * @author PopoY
 * @param value Raw ERP unlock result payload（解锁结果载荷）.
 * @returns Safe unlock result（解锁结果）with missing data normalized to an empty list.
 */
function narrowPressMoldUnlockResult(value: unknown): PressMoldUnlockResult {
  const record = readRecord(value);
  const unlockedMoldNos = Array.isArray(record?.unlockedMoldNos)
    ? record.unlockedMoldNos.flatMap((item) => {
        const moldNo = readNonEmptyString(item);
        return moldNo ? [moldNo] : [];
      })
    : [];

  return { unlockedMoldNos };
}

/**
 * @brief 收窄 press job（压机作业）通用结果字段。
 * @author PopoY
 * @param value ERP Qt response（响应）payload（载荷）。
 * @returns 通用 result（结果）白名单字段。
 */
function narrowPressJobBaseResult(
  value: unknown,
): PressJobStartResult & PressJobParameterRecordResult & PressJobCompleteResult {
  const record = readRecord(value);

  return {
    correlationId: readNonEmptyString(record?.correlationId) ?? "",
    localJobSessionId: readNonEmptyString(record?.localJobSessionId) ?? "",
    resultCode: readNonEmptyString(record?.resultCode) ?? "OK",
    message: readNonEmptyString(record?.message),
  };
}

/**
 * @brief 收窄 machine status（设备状态）更新结果字段。
 * @author PopoY
 * @param value ERP Qt response（响应）payload（载荷）。
 * @returns machine status（设备状态）结果白名单字段。
 */
function narrowPressMachineStatusUpdateResult(
  value: unknown,
): PressMachineStatusUpdateResult {
  const baseResult = narrowPressJobBaseResult(value);
  const record = readRecord(value);
  const status = readNonEmptyString(record?.status);

  return {
    ...baseResult,
    status: status === "0" || status === "9" ? status : undefined,
  };
}

/**
 * @brief 收窄参数快照，过滤敏感字段名，避免 ERP request（请求）携带设备网络细节。
 * @author PopoY
 * @param signalValues 前端收到的安全信号快照。
 * @returns 过滤后的信号快照。
 */
function narrowPressSignalValues(
  signalValues: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(signalValues).filter(
      ([key]) => !PRESS_SIGNAL_VALUE_FORBIDDEN_KEYS.has(key.toLowerCase()),
    ),
  );
}

/**
 * @brief 创建 press working（压机作业）客户端错误，保留中文业务错误并隐藏原始异常细节。
 * @author PopoY
 * @param error 原始错误。
 * @returns 可展示的中文错误。
 */
function createPressWorkingClientError(error: unknown): Error {
  if (error instanceof Error && /[\u4e00-\u9fff]/u.test(error.message)) {
    return error;
  }

  return new Error("压机作业请求失败，请查看诊断日志。", { cause: error });
}

/**
 * @brief Unwrap ERP AjaxResult responses and reject business failures before field narrowing.
 * @author PopoY
 * @param response Raw ERP response that may be a plain payload or AjaxResult wrapper.
 * @returns Plain ERP payload when present.
 */
function unwrapErpAjaxResult<T>(response: unknown): T {
  const responseRecord = readRecord(response);

  if (!responseRecord || !("code" in responseRecord)) {
    return response as T;
  }

  if (responseRecord.code !== 200) {
    throw new Error(readAjaxResultMessage(responseRecord));
  }

  return "data" in responseRecord ? (responseRecord.data as T) : (response as T);
}

/**
 * @brief Reject the legacy ERP bootstrap placeholder before it is sent to Driver Real Mode.
 * @param leasePackage Parsed ERP lease package.
 */
function rejectBootstrapPlaceholderLeasePackage(leasePackage: LeasePackage): void {
  // PopoY: these markers prove ERP has not produced a real signed device lease yet.
  if (
    readObjectField(leasePackage.signedLease, "signature") ===
      BOOTSTRAP_PLACEHOLDER_SIGNATURE ||
    readObjectField(leasePackage.signedLease, "targetEndpoint") ===
      BOOTSTRAP_PLACEHOLDER_ENDPOINT ||
    readObjectField(leasePackage.signalConfig, "mode") === BOOTSTRAP_PLACEHOLDER_MODE
  ) {
    throw createBootstrapError(
      "ERP_LEASE_PLACEHOLDER",
      "ERP lease package is still bootstrap placeholder.",
    );
  }
}

/**
 * @brief Safely read one field from an unknown ERP payload object.
 * @param value Unknown ERP payload value after optional JSON parsing.
 * @param fieldName Field name to read.
 * @returns Field value when the payload is an object, otherwise undefined.
 */
function readObjectField(value: unknown, fieldName: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[fieldName]
    : undefined;
}

/**
 * @brief Narrow the ERP auto-login payload to the Task3-approved bootstrap session fields only.
 * @param response Raw ERP auto-login response object.
 * @returns Auto-login payload stripped down to the allowed bootstrap fields.
 */
function narrowAutoLoginResponse(response: unknown): AutoLoginResponse {
  const responseRecord = readRecord(response);
  const stationContext = readRecord(responseRecord?.stationContext);

  if (
    !responseRecord ||
    typeof responseRecord.sessionToken !== "string" ||
    !stationContext
  ) {
    throw new Error("Invalid ERP auto-login response.");
  }

  // PopoY: Runtime payloads may contain extra ERP fields, so bootstrap keeps only the approved session shape.
  return {
    sessionToken: responseRecord.sessionToken,
    stationContext: stationContext as AutoLoginResponse["stationContext"],
    defaultDeviceScope: responseRecord.defaultDeviceScope as
      | AutoLoginResponse["defaultDeviceScope"]
      | undefined,
    businessContext: responseRecord.businessContext as
      | AutoLoginResponse["businessContext"]
      | undefined,
  };
}

/**
 * @brief Read an object record from an unknown ERP response value.
 * @author PopoY
 * @param value Unknown ERP response value.
 * @returns Record value when the response is an object, otherwise null.
 */
function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * @brief Read a non-empty string（非空字符串）from an unknown ERP field（字段）.
 * @author PopoY
 * @param value Unknown ERP field（字段）value.
 * @returns String value when present, otherwise undefined.
 */
function readNonEmptyString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

/**
 * @brief Read the ERP AjaxResult message without exposing request payloads or tokens.
 * @author PopoY
 * @param responseRecord ERP AjaxResult-like response record.
 * @returns Message suitable for error cause text.
 */
function readAjaxResultMessage(responseRecord: Record<string, unknown>): string {
  return typeof responseRecord.msg === "string" && responseRecord.msg.length > 0
    ? responseRecord.msg
    : "ERP business request failed.";
}

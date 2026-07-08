/**
 * @file driverClient.ts - 封装 Driver Service（驱动服务）客户端请求。
 * @author PopoY
 * @created 2026-06-25
 * @brief 实现 applyLeaseAndConfig（应用租约与配置）、getSignalSnapshot（获取信号快照）和 device command（设备命令）客户端。
 */

import type {
  ApplyLeaseAndConfigRequest,
  ApplyLeaseAndConfigResponse,
  GetSignalSnapshotRequest,
  GetSignalSnapshotResponse,
  PressDeviceCommandRequest,
  PressDeviceCommandResponse,
} from "../domain/driver";
import type { SignalConfig, SignedLease } from "../domain/lease";

const APPLY_LEASE_AND_CONFIG_PATH = "/applyLeaseAndConfig";
const GET_SIGNAL_SNAPSHOT_PATH = "/getSignalSnapshot";
const PRECHECK_DEVICE_COMMAND_PATH = "/precheckDeviceCommand";
const EXECUTE_DEVICE_COMMAND_PATH = "/executeDeviceCommand";

/**
 * @brief Define the JSON POST helper contract used by the Driver Service client.
 */
export type PostJson = <TResponse>(
  url: string,
  body: unknown,
  timeoutMs: number,
) => Promise<TResponse>;

/**
 * @brief 表示 Driver Service（驱动服务）传输层 timeout（超时）错误。
 */
type DriverTimeoutError = Error & {
  code: "DEVICE_TIMEOUT";
  resultCode: "DEVICE_TIMEOUT";
  correlationId?: string;
};

/**
 * @brief Model the transport fields shared by Driver Service commands.
 */
export type DriverCommandInput = {
  driverBaseUrl: string;
  correlationId: string;
  timeoutMs: number;
};

/**
 * @brief Model the applyLeaseAndConfig call input before the request is narrowed.
 */
export type ApplyLeaseAndConfigInput = DriverCommandInput & {
  signedLease: SignedLease;
  signalConfig: SignalConfig;
};

/**
 * @brief Model the getSignalSnapshot call input before the request is narrowed.
 */
export type GetSignalSnapshotInput = DriverCommandInput;

/**
 * @brief Model executePressDeviceCommand（执行压机设备命令）调用输入，driverBaseUrl（驱动地址）不进入请求体。
 * @author PopoY
 */
export type ExecutePressDeviceCommandInput = DriverCommandInput &
  PressDeviceCommandRequest;

/**
 * @brief Build the whitelisted applyLeaseAndConfig request body from the caller input.
 * @param input Driver apply input with transport metadata and approved lease payload.
 * @returns Narrowed request body without raw endpoint override fields.
 */
export function buildApplyLeaseRequest(
  input: Pick<
    ApplyLeaseAndConfigInput,
    "correlationId" | "timeoutMs" | "signedLease" | "signalConfig"
  >,
): ApplyLeaseAndConfigRequest {
  return {
    correlationId: input.correlationId,
    timeoutMs: input.timeoutMs,
    signedLease: input.signedLease,
    signalConfig: input.signalConfig,
  };
}

/**
 * @brief Build the minimal getSignalSnapshot request body from the caller input.
 * @param input Driver snapshot input with transport metadata only.
 * @returns Narrowed snapshot request body.
 */
export function buildSignalSnapshotRequest(
  input: Pick<GetSignalSnapshotInput, "correlationId" | "timeoutMs">,
): GetSignalSnapshotRequest {
  return {
    correlationId: input.correlationId,
    timeoutMs: input.timeoutMs,
  };
}

/**
 * @brief 构建 /executeDeviceCommand（执行设备命令）请求体，只保留五个白名单字段。
 * @author PopoY
 * @param input 调用方输入，可能携带运行时额外字段。
 * @returns 只包含 Driver Service（驱动服务）契约字段的请求体。
 */
export function buildPressDeviceCommandRequest(
  input: PressDeviceCommandRequest,
): PressDeviceCommandRequest {
  return {
    correlationId: input.correlationId,
    commandName: input.commandName,
    localJobSessionId: input.localJobSessionId,
    idempotencyKey: input.idempotencyKey,
    timeoutMs: input.timeoutMs,
  };
}

/**
 * @brief Call the Driver Service applyLeaseAndConfig endpoint with the approved request shape only.
 * @param sendJson JSON POST helper used by production code and contract tests.
 * @param input Driver apply input with base URL, timeout, and lease payload.
 * @returns Narrowed Driver Service apply response.
 */
export async function applyLeaseAndConfig(
  sendJson: PostJson,
  input: ApplyLeaseAndConfigInput,
): Promise<ApplyLeaseAndConfigResponse> {
  const response = await sendJson<ApplyLeaseAndConfigResponse>(
    buildDriverUrl(input.driverBaseUrl, APPLY_LEASE_AND_CONFIG_PATH),
    buildApplyLeaseRequest(input),
    input.timeoutMs,
  );

  return narrowApplyLeaseResponse(response);
}

/**
 * @brief Call the Driver Service getSignalSnapshot endpoint and return a typed signal payload.
 * @param sendJson JSON POST helper used by production code and contract tests.
 * @param input Driver snapshot input with base URL and transport metadata.
 * @returns Narrowed Driver Service signal snapshot response.
 */
export async function getSignalSnapshot(
  sendJson: PostJson,
  input: GetSignalSnapshotInput,
): Promise<GetSignalSnapshotResponse> {
  const response = await sendJson<GetSignalSnapshotResponse>(
    buildDriverUrl(input.driverBaseUrl, GET_SIGNAL_SNAPSHOT_PATH),
    buildSignalSnapshotRequest(input),
    input.timeoutMs,
  );

  return narrowSignalSnapshotResponse(response);
}

/**
 * @brief 调用 Driver Service（驱动服务）/executeDeviceCommand（执行设备命令）并收窄响应字段。
 * @author PopoY
 * @param sendJson JSON POST helper（辅助函数），方便测试注入。
 * @param input 压机设备动作输入，包含 driverBaseUrl（驱动地址）和五个命令字段。
 * @returns 收窄后的设备命令响应。
 */
export async function executePressDeviceCommand(
  sendJson: PostJson,
  input: ExecutePressDeviceCommandInput,
): Promise<PressDeviceCommandResponse> {
  const response = await sendJson<PressDeviceCommandResponse>(
    buildDriverUrl(input.driverBaseUrl, EXECUTE_DEVICE_COMMAND_PATH),
    buildPressDeviceCommandRequest(input),
    input.timeoutMs,
  );

  return narrowPressDeviceCommandResponse(response);
}

/**
 * @brief 调用 Driver Service（驱动服务）/precheckDeviceCommand（设备命令前置校验）并收窄响应字段。
 * @author PopoY
 * @param sendJson JSON POST helper（辅助函数），方便测试注入。
 * @param input 压机设备动作输入，包含 driverBaseUrl（驱动地址）和五个命令字段。
 * @returns 收窄后的设备命令前置校验响应。
 */
export async function precheckPressDeviceCommand(
  sendJson: PostJson,
  input: ExecutePressDeviceCommandInput,
): Promise<PressDeviceCommandResponse> {
  const response = await sendJson<PressDeviceCommandResponse>(
    buildDriverUrl(input.driverBaseUrl, PRECHECK_DEVICE_COMMAND_PATH),
    buildPressDeviceCommandRequest(input),
    input.timeoutMs,
  );

  return narrowPressDeviceCommandResponse(response);
}

/**
 * @brief Post JSON to the Driver Service while enforcing timeout with AbortController.
 * @param url Target Driver Service endpoint URL.
 * @param body JSON-serializable request payload.
 * @param timeoutMs Command timeout in milliseconds.
 * @returns Parsed JSON response body.
 */
export async function postJson<TResponse>(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<TResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseBody = await readJsonResponse<TResponse>(response);

    if (!response.ok) {
      if (responseBody !== null) {
        return responseBody;
      }

      throw new Error(`HTTP ${response.status}`);
    }

    if (responseBody === null) {
      throw new Error("Driver Service returned an empty JSON response.");
    }

    return responseBody;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createDriverTimeoutError(body, timeoutMs, error);
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * @brief 创建可被 Error Panel（错误面板）识别的 DEVICE_TIMEOUT（设备超时）错误。
 * @author PopoY
 * @param body 原始 Driver Service（驱动服务）请求体，用于尽力保留 correlationId（关联 ID）。
 * @param timeoutMs 本次请求的 timeout（超时）毫秒数。
 * @param cause 原始 AbortError（中止错误）。
 * @returns 带稳定 resultCode（结果码）的 timeout（超时）错误。
 */
function createDriverTimeoutError(
  body: unknown,
  timeoutMs: number,
  cause: unknown,
): DriverTimeoutError {
  const timeoutError = new Error(`设备通信超时，请检查设备连接状态后重试。超时：${timeoutMs}ms。`) as DriverTimeoutError;
  timeoutError.code = "DEVICE_TIMEOUT";
  timeoutError.resultCode = "DEVICE_TIMEOUT";
  timeoutError.cause = cause;

  const correlationId = readCorrelationId(body);
  if (correlationId) {
    timeoutError.correlationId = correlationId;
  }

  return timeoutError;
}

/**
 * @brief 从 unknown（未知）请求体中读取 correlationId（关联 ID）。
 * @author PopoY
 * @param body 原始 JSON 请求体。
 * @returns 存在时返回 correlationId（关联 ID），否则返回空字符串。
 */
function readCorrelationId(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const correlationId = (body as Record<string, unknown>).correlationId;
  return typeof correlationId === "string" ? correlationId : "";
}

/**
 * @brief Build the Driver Service endpoint URL from the configured base URL and command path.
 * @param driverBaseUrl Local Driver Service base URL from native config.
 * @param pathname Command path appended to the configured base URL.
 * @returns Absolute Driver Service endpoint URL.
 */
function buildDriverUrl(driverBaseUrl: string, pathname: string): string {
  return new URL(pathname, driverBaseUrl).toString();
}

/**
 * @brief Parse a JSON response body when present and return null for empty or non-JSON payloads.
 * @param response Fetch response returned by the Driver Service request.
 * @returns Parsed JSON body or null when the body is unavailable.
 */
async function readJsonResponse<TResponse>(
  response: Response,
): Promise<TResponse | null> {
  try {
    return (await response.json()) as TResponse;
  } catch {
    return null;
  }
}

/**
 * @brief Narrow the raw applyLeaseAndConfig response to the fields approved for bootstrap.
 * @param response Raw Driver Service apply response.
 * @returns Narrowed apply response for later dashboard and error mapping tasks.
 */
function narrowApplyLeaseResponse(
  response: ApplyLeaseAndConfigResponse,
): ApplyLeaseAndConfigResponse {
  return {
    correlationId: response.correlationId,
    resultCode: response.resultCode,
    message: response.message,
    leaseState: response.leaseState,
    deviceSessionState: response.deviceSessionState,
    leaseId: response.leaseId,
    targetDeviceId: response.targetDeviceId,
    fencingToken: response.fencingToken,
  };
}

/**
 * @brief Narrow the raw signal snapshot response to the typed payload required by bootstrap.
 * @param response Raw Driver Service signal snapshot response.
 * @returns Narrowed snapshot response with correlationId and signal values only.
 */
function narrowSignalSnapshotResponse(
  response: GetSignalSnapshotResponse,
): GetSignalSnapshotResponse {
  return {
    correlationId: response.correlationId,
    resultCode: response.resultCode,
    signalValues: response.signalValues,
  };
}

/**
 * @brief 收窄设备命令响应，避免 raw response（原始响应）里的设备字段进入 UI（界面）。
 * @author PopoY
 * @param response Driver Service（驱动服务）原始响应。
 * @returns 只包含前端允许读取的响应字段。
 */
function narrowPressDeviceCommandResponse(
  response: PressDeviceCommandResponse,
): PressDeviceCommandResponse {
  return {
    correlationId: response.correlationId,
    commandName: response.commandName,
    localJobSessionId: response.localJobSessionId,
    idempotencyKey: response.idempotencyKey,
    resultCode: response.resultCode,
    message: response.message,
    leaseState: response.leaseState,
    deviceSessionState: response.deviceSessionState,
    completedSteps: Array.isArray(response.completedSteps)
      ? response.completedSteps
      : [],
    failedSteps: Array.isArray(response.failedSteps) ? response.failedSteps : [],
  };
}

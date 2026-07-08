/**
 * @file driverDeviceEventsClient.ts - 封装 Driver device events（驱动设备事件）订阅客户端。
 * @author PopoY
 * @created 2026-07-02
 * @brief 使用原生 EventSource（事件源）订阅 /deviceEvents/stream（设备事件流）并收窄 payload（载荷）。
 */

import type {
  PressDeviceCommandName,
  PressDeviceCommandResultCode,
  PressDeviceEvent,
  PressDeviceEventName,
  PressDeviceEventSnapshotValue,
} from "../domain/driver";

/**
 * @brief 定义 device event subscription（设备事件订阅）清理句柄。
 * @author PopoY
 */
export type DriverDeviceEventsSubscription = {
  close: () => void;
};

const DEVICE_EVENT_FORBIDDEN_SIGNAL_CODES = new Set([
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
 * @brief 定义需要通过 addEventListener（事件监听）订阅的 named event（命名事件）。
 * @author PopoY
 */
const DEVICE_EVENT_NAMES: PressDeviceEventName[] = [
  "signalSnapshotChanged",
  "pressDownCountMonitorStarted",
  "pressDownCountChanged",
  "pressDownCountThresholdReached",
  "pressDownCountMonitorFailed",
  "pressDownCountMonitorStopped",
];

/**
 * @brief 订阅 Driver Service（驱动服务）设备事件流，不向 URL（地址）追加敏感 query params（查询参数）。
 * @author PopoY
 * @param driverBaseUrl Driver Service（驱动服务）base URL（基础地址）。
 * @param onEvent 收到安全事件时调用。
 * @param onError 解析或连接失败时调用。
 * @returns 可关闭 EventSource（事件源）的 subscription（订阅）。
 */
export function subscribeDriverDeviceEvents(
  driverBaseUrl: string,
  onEvent: (event: PressDeviceEvent) => void,
  onError: (error: Error) => void,
): DriverDeviceEventsSubscription {
  const eventSource = new EventSource(
    new URL("/deviceEvents/stream", driverBaseUrl).toString(),
  );

  for (const eventName of DEVICE_EVENT_NAMES) {
    eventSource.addEventListener(eventName, (event) => {
      handleDeviceEventMessage(event as MessageEvent<string>, onEvent, onError);
    });
  }

  eventSource.onmessage = (event) => {
    handleDeviceEventMessage(event, onEvent, onError);
  };

  eventSource.onerror = (event) => {
    onError(createDeviceEventError("设备事件流连接异常，请查看诊断日志。", event));
  };

  return {
    close: () => {
      eventSource.close();
    },
  };
}

/**
 * @brief 解析并分发 SSE event（服务器发送事件）。
 * @author PopoY
 * @param event 浏览器 EventSource（事件源）事件。
 * @param onEvent 安全事件回调。
 * @param onError 中文错误摘要回调。
 */
function handleDeviceEventMessage(
  event: MessageEvent<string>,
  onEvent: (event: PressDeviceEvent) => void,
  onError: (error: Error) => void,
): void {
  try {
    onEvent(narrowPressDeviceEvent(JSON.parse(event.data)));
  } catch (error) {
    onError(createDeviceEventError("设备事件数据解析失败，请查看诊断日志。", error));
  }
}

/**
 * @brief 收窄 Driver device event（驱动设备事件）字段，移除设备网络与 Modbus（工业通信协议）细节。
 * @author PopoY
 * @param raw 原始事件 payload（载荷）。
 * @returns 前端允许使用的安全事件 payload（载荷）。
 */
export function narrowPressDeviceEvent(raw: unknown): PressDeviceEvent {
  const record = readRecord(raw);

  return {
    eventId: readString(record?.eventId),
    correlationId: readString(record?.correlationId),
    localJobSessionId: readString(record?.localJobSessionId),
    eventName: readString(record?.eventName) as PressDeviceEventName,
    commandName: readString(record?.commandName) as PressDeviceCommandName,
    resultCode: readString(record?.resultCode) as PressDeviceCommandResultCode,
    pressDownCount: readOptionalNumber(record?.pressDownCount),
    threshold: readOptionalNumber(record?.threshold),
    parameterIdempotencyKey: readOptionalString(record?.parameterIdempotencyKey),
    occurredAt: readString(record?.occurredAt),
    snapshotValues: narrowSnapshotValues(record?.snapshotValues),
  };
}

/**
 * @brief 收窄事件快照值，只保留 safe signal code（安全信号码）和值。
 * @author PopoY
 * @param value 原始 snapshotValues（快照值）。
 * @returns 安全快照数组。
 */
function narrowSnapshotValues(value: unknown): PressDeviceEventSnapshotValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const signalCode = readOptionalString(record?.signalCode);

    return signalCode &&
      !DEVICE_EVENT_FORBIDDEN_SIGNAL_CODES.has(signalCode.trim().toLowerCase())
      ? [{ signalCode, value: record?.value }]
      : [];
  });
}

/**
 * @brief 创建中文摘要错误并保留 cause（原因）方便本地调试。
 * @author PopoY
 * @param message 中文错误摘要。
 * @param cause 原始异常或事件。
 * @returns 标准 Error（错误）。
 */
function createDeviceEventError(message: string, cause: unknown): Error {
  return new Error(message, { cause });
}

/**
 * @brief 安全读取 object record（对象记录）。
 * @author PopoY
 * @param value 待读取值。
 * @returns object record（对象记录）或 undefined（空）。
 */
function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * @brief 读取 string（字符串），缺失时返回空字符串。
 * @author PopoY
 * @param value 待读取值。
 * @returns string（字符串）值。
 */
function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * @brief 读取可选 string（字符串），空字符串按缺失处理。
 * @author PopoY
 * @param value 待读取值。
 * @returns 可选 string（字符串）。
 */
function readOptionalString(value: unknown): string | undefined {
  const text = readString(value);
  return text.length > 0 ? text : undefined;
}

/**
 * @brief 读取可选 number（数字）。
 * @author PopoY
 * @param value 待读取值。
 * @returns 可选 number（数字）。
 */
function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

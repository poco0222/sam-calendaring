/**
 * @file driver.ts - 定义 Driver Service（驱动服务）前端领域模型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 bootstrap flow（启动引导流程）使用的 Driver Service（驱动服务）契约。
 */

import type { SignalConfig, SignedLease } from "./lease";

/**
 * @brief Model the whitelisted request body for applyLeaseAndConfig.
 */
export type ApplyLeaseAndConfigRequest = {
  correlationId: string;
  timeoutMs: number;
  signedLease: SignedLease;
  signalConfig: SignalConfig;
};

/**
 * @brief Model the driver lease states surfaced by the bootstrap dashboard.
 */
export type DriverLeaseState =
  | "None"
  | "Pending"
  | "Active"
  | "Superseded"
  | "Expired"
  | "Released";

/**
 * @brief Model the driver device session states surfaced by the bootstrap dashboard.
 */
export type DriverDeviceSessionState =
  | "Disconnected"
  | "Connecting"
  | "Connected"
  | "Prechecked"
  | "Running"
  | "CleanupPending"
  | "Faulted";

/**
 * @brief Model the common Driver Service response metadata returned by bootstrap commands.
 */
export type DriverCommandResult = {
  correlationId: string;
  resultCode: string;
  message?: string;
};

/**
 * @brief Model the applyLeaseAndConfig response fields needed by later bootstrap tasks.
 */
export type ApplyLeaseAndConfigResponse = DriverCommandResult & {
  leaseState?: DriverLeaseState;
  deviceSessionState?: DriverDeviceSessionState;
  leaseId?: string;
  targetDeviceId?: string;
  fencingToken?: string | number;
};

/**
 * @brief Model the minimal request body for getSignalSnapshot.
 */
export type GetSignalSnapshotRequest = {
  correlationId: string;
  timeoutMs: number;
};

/**
 * @brief Model the signal values returned by getSignalSnapshot.
 */
export type SignalSnapshotValues = Record<string, unknown>;

/**
 * @brief Model the typed signal snapshot payload used by the bootstrap dashboard.
 */
export type GetSignalSnapshotResponse = DriverCommandResult & {
  signalValues: SignalSnapshotValues;
};

/**
 * @brief 定义压机设备动作可调用的 commandName（命令名）集合。
 * @author PopoY
 */
export type PressDeviceCommandName =
  | "signalSnapshotPublisher"
  | "connectMes"
  | "precheckForStart"
  | "startDeviceSession"
  | "startPressDownCountMonitor"
  | "stopPressDownCountMonitor"
  | "rollbackStartSignal"
  | "cleanupDeviceSession"
  | "moveIn"
  | "moveOut"
  | "lineIn"
  | "lineOut";

/**
 * @brief 定义压机设备动作稳定 resultCode（结果码），仅保留 Driver Service（驱动服务）公开值。
 * @author PopoY
 */
export type PressDeviceCommandResultCode =
  | "OK"
  | "PARTIAL_OK"
  | "LEASE_INVALID"
  | "LEASE_EXPIRED"
  | "HOST_MISMATCH"
  | "SIGNAL_CONFIG_MISMATCH"
  | "COMMAND_NOT_ALLOWED"
  | "SIGNAL_NOT_CONFIGURED"
  | "SIGNAL_NOT_WRITABLE"
  | "FENCING_TOKEN_STALE"
  | "DEVICE_IDENTITY_MISMATCH"
  | "DEVICE_TIMEOUT"
  | "DEVICE_REJECTED"
  | "DEVICE_BUSY"
  | "CLEANUP_PENDING"
  | "ROLLBACK_FAILED"
  | "IDEMPOTENCY_REPLAY"
  | "MONITOR_ALREADY_RUNNING"
  | "MONITOR_NOT_RUNNING"
  | "MONITOR_TIMEOUT"
  | "EVENT_STREAM_UNAVAILABLE";

/**
 * @brief 定义 /executeDeviceCommand（执行设备命令）和 /precheckDeviceCommand（设备命令前置校验）请求白名单字段。
 * @author PopoY
 */
export type PressDeviceCommandRequest = {
  correlationId: string;
  commandName: PressDeviceCommandName;
  localJobSessionId: string;
  idempotencyKey: string;
  timeoutMs: number;
};

/**
 * @brief 定义 /executeDeviceCommand（执行设备命令）和 /precheckDeviceCommand（设备命令前置校验）响应白名单字段。
 * @author PopoY
 */
export type PressDeviceCommandResponse = {
  correlationId: string;
  commandName: PressDeviceCommandName;
  localJobSessionId: string;
  idempotencyKey: string;
  resultCode: PressDeviceCommandResultCode;
  message?: string;
  leaseState?: DriverLeaseState;
  deviceSessionState?: DriverDeviceSessionState;
  completedSteps: string[];
  failedSteps: string[];
};

/**
 * @brief 定义 Driver device event stream（驱动设备事件流）稳定事件名。
 * @author PopoY
 */
export type PressDeviceEventName =
  | "signalSnapshotChanged"
  | "pressDownCountMonitorStarted"
  | "pressDownCountChanged"
  | "pressDownCountThresholdReached"
  | "pressDownCountMonitorFailed"
  | "pressDownCountMonitorStopped";

/**
 * @brief 定义设备事件中的安全信号快照值，不包含 Modbus address（Modbus 地址）。
 * @author PopoY
 */
export type PressDeviceEventSnapshotValue = {
  signalCode: string;
  value: unknown;
};

/**
 * @brief 定义 Driver device event stream（驱动设备事件流）前端安全 payload（载荷）。
 * @author PopoY
 */
export type PressDeviceEvent = {
  eventId: string;
  correlationId: string;
  localJobSessionId: string;
  eventName: PressDeviceEventName;
  commandName: PressDeviceCommandName;
  resultCode: PressDeviceCommandResultCode;
  pressDownCount?: number;
  threshold?: number;
  parameterIdempotencyKey?: string;
  occurredAt: string;
  snapshotValues: PressDeviceEventSnapshotValue[];
};

/**
 * @file errorMapper.ts - 实现错误映射逻辑。
 * @author PopoY
 * @created 2026-06-25
 * @brief 映射 bootstrap（启动引导）和 Driver Service（驱动服务）错误为用户文案。
 */

import type { ErrorDisplay } from "../domain/errorDisplay";
import type { DriverErrorCode } from "../domain/driverErrors";
import type { BootstrapErrorCode } from "../domain/errors";

type KnownErrorCode = BootstrapErrorCode | DriverErrorCode;

const DEFAULT_ERROR_DISPLAY: ErrorDisplay = {
  title: "启动失败",
  detail: "请查看诊断日志后重试。",
};

const ERROR_DISPLAY_BY_CODE: Record<KnownErrorCode, ErrorDisplay> = {
  CONFIG_INVALID: {
    title: "本机配置无效",
    detail: "请补齐工位启动配置后重试。",
  },
  ERP_AUTO_LOGIN_FAILED: {
    title: "ERP 免登录失败",
    detail: "请检查工位配置或账号状态后重试。",
  },
  ERP_LEASE_PLACEHOLDER: {
    title: "ERP 租约仍为占位数据",
    detail: "请先让 ERP 返回真实签名租约和信号配置。",
  },
  LEASE_INVALID: {
    title: "租约无效",
    detail: "请重新获取授权后再试。",
  },
  LEASE_EXPIRED: {
    title: "租约已过期",
    detail: "请重新获取授权。",
  },
  HOST_MISMATCH: {
    title: "工控机身份不匹配",
    detail: "请确认当前机器与授权工位一致。",
  },
  SIGNAL_CONFIG_MISMATCH: {
    title: "信号配置不匹配",
    detail: "请刷新配置后重试。",
  },
  FENCING_TOKEN_STALE: {
    title: "授权令牌已失效",
    detail: "当前授权已被更新或接管，请重新获取授权。",
  },
  DEVICE_IDENTITY_MISMATCH: {
    title: "设备身份不匹配",
    detail: "请核对目标设备身份后再试。",
  },
  DEVICE_TIMEOUT: {
    title: "设备通信超时",
    detail: "请检查设备连接状态后重试。",
  },
  DEVICE_REJECTED: {
    title: "设备拒绝执行",
    detail: "设备回读确认失败或拒绝执行。",
  },
  DEVICE_BUSY: {
    title: "设备当前不可操作",
    detail: "请等待设备回到允许状态后重试。",
  },
  CLEANUP_PENDING: {
    title: "上次收尾未完成",
    detail: "请先完成上次收尾，再继续启动流程。",
  },
};

/**
 * @brief Map a stable bootstrap or Driver Service error code to user-facing text.
 * @param code Runtime error code captured from ERP or Driver Service flows.
 * @returns Stable title and detail text for the dashboard error panel.
 */
export function mapErrorCode(code: string): ErrorDisplay {
  return ERROR_DISPLAY_BY_CODE[code as KnownErrorCode] ?? DEFAULT_ERROR_DISPLAY;
}

/**
 * @brief Convert an unknown runtime failure into a user-facing bootstrap error message.
 * @param error Unknown error object captured by hooks or transport helpers.
 * @returns Stable error panel text for the current runtime failure.
 */
export function mapRuntimeError(error: unknown): ErrorDisplay {
  const errorCode = readErrorField(error, "code") || readErrorField(error, "resultCode");

  if (errorCode && errorCode in ERROR_DISPLAY_BY_CODE) {
    return mapErrorCode(errorCode);
  }

  return DEFAULT_ERROR_DISPLAY;
}

/**
 * @brief Read a string field from an unknown runtime value without assuming a concrete error type.
 * @param value Unknown runtime failure captured by React hooks or transport helpers.
 * @param key String field name expected on the runtime object.
 * @returns Non-empty string field value, or an empty string when absent.
 */
function readErrorField(value: unknown, key: string): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const field = (value as Record<string, unknown>)[key];

  return typeof field === "string" && field.length > 0 ? field : "";
}

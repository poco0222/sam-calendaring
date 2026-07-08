/**
 * @file driverErrors.ts - 定义 Driver Service（驱动服务）错误映射。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 bootstrap flow（启动引导流程）需要保留的 Driver Service（驱动服务）错误码。
 */

/**
 * @brief List the stable Driver Service error codes required by the bootstrap specification.
 */
export const STANDARD_DRIVER_ERROR_CODES = [
  "LEASE_INVALID",
  "LEASE_EXPIRED",
  "HOST_MISMATCH",
  "SIGNAL_CONFIG_MISMATCH",
  "FENCING_TOKEN_STALE",
  "DEVICE_IDENTITY_MISMATCH",
  "DEVICE_TIMEOUT",
  "DEVICE_REJECTED",
  "DEVICE_BUSY",
  "CLEANUP_PENDING",
] as const;

/**
 * @brief Model the known Driver Service error code union for later UI mapping.
 */
export type DriverErrorCode = (typeof STANDARD_DRIVER_ERROR_CODES)[number];

/**
 * @brief Check whether a result code is one of the stable Driver Service error codes.
 * @param value Raw result code returned by the Driver Service.
 * @returns True when the code is a known Driver Service error code.
 */
export function isDriverErrorCode(value: string): value is DriverErrorCode {
  return STANDARD_DRIVER_ERROR_CODES.includes(value as DriverErrorCode);
}

/**
 * @file errors.ts - 定义前端错误模型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 bootstrap（启动引导）错误码和错误模型。
 */

/**
 * @brief List the bootstrap error codes that callers must handle explicitly.
 */
export type BootstrapErrorCode =
  | "CONFIG_INVALID"
  | "ERP_AUTO_LOGIN_FAILED"
  | "ERP_LEASE_PLACEHOLDER";

/**
 * @brief Model a bootstrap error with a stable code and optional underlying cause.
 */
export type BootstrapError = Error & {
  code: BootstrapErrorCode;
  cause?: unknown;
  missingFields?: readonly string[];
};

/**
 * @brief Create a bootstrap error with the stable code used by the UI flow.
 * @param code Stable bootstrap error code.
 * @param message Human-readable diagnostic message.
 * @param cause Optional underlying failure.
 * @returns Error object annotated with the bootstrap error code.
 */
export function createBootstrapError(
  code: BootstrapErrorCode,
  message: string,
  cause?: unknown,
): BootstrapError {
  const error = new Error(message) as BootstrapError;

  error.code = code;
  error.cause = cause;

  return error;
}

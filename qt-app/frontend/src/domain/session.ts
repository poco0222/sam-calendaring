/**
 * @file session.ts - 定义 session（会话）前端领域模型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 ERP auto-login（企业资源计划自动登录）请求和会话响应契约。
 */

/**
 * @brief Model the minimal request body required by the ERP auto-login API.
 */
export type AutoLoginRequest = {
  stationAccountId: string;
  granteeHostId: string;
  stationId: string;
};

/**
 * @brief Model the station context returned by ERP after a successful auto-login.
 */
export type StationContext = {
  stationAccountId: string;
  stationId: string;
  granteeHostId?: string;
  [key: string]: unknown;
};

/**
 * @brief Model the minimal ERP auto-login response used by the bootstrap flow.
 */
export type AutoLoginResponse = {
  sessionToken: string;
  stationContext: StationContext;
  defaultDeviceScope?: Record<string, unknown>;
  businessContext?: Record<string, unknown>;
};

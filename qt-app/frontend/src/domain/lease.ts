/**
 * @file lease.ts - 定义 lease（租约）前端领域模型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 lease authorization（租约授权）请求和租约包契约。
 */

/**
 * @brief Model the request body required by the ERP lease authorization API.
 */
export type LeaseAuthorizationRequest = {
  sessionToken: string;
  stationId: string;
  granteeHostId: string;
};

/**
 * @brief Model one backend-approved signal point in signalConfig.
 */
export type SignalPoint = {
  name?: string;
  address?: number;
  type?: "holdingRegister" | string;
  expectedValue?: string;
  [key: string]: unknown;
};

/**
 * @brief Model the backend-approved signal configuration payload returned by ERP.
 */
export type SignalConfig = {
  signals?: SignalPoint[];
  identityProbe?: SignalPoint;
  [key: string]: unknown;
};

/**
 * @brief Model one ERP dict（字典）option used by frontend translation（前端翻译）.
 * @author PopoY
 */
export type ErpDictOption = {
  dictValue: string;
  dictLabel: string;
};

/**
 * @brief Model one ERP parameter_group dict（参数组别字典）option used by signal snapshot grouping.
 * @author PopoY
 */
export type ParameterGroupOption = ErpDictOption;

/**
 * @brief Model the signed lease payload returned by ERP.
 */
export type SignedLease = {
  leaseId?: string;
  targetDeviceId?: string;
  expiresAt?: string;
  fencingToken?: string | number;
  signalConfigHash?: string;
  [key: string]: unknown;
};

/**
 * @brief Model the bootstrap lease package returned by the ERP lease authorization API.
 */
export type LeasePackage = {
  signalConfig: SignalConfig;
  signedLease: SignedLease;
};

/**
 * @brief Model the ERP lease response while keeping forbidden device connection data out of the public contract.
 */
export type LeaseAuthorizationResponse = {
  signalConfig: SignalConfig | string;
  signedLease: SignedLease | string;
  deviceConnectionInfo?: unknown;
};

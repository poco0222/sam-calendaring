/**
 * @file native.ts - 定义 Qt App（Qt 应用）native bridge（原生桥接）类型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 声明 Qt App（Qt 应用）native bridge（原生桥接）类型。
 */

/**
 * @brief Describe the read-only bootstrap config exposed by the Qt native layer.
 */
export type NativeBootstrapConfig = {
  stationAccountId: string;
  granteeHostId: string;
  stationId: string;
  erpBaseUrl: string;
  driverBaseUrl: string;
  configVersion: string;
};

/**
 * @brief Define the callback signature used by QWebChannel bridge methods.
 * @param config Read-only bootstrap config returned by the native layer.
 */
export type NativeConfigCallback = (config: NativeBootstrapConfig) => void;

/**
 * @brief Describe the minimal bridge API exposed by the Qt WebChannel object.
 */
export type NativeConfigBridge = {
  readBootstrapConfig: (callback: NativeConfigCallback) => void;
};

declare global {
  interface Window {
    /**
     * @brief Cache the asynchronously initialized QWebChannel bridge promise.
     */
    __qtNativeBridgePromise?: Promise<NativeConfigBridge>;
  }
}

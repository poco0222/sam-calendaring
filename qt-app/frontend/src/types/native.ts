/**
 * @file native.ts - 定义 Qt App（Qt 应用）native bridge（原生桥接）类型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 声明 Qt App（Qt 应用）native bridge（原生桥接）类型。
 */

/**
 * @brief 描述 Qt native layer（Qt 原生层）暴露的 bootstrap config（启动配置）。
 * @author PopoY
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
 * @brief 定义 QWebChannel（Qt Web 通道）读取配置 callback（回调）签名。
 * @author PopoY
 * @param config native layer（原生层）返回的 bootstrap config（启动配置）。
 */
export type NativeConfigCallback = (config: NativeBootstrapConfig) => void;

/**
 * @brief 描述 AppConfigBridge（应用配置桥）返回的 native save result（原生保存结果）。
 * @author PopoY
 */
export type NativeBootstrapConfigSaveResult = {
  ok: boolean;
  errorMessage?: string;
};

/**
 * @brief 定义 native save result（原生保存结果）callback（回调）签名。
 * @author PopoY
 * @param result 保存结果；失败时包含中文错误摘要。
 */
export type NativeConfigSaveCallback = (
  result: NativeBootstrapConfigSaveResult,
) => void;

/**
 * @brief 定义 default host address（默认主机地址）callback（回调）签名。
 * @author PopoY
 * @param hostAddress 默认 IPv4 address（IPv4 地址）；取不到时为空字符串。
 */
export type NativeDefaultHostAddressCallback = (hostAddress: string) => void;

/**
 * @brief 描述 Qt WebChannel object（Qt Web 通道对象）暴露的最小 bridge API（桥接口）。
 * @author PopoY
 */
export type NativeConfigBridge = {
  readBootstrapConfig: (callback: NativeConfigCallback) => void;
  saveBootstrapConfig: (
    config: NativeBootstrapConfig,
    callback: NativeConfigSaveCallback,
  ) => void;
  readDefaultHostAddress: (callback: NativeDefaultHostAddressCallback) => void;
};

declare global {
  interface Window {
    /**
     * @brief 缓存异步初始化的 QWebChannel bridge promise（Qt Web 通道桥 Promise）。
     * @author PopoY
     */
    __qtNativeBridgePromise?: Promise<NativeConfigBridge>;
  }
}

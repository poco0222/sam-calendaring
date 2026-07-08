/**
 * @file nativeBridge.ts - 封装 Qt App（Qt 应用）native bridge（原生桥接）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 通过 QWebChannel（Qt Web 通道）读取 bootstrap config（启动引导配置）。
 */

import type {
  NativeBootstrapConfig,
  NativeBootstrapConfigSaveResult,
  NativeConfigBridge,
} from "../types/native";

const QWEBCHANNEL_SCRIPT_SRC = "qrc:///qtwebchannel/qwebchannel.js";

type NativeBridgeWindow = Window & typeof globalThis & {
  QWebChannel?: new (
    transport: unknown,
    initCallback: (channel: {
      objects: {
        appConfigBridge?: NativeConfigBridge;
      };
    }) => void,
  ) => void;
  qt?: {
    webChannelTransport?: unknown;
  };
};

/**
 * @brief 允许 test（测试）注入 mock bridge（模拟桥），生产环境延迟解析 Qt bridge（Qt 桥）。
 * @author PopoY
 */
export type ReadNativeConfigOptions = {
  bridge?: NativeConfigBridge;
  targetWindow?: NativeBridgeWindow;
};

/**
 * @brief 从 Qt native bridge（Qt 原生桥）读取 bootstrap config（启动配置）。
 * @author PopoY
 * @param options 可选 test bridge（测试桥）注入或 alternate window（替代窗口）目标。
 * @returns resolved（完成）后返回 bootstrap config（启动配置）。
 */
export async function readNativeConfig(
  options: ReadNativeConfigOptions = {},
): Promise<NativeBootstrapConfig> {
  const bridge = options.bridge ?? (await resolveNativeBridge(options.targetWindow));
  return readConfigFromBridge(bridge);
}

/**
 * @brief 保存 bootstrap config（启动配置）到 Qt native layer（Qt 原生层）。
 * @author PopoY
 * @param config 六个 whitelist fields（白名单字段）的启动配置。
 * @param options 可选 test bridge（测试桥）注入或 alternate window（替代窗口）目标。
 * @returns 保存成功时 resolved（完成）；失败时 rejected（拒绝）中文错误。
 */
export async function saveNativeConfig(
  config: NativeBootstrapConfig,
  options: ReadNativeConfigOptions = {},
): Promise<void> {
  const bridge = options.bridge ?? (await resolveNativeBridge(options.targetWindow));
  const result = await saveConfigToBridge(bridge, trimNativeConfig(config));

  if (result?.ok !== true) {
    throw new Error(result?.errorMessage || "启动配置保存失败，请稍后重试。");
  }
}

/**
 * @brief 读取 QT App（Qt 应用）native layer（原生层）提供的默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @param options 可选 test bridge（测试桥）注入或 alternate window（替代窗口）目标。
 * @returns 默认主机地址；native layer（原生层）取不到时为空字符串。
 */
export async function readDefaultHostAddress(
  options: ReadNativeConfigOptions = {},
): Promise<string> {
  const bridge = options.bridge ?? (await resolveNativeBridge(options.targetWindow));
  return readDefaultHostAddressFromBridge(bridge);
}

/**
 * @brief 解析 Qt bridge instance（Qt 桥实例），并在 browser window（浏览器窗口）缓存 promise（承诺）。
 * @author PopoY
 * @param targetWindow test（测试）使用的可选 alternate browser window（替代浏览器窗口）。
 * @returns resolved（完成）后返回 native bridge object（原生桥对象）。
 */
async function resolveNativeBridge(
  targetWindow?: NativeBridgeWindow,
): Promise<NativeConfigBridge> {
  const bridgeWindow = targetWindow ?? getBrowserWindow();

  if (!bridgeWindow.__qtNativeBridgePromise) {
    bridgeWindow.__qtNativeBridgePromise = createBridgePromise(bridgeWindow).catch(
      (error) => {
        delete bridgeWindow.__qtNativeBridgePromise;
        throw error;
      },
    );
  }

  return bridgeWindow.__qtNativeBridgePromise;
}

/**
 * @brief 从已解析 bridge object（桥对象）读取 bootstrap config（启动配置）。
 * @author PopoY
 * @param bridge QWebChannel（Qt Web 通道）返回或 test（测试）注入的 native bridge（原生桥）。
 * @returns resolved（完成）后返回 bootstrap config payload（启动配置载荷）。
 */
function readConfigFromBridge(
  bridge: NativeConfigBridge,
): Promise<NativeBootstrapConfig> {
  return new Promise((resolve, reject) => {
    try {
      bridge.readBootstrapConfig((config) => {
        resolve(config);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * @brief 将 bootstrap config（启动配置）裁剪为六个字段，并 trim（去空白）每个字符串。
 * @author PopoY
 * @param config frontend（前端）准备保存的 bootstrap config（启动配置）。
 * @returns 仅包含六个 whitelist fields（白名单字段）的配置。
 */
function trimNativeConfig(config: NativeBootstrapConfig): NativeBootstrapConfig {
  return {
    stationAccountId: config.stationAccountId.trim(),
    granteeHostId: config.granteeHostId.trim(),
    stationId: config.stationId.trim(),
    erpBaseUrl: config.erpBaseUrl.trim(),
    driverBaseUrl: config.driverBaseUrl.trim(),
    configVersion: config.configVersion.trim(),
  };
}

/**
 * @brief 通过 bridge object（桥对象）保存 bootstrap config（启动配置）。
 * @author PopoY
 * @param bridge QWebChannel（Qt Web 通道）返回或 test（测试）注入的 native bridge（原生桥）。
 * @param config 已裁剪的 bootstrap config（启动配置）。
 * @returns resolved（完成）后返回 native save result（原生保存结果）。
 */
function saveConfigToBridge(
  bridge: NativeConfigBridge,
  config: NativeBootstrapConfig,
): Promise<NativeBootstrapConfigSaveResult> {
  return new Promise((resolve, reject) => {
    try {
      bridge.saveBootstrapConfig(config, (result) => {
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * @brief 通过 bridge object（桥对象）读取默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @param bridge QWebChannel（Qt Web 通道）返回或 test（测试）注入的 native bridge（原生桥）。
 * @returns native（原生）返回字符串时使用该值，否则返回空字符串。
 */
function readDefaultHostAddressFromBridge(
  bridge: NativeConfigBridge,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      bridge.readDefaultHostAddress((hostAddress: unknown) => {
        resolve(typeof hostAddress === "string" ? hostAddress : "");
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * @brief 创建 production read（生产读取）使用的 QWebChannel-backed bridge promise（Qt Web 通道桥承诺）。
 * @author PopoY
 * @param bridgeWindow 持有 Qt transport globals（Qt 传输全局对象）的 browser window（浏览器窗口）。
 * @returns resolved（完成）后返回已注册的 native config bridge object（原生配置桥对象）。
 */
async function createBridgePromise(
  bridgeWindow: NativeBridgeWindow,
): Promise<NativeConfigBridge> {
  await ensureQWebChannelScript(bridgeWindow);

  const transport = bridgeWindow.qt?.webChannelTransport;
  const QWebChannel = bridgeWindow.QWebChannel;

  if (!transport || !QWebChannel) {
    throw new Error("QWebChannel native bridge is unavailable.");
  }

  return new Promise((resolve, reject) => {
    try {
      new QWebChannel(transport, (channel) => {
        const bridge = channel.objects.appConfigBridge;

        if (!bridge) {
          reject(new Error("appConfigBridge is unavailable."));
          return;
        }

        resolve(bridge);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * @brief 创建 bridge（桥）前确保 browser window（浏览器窗口）已加载 qwebchannel.js。
 * @author PopoY
 * @param bridgeWindow 持有 target document（目标文档）的 browser window（浏览器窗口）。
 * @returns QWebChannel constructor（Qt Web 通道构造器）可用时 resolved（完成）。
 */
function ensureQWebChannelScript(bridgeWindow: NativeBridgeWindow): Promise<void> {
  if (bridgeWindow.QWebChannel) {
    return Promise.resolve();
  }

  const existingScript =
    bridgeWindow.document.querySelector<HTMLScriptElement>(
      `script[data-qt-webchannel-src="${QWEBCHANNEL_SCRIPT_SRC}"]`,
    );

  if (existingScript) {
    return waitForQWebChannelScript(existingScript, bridgeWindow);
  }

  return new Promise((resolve, reject) => {
    const script = bridgeWindow.document.createElement("script");

    // PopoY: production path（生产路径）必须通过 QWebChannel（Qt Web 通道）解析 bridge（桥），绝不读写 localStorage（本地存储）。
    script.src = QWEBCHANNEL_SCRIPT_SRC;
    script.dataset.qtWebchannelSrc = QWEBCHANNEL_SCRIPT_SRC;
    script.addEventListener(
      "load",
      () => {
        script.dataset.qtWebchannelLoaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        reject(new Error("Failed to load qwebchannel.js."));
      },
      { once: true },
    );

    (bridgeWindow.document.head ?? bridgeWindow.document.documentElement).appendChild(
      script,
    );
  });
}

/**
 * @brief 复用其他 caller（调用方）已插入且正在加载的 qwebchannel.js script（脚本）。
 * @author PopoY
 * @param script 现有 qwebchannel.js script element（脚本元素）。
 * @param bridgeWindow 应接收 constructor（构造器）的 browser window（浏览器窗口）。
 * @returns QWebChannel constructor（Qt Web 通道构造器）可用时 resolved（完成）。
 */
function waitForQWebChannelScript(
  script: HTMLScriptElement,
  bridgeWindow: NativeBridgeWindow,
): Promise<void> {
  if (
    script.dataset.qtWebchannelLoaded === "true" ||
    typeof bridgeWindow.QWebChannel === "function"
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    script.addEventListener(
      "load",
      () => {
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        reject(new Error("Failed to load qwebchannel.js."));
      },
      { once: true },
    );
  });
}

/**
 * @brief 返回 production bridge reads（生产桥读取）使用的 browser window（浏览器窗口）。
 * @author PopoY
 * @returns 带 Qt globals（Qt 全局对象）的 native bridge window（原生桥窗口）。
 */
function getBrowserWindow(): NativeBridgeWindow {
  if (typeof window === "undefined") {
    throw new Error("QWebChannel native bridge is unavailable.");
  }

  return window as NativeBridgeWindow;
}

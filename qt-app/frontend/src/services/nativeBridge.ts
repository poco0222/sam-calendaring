/**
 * @file nativeBridge.ts - 封装 Qt App（Qt 应用）native bridge（原生桥接）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 通过 QWebChannel（Qt Web 通道）读取 bootstrap config（启动引导配置）。
 */

import type { NativeBootstrapConfig, NativeConfigBridge } from "../types/native";

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
 * @brief Allow tests to inject a mock bridge while production resolves the Qt bridge lazily.
 */
export type ReadNativeConfigOptions = {
  bridge?: NativeConfigBridge;
  targetWindow?: NativeBridgeWindow;
};

/**
 * @brief Read the bootstrap config from the Qt native bridge.
 * @param options Optional test-only bridge injection or alternate window target.
 * @returns Promise resolved with the read-only bootstrap config.
 */
export async function readNativeConfig(
  options: ReadNativeConfigOptions = {},
): Promise<NativeBootstrapConfig> {
  if (options.bridge) {
    return readConfigFromBridge(options.bridge);
  }

  const bridge = await resolveNativeBridge(options.targetWindow);
  return readConfigFromBridge(bridge);
}

/**
 * @brief Resolve the Qt bridge instance, caching the promise on the browser window.
 * @param targetWindow Optional alternate browser window used by tests.
 * @returns Promise resolved with the native bridge object.
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
 * @brief Read the bootstrap config from the resolved bridge object.
 * @param bridge Native bridge object returned by QWebChannel or injected by tests.
 * @returns Promise resolved with the bootstrap config payload.
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
 * @brief Create the QWebChannel-backed bridge promise for production reads.
 * @param bridgeWindow Browser window that owns the Qt transport globals.
 * @returns Promise resolved with the registered native config bridge object.
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
 * @brief Ensure the browser window has loaded qwebchannel.js before bridge creation.
 * @param bridgeWindow Browser window that owns the target document.
 * @returns Promise resolved when the QWebChannel constructor is available.
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

    // PopoY: the production path must resolve the bridge through QWebChannel, never localStorage.
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
 * @brief Reuse an in-flight qwebchannel.js script load when another caller already inserted it.
 * @param script Existing script element for qwebchannel.js.
 * @param bridgeWindow Browser window that should receive the constructor.
 * @returns Promise resolved when the QWebChannel constructor becomes available.
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
 * @brief Return the browser window used for production bridge reads.
 * @returns Native bridge window with Qt globals.
 */
function getBrowserWindow(): NativeBridgeWindow {
  if (typeof window === "undefined") {
    throw new Error("QWebChannel native bridge is unavailable.");
  }

  return window as NativeBridgeWindow;
}

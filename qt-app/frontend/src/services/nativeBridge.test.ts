/**
 * @file nativeBridge.test.ts - 验证 native bridge（原生桥接）逻辑。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 native bootstrap config（原生启动引导配置）桥接契约。
 */

import { afterEach, expect, it, vi } from "vitest";

import type { NativeConfigBridge } from "../types/native";
import { readNativeConfig } from "./nativeBridge";

const sampleConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "station-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5000",
  configVersion: "v1",
};

/**
 * @brief Clean up any test doubles registered on the global object between cases.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * @brief Create a minimal mock bridge that returns the sample bootstrap config.
 * @returns Mock native bridge compatible with the production contract.
 */
function createMockBridge(): NativeConfigBridge {
  return {
    readBootstrapConfig(callback) {
      callback(sampleConfig);
    },
  };
}

/**
 * @brief Create a minimal window-like object for exercising the QWebChannel production path.
 * @param bridge Optional bridge object exposed by the mock channel.
 * @param onConstruct Optional hook fired whenever the channel constructor runs.
 * @param shouldThrow Optional switch that simulates bridge initialization failure.
 * @returns Window-shaped object compatible with readNativeConfig targetWindow injection.
 */
function createQWebChannelWindow({
  bridge,
  onConstruct,
  shouldThrow,
}: {
  bridge?: NativeConfigBridge;
  onConstruct?: () => void;
  shouldThrow?: () => boolean;
}) {
  return {
    document: {} as Document,
    QWebChannel: function MockQWebChannel(
      _transport: unknown,
      initCallback: (channel: {
        objects: {
          appConfigBridge?: NativeConfigBridge;
        };
      }) => void,
    ) {
      onConstruct?.();

      if (shouldThrow?.()) {
        throw new Error("bridge init failed");
      }

      initCallback({
        objects: {
          appConfigBridge: bridge,
        },
      });
    },
    qt: {
      webChannelTransport: {},
    },
  } as unknown as Window & typeof globalThis;
}

/**
 * @brief Assert that the native bridge returns the required bootstrap config fields.
 * @returns Promise resolved when the contract assertion finishes.
 */
it("returns required bootstrap config fields", async () => {
  const config = await readNativeConfig({ bridge: createMockBridge() });

  expect(config.stationAccountId).toBe("station-a");
  expect(config.driverBaseUrl).toEqual(expect.any(String));
});

/**
 * @brief Assert that the test path does not fall back to browser localStorage.
 * @returns Promise resolved when the no-localStorage assertion finishes.
 */
it("does not use localStorage when a mock bridge is injected", async () => {
  const localStorageProbe = {
    clear: vi.fn(),
    getItem: vi.fn(),
    key: vi.fn(),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn(),
  };

  vi.stubGlobal("localStorage", localStorageProbe as unknown as Storage);

  await readNativeConfig({ bridge: createMockBridge() });

  expect(localStorageProbe.getItem).not.toHaveBeenCalled();
  expect(localStorageProbe.setItem).not.toHaveBeenCalled();
  expect(localStorageProbe.removeItem).not.toHaveBeenCalled();
});

/**
 * @brief Assert that the production path can resolve the bridge through QWebChannel.
 * @returns Promise resolved when the production-path assertion finishes.
 */
it("reads config through the QWebChannel production path", async () => {
  const config = await readNativeConfig({
    targetWindow: createQWebChannelWindow({ bridge: createMockBridge() }),
  });

  expect(config.stationId).toBe("station-01");
  expect(config.erpBaseUrl).toBe("http://127.0.0.1:8080");
});

/**
 * @brief Assert that missing bridge registration rejects with a clear error.
 * @returns Promise resolved when the missing-bridge assertion finishes.
 */
it("rejects when appConfigBridge is missing from the QWebChannel objects", async () => {
  await expect(
    readNativeConfig({
      targetWindow: createQWebChannelWindow({ bridge: undefined }),
    }),
  ).rejects.toThrow("appConfigBridge is unavailable.");
});

/**
 * @brief Assert that a failed bridge initialization does not poison later retries.
 * @returns Promise resolved when the retry assertion finishes.
 */
it("retries bridge initialization after an initial QWebChannel failure", async () => {
  let attempts = 0;
  let shouldFail = true;
  const targetWindow = createQWebChannelWindow({
    bridge: createMockBridge(),
    onConstruct() {
      attempts += 1;
    },
    shouldThrow() {
      return shouldFail;
    },
  });

  await expect(readNativeConfig({ targetWindow })).rejects.toThrow("bridge init failed");

  shouldFail = false;

  const config = await readNativeConfig({ targetWindow });

  expect(config.stationAccountId).toBe("station-a");
  expect(attempts).toBe(2);
});

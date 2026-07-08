/**
 * @file nativeBridge.test.ts - 验证 native bridge（原生桥接）逻辑。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 native bootstrap config（原生启动引导配置）桥接契约。
 */

import { afterEach, expect, it, vi } from "vitest";

import type { NativeConfigBridge } from "../types/native";
import {
  readDefaultHostAddress,
  readNativeConfig,
  saveNativeConfig,
} from "./nativeBridge";

const sampleConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "station-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5000",
  configVersion: "v1",
};

/**
 * @brief 清理每个 case（用例）注册到 global object（全局对象）的 test double（测试替身）。
 * @author PopoY
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * @brief 创建返回 sample bootstrap config（样例启动配置）的最小 mock bridge（模拟桥）。
 * @author PopoY
 * @returns 兼容 production contract（生产契约）的 mock native bridge（模拟原生桥）。
 */
function createMockBridge(): NativeConfigBridge {
  return {
    readBootstrapConfig(callback) {
      callback(sampleConfig);
    },
    saveBootstrapConfig(config, callback) {
      callback({ ok: config.stationAccountId === sampleConfig.stationAccountId });
    },
    readDefaultHostAddress(callback) {
      callback("");
    },
  };
}

/**
 * @brief 创建最小 window-like object（类窗口对象），用于验证 QWebChannel production path（生产路径）。
 * @author PopoY
 * @param bridge mock channel（模拟通道）暴露的可选 bridge object（桥对象）。
 * @param onConstruct 每次 channel constructor（通道构造器）运行时触发的可选 hook（钩子）。
 * @param shouldThrow 模拟 bridge initialization（桥初始化）失败的可选 switch（开关）。
 * @returns 兼容 readNativeConfig targetWindow injection（目标窗口注入）的 window-shaped object（窗口形对象）。
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
 * @brief 验证 native bridge（原生桥）返回必需 bootstrap config（启动配置）字段。
 * @author PopoY
 * @returns contract assertion（契约断言）完成后 resolved（完成）的 Promise（承诺）。
 */
it("returns required bootstrap config fields", async () => {
  const config = await readNativeConfig({ bridge: createMockBridge() });

  expect(config.stationAccountId).toBe("station-a");
  expect(config.driverBaseUrl).toEqual(expect.any(String));
});

/**
 * @brief 验证 test path（测试路径）不会回退到 browser localStorage（浏览器本地存储）。
 * @author PopoY
 * @returns no-localStorage assertion（无本地存储断言）完成后 resolved（完成）的 Promise（承诺）。
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
  await saveNativeConfig(sampleConfig, { bridge: createMockBridge() });
  await readDefaultHostAddress({ bridge: createMockBridge() });

  expect(localStorageProbe.getItem).not.toHaveBeenCalled();
  expect(localStorageProbe.setItem).not.toHaveBeenCalled();
  expect(localStorageProbe.removeItem).not.toHaveBeenCalled();
});

/**
 * @brief 验证 saveNativeConfig（保存原生配置）通过 QWebChannel（Qt Web 通道）写入本机 QSettings（Qt 配置存储）。
 * @author PopoY
 */
it("saves bootstrap config through the native bridge", async () => {
  const bridge = createMockBridge();
  const saveSpy = vi.spyOn(bridge, "saveBootstrapConfig");

  await saveNativeConfig(sampleConfig, { bridge });

  expect(saveSpy).toHaveBeenCalledWith(sampleConfig, expect.any(Function));
});

/**
 * @brief 验证保存失败时返回中文错误摘要。
 * @author PopoY
 */
it("rejects native save failures with Chinese summary", async () => {
  const bridge: NativeConfigBridge = {
    ...createMockBridge(),
    saveBootstrapConfig(_config, callback) {
      callback({ ok: false, errorMessage: "启动配置保存失败，请检查本机配置权限。" });
    },
  };

  await expect(saveNativeConfig(sampleConfig, { bridge })).rejects.toThrow(
    "启动配置保存失败，请检查本机配置权限。",
  );
});

/**
 * @brief 验证 native save result（原生保存结果）只有 ok 严格等于 true 才算成功。
 * @author PopoY
 */
it("rejects malformed native save success flags", async () => {
  const bridge: NativeConfigBridge = {
    ...createMockBridge(),
    saveBootstrapConfig(_config, callback) {
      (callback as (result: { ok: unknown }) => void)({ ok: "true" });
    },
  };

  await expect(saveNativeConfig(sampleConfig, { bridge })).rejects.toThrow(
    "启动配置保存失败，请稍后重试。",
  );
});

/**
 * @brief 验证 native save result（原生保存结果）为空值时仍返回中文 fallback（回退）错误。
 * @author PopoY
 */
it("rejects empty native save results with Chinese fallback", async () => {
  const bridge: NativeConfigBridge = {
    ...createMockBridge(),
    saveBootstrapConfig(_config, callback) {
      (callback as unknown as (result: undefined) => void)(undefined);
    },
  };

  await expect(saveNativeConfig(sampleConfig, { bridge })).rejects.toThrow(
    "启动配置保存失败，请稍后重试。",
  );
});

/**
 * @brief 验证默认 IPv4 address（IPv4 地址）通过 native bridge（原生桥）读取。
 * @author PopoY
 */
it("reads default host address through the native bridge", async () => {
  const bridge: NativeConfigBridge = {
    ...createMockBridge(),
    readDefaultHostAddress(callback) {
      callback("192.168.19.100");
    },
  };

  await expect(readDefaultHostAddress({ bridge })).resolves.toBe("192.168.19.100");
});

/**
 * @brief 验证 default host address（默认主机地址）返回非 string（字符串）时回退为空字符串。
 * @author PopoY
 */
it("falls back to empty default host address for non-string bridge values", async () => {
  const bridge: NativeConfigBridge = {
    ...createMockBridge(),
    readDefaultHostAddress(callback) {
      (callback as (value: unknown) => void)(42);
    },
  };

  await expect(readDefaultHostAddress({ bridge })).resolves.toBe("");
});

/**
 * @brief 验证 production path（生产路径）可以通过 QWebChannel（Qt Web 通道）解析 bridge（桥）。
 * @author PopoY
 * @returns production-path assertion（生产路径断言）完成后 resolved（完成）的 Promise（承诺）。
 */
it("reads config through the QWebChannel production path", async () => {
  const config = await readNativeConfig({
    targetWindow: createQWebChannelWindow({ bridge: createMockBridge() }),
  });

  expect(config.stationId).toBe("station-01");
  expect(config.erpBaseUrl).toBe("http://127.0.0.1:8080");
});

/**
 * @brief 验证缺少 bridge registration（桥注册）时会 reject（拒绝）并返回清晰错误。
 * @author PopoY
 * @returns missing-bridge assertion（缺桥断言）完成后 resolved（完成）的 Promise（承诺）。
 */
it("rejects when appConfigBridge is missing from the QWebChannel objects", async () => {
  await expect(
    readNativeConfig({
      targetWindow: createQWebChannelWindow({ bridge: undefined }),
    }),
  ).rejects.toThrow("appConfigBridge is unavailable.");
});

/**
 * @brief 验证 bridge initialization（桥初始化）失败不会污染后续 retry（重试）。
 * @author PopoY
 * @returns retry assertion（重试断言）完成后 resolved（完成）的 Promise（承诺）。
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

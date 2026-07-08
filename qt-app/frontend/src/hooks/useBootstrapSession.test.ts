/**
 * @file useBootstrapSession.test.ts - 验证 bootstrap session hook（启动引导会话钩子）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 native config（原生配置）缺失时停止 ERP（企业资源计划系统）请求。
 */

import { describe, expect, it, vi } from "vitest";

import type { BootstrapSession } from "../services/erpClient";
import type { NativeBootstrapConfig } from "../types/native";
import { loadValidatedBootstrapSession } from "./useBootstrapSession";

const sampleConfig: NativeBootstrapConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "station-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5000",
  configVersion: "v1",
};

const sampleSession: BootstrapSession = {
  sessionToken: "erp-session-token",
  stationContext: {
    stationAccountId: "station-a",
    stationId: "station-01",
  },
  signalConfig: {
    signals: [],
  },
  signedLease: {
    leaseId: "lease-01",
  },
};

describe("loadValidatedBootstrapSession", () => {
  /**
   * @brief Assert that missing native config prevents the ERP bootstrap request chain.
   * @returns Promise resolved when the missing-config short-circuit is verified.
   */
  it("stops before ERP session loading when native config is missing", async () => {
    const readConfig = vi.fn().mockResolvedValue({
      ...sampleConfig,
      stationAccountId: "",
    });
    const loadSession = vi.fn().mockResolvedValue(sampleSession);

    await expect(
      loadValidatedBootstrapSession(readConfig, loadSession),
    ).rejects.toMatchObject({
      code: "CONFIG_INVALID",
      missingFields: ["stationAccountId"],
    });

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(loadSession).not.toHaveBeenCalled();
  });
});

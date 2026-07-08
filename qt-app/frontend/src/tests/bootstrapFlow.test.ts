/**
 * @file bootstrapFlow.test.ts - 验证 bootstrap flow（启动引导流程）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 bootstrap flow（启动引导流程）契约。
 */

import { describe, expect, it, vi } from "vitest";

import type { ApplyLeaseAndConfigResponse, GetSignalSnapshotResponse } from "../domain/driver";
import type { BootstrapSession } from "../services/erpClient";
import { runBootstrapFlow } from "../services/bootstrapFlow";
import type { NativeBootstrapConfig } from "../types/native";

const sampleConfig: NativeBootstrapConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "station-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5000",
  configVersion: "v1",
};

const sampleBootstrapSession: BootstrapSession = {
  bootstrapConfigEditable: false,
  bootstrapConfigApprovalState: "readonly",
  sessionToken: "erp-session-token",
  stationContext: {
    stationAccountId: "station-a",
    stationId: "station-01",
  },
  defaultDeviceScope: {
    deviceIds: ["device-01"],
  },
  businessContext: {
    shiftCode: "A",
  },
  signalConfig: {
    signals: [
      {
        address: 100,
        name: "mesCommunication",
      },
    ],
  },
  signedLease: {
    leaseId: "lease-01",
    targetDeviceId: "device-01",
    fencingToken: "fence-01",
    signature: "signed-payload",
  },
};

const sampleApplyResult: ApplyLeaseAndConfigResponse = {
  correlationId: "corr-apply-01",
  resultCode: "OK",
  leaseState: "Active",
  deviceSessionState: "Connected",
  leaseId: "lease-01",
  targetDeviceId: "device-01",
  fencingToken: "fence-01",
};

const sampleSignalSnapshot: GetSignalSnapshotResponse = {
  correlationId: "corr-snapshot-01",
  resultCode: "OK",
  signalValues: {
    machineState: "Ready",
    mesCommunication: true,
  },
};

describe("runBootstrapFlow", () => {
  /**
   * @brief Assert that the composed verification harness reaches the first signal snapshot on the happy path.
   * @returns Promise resolved when the composed bootstrap flow reaches SnapshotReady.
   */
  it("boots from native config to first signal snapshot", async () => {
    const result = await runBootstrapFlow({
      readNativeConfig: vi.fn().mockResolvedValue(sampleConfig),
      loadBootstrapSession: vi.fn().mockResolvedValue(sampleBootstrapSession),
      applyLeaseAndConfig: vi.fn().mockResolvedValue(sampleApplyResult),
      getSignalSnapshot: vi.fn().mockResolvedValue(sampleSignalSnapshot),
    });

    expect(result.state).toBe("SnapshotReady");
    if (result.state !== "SnapshotReady") {
      throw new Error("启动流程未到达快照状态。");
    }

    expect(result.applyResult.resultCode).toBe("OK");
    expect(result.signalSnapshot.resultCode).toBe("OK");
  });
});

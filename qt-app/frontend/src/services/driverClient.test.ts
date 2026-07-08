/**
 * @file driverClient.test.ts - 验证 Driver Service client（驱动服务客户端）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 Driver Service client（驱动服务客户端）契约。
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyLeaseAndConfig,
  buildApplyLeaseRequest,
  buildPressDeviceCommandRequest,
  getSignalSnapshot,
  executePressDeviceCommand,
  precheckPressDeviceCommand,
  postJson,
} from "./driverClient";

const sampleDriverBaseUrl = "http://127.0.0.1:5000";
const sampleCorrelationId = "corr-apply-01";
const sampleTimeoutMs = 5000;

const sampleSignedLease = {
  leaseId: "lease-01",
  targetDeviceId: "device-01",
  targetEndpoint: {
    ip: "10.10.10.10",
    port: 502,
  },
  fencingToken: "fence-01",
  signature: "signed-payload",
};

const sampleSignalConfig = {
  signals: [
    {
      address: 100,
      name: "mesCommunication",
    },
  ],
};

/**
 * @brief Reset all mocks between test cases so request assertions stay isolated.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * @brief Create a minimal Driver Service response payload for applyLeaseAndConfig assertions.
 * @param resultCode Driver result code that should be preserved by the client.
 * @returns Minimal apply response payload.
 */
function createApplyResponse(resultCode: string) {
  return {
    correlationId: sampleCorrelationId,
    resultCode,
    leaseState: "Active",
    deviceSessionState: "Connected",
    leaseId: sampleSignedLease.leaseId,
    targetDeviceId: sampleSignedLease.targetDeviceId,
    fencingToken: sampleSignedLease.fencingToken,
  };
}

/**
 * @brief Create a minimal Driver Service snapshot payload for typed signal assertions.
 * @returns Snapshot payload with correlation metadata and signal values.
 */
function createSnapshotResponse() {
  return {
    correlationId: "corr-snapshot-01",
    resultCode: "OK",
    signalValues: {
      mesCommunication: true,
      machineState: "Ready",
    },
  };
}

describe("driverClient", () => {
  /**
   * @brief Assert that driver apply requests never expose raw ip, port, or deviceId override fields.
   */
  it("builds applyLeaseAndConfig with signedLease and signalConfig only", () => {
    const request = buildApplyLeaseRequest({
      correlationId: sampleCorrelationId,
      signalConfig: sampleSignalConfig,
      signedLease: sampleSignedLease,
      timeoutMs: sampleTimeoutMs,
    });

    expect(request).not.toHaveProperty("ip");
    expect(request).not.toHaveProperty("port");
    expect(request).not.toHaveProperty("deviceId");
    expect(request.signalConfig).toHaveProperty("signals");
    expect(request.signalConfig).not.toHaveProperty("readSignals");
    expect(request).toEqual({
      correlationId: sampleCorrelationId,
      timeoutMs: sampleTimeoutMs,
      signedLease: sampleSignedLease,
      signalConfig: sampleSignalConfig,
    });
  });

  /**
   * @brief Assert that standard Driver Service error codes pass through unchanged for later UI mapping.
   * @param resultCode Standard Driver Service error code under test.
   */
  it.each([
    "LEASE_INVALID",
    "LEASE_EXPIRED",
    "HOST_MISMATCH",
    "SIGNAL_CONFIG_MISMATCH",
  ])("preserves %s from applyLeaseAndConfig", async (resultCode) => {
    const postJson = vi.fn().mockResolvedValue(createApplyResponse(resultCode));

    await expect(
      applyLeaseAndConfig(postJson, {
        correlationId: sampleCorrelationId,
        driverBaseUrl: sampleDriverBaseUrl,
        signalConfig: sampleSignalConfig,
        signedLease: sampleSignedLease,
        timeoutMs: sampleTimeoutMs,
      }),
    ).resolves.toMatchObject({
      correlationId: sampleCorrelationId,
      resultCode,
    });

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:5000/applyLeaseAndConfig",
      {
        correlationId: sampleCorrelationId,
        timeoutMs: sampleTimeoutMs,
        signedLease: sampleSignedLease,
        signalConfig: sampleSignalConfig,
      },
      sampleTimeoutMs,
    );
  });

  /**
   * @brief Assert that the snapshot client returns a typed payload with correlationId and signal values.
   */
  it("returns a typed signal snapshot payload", async () => {
    const postJson = vi.fn().mockResolvedValue(createSnapshotResponse());

    await expect(
      getSignalSnapshot(postJson, {
        correlationId: "corr-snapshot-01",
        driverBaseUrl: sampleDriverBaseUrl,
        timeoutMs: sampleTimeoutMs,
      }),
    ).resolves.toEqual({
      correlationId: "corr-snapshot-01",
      resultCode: "OK",
      signalValues: {
        mesCommunication: true,
        machineState: "Ready",
      },
    });

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:5000/getSignalSnapshot",
      {
        correlationId: "corr-snapshot-01",
        timeoutMs: sampleTimeoutMs,
      },
      sampleTimeoutMs,
    );
  });

  /**
   * @brief Assert that snapshot result codes stay stable when Driver Service rejects the snapshot call.
   */
  it("preserves standard snapshot error codes", async () => {
    const postJson = vi.fn().mockResolvedValue({
      correlationId: "corr-snapshot-01",
      resultCode: "DEVICE_TIMEOUT",
      signalValues: {},
    });

    await expect(
      getSignalSnapshot(postJson, {
        correlationId: "corr-snapshot-01",
        driverBaseUrl: sampleDriverBaseUrl,
        timeoutMs: sampleTimeoutMs,
      }),
    ).resolves.toEqual({
      correlationId: "corr-snapshot-01",
      resultCode: "DEVICE_TIMEOUT",
      signalValues: {},
    });
  });

  /**
   * @brief Assert that non-2xx Driver Service JSON responses still preserve standard result codes.
   */
  it("returns JSON error payloads from non-2xx Driver Service responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            correlationId: sampleCorrelationId,
            resultCode: "LEASE_EXPIRED",
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(
      postJson(
        "http://127.0.0.1:5000/applyLeaseAndConfig",
        {
          correlationId: sampleCorrelationId,
        },
        sampleTimeoutMs,
      ),
    ).resolves.toEqual({
      correlationId: sampleCorrelationId,
      resultCode: "LEASE_EXPIRED",
    });
  });

  /**
   * @brief 将 fetch abort（前端请求中止）映射为 DEVICE_TIMEOUT（设备超时），避免 Error Panel（错误面板）回退到通用启动失败。
   * @author PopoY
   */
  it("maps aborted Driver Service requests to DEVICE_TIMEOUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );

    await expect(
      postJson(
        "http://127.0.0.1:5000/getSignalSnapshot",
        {
          correlationId: "corr-snapshot-timeout",
        },
        sampleTimeoutMs,
      ),
    ).rejects.toMatchObject({
      correlationId: "corr-snapshot-timeout",
      resultCode: "DEVICE_TIMEOUT",
      code: "DEVICE_TIMEOUT",
    });
  });

  /**
   * @brief 断言压机设备动作请求只保留 /executeDeviceCommand（执行设备命令）白名单字段。
   * @author PopoY
   */
  it("builds executePressDeviceCommand with five whitelist fields only", () => {
    const unsafeInput = {
      correlationId: "press-move-in-01",
      commandName: "moveIn",
      localJobSessionId: "press-job-row-01",
      idempotencyKey: "press-move-in-01",
      timeoutMs: 5000,
      deviceId: "drop-device",
      ip: "drop-ip",
      port: 502,
      registerAddress: 100,
      writeValue: true,
    } as const;
    const request = buildPressDeviceCommandRequest(unsafeInput);

    expect(Object.keys(request).sort()).toEqual([
      "commandName",
      "correlationId",
      "idempotencyKey",
      "localJobSessionId",
      "timeoutMs",
    ]);
    expect(request).toEqual({
      correlationId: "press-move-in-01",
      commandName: "moveIn",
      localJobSessionId: "press-job-row-01",
      idempotencyKey: "press-move-in-01",
      timeoutMs: 5000,
    });
    expect(request).not.toHaveProperty("deviceId");
    expect(request).not.toHaveProperty("ip");
    expect(request).not.toHaveProperty("port");
    expect(request).not.toHaveProperty("registerAddress");
    expect(request).not.toHaveProperty("writeValue");
  });

  /**
   * @brief 断言 executePressDeviceCommand（执行压机设备命令）调用固定 endpoint（端点）并收窄响应字段。
   * @author PopoY
   */
  it("posts executePressDeviceCommand to the command endpoint and narrows the response", async () => {
    const postJson = vi.fn().mockResolvedValue({
      correlationId: "press-connect-01",
      commandName: "connectMes",
      localJobSessionId: "press-device-action-01",
      idempotencyKey: "press-connect-01",
      resultCode: "PARTIAL_OK",
      message: "通信已建立，附属步骤需要关注，请查看诊断日志。",
      leaseState: "Active",
      deviceSessionState: "Connected",
      completedSteps: ["MES通信状态"],
      failedSteps: ["附属步骤"],
      deviceId: "drop-device",
      registerAddress: 100,
      writeValue: true,
    });

    await expect(
      executePressDeviceCommand(postJson, {
        driverBaseUrl: sampleDriverBaseUrl,
        correlationId: "press-connect-01",
        commandName: "connectMes",
        localJobSessionId: "press-device-action-01",
        idempotencyKey: "press-connect-01",
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      correlationId: "press-connect-01",
      commandName: "connectMes",
      localJobSessionId: "press-device-action-01",
      idempotencyKey: "press-connect-01",
      resultCode: "PARTIAL_OK",
      message: "通信已建立，附属步骤需要关注，请查看诊断日志。",
      leaseState: "Active",
      deviceSessionState: "Connected",
      completedSteps: ["MES通信状态"],
      failedSteps: ["附属步骤"],
    });

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:5000/executeDeviceCommand",
      {
        correlationId: "press-connect-01",
        commandName: "connectMes",
        localJobSessionId: "press-device-action-01",
        idempotencyKey: "press-connect-01",
        timeoutMs: 5000,
      },
      5000,
    );
  });

  /**
   * @brief 断言 precheckPressDeviceCommand（压机设备命令前置校验）调用专用 endpoint（端点）。
   * @author PopoY
   */
  it("posts precheckPressDeviceCommand to the precheck endpoint", async () => {
    const postJson = vi.fn().mockResolvedValue({
      correlationId: "press-start-precheck-01",
      commandName: "startDeviceSession",
      localJobSessionId: "press-device-action-01",
      idempotencyKey: "press-start-precheck-01",
      resultCode: "SIGNAL_NOT_WRITABLE",
      message: "信号不可写。",
      leaseState: "Active",
      deviceSessionState: "Connected",
      completedSteps: [],
      failedSteps: ["开始信号"],
      registerAddress: 100,
      writeValue: true,
    });

    await expect(
      precheckPressDeviceCommand(postJson, {
        driverBaseUrl: sampleDriverBaseUrl,
        correlationId: "press-start-precheck-01",
        commandName: "startDeviceSession",
        localJobSessionId: "press-device-action-01",
        idempotencyKey: "press-start-precheck-01",
        timeoutMs: 5000,
      }),
    ).resolves.toMatchObject({
      resultCode: "SIGNAL_NOT_WRITABLE",
      completedSteps: [],
      failedSteps: ["开始信号"],
    });

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:5000/precheckDeviceCommand",
      {
        correlationId: "press-start-precheck-01",
        commandName: "startDeviceSession",
        localJobSessionId: "press-device-action-01",
        idempotencyKey: "press-start-precheck-01",
        timeoutMs: 5000,
      },
      5000,
    );
  });
});

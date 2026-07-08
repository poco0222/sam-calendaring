/**
 * @file useDriverSession.test.ts - 验证 Driver Service（驱动服务）session hook（会话钩子）。
 * @author PopoY
 * @created 2026-06-26
 * @brief 验证 startup snapshot retry（启动快照重试）辅助逻辑。
 */

import { describe, expect, it, vi } from "vitest";

import type {
  ApplyLeaseAndConfigResponse,
  GetSignalSnapshotResponse,
  PressDeviceEvent,
} from "../domain/driver";
import {
  applySignalSnapshotEventToData,
  canRefreshSignalSnapshot,
  loadSignalSnapshotWithStartupRetry,
  resolveApplyResultAfterSnapshot,
} from "./useDriverSession";

const connectedApplyResult: ApplyLeaseAndConfigResponse = {
  correlationId: "cid-apply-001",
  resultCode: "OK",
  leaseState: "Active",
  deviceSessionState: "Connected",
  leaseId: "lease-001",
  targetDeviceId: "press-001",
  fencingToken: "10",
};

const okSnapshot: GetSignalSnapshotResponse = {
  correlationId: "cid-snapshot-ok",
  resultCode: "OK",
  signalValues: {
    pressure: 100,
  },
};

const disconnectedApplyResult: ApplyLeaseAndConfigResponse = {
  ...connectedApplyResult,
  deviceSessionState: "Disconnected",
};

/**
 * @brief Build a minimal snapshot response for retry branch assertions.
 * @param resultCode Driver Service result code returned by getSignalSnapshot.
 * @returns Signal snapshot response with an empty value set.
 */
function createSnapshot(resultCode: string): GetSignalSnapshotResponse {
  return {
    correlationId: `cid-snapshot-${resultCode}`,
    resultCode,
    signalValues: {},
  };
}

describe("loadSignalSnapshotWithStartupRetry", () => {
  /**
   * @brief 授权成功但尚未连接设备时，startup snapshot retry（启动快照重试）仍应覆盖首次设备读取抖动。
   * @author PopoY
   */
  it("retries one transient startup snapshot error after successful authorization", async () => {
    const fetchSignalSnapshot = vi
      .fn()
      .mockResolvedValueOnce(createSnapshot("DEVICE_TIMEOUT"))
      .mockResolvedValueOnce(okSnapshot);
    const waitForRetry = vi.fn().mockResolvedValue(undefined);

    await expect(
      loadSignalSnapshotWithStartupRetry(
        disconnectedApplyResult,
        fetchSignalSnapshot,
        waitForRetry,
      ),
    ).resolves.toEqual(okSnapshot);

    expect(fetchSignalSnapshot).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledWith(500);
  });

  /**
   * @brief 授权成功后，设备冷启动读取可在短窗口内多次 retry（重试）。
   * @author PopoY
   */
  it("retries multiple transient startup snapshot errors after successful authorization", async () => {
    const fetchSignalSnapshot = vi
      .fn()
      .mockResolvedValueOnce(createSnapshot("DEVICE_TIMEOUT"))
      .mockResolvedValueOnce(createSnapshot("DEVICE_BUSY"))
      .mockResolvedValueOnce(okSnapshot);
    const waitForRetry = vi.fn().mockResolvedValue(undefined);

    await expect(
      loadSignalSnapshotWithStartupRetry(
        disconnectedApplyResult,
        fetchSignalSnapshot,
        waitForRetry,
      ),
    ).resolves.toEqual(okSnapshot);

    expect(fetchSignalSnapshot).toHaveBeenCalledTimes(3);
    expect(waitForRetry).toHaveBeenCalledTimes(2);
  });

  /**
   * @brief 确定性 identity（身份）错误不应被 retry（重试）隐藏。
   * @author PopoY
   */
  it("does not retry deterministic snapshot errors", async () => {
    const identityMismatchSnapshot = createSnapshot("DEVICE_IDENTITY_MISMATCH");
    const fetchSignalSnapshot = vi.fn().mockResolvedValue(identityMismatchSnapshot);
    const waitForRetry = vi.fn().mockResolvedValue(undefined);

    await expect(
      loadSignalSnapshotWithStartupRetry(
        connectedApplyResult,
        fetchSignalSnapshot,
        waitForRetry,
      ),
    ).resolves.toEqual(identityMismatchSnapshot);

    expect(fetchSignalSnapshot).toHaveBeenCalledTimes(1);
    expect(waitForRetry).not.toHaveBeenCalled();
  });

  /**
   * @brief 授权成功后，抛出的首次 snapshot（快照）异常也允许一次短 retry（重试）。
   * @author PopoY
   */
  it("retries one thrown startup snapshot error after successful authorization", async () => {
    const fetchSignalSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("cold snapshot read failed"))
      .mockResolvedValueOnce(okSnapshot);
    const waitForRetry = vi.fn().mockResolvedValue(undefined);

    await expect(
      loadSignalSnapshotWithStartupRetry(
        disconnectedApplyResult,
        fetchSignalSnapshot,
        waitForRetry,
      ),
    ).resolves.toEqual(okSnapshot);

    expect(fetchSignalSnapshot).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledWith(500);
  });
});

describe("canRefreshSignalSnapshot", () => {
  /**
   * @brief 只有成功授权结果才能启用 manual refresh（手动刷新），避免失败后读取旧 active lease（活跃租约）。
   * @author PopoY
   */
  it("allows refresh only after a successful authorization result", () => {
    expect(canRefreshSignalSnapshot(disconnectedApplyResult)).toBe(true);
    expect(
      canRefreshSignalSnapshot({
        ...disconnectedApplyResult,
        resultCode: "LEASE_INVALID",
      }),
    ).toBe(false);
    expect(canRefreshSignalSnapshot(null)).toBe(false);
  });
});

describe("resolveApplyResultAfterSnapshot", () => {
  /**
   * @brief 成功 snapshot（快照）意味着 Driver Service（驱动服务）已完成设备连接，App Shell（应用外壳）应同步显示 Connected（已连接）。
   * @author PopoY
   */
  it("marks the lease apply result connected after a successful automatic snapshot", () => {
    const resolvedApplyResult = resolveApplyResultAfterSnapshot(
      disconnectedApplyResult,
      okSnapshot,
    );

    expect(resolvedApplyResult.deviceSessionState).toBe("Connected");
    expect(disconnectedApplyResult.deviceSessionState).toBe("Disconnected");
  });

  /**
   * @brief 成功 snapshot（快照）不能覆盖 Driver Service（驱动服务）返回的生产状态。
   * @author PopoY
   */
  it("preserves non-disconnected device session states after a successful automatic snapshot", () => {
    const cleanupPendingApplyResult: ApplyLeaseAndConfigResponse = {
      ...connectedApplyResult,
      deviceSessionState: "CleanupPending",
    };
    const runningApplyResult: ApplyLeaseAndConfigResponse = {
      ...connectedApplyResult,
      deviceSessionState: "Running",
    };

    expect(
      resolveApplyResultAfterSnapshot(cleanupPendingApplyResult, okSnapshot)
        .deviceSessionState,
    ).toBe("CleanupPending");
    expect(
      resolveApplyResultAfterSnapshot(runningApplyResult, okSnapshot)
        .deviceSessionState,
    ).toBe("Running");
  });
});

describe("applySignalSnapshotEventToData", () => {
  /**
   * @brief signalSnapshotChanged（信号快照变化）应只更新 signalSnapshot（信号快照），保留 applyResult（授权结果）。
   * @author PopoY
   */
  it("applies signalSnapshotChanged events to existing driver session data", () => {
    const event: PressDeviceEvent = {
      eventId: "evt-snapshot-001",
      correlationId: "signal-snapshot-publisher-001",
      localJobSessionId: "",
      eventName: "signalSnapshotChanged",
      commandName: "signalSnapshotPublisher",
      resultCode: "OK",
      occurredAt: "2026-07-03T00:00:00Z",
      snapshotValues: [{ signalCode: "pressure", value: 120 }],
    };

    const nextData = applySignalSnapshotEventToData(
      { applyResult: connectedApplyResult, signalSnapshot: okSnapshot },
      event,
    );

    expect(nextData?.applyResult).toBe(connectedApplyResult);
    expect(nextData?.signalSnapshot?.correlationId).toBe(
      "signal-snapshot-publisher-001",
    );
    expect(nextData?.signalSnapshot?.signalValues).toEqual({ pressure: 120 });
  });

  /**
   * @brief SSE（服务器发送事件）只带 scalar value（标量值）时，实时刷新应保留初始 snapshot（快照）的 ERP metadata（元数据）。
   * @author PopoY
   */
  it("preserves signal metadata when applying scalar snapshot change events", () => {
    const event: PressDeviceEvent = {
      eventId: "evt-snapshot-erp",
      correlationId: "signal-snapshot-publisher-erp",
      localJobSessionId: "",
      eventName: "signalSnapshotChanged",
      commandName: "signalSnapshotPublisher",
      resultCode: "OK",
      occurredAt: "2026-07-03T00:00:00Z",
      snapshotValues: [{ signalCode: "277", value: 16 }],
    };
    const currentSnapshot: GetSignalSnapshotResponse = {
      correlationId: "cid-snapshot-erp",
      resultCode: "OK",
      signalValues: {
        "277": {
          signalCode: "277",
          signalName: "下压计数",
          paramGroup: "4",
          unit: "次",
          value: 15,
        },
      },
    };

    const nextData = applySignalSnapshotEventToData(
      { applyResult: connectedApplyResult, signalSnapshot: currentSnapshot },
      event,
    );

    expect(nextData?.signalSnapshot?.signalValues).toEqual({
      "277": {
        signalCode: "277",
        signalName: "下压计数",
        paramGroup: "4",
        unit: "次",
        value: 16,
      },
    });
  });

  /**
   * @brief 非 OK 或非 signalSnapshotChanged（信号快照变化）事件不应改动 driverSession（驱动会话）。
   * @author PopoY
   */
  it("ignores non-ok signal snapshot events", () => {
    const event: PressDeviceEvent = {
      eventId: "evt-snapshot-failed",
      correlationId: "signal-snapshot-publisher-failed",
      localJobSessionId: "",
      eventName: "signalSnapshotChanged",
      commandName: "signalSnapshotPublisher",
      resultCode: "DEVICE_TIMEOUT",
      occurredAt: "2026-07-03T00:00:00Z",
      snapshotValues: [{ signalCode: "pressure", value: 120 }],
    };

    const currentData = {
      applyResult: connectedApplyResult,
      signalSnapshot: okSnapshot,
    };

    expect(applySignalSnapshotEventToData(currentData, event)).toBe(currentData);
  });
});

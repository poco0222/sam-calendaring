/**
 * @file useDriverSession.ts - 管理 Driver Service（驱动服务）session（会话）状态。
 * @author PopoY
 * @created 2026-06-25
 * @brief 暴露 Driver Service（驱动服务）apply-and-snapshot（应用并快照）状态。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApplyLeaseAndConfigResponse,
  GetSignalSnapshotResponse,
  PressDeviceEvent,
} from "../domain/driver";
import { isDriverErrorCode } from "../domain/driverErrors";
import type { SignalConfig, SignedLease } from "../domain/lease";
import {
  applyLeaseAndConfig,
  getSignalSnapshot,
  postJson,
} from "../services/driverClient";
import { logDiagnostic } from "../services/logging";

const DEFAULT_DRIVER_TIMEOUT_MS = 5000;
const STARTUP_SNAPSHOT_RETRY_DELAY_MS = 500;
// PopoY: startup only gets a short bounded retry window; manual refresh remains available for real faults.
const STARTUP_SNAPSHOT_MAX_ATTEMPTS = 3;
// PopoY: only retry transient device-read failures after a confirmed connected apply; lease/security errors must surface immediately.
const STARTUP_SNAPSHOT_RETRY_RESULT_CODES = [
  "DEVICE_TIMEOUT",
  "DEVICE_REJECTED",
  "DEVICE_BUSY",
] as const;

/**
 * @brief Describe the input required to bootstrap the Driver Service session.
 */
export type UseDriverSessionInput = {
  driverBaseUrl: string;
  stationAccountId: string;
  signedLease: SignedLease;
  signalConfig: SignalConfig;
  timeoutMs?: number;
};

/**
 * @brief Model the minimal async states needed by the Driver Service hook.
 */
export type DriverSessionStatus = "idle" | "loading" | "success" | "error";

/**
 * @brief Describe the combined Driver Service data surfaced to React consumers.
 */
export type DriverSessionData = {
  applyResult: ApplyLeaseAndConfigResponse | null;
  signalSnapshot: GetSignalSnapshotResponse | null;
};

/**
 * @brief 描述 Driver Service hook（驱动服务钩子）对页面暴露的公开状态和操作。
 * @author PopoY
 */
export type UseDriverSessionResult = {
  status: DriverSessionStatus;
  data: DriverSessionData | null;
  error: unknown;
  retry: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  applySignalSnapshotEvent: (event: PressDeviceEvent) => void;
};

/**
 * @brief Define a one-shot signal snapshot fetcher used by startup retry.
 */
type SignalSnapshotFetcher = () => Promise<GetSignalSnapshotResponse>;

/**
 * @brief Define the delay function used before a startup snapshot retry.
 * @param delayMs Retry delay in milliseconds.
 * @returns Promise resolved after the delay window.
 */
type StartupSnapshotRetryDelay = (delayMs: number) => Promise<void>;

/**
 * @brief Run applyLeaseAndConfig and then getSignalSnapshot for React consumers.
 * @param input Driver Service bootstrap input or null when the upstream session is unavailable.
 * @returns Minimal state object with driver status, data, error, and retry.
 */
export function useDriverSession(
  input: UseDriverSessionInput | null,
): UseDriverSessionResult {
  const [status, setStatus] = useState<DriverSessionStatus>("idle");
  const [data, setData] = useState<DriverSessionData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const mountedRef = useRef(true);

  const loadSignalSnapshot = useCallback(
    async (applyResult: ApplyLeaseAndConfigResponse) => {
      if (!input) {
        return;
      }

      const timeoutMs = input.timeoutMs ?? DEFAULT_DRIVER_TIMEOUT_MS;
      let lastCorrelationId = createCorrelationId();
      let lastStartedAt = Date.now();

      try {
        const fetchSignalSnapshot = async () => {
          lastCorrelationId = createCorrelationId();
          lastStartedAt = Date.now();
          const signalSnapshot = await getSignalSnapshot(postJson, {
            correlationId: lastCorrelationId,
            driverBaseUrl: input.driverBaseUrl,
            timeoutMs,
          });

          if (isDriverErrorCode(signalSnapshot.resultCode)) {
            logDiagnostic({
              correlationId: signalSnapshot.correlationId ?? lastCorrelationId,
              commandName: "getSignalSnapshot",
              durationMs: Date.now() - lastStartedAt,
              resultCode: signalSnapshot.resultCode,
              stationAccountId: input.stationAccountId,
            });
          }

          return signalSnapshot;
        };

        const signalSnapshot = await loadSignalSnapshotWithStartupRetry(
          applyResult,
          fetchSignalSnapshot,
        );

        if (!mountedRef.current) {
          return;
        }

        // PopoY: snapshot failures must surface stable Driver Service result codes for later UI mapping.
        if (isDriverErrorCode(signalSnapshot.resultCode)) {
          setData({
            applyResult,
            signalSnapshot,
          });
          setError(signalSnapshot);
          setStatus("error");
          return;
        }

        setData({
          applyResult: resolveApplyResultAfterSnapshot(applyResult, signalSnapshot),
          signalSnapshot,
        });
        setStatus("success");
      } catch (caughtError) {
        logDiagnostic({
          correlationId: lastCorrelationId,
          commandName: "getSignalSnapshot",
          durationMs: Date.now() - lastStartedAt,
          resultCode: readErrorCode(caughtError),
          stationAccountId: input.stationAccountId,
        });

        if (!mountedRef.current) {
          return;
        }

        setData({
          applyResult,
          signalSnapshot: null,
        });
        setError(caughtError);
        setStatus("error");
      }
    },
    [input],
  );

  const retry = useCallback(async () => {
    if (!input) {
      return;
    }

    const timeoutMs = input.timeoutMs ?? DEFAULT_DRIVER_TIMEOUT_MS;
    const correlationId = createCorrelationId();
    const startedAt = Date.now();

    setStatus("loading");
    setError(null);

    try {
      const applyResult = await applyLeaseAndConfig(postJson, {
        correlationId,
        driverBaseUrl: input.driverBaseUrl,
        signalConfig: input.signalConfig,
        signedLease: input.signedLease,
        timeoutMs,
      });

      if (isDriverErrorCode(applyResult.resultCode)) {
        logDiagnostic({
          correlationId: applyResult.correlationId ?? correlationId,
          commandName: "applyLeaseAndConfig",
          durationMs: Date.now() - startedAt,
          resultCode: applyResult.resultCode,
          stationAccountId: input.stationAccountId,
        });
      }

      if (!mountedRef.current) {
        return;
      }

      // PopoY: stop before snapshot when Driver Service already returned a stable domain error code.
      if (isDriverErrorCode(applyResult.resultCode)) {
        setData({
          applyResult,
          signalSnapshot: null,
        });
        setError(applyResult);
        setStatus("error");
        return;
      }

      await loadSignalSnapshot(applyResult);
    } catch (caughtError) {
      logDiagnostic({
        correlationId,
        commandName: "applyLeaseAndConfig",
        durationMs: Date.now() - startedAt,
        resultCode: readErrorCode(caughtError),
        stationAccountId: input.stationAccountId,
      });

      if (!mountedRef.current) {
        return;
      }

      setData(null);
      setError(caughtError);
      setStatus("error");
    }
  }, [input, loadSignalSnapshot]);

  const refreshSnapshot = useCallback(async () => {
    if (!input || !canRefreshSignalSnapshot(data?.applyResult)) {
      return;
    }

    setStatus("loading");
    setError(null);

    await loadSignalSnapshot(data.applyResult);
  }, [data?.applyResult, input, loadSignalSnapshot]);

  const applySignalSnapshotEvent = useCallback((event: PressDeviceEvent) => {
    setData((currentData) => applySignalSnapshotEventToData(currentData, event));
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!input) {
      setData(null);
      setError(null);
      setStatus("idle");
      return () => {
        mountedRef.current = false;
      };
    }

    void retry();

    return () => {
      mountedRef.current = false;
    };
  }, [input, retry]);

  return {
    status,
    data,
    error,
    retry,
    refreshSnapshot,
    applySignalSnapshotEvent,
  };
}

/**
 * @brief 将 signalSnapshotChanged（信号快照变化）事件应用到 driverSession（驱动会话）数据。
 * @author PopoY
 * @param currentData 当前 driverSession（驱动会话）数据。
 * @param event Driver device event（驱动设备事件）。
 * @returns 更新后的数据；不应处理的事件返回原引用。
 */
export function applySignalSnapshotEventToData(
  currentData: DriverSessionData | null,
  event: PressDeviceEvent,
): DriverSessionData | null {
  if (
    !currentData ||
    event.eventName !== "signalSnapshotChanged" ||
    event.resultCode !== "OK"
  ) {
    return currentData;
  }

  const currentSignalValues = currentData.signalSnapshot?.signalValues ?? {};
  const nextSignalValues = { ...currentSignalValues };

  for (const item of event.snapshotValues) {
    const currentValue = currentSignalValues[item.signalCode];
    // @author PopoY: SSE（服务器发送事件）只传安全 scalar（标量），这里保留首帧 snapshot（快照）的 ERP metadata（元数据）。
    nextSignalValues[item.signalCode] = isPlainRecord(currentValue)
      ? { ...currentValue, value: item.value }
      : item.value;
  }

  return {
    applyResult: currentData.applyResult,
    signalSnapshot: {
      correlationId: event.correlationId,
      resultCode: "OK",
      signalValues: nextSignalValues,
    },
  };
}

/**
 * @brief Fetch a signal snapshot and briefly retry when startup hits transient device-read failures after successful authorization.
 * @author PopoY
 * @param applyResult Successful applyLeaseAndConfig（应用租约与配置）response used to decide retry safety.
 * @param fetchSignalSnapshot One-shot signal snapshot fetcher.
 * @param waitForRetry Delay function injected by tests.
 * @returns The first successful snapshot, or the final failed snapshot.
 */
export async function loadSignalSnapshotWithStartupRetry(
  applyResult: ApplyLeaseAndConfigResponse,
  fetchSignalSnapshot: SignalSnapshotFetcher,
  waitForRetry: StartupSnapshotRetryDelay = waitForStartupSnapshotRetry,
): Promise<GetSignalSnapshotResponse> {
  for (let attemptIndex = 1; attemptIndex <= STARTUP_SNAPSHOT_MAX_ATTEMPTS; attemptIndex += 1) {
    try {
      const signalSnapshot = await fetchSignalSnapshot();

      if (
        attemptIndex >= STARTUP_SNAPSHOT_MAX_ATTEMPTS ||
        !shouldRetryStartupSnapshot(applyResult, signalSnapshot)
      ) {
        return signalSnapshot;
      }
    } catch (error) {
      if (
        attemptIndex >= STARTUP_SNAPSHOT_MAX_ATTEMPTS ||
        !canRefreshSignalSnapshot(applyResult)
      ) {
        throw error;
      }
    }

    await waitForRetry(STARTUP_SNAPSHOT_RETRY_DELAY_MS);
  }

  throw new Error("Startup snapshot retry exited unexpectedly.");
}

/**
 * @brief 根据 successful snapshot（成功快照）同步 apply result（授权结果）的 device session（设备会话）状态。
 * @author PopoY
 * @param applyResult applyLeaseAndConfig（应用租约与配置）返回的授权结果。
 * @param signalSnapshot getSignalSnapshot（获取信号快照）返回的读取结果。
 * @returns snapshot（快照）成功时仅把启动态同步为 Connected（已连接）的授权结果。
 */
export function resolveApplyResultAfterSnapshot(
  applyResult: ApplyLeaseAndConfigResponse,
  signalSnapshot: GetSignalSnapshotResponse,
): ApplyLeaseAndConfigResponse {
  if (
    signalSnapshot.resultCode !== "OK" ||
    (applyResult.deviceSessionState &&
      applyResult.deviceSessionState !== "Disconnected" &&
      applyResult.deviceSessionState !== "Connecting")
  ) {
    return applyResult;
  }

  return {
    ...applyResult,
    deviceSessionState: "Connected",
  };
}

/**
 * @brief 判断当前 authorization（授权）结果是否允许 refresh snapshot（刷新快照）。
 * @author PopoY
 * @param applyResult applyLeaseAndConfig（应用租约与配置）返回的授权结果。
 * @returns 成功授权且 lease（租约）活跃时返回 true。
 */
export function canRefreshSignalSnapshot(
  applyResult: ApplyLeaseAndConfigResponse | null | undefined,
): applyResult is ApplyLeaseAndConfigResponse {
  return applyResult?.resultCode === "OK" && applyResult.leaseState === "Active";
}

/**
 * @brief Decide whether a startup snapshot error is safe to retry automatically.
 * @author PopoY
 * @param applyResult Driver apply response produced immediately before the snapshot.
 * @param signalSnapshot First snapshot response.
 * @returns True when one automatic retry should run.
 */
function shouldRetryStartupSnapshot(
  applyResult: ApplyLeaseAndConfigResponse,
  signalSnapshot: GetSignalSnapshotResponse,
): boolean {
  return (
    canRefreshSignalSnapshot(applyResult) &&
    STARTUP_SNAPSHOT_RETRY_RESULT_CODES.includes(
      signalSnapshot.resultCode as (typeof STARTUP_SNAPSHOT_RETRY_RESULT_CODES)[number],
    )
  );
}

/**
 * @brief Wait briefly before retrying the startup snapshot so real devices can finish cold-start reads.
 * @author PopoY
 * @param delayMs Delay in milliseconds.
 * @returns Promise resolved after the delay window.
 */
function waitForStartupSnapshotRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * @brief 判断 snapshot value（快照值）是否为可合并的 plain record（普通记录）。
 * @author PopoY
 * @param value 待检查的 runtime value（运行时值）。
 * @returns 可安全 shallow merge（浅合并）时返回 true。
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @brief Create a correlationId for Driver Service commands without pulling in extra dependencies.
 * @returns Stable-enough UUID string for bootstrap diagnostics.
 */
function createCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `driver-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * @brief Read a stable result code from an unknown runtime error for diagnostic logging.
 * @param value Unknown runtime failure captured by the driver hook.
 * @returns Stable code string when present, otherwise a generic fallback.
 */
function readErrorCode(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "UNKNOWN_ERROR";
  }

  const code = (value as Record<string, unknown>).code;
  const resultCode = (value as Record<string, unknown>).resultCode;

  if (typeof resultCode === "string" && resultCode.length > 0) {
    return resultCode;
  }

  if (typeof code === "string" && code.length > 0) {
    return code;
  }

  return "UNKNOWN_ERROR";
}

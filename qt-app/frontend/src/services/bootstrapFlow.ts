/**
 * @file bootstrapFlow.ts - 实现 bootstrap flow（启动引导流程）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 组合 native config（原生配置）到 first signal snapshot（首次信号快照）的验证流程。
 */

import { isDriverErrorCode } from "../domain/driverErrors";
import type {
  ApplyLeaseAndConfigResponse,
  GetSignalSnapshotResponse,
} from "../domain/driver";
import type {
  ApplyLeaseAndConfigInput,
  GetSignalSnapshotInput,
} from "./driverClient";
import type { BootstrapSession } from "./erpClient";
import type { NativeBootstrapConfig } from "../types/native";

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * @brief Model the injected dependencies needed by the pure bootstrap verification harness.
 */
export type BootstrapFlowDeps = {
  readNativeConfig: () => Promise<NativeBootstrapConfig>;
  loadBootstrapSession: (
    config: NativeBootstrapConfig,
  ) => Promise<BootstrapSession>;
  applyLeaseAndConfig: (
    input: ApplyLeaseAndConfigInput,
  ) => Promise<ApplyLeaseAndConfigResponse>;
  getSignalSnapshot: (
    input: GetSignalSnapshotInput,
  ) => Promise<GetSignalSnapshotResponse>;
  createCorrelationId?: () => string;
  timeoutMs?: number;
};

/**
 * @brief Enumerate the native config fields that must exist before the bootstrap chain can start.
 */
export const REQUIRED_BOOTSTRAP_CONFIG_FIELDS = [
  "stationAccountId",
  "granteeHostId",
  "stationId",
  "erpBaseUrl",
  "driverBaseUrl",
  "configVersion",
] as const;

/**
 * @brief Model the known native config field names used by bootstrap validation.
 */
export type RequiredBootstrapConfigField =
  (typeof REQUIRED_BOOTSTRAP_CONFIG_FIELDS)[number];

/**
 * @brief Model the composed bootstrap harness result for Task7 verification.
 */
export type BootstrapFlowResult =
  | {
      state: "ConfigInvalid";
      config: NativeBootstrapConfig;
      missingFields: RequiredBootstrapConfigField[];
    }
  | {
      state: "DriverRejected";
      config: NativeBootstrapConfig;
      session: BootstrapSession;
      applyResult: ApplyLeaseAndConfigResponse;
    }
  | {
      state: "SnapshotReady";
      config: NativeBootstrapConfig;
      session: BootstrapSession;
      applyResult: ApplyLeaseAndConfigResponse;
      signalSnapshot: GetSignalSnapshotResponse;
    };

/**
 * @brief Run the minimal bootstrap chain needed by Task7 verification from config to first signal snapshot.
 * @param deps Injected IO dependencies so the harness stays pure and testable.
 * @returns Composed bootstrap result that either short-circuits on known invalid states or reaches SnapshotReady.
 */
export async function runBootstrapFlow(
  deps: BootstrapFlowDeps,
): Promise<BootstrapFlowResult> {
  const config = await deps.readNativeConfig();
  const missingFields = readMissingBootstrapConfigFields(config);

  if (missingFields.length > 0) {
    return {
      state: "ConfigInvalid",
      config,
      missingFields,
    };
  }

  const session = await deps.loadBootstrapSession(config);
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // PopoY: reuse one correlationId across the composed flow so Task7 can assert a single bootstrap transaction.
  const correlationId = deps.createCorrelationId?.() ?? "bootstrap-flow";
  const applyResult = await deps.applyLeaseAndConfig({
    correlationId,
    driverBaseUrl: config.driverBaseUrl,
    timeoutMs,
    signalConfig: session.signalConfig,
    signedLease: session.signedLease,
  });

  if (isDriverErrorCode(applyResult.resultCode)) {
    return {
      state: "DriverRejected",
      config,
      session,
      applyResult,
    };
  }

  const signalSnapshot = await deps.getSignalSnapshot({
    correlationId,
    driverBaseUrl: config.driverBaseUrl,
    timeoutMs,
  });

  return {
    state: "SnapshotReady",
    config,
    session,
    applyResult,
    signalSnapshot,
  };
}

/**
 * @brief Collect the required native config fields that are blank before the bootstrap chain begins.
 * @param config Native bootstrap config returned by the Qt bridge.
 * @returns Missing or blank field names in stable order.
 */
export function readMissingBootstrapConfigFields(
  config: NativeBootstrapConfig,
): RequiredBootstrapConfigField[] {
  return REQUIRED_BOOTSTRAP_CONFIG_FIELDS.filter((fieldName) =>
    isBlank(config[fieldName]),
  );
}

/**
 * @brief Check whether a config value is blank after trimming surrounding whitespace.
 * @param value Native config field value under validation.
 * @returns True when the value is empty or whitespace-only.
 */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * @file useBootstrapSession.ts - 管理 bootstrap session（启动引导会话）状态。
 * @author PopoY
 * @created 2026-06-25
 * @brief 暴露 bootstrap session（启动引导会话）加载状态。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createBootstrapError } from "../domain/errors";
import { readNativeConfig } from "../services/nativeBridge";
import {
  getJson,
  loadBootstrapSession,
  postJson,
  type BootstrapSession,
} from "../services/erpClient";
import {
  REQUIRED_BOOTSTRAP_CONFIG_FIELDS,
  readMissingBootstrapConfigFields,
} from "../services/bootstrapFlow";
import { logDiagnostic } from "../services/logging";
import type { NativeBootstrapConfig } from "../types/native";

const UNKNOWN_STATION_ACCOUNT_ID = "UNKNOWN_STATION_ACCOUNT";

/**
 * @brief Model the minimal async states needed by the bootstrap session hook.
 */
export type BootstrapSessionStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

/**
 * @brief Describe the public result returned by the bootstrap session hook.
 */
export type UseBootstrapSessionResult = {
  status: BootstrapSessionStatus;
  config: NativeBootstrapConfig | null;
  data: BootstrapSession | null;
  error: unknown;
  retry: () => Promise<void>;
};

/**
 * @brief Define the native config reader dependency used by the runtime bootstrap loader.
 */
export type NativeBootstrapConfigReader = () => Promise<NativeBootstrapConfig>;

/**
 * @brief Define the ERP bootstrap session loader dependency used after config validation.
 * @param config Native bootstrap config already validated by the runtime loader.
 * @returns ERP bootstrap session payload.
 */
export type BootstrapSessionLoader = (
  config: NativeBootstrapConfig,
) => Promise<BootstrapSession>;

/**
 * @brief Model the validated bootstrap session package consumed by the React hook.
 */
export type ValidatedBootstrapSession = {
  config: NativeBootstrapConfig;
  session: BootstrapSession;
};

/**
 * @brief 描述 CONFIG_INVALID（配置无效）错误携带的已读取 native config（原生配置）。
 * @author PopoY
 */
type BootstrapConfigError = ReturnType<typeof createBootstrapError> & {
  config?: NativeBootstrapConfig;
};

/**
 * @brief Read native config, stop on missing required fields, then load the ERP bootstrap session.
 * @param readConfig Native config reader dependency.
 * @param loadSession ERP bootstrap session loader dependency.
 * @returns Native config and ERP session package when validation succeeds.
 */
export async function loadValidatedBootstrapSession(
  readConfig: NativeBootstrapConfigReader,
  loadSession: BootstrapSessionLoader,
): Promise<ValidatedBootstrapSession> {
  const nextConfig = await readConfig();
  const missingFields = readMissingBootstrapConfigFields(nextConfig);

  if (missingFields.length > 0) {
    const error = createBootstrapError(
      "CONFIG_INVALID",
      `Missing bootstrap config: ${missingFields.join(", ")}`,
    ) as BootstrapConfigError;

    error.config = nextConfig;
    error.missingFields = missingFields;
    throw error;
  }

  return {
    config: nextConfig,
    session: await loadSession(nextConfig),
  };
}

/**
 * @brief Load native config and ERP bootstrap session together for React consumers.
 * @returns Minimal state object with status, session payload, error, and retry.
 */
export function useBootstrapSession(): UseBootstrapSessionResult {
  const [status, setStatus] = useState<BootstrapSessionStatus>("idle");
  const [config, setConfig] = useState<NativeBootstrapConfig | null>(null);
  const [data, setData] = useState<BootstrapSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const mountedRef = useRef(true);

  const retry = useCallback(async () => {
    const correlationId = createDiagnosticCorrelationId("bootstrap");
    const startedAt = Date.now();
    let stationAccountId = UNKNOWN_STATION_ACCOUNT_ID;

    setStatus("loading");
    setError(null);

    try {
      const { config: nextConfig, session } = await loadValidatedBootstrapSession(
        readNativeConfig,
        (config) => loadBootstrapSession(postJson, config, getJson),
      );

      stationAccountId = nextConfig.stationAccountId;

      if (!mountedRef.current) {
        return;
      }

      setConfig(nextConfig);
      setData(session);
      setStatus("success");
    } catch (caughtError) {
      logDiagnostic({
        correlationId,
        commandName: "loadBootstrapSession",
        durationMs: Date.now() - startedAt,
        resultCode: readErrorCode(caughtError),
        stationAccountId,
      });

      if (!mountedRef.current) {
        return;
      }

      setConfig(readBootstrapConfigFromError(caughtError));
      setData(null);
      setError(caughtError);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void retry();

    return () => {
      mountedRef.current = false;
    };
  }, [retry]);

  return {
    status,
    config,
    data,
    error,
    retry,
  };
}

/**
 * @brief 从 CONFIG_INVALID（配置无效）错误读取可用于首次启动页预填的 native config（原生配置）。
 * @author PopoY
 * @param value bootstrap（启动）流程捕获的未知错误。
 * @returns 携带完整六字段配置时返回该配置，否则返回 null。
 */
function readBootstrapConfigFromError(value: unknown): NativeBootstrapConfig | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const config = (value as { config?: unknown }).config;

  return isNativeBootstrapConfig(config) ? config : null;
}

/**
 * @brief 校验未知值是否为完整 NativeBootstrapConfig（原生启动配置）。
 * @author PopoY
 * @param value 待校验的 unknown（未知值）。
 * @returns 六个 bootstrap config（启动配置）字段均为 string（字符串）时返回 true。
 */
function isNativeBootstrapConfig(value: unknown): value is NativeBootstrapConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return REQUIRED_BOOTSTRAP_CONFIG_FIELDS.every(
    (fieldName) => typeof (value as Record<string, unknown>)[fieldName] === "string",
  );
}

/**
 * @brief Read a stable result code from an unknown runtime error for diagnostic logging.
 * @param value Unknown runtime failure captured by the bootstrap hook.
 * @returns Stable code string when present, otherwise a generic fallback.
 */
function readErrorCode(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "UNKNOWN_ERROR";
  }

  const code = (value as Record<string, unknown>).code;
  const resultCode = (value as Record<string, unknown>).resultCode;

  if (typeof code === "string" && code.length > 0) {
    return code;
  }

  if (typeof resultCode === "string" && resultCode.length > 0) {
    return resultCode;
  }

  return "UNKNOWN_ERROR";
}

/**
 * @brief Create a lightweight correlationId for bootstrap diagnostics without adding a dependency.
 * @param prefix Stable diagnostic prefix for the current command.
 * @returns Stable-enough diagnostic correlation identifier.
 */
function createDiagnosticCorrelationId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

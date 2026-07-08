/**
 * @file diagnosticLogClient.ts - 封装 diagnostic log（诊断日志）客户端请求。
 * @author PopoY
 * @created 2026-06-27
 * @brief 实现 GET /diagnosticLogs（诊断日志接口）的最小 typed client（类型化客户端）。
 */

import {
  diagnosticLogRecordKeys,
  type DiagnosticLogRecord,
  type DiagnosticLogsQuery,
  type DiagnosticLogsResponse,
} from "../domain/diagnosticLog";

export type GetJson = <TResponse>(url: string, timeoutMs: number) => Promise<TResponse>;

export type DiagnosticLogsInput = DiagnosticLogsQuery & {
  driverBaseUrl: string;
  timeoutMs?: number;
};

/**
 * @brief 构建 Diagnostic Logs API（诊断日志接口）URL（统一资源定位符）。
 * @param driverBaseUrl Driver Service（驱动服务）基础地址。
 * @param query 只包含允许筛选字段的查询条件。
 * @returns 可直接用于 GET（读取）请求的 absolute URL（绝对地址）。
 */
export function buildDiagnosticLogsUrl(
  driverBaseUrl: string,
  query: DiagnosticLogsQuery,
): string {
  const url = new URL("/diagnosticLogs", driverBaseUrl);

  url.searchParams.set("statusClass", query.statusClass);
  url.searchParams.set("category", query.category);
  if (query.correlationId) {
    url.searchParams.set("correlationId", query.correlationId);
  }
  if (query.fromUtc) {
    url.searchParams.set("fromUtc", query.fromUtc);
  }
  if (query.toUtc) {
    url.searchParams.set("toUtc", query.toUtc);
  }
  if (query.limit !== undefined) {
    url.searchParams.set("limit", String(query.limit));
  }

  return url.toString();
}

/**
 * @brief 拉取 diagnostic logs（诊断日志）并保留白名单响应字段。
 * @param getJson JSON GET（读取）函数，便于测试替换。
 * @param input Driver Service（驱动服务）地址、筛选器和 timeout（超时）配置。
 * @returns 只包含 approved fields（批准字段）的诊断日志响应。
 */
export async function fetchDiagnosticLogs(
  getJson: GetJson,
  input: DiagnosticLogsInput,
): Promise<DiagnosticLogsResponse> {
  const response = await getJson<DiagnosticLogsResponse>(
    buildDiagnosticLogsUrl(input.driverBaseUrl, input),
    input.timeoutMs ?? 5000,
  );

  return {
    resultCode: response.resultCode,
    logs: response.logs.map(narrowDiagnosticLogRecord),
  };
}

/**
 * @brief 通过 fetch（浏览器请求）执行 JSON GET（读取）请求。
 * @param url 目标 Driver Service（驱动服务）URL（统一资源定位符）。
 * @param timeoutMs 请求超时时间，单位毫秒。
 * @returns 解析后的 JSON（对象表示法）响应。
 */
export async function getJson<TResponse>(
  url: string,
  timeoutMs: number,
): Promise<TResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const responseBody = await readJsonResponse<TResponse>(response);
    if (!response.ok) {
      if (responseBody !== null) {
        return responseBody;
      }

      throw new Error(`HTTP ${response.status}`);
    }

    if (responseBody === null) {
      throw new Error("Driver Service（驱动服务）返回了空 JSON（对象表示法）响应。");
    }

    return responseBody;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Diagnostic Logs（诊断日志）请求在 ${timeoutMs}ms 后超时。`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * @brief 解析 JSON（对象表示法）响应体，空响应或非 JSON 响应返回 null。
 * @param response fetch（浏览器请求）返回的响应对象。
 * @returns 解析后的 JSON（对象表示法）对象，或 null。
 */
async function readJsonResponse<TResponse>(
  response: Response,
): Promise<TResponse | null> {
  try {
    return (await response.json()) as TResponse;
  } catch {
    return null;
  }
}

/**
 * @brief 收窄单条 diagnostic log（诊断日志），避免额外字段进入 UI（用户界面）。
 * @param record 后端返回的单条日志对象。
 * @returns 仅含白名单字段的日志对象。
 */
function narrowDiagnosticLogRecord(record: DiagnosticLogRecord): DiagnosticLogRecord {
  return Object.fromEntries(
    diagnosticLogRecordKeys
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, record[key]]),
  ) as DiagnosticLogRecord;
}

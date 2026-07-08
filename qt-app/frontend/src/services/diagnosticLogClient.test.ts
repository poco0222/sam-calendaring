/**
 * @file diagnosticLogClient.test.ts - 验证 diagnostic log client（诊断日志客户端）。
 * @author PopoY
 * @created 2026-06-27
 * @brief 验证 Diagnostic Logs API（诊断日志接口）客户端的 GET（读取）契约。
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildDiagnosticLogsUrl,
  fetchDiagnosticLogs,
  type GetJson,
} from "./diagnosticLogClient";

describe("diagnosticLogClient", () => {
  /**
   * @brief 断言查询参数包含 statusClass（状态分类）、category（分类）、correlationId（关联 ID）和 limit（数量限制）。
   */
  it("builds the whitelisted diagnostic logs URL", () => {
    const url = buildDiagnosticLogsUrl("http://127.0.0.1:5096", {
      statusClass: "abnormal",
      category: "device",
      correlationId: "cid-001",
      limit: 100,
    });

    expect(url).toBe(
      "http://127.0.0.1:5096/diagnosticLogs?statusClass=abnormal&category=device&correlationId=cid-001&limit=100",
    );
    expect(url).not.toContain("ip=");
    expect(url).not.toContain("port=");
    expect(url).not.toContain("deviceId=");
  });

  /**
   * @brief 断言最近三天查询使用 fromUtc/toUtc（UTC 起止时间）且不强制 limit（数量限制）。
   * @author PopoY
   */
  it("builds the three-day diagnostic logs URL without a hard limit", () => {
    const rawUrl = buildDiagnosticLogsUrl("http://127.0.0.1:5096", {
      statusClass: "all",
      category: "all",
      fromUtc: "2026-06-26T02:06:59.884Z",
      toUtc: "2026-06-29T02:06:59.884Z",
    });
    const url = new URL(rawUrl);

    expect(url.searchParams.get("statusClass")).toBe("all");
    expect(url.searchParams.get("category")).toBe("all");
    expect(url.searchParams.get("fromUtc")).toBe("2026-06-26T02:06:59.884Z");
    expect(url.searchParams.get("toUtc")).toBe("2026-06-29T02:06:59.884Z");
    expect(url.searchParams.has("limit")).toBe(false);
  });

  /**
   * @brief 断言客户端使用 GET（读取）并返回白名单 logs（日志）数组。
   */
  it("fetches diagnostic logs through GET", async () => {
    const getJson: GetJson = vi.fn().mockResolvedValue({
      resultCode: "OK",
      logs: [
        {
          createdAt: "2026-06-27T10:00:00Z",
          level: "Error",
          category: "Device",
          statusClass: "Abnormal",
          eventName: "SignalReadFailed",
          eventStage: "Failed",
          correlationId: "cid-001",
          commandName: "getSignalSnapshot",
          resultCode: "DEVICE_TIMEOUT",
          httpStatusCode: 504,
          durationMs: 5000,
          message: "设备通信超时",
          exceptionType: "TimeoutException",
        },
      ],
    });

    const result = await fetchDiagnosticLogs(getJson, {
      driverBaseUrl: "http://127.0.0.1:5096",
      statusClass: "abnormal",
      category: "device",
      limit: 100,
    });

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:5096/diagnosticLogs?statusClass=abnormal&category=device&limit=100",
      5000,
    );
    expect(result.logs).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("signedLease");
    expect(JSON.stringify(result)).not.toContain("sessionToken");
  });
});

/**
 * @file logging.test.ts - 验证前端 logging（日志）逻辑。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 Task6（任务六）白名单 diagnostic logging（诊断日志）契约。
 */

import { describe, expect, it, vi } from "vitest";

import type { LogRecord } from "../domain/logRecord";
import { createDiagnosticLog, logDiagnostic } from "./logging";

const sampleLogRecord: LogRecord = {
  correlationId: "corr-task6-01",
  commandName: "applyLeaseAndConfig",
  durationMs: 128,
  resultCode: "LEASE_INVALID",
  stationAccountId: "station-a",
};

describe("logging", () => {
  /**
   * @brief 断言 bootstrap diagnostics（启动诊断）忽略 secrets（敏感值）和 authorization payload（授权载荷）。
   * @author PopoY
   */
  it("ignores privateKey, raw signature, and full authorization payload fields", () => {
    const entry = createDiagnosticLog(sampleLogRecord, {
      authorizationPayload: {
        sessionToken: "erp-session-token",
        signalConfig: {
          topic: "stations/station-01",
        },
        signedLease: {
          leaseId: "lease-01",
          signature: "raw-signed-payload",
        },
      },
      privateKey: "secret-private-key",
      safeHint: "kept",
      signature: "raw-top-level-signature",
    });

    expect(entry).toEqual({
      record: sampleLogRecord,
    });
    expect(JSON.stringify(entry)).not.toContain("secret-private-key");
    expect(JSON.stringify(entry)).not.toContain("raw-signed-payload");
    expect(JSON.stringify(entry)).not.toContain("erp-session-token");
    expect(JSON.stringify(entry)).not.toContain("kept");
  });

  /**
   * @brief 断言 logging helper（日志辅助函数）只把白名单 diagnostic record（诊断记录）写入 sink（输出端）。
   * @author PopoY
   */
  it("writes only the whitelist diagnostic entry through the sink", () => {
    const sink = vi.fn();

    const entry = logDiagnostic(sampleLogRecord, undefined, sink);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(entry);
    expect(entry).toEqual({
      record: sampleLogRecord,
    });
  });

  /**
   * @brief 断言锁模 diagnostic log（诊断日志）只允许 Task3（任务三）白名单字段。
   * @author PopoY
   */
  it("allows mold lock summary fields without accepting raw payload fields", () => {
    const moldLockRecord = {
      correlationId: "press-mold-lock-01",
      moldNo: "MOLD-01",
      operatorId: "zhangsan",
      teamId: "PLINE-01",
      processId: "CRAFT-001",
      commandName: "pressMoldLock",
      durationMs: 28,
      resultCode: "OK",
      stationAccountId: "station-a",
    } as unknown as LogRecord;
    const entry = createDiagnosticLog(moldLockRecord, {
      selectedRows: [{ moldNo: "MOLD-01" }],
      rawResponse: { sessionToken: "secret-token" },
      signedLease: "secret-lease",
      signalConfig: "secret-config",
    });

    expect(entry.record).not.toHaveProperty("moldNo");
    expect(entry.record).toMatchObject({
      correlationId: "press-mold-lock-01",
      operatorId: "zhangsan",
      teamId: "PLINE-01",
      processId: "CRAFT-001",
      commandName: "pressMoldLock",
      durationMs: 28,
      resultCode: "OK",
      stationAccountId: "station-a",
    });
    expect(JSON.stringify(entry)).not.toContain("selectedRows");
    expect(JSON.stringify(entry)).not.toContain("rawResponse");
    expect(JSON.stringify(entry)).not.toContain("secret-token");
    expect(JSON.stringify(entry)).not.toContain("secret-lease");
    expect(JSON.stringify(entry)).not.toContain("secret-config");
  });

  /**
   * @brief 断言压机设备动作 diagnostic summary（诊断摘要）只保留按钮、动作和结果白名单字段。
   * @author PopoY
   */
  it("allows press device action summary fields without accepting raw payload fields", () => {
    const actionRecord = {
      correlationId: "press-line-in-01",
      localJobSessionId: "press-device-action-01",
      idempotencyKey: "press-line-in-01",
      buttonKey: "lineIn",
      commandName: "lineIn",
      durationMs: 42,
      resultCode: "OK",
      driverResultCode: "OK",
      erpResultCode: "OK",
      stationAccountId: "station-a",
    } satisfies LogRecord;
    const entry = createDiagnosticLog(actionRecord, {
      rawResponse: {
        sessionToken: "secret-token",
        signedLease: "secret-lease",
        signalConfig: "secret-config",
        deviceId: "drop-device",
        ip: "drop-ip",
        port: 502,
      },
      registerAddress: 100,
      writeValue: true,
    });

    expect(entry).toEqual({
      record: actionRecord,
    });
    expect(JSON.stringify(entry)).toContain("lineIn");
    expect(JSON.stringify(entry)).not.toContain("secret-token");
    expect(JSON.stringify(entry)).not.toContain("secret-lease");
    expect(JSON.stringify(entry)).not.toContain("secret-config");
    expect(JSON.stringify(entry)).not.toContain("drop-device");
    expect(JSON.stringify(entry)).not.toContain("drop-ip");
    expect(JSON.stringify(entry)).not.toContain("registerAddress");
  });

  /**
   * @brief 断言 diagnostic log（诊断日志）运行时只输出 Task7（任务七）白名单字段。
   * @author PopoY
   */
  it("sanitizes diagnostic records to the Task7 whitelist at runtime", () => {
    const unsafeRecord = {
      correlationId: "press-action-unsafe-01",
      localJobSessionId: "job-01",
      idempotencyKey: "idem-01",
      buttonKey: "lineOut",
      commandName: "lineOut",
      operatorId: "zhangsan",
      teamId: "PLINE-A",
      processId: "PRESS-01",
      resultCode: "OK",
      durationMs: 12,
      driverResultCode: "OK",
      erpResultCode: "OK",
      stationAccountId: "station-a",
      actionName: "lineOut",
      credential: "drop-credential",
      deviceId: "drop-device",
      ip: "drop-ip",
      port: 502,
      privateKey: "drop-private-key",
      registerAddress: 100,
      sessionToken: "drop-token",
      signalConfig: { secret: true },
      signalValues: { pressDownCount: 5 },
      signature: "drop-signature",
      signedLease: "drop-lease",
      snapshotValues: [{ signalCode: "pressDownCount", value: 5 }],
      targetDeviceId: "drop-target-device",
      writeValue: true,
    } as unknown as LogRecord;

    const entry = createDiagnosticLog(unsafeRecord);

    expect(Object.keys(entry.record).sort()).toEqual([
      "buttonKey",
      "commandName",
      "correlationId",
      "driverResultCode",
      "durationMs",
      "erpResultCode",
      "idempotencyKey",
      "localJobSessionId",
      "operatorId",
      "processId",
      "resultCode",
      "stationAccountId",
      "teamId",
    ]);
    expect(JSON.stringify(entry)).not.toContain("drop-credential");
    expect(JSON.stringify(entry)).not.toContain("drop-device");
    expect(JSON.stringify(entry)).not.toContain("drop-ip");
    expect(JSON.stringify(entry)).not.toContain("drop-private-key");
    expect(JSON.stringify(entry)).not.toContain("drop-token");
    expect(JSON.stringify(entry)).not.toContain("drop-signature");
    expect(JSON.stringify(entry)).not.toContain("drop-lease");
    expect(JSON.stringify(entry)).not.toContain("pressDownCount");
    expect(JSON.stringify(entry)).not.toContain("registerAddress");
    expect(JSON.stringify(entry)).not.toContain("writeValue");
  });
});

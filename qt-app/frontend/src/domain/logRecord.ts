/**
 * @file logRecord.ts - 定义 Qt App（Qt 应用）日志记录模型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 bootstrap specification（启动引导规格）允许的脱敏诊断日志形态。
 */

/**
 * @brief 定义 QT diagnostic summary（Qt 诊断摘要）可写入的 Task7（任务七）白名单字段。
 * @author PopoY
 */
export type LogRecord = {
  correlationId: string;
  localJobSessionId?: string;
  idempotencyKey?: string;
  buttonKey?: string;
  operatorId?: string;
  teamId?: string;
  processId?: string;
  commandName: string;
  durationMs: number;
  resultCode: string;
  driverResultCode?: string;
  erpResultCode?: string;
  stationAccountId: string;
};

// @author PopoY: logging helper（日志辅助函数）运行时按同一份 key list（键列表）裁剪，避免 TypeScript type（类型）被绕过。
export const logRecordKeys = [
  "correlationId",
  "idempotencyKey",
  "localJobSessionId",
  "buttonKey",
  "commandName",
  "operatorId",
  "teamId",
  "processId",
  "resultCode",
  "durationMs",
  "driverResultCode",
  "erpResultCode",
  "stationAccountId",
] as const satisfies ReadonlyArray<keyof LogRecord>;

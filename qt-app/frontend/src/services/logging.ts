/**
 * @file logging.ts - 实现前端 logging（日志）记录。
 * @author PopoY
 * @created 2026-06-25
 * @brief 发出仅含白名单字段的 bootstrap diagnostic log（启动引导诊断日志）。
 */

import type { LogRecord } from "../domain/logRecord";
import { logRecordKeys } from "../domain/logRecord";

/**
 * @brief 定义 logging helper（日志辅助函数）最终写出的 diagnostic log entry（诊断日志条目）。
 * @author PopoY
 */
export type DiagnosticLogEntry = {
  record: LogRecord;
};

/**
 * @brief 定义 diagnostic log sink（诊断日志输出端）契约。
 * @author PopoY
 * @param entry 已按白名单裁剪的日志条目。
 */
export type LogSink = (entry: DiagnosticLogEntry) => void;

/**
 * @brief 创建只含 Task7（任务七）白名单字段的 diagnostic log entry（诊断日志条目）。
 * @author PopoY
 * @param record 调用方传入的诊断记录，运行时可能混入额外字段。
 * @param _context 旧版上下文参数，白名单日志不读取该参数。
 * @returns 可写入 console（控制台）或结构化日志的安全条目。
 */
export function createDiagnosticLog(
  record: LogRecord,
  _context?: unknown,
): DiagnosticLogEntry {
  return {
    record: pickLogRecordFields(record),
  };
}

/**
 * @brief 通过指定 sink（输出端）写出白名单 diagnostic log（诊断日志）。
 * @author PopoY
 * @param record 调用方传入的诊断记录。
 * @param _context 旧版上下文参数，白名单日志不读取该参数。
 * @param sink 写出日志条目的输出端。
 * @returns 已写出的安全日志条目。
 */
export function logDiagnostic(
  record: LogRecord,
  _context?: unknown,
  sink: LogSink = writeDiagnosticLog,
): DiagnosticLogEntry {
  const entry = createDiagnosticLog(record, _context);

  sink(entry);

  return entry;
}

/**
 * @brief 按 LogRecord（日志记录）白名单字段裁剪运行时记录。
 * @author PopoY
 * @param record 可能携带额外字段的日志记录。
 * @returns 只含允许字段的日志记录。
 */
function pickLogRecordFields(record: LogRecord): LogRecord {
  const safeRecord: Partial<LogRecord> = {};

  for (const key of logRecordKeys) {
    const value = record[key];

    if (value !== undefined) {
      (safeRecord as Record<keyof LogRecord, unknown>)[key] = value;
    }
  }

  return safeRecord as LogRecord;
}

/**
 * @brief 将 diagnostic entry（诊断条目）写入 browser console（浏览器控制台）。
 * @author PopoY
 * @param entry 已裁剪的 diagnostic log entry（诊断日志条目）。
 */
function writeDiagnosticLog(entry: DiagnosticLogEntry): void {
  console.error("[qt-app-bootstrap]", entry);
}

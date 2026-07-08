/**
 * @file diagnosticLog.ts - 定义 diagnostic log（诊断日志）前端领域模型。
 * @author PopoY
 * @created 2026-06-27
 * @brief 定义 Diagnostic Logs Page（诊断日志页面）允许展示的白名单字段。
 */

export type DiagnosticStatusClassFilter = "abnormal" | "normal" | "all";

export type DiagnosticCategoryFilter =
  | "all"
  | "startup"
  | "request"
  | "execution"
  | "device"
  | "response"
  | "audit";

export type DiagnosticLogRecord = {
  createdAt: string;
  level: "Information" | "Warning" | "Error";
  category: "Startup" | "Request" | "Execution" | "Device" | "Response" | "Audit";
  statusClass: "Normal" | "Abnormal";
  eventName: string;
  eventStage?: "Start" | "Completed" | "Failed" | "Skipped";
  correlationId?: string;
  commandName?: string;
  resultCode?: string;
  httpStatusCode?: number;
  durationMs?: number | null;
  leaseState?: string;
  deviceSessionState?: string;
  leaseId?: string;
  targetDeviceId?: string;
  fencingToken?: string | number;
  exceptionType?: string;
  message: string;
};

export type DiagnosticLogsQuery = {
  statusClass: DiagnosticStatusClassFilter;
  category: DiagnosticCategoryFilter;
  correlationId?: string;
  limit?: number;
  fromUtc?: string;
  toUtc?: string;
};

export type DiagnosticLogsResponse = {
  resultCode: "OK";
  logs: DiagnosticLogRecord[];
};

// PopoY: 详情区和 client（客户端）共用同一份 field whitelist（字段白名单），避免敏感字段意外透传。
export const diagnosticLogRecordKeys = [
  "createdAt",
  "level",
  "category",
  "statusClass",
  "eventName",
  "eventStage",
  "correlationId",
  "commandName",
  "resultCode",
  "httpStatusCode",
  "durationMs",
  "leaseState",
  "deviceSessionState",
  "leaseId",
  "targetDeviceId",
  "fencingToken",
  "exceptionType",
  "message",
] as const satisfies ReadonlyArray<keyof DiagnosticLogRecord>;

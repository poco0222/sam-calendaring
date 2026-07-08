/**
 * @file DiagnosticLogsPage.tsx - 渲染 Diagnostic Logs Page（诊断日志页面）。
 * @author PopoY
 * @created 2026-06-27
 * @brief 渲染独立 Diagnostic Logs Page（诊断日志页面）。
 */

import {
  Button,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Row,
  Segmented,
  Switch,
  Table,
  Tag,
  Tooltip,
  type DescriptionsProps,
  type TableProps,
} from "antd";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  diagnosticLogRecordKeys,
  type DiagnosticCategoryFilter,
  type DiagnosticLogRecord,
  type DiagnosticStatusClassFilter,
} from "../domain/diagnosticLog";
import {
  fetchDiagnosticLogs,
  getJson,
} from "../services/diagnosticLogClient";
import "./DiagnosticLogsPage.css";

export type DiagnosticLogsPageProps = {
  driverBaseUrl?: string;
  initialLogs?: DiagnosticLogRecord[];
};

const diagnosticPageSize = 8;
const recentLogDays = 3;

const statusOptions = [
  { label: "全部", value: "all" },
  { label: "异常", value: "abnormal" },
  { label: "正常", value: "normal" },
] satisfies Array<{ label: string; value: DiagnosticStatusClassFilter }>;

const categoryOptions = [
  { label: "全部", value: "all" },
  { label: "启动", value: "startup" },
  { label: "请求", value: "request" },
  { label: "执行", value: "execution" },
  { label: "设备", value: "device" },
  { label: "响应", value: "response" },
  { label: "审计", value: "audit" },
] satisfies Array<{ label: string; value: DiagnosticCategoryFilter }>;

const categoryText: Record<DiagnosticLogRecord["category"], string> = {
  Startup: "启动",
  Request: "请求",
  Execution: "执行",
  Device: "设备",
  Response: "响应",
  Audit: "审计",
};

// PopoY: stable enum（稳定枚举）在 UI（用户界面）展示为中文，避免详情区只有 English identifier（英文标识）。
const levelText: Record<DiagnosticLogRecord["level"], string> = {
  Information: "信息",
  Warning: "警告",
  Error: "错误",
};

const statusClassText: Record<DiagnosticLogRecord["statusClass"], string> = {
  Normal: "正常",
  Abnormal: "异常",
};

const eventStageText: Record<NonNullable<DiagnosticLogRecord["eventStage"]>, string> = {
  Start: "开始",
  Completed: "完成",
  Failed: "失败",
  Skipped: "跳过",
};

const leaseStateText: Record<string, string> = {
  None: "无",
  Pending: "待处理",
  Active: "有效",
  Expired: "已过期",
  Superseded: "已替换",
};

const deviceSessionStateText: Record<string, string> = {
  Disconnected: "未连接",
  Connecting: "连接中",
  Connected: "已连接",
  Prechecked: "已预检",
  Running: "运行中",
  CleanupPending: "清理待完成",
  Faulted: "故障",
};

// PopoY: commandName（命令名）展示中文动作，同时保留原始码便于研发排查。
const commandNameText: Record<string, string> = {
  connectMes: "建立通信",
  precheckForStart: "开始前检查",
  startDeviceSession: "启动设备会话",
  startPressDownCountMonitor: "启动下压计数监测",
  stopPressDownCountMonitor: "停止下压计数监测",
  rollbackStartSignal: "回滚开始信号",
  cleanupDeviceSession: "清理设备会话",
  moveIn: "移入",
  moveOut: "移出",
  lineIn: "入线",
  lineOut: "出线",
  applyLeaseAndConfig: "应用租约和配置",
  getSignalSnapshot: "获取信号快照",
  executeDeviceCommand: "执行设备命令",
};

// PopoY: stable resultCode（稳定结果码）保留给 API（接口），页面只展示现场可读中文。
const resultCodeText: Record<string, string> = {
  OK: "请求执行成功",
  PARTIAL_OK: "请求主体执行成功，附属步骤需要关注",
  LEASE_INVALID: "租约无效或字段不完整",
  LEASE_EXPIRED: "租约已过期",
  HOST_MISMATCH: "本机身份不匹配",
  SIGNAL_CONFIG_MISMATCH: "信号配置哈希不匹配",
  COMMAND_NOT_ALLOWED: "命令未获授权或不在白名单",
  SIGNAL_NOT_CONFIGURED: "信号未配置",
  SIGNAL_NOT_WRITABLE: "信号不可写",
  FENCING_TOKEN_STALE: "隔离令牌过旧",
  DEVICE_IDENTITY_MISMATCH: "设备身份不匹配",
  DEVICE_TIMEOUT: "设备通信超时",
  DEVICE_REJECTED: "设备拒绝执行",
  DEVICE_BUSY: "设备忙碌，请稍后重试",
  CLEANUP_PENDING: "上次清理未完成，禁止执行新请求",
  ROLLBACK_FAILED: "回滚失败，需要人工确认",
  IDEMPOTENCY_REPLAY: "幂等请求已重放",
  MONITOR_ALREADY_RUNNING: "下压计数监测已运行",
  MONITOR_NOT_RUNNING: "下压计数监测未运行",
  MONITOR_TIMEOUT: "下压计数监测超时",
  EVENT_STREAM_UNAVAILABLE: "设备事件流不可用",
};

const detailLabelText: Record<keyof DiagnosticLogRecord, string> = {
  createdAt: "创建时间",
  level: "级别",
  category: "分类",
  statusClass: "状态分类",
  eventName: "事件名",
  eventStage: "事件阶段",
  correlationId: "关联 ID",
  commandName: "命令",
  resultCode: "结果码",
  httpStatusCode: "HTTP 状态码",
  durationMs: "耗时",
  leaseState: "租约状态",
  deviceSessionState: "设备会话状态",
  leaseId: "租约 ID",
  targetDeviceId: "目标设备 ID",
  fencingToken: "隔离令牌",
  exceptionType: "异常类型",
  message: "说明",
};

/**
 * @brief 渲染现场排障用的诊断日志工具页。
 * @param props Driver Service（驱动服务）地址和可选初始日志。
 * @returns Diagnostic Logs Page（诊断日志页面）的 React element（React 元素）。
 */
export function DiagnosticLogsPage({
  driverBaseUrl,
  initialLogs = [],
}: DiagnosticLogsPageProps) {
  const [statusClass, setStatusClass] =
    useState<DiagnosticStatusClassFilter>("all");
  const [category, setCategory] = useState<DiagnosticCategoryFilter>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLogRecord[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DiagnosticLogRecord | null>(
    initialLogs[0] ?? null,
  );
  const [timelineOpen, setTimelineOpen] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!driverBaseUrl) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const recentRange = createRecentDiagnosticRange();
      const response = await fetchDiagnosticLogs(getJson, {
        driverBaseUrl,
        statusClass,
        category,
        fromUtc: recentRange.fromUtc,
        toUtc: recentRange.toUtc,
      });

      setLogs(response.logs);
      setSelectedLog(response.logs[0] ?? null);
    } catch (error) {
      setLoadError(formatLoadError(error));
    } finally {
      setLoading(false);
    }
  }, [category, driverBaseUrl, statusClass]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadLogs();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefresh, loadLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const statusMatches =
        statusClass === "all" || log.statusClass.toLowerCase() === statusClass;
      const categoryMatches =
        category === "all" || log.category.toLowerCase() === category;

      return statusMatches && categoryMatches;
    });
  }, [category, logs, statusClass]);
  const activeLog =
    selectedLog && logs.includes(selectedLog)
      ? selectedLog
      : filteredLogs[0] ?? null;
  const detailItems = createDetailItems(activeLog);
  const openTimelineForLog = useCallback((log: DiagnosticLogRecord) => {
    setSelectedLog(log);
    setTimelineOpen(true);
  }, []);
  const columns = createColumns(openTimelineForLog);
  const timelineLogs = createTimelineLogs(activeLog, logs);
  const detailTitle = (
    <div className="diagnostic-logs-page__detail-title">
      <span className="diagnostic-logs-page__detail-title-text">
        {loadError ?? "日志详情"}
      </span>
      <Button
        disabled={!activeLog}
        onClick={() => {
          setTimelineOpen(true);
        }}
        size="small"
      >
        时间线
      </Button>
    </div>
  );

  return (
    <section className="diagnostic-logs-page">
      <header className="diagnostic-logs-page__toolbar">
        <Row
          align="middle"
          className="diagnostic-logs-page__toolbar-main"
          gutter={[8, 0]}
        >
          <Col flex="none">
            <Segmented<DiagnosticStatusClassFilter>
              onChange={setStatusClass}
              options={statusOptions}
              value={statusClass}
            />
          </Col>
          <Col flex="none">
            <Segmented<DiagnosticCategoryFilter>
              onChange={setCategory}
              options={categoryOptions}
              value={category}
            />
          </Col>
          <Col flex="auto" />
          <Col flex="none">
            <Tooltip title="刷新日志">
              <Button
                disabled={!driverBaseUrl}
                icon={createToolbarIcon("⟳")}
                loading={loading}
                onClick={() => {
                  void loadLogs();
                }}
              >
                刷新日志
              </Button>
            </Tooltip>
          </Col>
          <Col flex="none">
            <Switch
              checked={autoRefresh}
              checkedChildren="自动刷新"
              onChange={setAutoRefresh}
              unCheckedChildren="自动刷新"
            />
          </Col>
        </Row>
      </header>
      <Table
        className="diagnostic-logs-page__table"
        columns={columns}
        dataSource={filteredLogs}
        locale={{
          emptyText:
            statusClass === "abnormal" ? (
              <Empty description="当前没有异常日志" />
            ) : (
              <Empty description="当前没有日志" />
            ),
        }}
        loading={loading}
        onRow={(record) => ({
          onClick: () => {
            applyDiagnosticLogRowClick(record, setSelectedLog);
          },
        })}
        pagination={{
          pageSize: diagnosticPageSize,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
        }}
        rowKey={createDiagnosticLogRowKey}
        scroll={{ x: 960, y: "100%" }}
        size="small"
      />
      <div className="diagnostic-logs-page__detail-grid">
        <Descriptions
          className="diagnostic-logs-page__detail"
          column={3}
          items={detailItems}
          size="small"
          title={detailTitle}
        />
      </div>
      <Drawer
        className="diagnostic-logs-page__timeline-drawer"
        onClose={() => {
          setTimelineOpen(false);
        }}
        open={timelineOpen}
        placement="right"
        title="操作时间线"
      >
        <div className="diagnostic-logs-page__timeline">
          {timelineLogs.length > 0 ? (
            <ol className="diagnostic-logs-page__timeline-list">
              {timelineLogs.map((log) => {
                const isActive =
                  activeLog !== null &&
                  createDiagnosticLogRowKey(log) ===
                    createDiagnosticLogRowKey(activeLog);

                return (
                  <li
                    className={
                      isActive
                        ? "diagnostic-logs-page__timeline-item diagnostic-logs-page__timeline-item--active"
                        : "diagnostic-logs-page__timeline-item"
                    }
                    key={createDiagnosticLogRowKey(log)}
                  >
                    <button
                      aria-current={isActive ? "true" : undefined}
                      className="diagnostic-logs-page__timeline-button"
                      onClick={() => {
                        setSelectedLog(log);
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="diagnostic-logs-page__timeline-marker"
                      />
                      <span className="diagnostic-logs-page__timeline-time">
                        {formatTimelineTime(log.createdAt)}
                      </span>
                      <span className="diagnostic-logs-page__timeline-content">
                        <span className="diagnostic-logs-page__timeline-main">
                          <Tag color={getStatusTagColor(log.statusClass)}>
                            {statusClassText[log.statusClass]}
                          </Tag>
                          <Tag>{categoryText[log.category]}</Tag>
                          <span className="diagnostic-logs-page__timeline-event">
                            {log.eventName}
                          </span>
                        </span>
                        <span className="diagnostic-logs-page__timeline-message">
                          {log.message}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Empty
              description="暂无时间线日志"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      </Drawer>
    </section>
  );
}

/**
 * @brief 创建 toolbar button（工具栏按钮）的轻量字符 icon（图标），保持 Diagnostic Logs Page（诊断日志页面）与 dashboard（仪表盘）一致。
 * @author PopoY
 * @param symbol 用于表达操作含义的字符图标。
 * @returns Ant Design Button（按钮）icon prop（图标属性）使用的 React element（React 元素）。
 */
function createToolbarIcon(symbol: string) {
  return (
    <span aria-hidden="true" className="diagnostic-logs-page__toolbar-icon">
      {symbol}
    </span>
  );
}

/**
 * @brief 应用 row click（行点击）后的详情选中。
 * @author PopoY
 * @param record 被点击的 diagnostic log（诊断日志）行。
 * @param setSelectedLog 更新当前详情日志。
 */
export function applyDiagnosticLogRowClick(
  record: DiagnosticLogRecord,
  setSelectedLog: (value: DiagnosticLogRecord) => void,
): void {
  setSelectedLog(record);
}

/**
 * @brief 生成 Ant Design Table（表格）稳定 rowKey（行键），避免使用已废弃 index（索引）参数。
 * @author PopoY
 * @param record diagnostic log（诊断日志）行。
 * @returns 前端内部稳定行键，不直接暴露 raw timestamp（原始时间戳）。
 */
function createDiagnosticLogRowKey(record: DiagnosticLogRecord): string {
  const createdAtMs = Date.parse(record.createdAt);
  const createdAtKey = Number.isNaN(createdAtMs)
    ? formatDiagnosticTimestamp(record.createdAt)
    : String(createdAtMs);

  return [
    createdAtKey,
    record.eventName,
    record.category,
    record.commandName ?? "no-command",
    record.resultCode ?? "no-result",
    record.message,
  ].join("-");
}

/**
 * @brief 创建 Diagnostic Logs Page（诊断日志页面）的固定表格列。
 * @author PopoY
 * @param openTimeline 打开当前行的 timeline（时间线）抽屉。
 * @returns Ant Design Table（表格）的列定义。
 */
function createColumns(
  openTimeline: (record: DiagnosticLogRecord) => void,
): TableProps<DiagnosticLogRecord>["columns"] {
  return [
    {
      title: "操作",
      key: "timeline",
      width: 88,
      render: (_, record) => (
        <Button
          aria-label="打开操作时间线"
          onClick={(event) => {
            event.stopPropagation();
            openTimeline(record);
          }}
          size="small"
          type="link"
        >
          时间线
        </Button>
      ),
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 196,
      ellipsis: true,
      render: (value: string) => formatDiagnosticTimestamp(value),
    },
    {
      title: "状态",
      dataIndex: "statusClass",
      width: 72,
      render: (value: DiagnosticLogRecord["statusClass"]) => (
        <Tag color={getStatusTagColor(value)}>
          {value === "Abnormal" ? "异常" : "正常"}
        </Tag>
      ),
    },
    {
      title: "分类",
      dataIndex: "category",
      width: 72,
      ellipsis: true,
      render: (value: DiagnosticLogRecord["category"]) => categoryText[value],
    },
    {
      title: "命令",
      dataIndex: "commandName",
      width: 150,
      ellipsis: true,
      render: (value?: string | null) => formatCommandName(value),
    },
    {
      title: "结果码",
      dataIndex: "resultCode",
      width: 160,
      ellipsis: true,
      render: (value?: string | null) => formatResultCode(value),
    },
    {
      title: "耗时",
      dataIndex: "durationMs",
      width: 80,
      render: (value?: number | null) =>
        value === undefined || value === null ? "-" : `${value}ms`,
    },
    { title: "说明", dataIndex: "message", ellipsis: true },
  ];
}

/**
 * @brief 将白名单 diagnostic log（诊断日志）字段转换为详情区 items（项目）。
 * @author PopoY
 * @param log 当前选中的日志。
 * @returns Ant Design Descriptions（描述列表）项目。
 */
function createDetailItems(
  log: DiagnosticLogRecord | null,
): DescriptionsProps["items"] {
  if (!log) {
    return [];
  }

  return diagnosticLogRecordKeys
    .filter((key) => key !== "correlationId")
    .map((key) => ({
      key,
      label: detailLabelText[key],
      children: createDetailValueNode(formatDetailValue(key, log[key])),
    }));
}

/**
 * @brief 创建 detail value（详情值）节点，单行显示并用 Tooltip（提示）保留完整内容。
 * @author PopoY
 * @param text 已格式化的详情文本。
 * @returns 可截断显示的 ReactNode（React 节点）。
 */
function createDetailValueNode(text: string): ReactNode {
  const valueNode = (
    <span className="diagnostic-logs-page__detail-value">{text}</span>
  );

  return text === "-" ? valueNode : <Tooltip title={text}>{valueNode}</Tooltip>;
}

/**
 * @brief 创建同一 correlationId（关联 ID）的 chronological timeline（时间顺序线性视图）。
 * @author PopoY
 * @param activeLog 当前详情日志。
 * @param logs 页面当前持有的全量 diagnostic logs（诊断日志）。
 * @returns 按创建时间升序排列的操作时间线。
 */
export function createTimelineLogs(
  activeLog: DiagnosticLogRecord | null,
  logs: DiagnosticLogRecord[],
): DiagnosticLogRecord[] {
  if (!activeLog) {
    return [];
  }

  const chainLogs = activeLog.correlationId
    ? logs.filter((log) => log.correlationId === activeLog.correlationId)
    : [activeLog];

  return [...chainLogs].sort(compareDiagnosticCreatedAt);
}

/**
 * @brief 比较 diagnostic log（诊断日志）创建时间，无法解析时用原始字符串稳定排序。
 * @author PopoY
 * @param left 左侧日志。
 * @param right 右侧日志。
 * @returns sort（排序）比较结果。
 */
function compareDiagnosticCreatedAt(
  left: DiagnosticLogRecord,
  right: DiagnosticLogRecord,
): number {
  const leftMs = Date.parse(left.createdAt);
  const rightMs = Date.parse(right.createdAt);

  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return leftMs - rightMs;
}

/**
 * @brief 格式化 timeline（时间线）中的短时间。
 * @author PopoY
 * @param value Driver Service（驱动服务）返回的 ISO timestamp（时间戳）。
 * @returns `HH:mm:ss` 短时间，无法解析时返回原值。
 */
function formatTimelineTime(value: string): string {
  const formatted = formatDiagnosticTimestamp(value);

  return formatted.length >= 19 ? formatted.slice(11) : formatted;
}

/**
 * @brief 获取 status tag（状态标签）颜色。
 * @author PopoY
 * @param value statusClass（状态分类）。
 * @returns Ant Design Tag（标签）颜色。
 */
function getStatusTagColor(value: DiagnosticLogRecord["statusClass"]): string {
  return value === "Abnormal" ? "error" : "success";
}

/**
 * @brief 格式化详情字段，避免 undefined（未定义）撑出空白信息。
 * @author PopoY
 * @param key 当前白名单字段名。
 * @param value 待展示的白名单字段值。
 * @returns 操作员可读的详情文本。
 */
function formatDetailValue(
  key: keyof DiagnosticLogRecord,
  value: unknown,
): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (key === "createdAt" && typeof value === "string") {
    return formatDiagnosticTimestamp(value);
  }
  if (key === "level" && typeof value === "string") {
    return levelText[value as DiagnosticLogRecord["level"]] ?? value;
  }
  if (key === "category" && typeof value === "string") {
    return categoryText[value as DiagnosticLogRecord["category"]] ?? value;
  }
  if (key === "statusClass" && typeof value === "string") {
    return statusClassText[value as DiagnosticLogRecord["statusClass"]] ?? value;
  }
  if (key === "eventStage" && typeof value === "string") {
    return eventStageText[value as NonNullable<DiagnosticLogRecord["eventStage"]>] ?? value;
  }
  if (key === "commandName" && typeof value === "string") {
    return formatCommandName(value);
  }
  if (key === "resultCode" && typeof value === "string") {
    return formatResultCode(value);
  }
  if (key === "durationMs" && typeof value === "number") {
    return `${value}ms`;
  }
  if (key === "leaseState" && typeof value === "string") {
    return leaseStateText[value] ?? value;
  }
  if (key === "deviceSessionState" && typeof value === "string") {
    return deviceSessionStateText[value] ?? value;
  }

  return String(value);
}

/**
 * @brief 格式化 commandName（命令名）为中文动作名。
 * @author PopoY
 * @param value Driver Service（驱动服务）返回的 commandName（命令名）。
 * @returns 中文动作名和原始命令名。
 */
function formatCommandName(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return commandNameText[value] ? `${commandNameText[value]}（${value}）` : `未知命令（${value}）`;
}

/**
 * @brief 格式化 resultCode（结果码）为中文显示文本。
 * @author PopoY
 * @param value Driver Service（驱动服务）返回的 stable resultCode（稳定结果码）。
 * @returns 中文结果码说明，未知值保留原始码便于研发排查。
 */
function formatResultCode(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return resultCodeText[value] ?? value;
}

/**
 * @brief 把 UTC timestamp（UTC 时间戳）转成现场可读的北京时间。
 * @author PopoY
 * @param value Driver Service（驱动服务）返回的 ISO timestamp（时间戳）。
 * @returns `yyyy-MM-dd HH:mm:ss.SSS` 格式时间，无法解析时返回原值。
 */
function formatDiagnosticTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}.${partMap.fractionalSecond ?? "000"}`;
}

/**
 * @brief 生成 Diagnostic Logs API（诊断日志接口）默认最近三天 UTC range（范围）。
 * @author PopoY
 * @returns fromUtc/toUtc（UTC 起止时间）查询参数。
 */
function createRecentDiagnosticRange(): { fromUtc: string; toUtc: string } {
  const toUtc = new Date();
  const fromUtc = new Date(toUtc.getTime() - recentLogDays * 24 * 60 * 60 * 1000);

  return {
    fromUtc: fromUtc.toISOString(),
    toUtc: toUtc.toISOString(),
  };
}

/**
 * @brief 将加载异常转换为中文提示，不暴露底层 stack（堆栈）。
 * @param error 捕获到的未知异常。
 * @returns 页面详情区标题提示。
 */
function formatLoadError(error: unknown): string {
  if (error instanceof Error) {
    return `日志加载失败：${error.message}`;
  }

  return "日志加载失败：未知异常";
}

# Driver Service V1 Logging Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file Driver Service V1 日志实现计划总览
> @author PopoY
> @created 2026-06-27
> @purpose 基于 `driver-service-v1-logging-spec.md` 拆分 Runtime Log（运行日志）、Audit Log（审计日志）、Diagnostic Log（诊断日志）和 QT App Diagnostic Logs Page（Qt 应用诊断日志页面）的最小实现任务。

**Goal（目标）:** Complete the V1 logging chain so `Driver Service（驱动服务）` writes sanitized runtime, audit, and diagnostic events, and `QT App（Qt 应用）` exposes an independent `Diagnostic Logs Page（诊断日志页面）`.

**Architecture（架构）:** Reuse the existing `DriverStateService（驱动状态服务）` and `SqliteDriverStateStore（SQLite 状态存储）` instead of adding a new service layer（服务层）. Add a whitelisted `DiagnosticLogEntry（诊断日志条目）` record and `diagnostic_log（诊断日志表）`, map `GET /diagnosticLogs（诊断日志接口）` in the existing Minimal API（最小 API）, and keep frontend navigation as simple `view state（视图状态）` in `App.tsx`.

**Tech Stack（技术栈）:** `.NET 10`, `ASP.NET Core Minimal API（最小 API）`, `ILogger（日志抽象）`, `SQLite + WAL（嵌入式数据库 + 预写日志）`, `xUnit（测试框架）`, `React 19`, `Ant Design（组件库）`, `Vitest（测试框架）`, `Vite（构建工具）`.

**Source Spec（来源规格）:** `docs/driver-service-v1-logging-spec.md`

---

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Logging Contract and AGENTS Rules](./task-01-logging-contract-and-agents-rules.md) | 固化日志字段、敏感字段禁令和 `AGENTS.md（代理规则文档）` 约束。 | None |
| 2 | [Task 02: Driver Diagnostic Log Storage](./task-02-driver-diagnostic-log-storage.md) | 新增 `diagnostic_log（诊断日志表）`、白名单模型、写入和查询能力。 | Task 01 |
| 3 | [Task 03: Host Request Response Logging](./task-03-host-request-response-logging.md) | 为宿主生命周期、请求、响应、审计写入和 `GET /diagnosticLogs` 补齐日志。 | Task 02 |
| 4 | [Task 04: Session and Modbus Action Logging](./task-04-session-and-modbus-action-logging.md) | 为租约校验、状态保存、设备连接、身份探测和信号读取补齐过程诊断。 | Task 03 |
| 5 | [Task 05: QT Diagnostic Logs Page With Existing Design Contract](./task-05-qt-diagnostic-logs-page-with-existing-design-contract.md) | 新增独立诊断日志页，复用现有 `Ant Design（组件库）` 和现场控制台风格。 | Task 03 |
| 6 | [Task 06: Verification Record](./task-06-verification-record.md) | 落库最终验证记录，覆盖后端、前端、视觉和敏感信息边界。 | Task 01 through Task 05 |

## File Boundary（文件边界）

### Backend（后端）

- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogEntry.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogQuery.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/IDriverStateStore.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/DriverStateService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/SqliteDriverStateStore.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/DriverWorker.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogStorageTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogsApiTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/SessionDiagnosticLoggingTests.cs`
- Modify: existing focused tests only where constructor signatures or expected logs change.

### Frontend（前端）

- Modify: `qt-app/frontend/src/App.tsx`
- Create: `qt-app/frontend/src/domain/diagnosticLog.ts`
- Create: `qt-app/frontend/src/services/diagnosticLogClient.ts`
- Create: `qt-app/frontend/src/services/diagnosticLogClient.test.ts`
- Create: `qt-app/frontend/src/components/DiagnosticLogsPage.tsx`
- Create: `qt-app/frontend/src/components/DiagnosticLogsPage.test.tsx`
- Create: `qt-app/frontend/src/components/DiagnosticLogsPage.css`
- Do not rewrite（不要重写）: `qt-app/frontend/src/components/BootstrapDashboard.tsx`
- Do not add（不要新增）: `React Router（React 路由库）`, new theme system（主题体系）, new dependency（依赖）.

### Docs（文档）

- Create: `AGENTS.md`
- Create: `docs/driver-service-v1-logging-spec-plan/verification-record.md`

## Execution Notes（执行说明）

1. Use `RED -> GREEN -> verification（失败 -> 通过 -> 验证）` for each task.
2. Keep `audit_log（审计日志表）` as command final fact storage. Do not put process timeline events into it.
3. Keep `diagnostic_log（诊断日志表）` whitelisted. Do not add a free JSON blob（自由 JSON 数据块）.
4. Diagnostic write failure must not change command response; log one Chinese `ILogger（日志抽象）` summary.
5. `QT App（Qt 应用）` must not send raw `ip（网络地址）`, `port（端口）`, or `deviceId（设备 ID）` for logging.
6. Frontend uses existing `Ant Design（组件库）` components and `view state（视图状态）`; upgrade to route（路由） only after page count grows beyond this V1 need.
7. Every new or changed code comment must include `@author PopoY` where a file header exists, and all explanatory comments must be Chinese or Chinese-English mixed.
8. Generated commit messages must use Chinese except English technical terms（专业术语）.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| Startup（启动） events are logged | Task 03 |
| Request / response（请求 / 响应） events are logged with `correlationId（关联 ID）` | Task 03 |
| `audit_log（审计日志表）` still stores final command result | Task 03, Task 06 |
| `diagnostic_log（诊断日志表）` stores process timeline | Task 02, Task 03, Task 04 |
| `GET /diagnosticLogs（诊断日志接口）` filters by status, category, correlationId, and limit | Task 03 |
| Diagnostic writes are safe on failure | Task 02, Task 03 |
| Device / Modbus（设备 / 通信协议） actions have diagnostic events | Task 04 |
| Sensitive fields are not logged | Task 01, Task 02, Task 03, Task 05, Task 06 |
| Diagnostic Logs Page（诊断日志页面） is independent from Bootstrap Dashboard（启动仪表盘） | Task 05 |
| Frontend uses fixed filters, fixed table columns, and whitelisted detail fields | Task 05 |
| 1280x720 visual baseline remains readable | Task 05, Task 06 |

## Verification Gates（验证门禁）

Run these after all tasks are complete:

```bash
cd driver-service
dotnet test
dotnet build
```

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/DiagnosticLogsPage.test.tsx src/services/diagnosticLogClient.test.ts
./node_modules/.bin/vite build
```

Visual smoke（视觉冒烟）:

1. `1280x720 light theme（浅色主题）`: Bootstrap Dashboard（启动仪表盘） has no embedded log table.
2. `1280x720 light theme（浅色主题）`: Diagnostic Logs Page（诊断日志页面） shows toolbar, table header, and at least 8 rows when data exists.
3. `1280x720 dark theme（深色主题）`: filters, tags, table, and details remain readable.

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: all sections 4 through 16 map to Tasks 01 through 06.
- Placeholder scan（占位扫描）: this plan uses no `TBD`, `TODO`, or unspecified implementation buckets.
- YAGNI（你不会需要它） decision: no new logging framework（日志框架）, no OpenTelemetry（开放遥测）, no React Router（React 路由库）, no new frontend dependency（前端依赖）.

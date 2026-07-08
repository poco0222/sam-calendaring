# Driver Signal Snapshot SSE Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file Driver Service 主动信号快照 SSE 推送实现计划总览
> @author PopoY
> @created 2026-07-03
> @purpose 基于 `2026-07-03-driver-signal-snapshot-sse-design.md` 拆分 Driver Service（驱动服务）后台 signal snapshot（信号快照）发布、SSE（服务器发送事件）消费、diagnostic log retention（诊断日志保留）和共享渲染验证任务。

**Goal（目标）:** 在 Driver Service（驱动服务）持有有效 active lease（活跃租约）且存在 SSE subscriber（订阅者）时，每 10 秒读取授权 signal snapshot（信号快照），通过已有 `/deviceEvents/stream` 推送 `signalSnapshotChanged`，并让 Bootstrap Dashboard（启动仪表盘）和 PressJobPage（压机作业页）共享同一份 `driverSession（驱动会话）` 状态。

**Architecture（架构）:** 复用现有 `DriverSessionManager.GetSignalSnapshotAsync（获取信号快照）` 和 `DeviceEventHub（设备事件中心）`，只新增一个最小 `BackgroundService（后台服务）` 做定时读取与发布。自动成功 tick（计时读取）不写 `audit_log（审计日志表）`，也不逐条写 `diagnostic_log（诊断日志表）`；失败和恢复通过现有 `DriverStateService.TryAppendDiagnosticLogAsync（安全写诊断日志）` 写入。前端只补齐 named event（命名事件）接收和 `driverSession.applySignalSnapshotEvent（应用信号快照事件）`，不新增 polling（轮询）或独立页面状态。

**Tech Stack（技术栈）:** `.NET 10`, `ASP.NET Core Minimal API（最小 API）`, `BackgroundService（后台服务）`, `SQLite（嵌入式数据库）`, `ILogger（日志抽象）`, `SSE（服务器发送事件）`, `React 19`, `TypeScript（类型脚本）`, `Vitest（测试框架）`, `Vite（构建工具）`.

**Source Spec（来源规格）:** `docs/superpowers/specs/2026-07-03-driver-signal-snapshot-sse-design.md`

---

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Backend Event Contract and Subscriber Gate](./task-01-backend-event-contract-and-subscriber-gate.md) | 固化 `signalSnapshotChanged` 事件名、SSE subscriber（订阅者）门控和 payload（载荷）安全边界。 | None |
| 2 | [Task 02: Signal Snapshot Publisher Service](./task-02-signal-snapshot-publisher-service.md) | 新增后台发布服务，复用 `GetSignalSnapshotAsync`，实现 10 秒读取、发布、失败节流和恢复日志。 | Task 01 |
| 3 | [Task 03: Diagnostic Log Retention Service](./task-03-diagnostic-log-retention-service.md) | 新增 startup cleanup（启动清理）和 24 小时 recurring cleanup（周期清理），只清理 `diagnostic_log`。 | Task 02 |
| 4 | [Task 04: Frontend Named SSE and Driver Session Update](./task-04-frontend-named-sse-and-driver-session-update.md) | 前端用 `addEventListener（事件监听）` 接收 named event，并通过 `driverSession` 更新 signal snapshot。 | Task 01 |
| 5 | [Task 05: Shared Rendering and Verification Record](./task-05-shared-rendering-and-verification-record.md) | 验证 Dashboard 与 PressJobPage 同源刷新、pressDownCount monitor（下压计数监测）不回归，并落库验证记录。 | Task 02 through Task 04 |

## File Boundary（文件边界）

### Backend（后端）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DeviceEventStreamModels.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Events/DeviceEventHub.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Sessions/SignalSnapshotDiagnosticMode.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Sessions/SignalSnapshotPublisherService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/IDriverStateStore.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/DriverStateService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/SqliteDriverStateStore.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/State/DiagnosticLogRetentionService.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceEventStreamTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/SignalSnapshotPublisherServiceTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogRetentionTests.cs`

### Frontend（前端）

- Modify: `qt-app/frontend/src/domain/driver.ts`
- Modify: `qt-app/frontend/src/services/driverDeviceEventsClient.ts`
- Modify: `qt-app/frontend/src/services/driverDeviceEventsClient.test.ts`
- Modify: `qt-app/frontend/src/hooks/useDriverSession.ts`
- Modify: `qt-app/frontend/src/hooks/useDriverSession.test.ts`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify only if existing assertions need new fixture data: `qt-app/frontend/src/components/PressJobPage.test.tsx`

### Docs（文档）

- Create: `docs/superpowers/specs/2026-07-03-driver-signal-snapshot-sse-design-plan/verification-record.md`
- Update each task file status/progress after executing its own steps.

## Execution Notes（执行说明）

1. Use `RED -> GREEN -> regression（失败 -> 通过 -> 回归）` for each task.
2. Do not add WebSocket（网页套接字）, message queue（消息队列）, remote observability platform（远程可观测平台）, frontend polling（前端轮询）, or ERP（企业资源计划）changes.
3. Do not make `QT App（Qt 应用）` send raw `ip（网络地址）`, `port（端口）`, `deviceId（设备 ID）`, `targetEndpoint（目标端点）`, or raw `signalConfig（信号配置）`.
4. Every new or modified code comment must include `@author PopoY` in file headers and must be Chinese or Chinese-English mixed.
5. Automatic successful tick（计时读取） must not append `audit_log（审计日志表）` and must not append per-tick successful `diagnostic_log（诊断日志表）`.
6. Failure logging must record only safe fields: `eventName`, `correlationId`, `commandName`, `resultCode`, `exceptionType`, Chinese `message（说明）`; no full stack trace（堆栈） or sensitive payload（敏感载荷）.
7. Commit messages, if a Git repository（Git 仓库） is available, must be Chinese except English technical terms（专业术语）.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| 有效 active lease（活跃租约）期间每 10 秒主动读取 signal snapshot（信号快照） | Task 02 |
| `/deviceEvents/stream` 推送 `signalSnapshotChanged` SSE event（服务器发送事件） | Task 01, Task 02 |
| Dashboard 和 PressJobPage 使用同一份 `driverSession（驱动会话）` 状态 | Task 04, Task 05 |
| 自动成功读取不写 `audit_log（审计日志表）` | Task 02 |
| 自动成功读取不逐条写 `diagnostic_log（诊断日志表）` | Task 02 |
| 自动读取失败和恢复写可检索 diagnostic log（诊断日志）且有 throttle（节流） | Task 02 |
| diagnostic log（诊断日志）默认 7 天保留，每 24 小时自动清理 | Task 03 |
| 清理只作用于 `diagnostic_log（诊断日志表）`，不清理 `audit_log（审计日志表）` | Task 03 |
| SSE payload（服务器发送事件载荷）和日志不泄漏敏感字段 | Task 01, Task 02, Task 04, Task 05 |
| manual refresh（手动刷新）和 pressDownCount monitor（下压计数监测）不回归 | Task 04, Task 05 |

## Verification Gates（验证门禁）

Run after all tasks are complete:

```bash
cd driver-service
dotnet test
dotnet build
```

Expected（期望）: all tests pass, build succeeds, and no warning requires code change for this feature.

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

Expected（期望）: all Vitest（测试框架） suites pass and Vite（构建工具） build succeeds.

Manual smoke（手动冒烟）:

1. 启动 Driver Service（驱动服务）和 QT App（Qt 应用）。
2. 获取 lease authorization（租约授权）成功后打开 Bootstrap Dashboard（启动仪表盘）。
3. 确认 10 秒内 signal snapshot（信号快照）刷新。
4. 切到 PressJobPage（压机作业页），确认实时信号读取同一份 `driverSession.data.signalSnapshot.signalValues`。
5. 模拟 device timeout（设备超时），确认 `SignalSnapshotPublisherReadFailed` 按 5 分钟 throttle（节流）记录。
6. 恢复设备，确认只出现一次 `SignalSnapshotPublisherRecovered`。
7. 查询 diagnostic logs（诊断日志），确认没有成功 tick（计时读取）刷屏。

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: sections 4 through 13 map to Tasks 01 through 05.
- Placeholder scan（占位扫描）: no unresolved placeholder wording or open implementation bucket is left in this plan.
- Type consistency（类型一致性）: event name is `signalSnapshotChanged`, command name is `signalSnapshotPublisher`, success result code is `OK`, frontend update entry is `applySignalSnapshotEvent`.
- YAGNI（你不会需要它） decision: no new protocol（协议）, no new frontend state store（前端状态库）, no new dependency（依赖）, no separate polling path（轮询路径）.

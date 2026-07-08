# Press Working Device Actions Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file 压机作业设备动作实现计划总览
> @author PopoY
> @created 2026-07-02
> @purpose 基于 `press-working-device-actions-spec.md` 拆分七个生产按钮、Driver Service（驱动服务）写设备能力、pressDownCountMonitor（下压计数监测）和 QT App（Qt 应用）编排的最小实施任务。

**Goal（目标）:** Move the seven `建立通信 / 开始加工 / 完成加工 / 移入 / 移出 / 入线 / 出线` buttons from placeholder（占位） behavior to real action orchestration（动作编排） without letting QT App（Qt 应用） pass raw device/network fields（设备/网络字段）.

**Architecture（架构）:** Keep orchestration（编排） in QT App（Qt 应用） and keep Modbus（工业通信协议） writes inside Driver Service（驱动服务）. Driver Service（驱动服务） reads active lease（活跃租约） and local signalConfig（信号配置） to resolve semantic command（语义命令）, performs read-back confirmation（回读确认）, emits one-way device event stream（单向设备事件流） for `pressDownCountMonitor（下压计数监测）`, and never calls ERP API（企业资源计划接口）. ERP Qt API（企业资源计划 Qt 接口） remains the only business persistence（业务落库） surface.

**Tech Stack（技术栈）:** C# / ASP.NET Core Minimal API（最小接口）, xUnit（测试框架）, NModbus（Modbus 库）, SQLite（轻量数据库）, React 19, TypeScript, TSX, Ant Design 6.4.5（组件库）, Vite（构建工具）, Vitest（测试框架）, SSE（Server-Sent Events，服务器发送事件）.

**Source Spec（来源规格）:** `docs/press-working-device-actions-spec.md`

---

## Status（状态）

- `Task 01 Completed（任务一已完成）`: 本轮只执行 Task 01，`/executeDeviceCommand` contract boundary（契约边界）与日志边界已通过验证；未推进 Task 02+。
- `Task 02 Completed（任务二已完成）`: 本轮只执行 Task 02，Modbus write planner（写入规划）与 semantic command executor（语义命令执行器）已通过 focused/regression driver tests（聚焦/回归驱动测试）；未推进 Task 03+。
- `Task 03 Completed（任务三已完成）`: 本轮只执行 Task 03，Driver-owned pressDownCountMonitor（驱动侧下压计数监测）与 `GET /deviceEvents/stream` SSE（服务器发送事件）已通过 focused/regression driver tests（聚焦/回归驱动测试）；未推进 Task 04+。
- `Task 04 Completed（任务四已完成）`: 本轮只执行 Task 04，frontend domain models（前端领域模型）、typed Driver/ERP clients（类型化驱动/企业资源计划客户端）与 device event subscription（设备事件订阅）已通过 focused/regression frontend tests（聚焦/回归前端测试）；未推进 Task 05+。
- `Task 05 Completed（任务五已完成）`: 本轮只执行 Task 05，PressJobPage（压机作业页）shared preflight（通用前置校验）、per-button loading state（独立加载状态）和 `建立通信 / 移入 / 普通移出 / 入线 / 普通出线` simple actions（简单动作）已通过 focused/regression frontend tests（聚焦/回归前端测试）；未推进 Task 06+。
- `Task 06 Completed（任务六已完成）`: 本轮续接只执行 Task 06，`开始加工 / 完成加工` workflow（流程）、加工中 `移出 / 出线` 复用 completion workflow（完工流程）、非加工中 `出线` shared preflight（通用前置校验）和 threshold event（阈值事件）开始参数记录已通过 focused/regression frontend tests（聚焦/回归前端测试）；未推进 Task 07。
- `Task 07 Completed（任务七已完成）`: 本轮只执行 Task 07，App wiring（应用接线）、device event subscription（设备事件订阅）、diagnostic whitelist（诊断白名单）、review hardening（审查后加固）、security scans（安全扫描）和 verification record（验证记录）已通过 automated gates（自动化门禁）与 visual smoke（视觉冒烟）；未推进 Task 07 以外范围。

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Driver Command Contract And Request Boundary](./task-01-driver-command-contract-and-request-boundary.md) | 新增 `/executeDeviceCommand` contract（契约）、result codes（结果码）、严格 JSON whitelist（白名单）和审计/诊断日志边界。 | None |
| 2 | [Task 02: Modbus Write Planner And Semantic Command Executor](./task-02-modbus-write-planner-and-semantic-command-executor.md) | 扩展 Modbus write（写入）能力，按 semanticKey（语义键）解析设备动作并做 read-back confirmation（回读确认）。 | Task 01 |
| 3 | [Task 03: PressDownCount Monitor And Device Event Stream](./task-03-press-down-count-monitor-and-device-event-stream.md) | 实现 Driver-owned bounded monitor（驱动侧有界监测）和 `SSE（服务器发送事件）` event stream（事件流）。 | Task 01, Task 02 |
| 4 | [Task 04: Frontend Domain And Typed Clients](./task-04-frontend-domain-and-typed-clients.md) | 新增 QT App（Qt 应用）Driver command（驱动命令）、event subscription（事件订阅）和 ERP Qt endpoint（企业资源计划 Qt 端点）客户端。 | Task 01 |
| 5 | [Task 05: PressJobPage Shared Preflight And Simple Actions](./task-05-press-job-page-shared-preflight-and-simple-actions.md) | 在 `PressJobPage（压机作业页）` 接入 shared preflight（通用前置校验）、loading state（加载状态）和 `建立通信 / 移入 / 普通移出 / 入线 / 普通出线`。 | Task 04 |
| 6 | [Task 06: Start Complete And Reused Completion Workflows](./task-06-start-complete-and-reused-completion-workflows.md) | 实现 `开始加工 / 完成加工`，并让加工中 `移出 / 出线` 复用 completion workflow（完工流程）。 | Task 02, Task 03, Task 04, Task 05 |
| 7 | [Task 07: App Wiring Diagnostics And Verification Record](./task-07-app-wiring-diagnostics-and-verification-record.md) | 完成 `App.tsx（应用入口）` 注入、diagnostic summary（诊断摘要）、敏感信息检查和 verification record（验证记录）。 | Task 01 through Task 06 |

## File Boundary（文件边界）

### Driver Service（驱动服务）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DriverResultCode.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/ExecuteDeviceCommandRequest.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/ExecuteDeviceCommandResponse.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DeviceEventStreamModels.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/SignalPoint.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/SignalConfig.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/AuthorizedSignalPlanner.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/IModbusAdapter.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/NModbusAdapter.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Modbus/MockModbusAdapter.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceCommandCatalog.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceCommandExecutor.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Commands/PressDeviceIdempotencyStore.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Monitoring/PressDownCountMonitorService.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Events/DeviceEventHub.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/ApiContractTests.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/NModbusAdapterTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceCommandContractTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/PressDeviceCommandExecutorTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/PressDownCountMonitorTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DeviceEventStreamTests.cs`

### QT App Frontend（Qt 应用前端）

- Modify: `qt-app/frontend/src/domain/driver.ts`
- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/domain/logRecord.ts`
- Modify: `qt-app/frontend/src/services/driverClient.ts`
- Modify: `qt-app/frontend/src/services/driverClient.test.ts`
- Create: `qt-app/frontend/src/services/driverDeviceEventsClient.ts`
- Create: `qt-app/frontend/src/services/driverDeviceEventsClient.test.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/services/logging.test.ts`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`

### Docs（文档）

- Create during Task 07（任务七执行时创建）: `docs/press-working-device-actions-spec-plan/verification-record.md`
- Update during execution（执行时回写）: `docs/press-working-device-actions-spec-plan/task-*.md`

### Do Not Touch（不得触碰）

- Do not modify（不要修改）: `qt-app/native/**`
- Do not add（不要新增）: raw `/connect（连接）`, `/renewLease（续租）`, `polling（网页轮询）`, new global state store（全局状态仓库）, new UI component library（组件库）, or Driver-to-ERP API call（驱动调用企业资源计划接口）.
- Do not pass（不要传递）: `signedLease（签名租约）`, `signature（签名）`, raw `signalConfig（信号配置）`, `sessionToken（会话令牌）`, `deviceId（设备 ID）`, `ip（网络地址）`, `port（端口）`, `signalName（信号名）`, `registerAddress（寄存器地址）`, or `writeValue（写入值）` through `/executeDeviceCommand`.

## Plan Decisions（计划默认决策）

1. Use ERP Qt API（企业资源计划 Qt 接口） path `/api/qt/press-working/machine-status`.
2. Use ERP legacy `signalName（信号名）` and `writable（可写）` in `signalConfig（信号配置）`.
3. Accept both `pressWorking.deviceActions` and command-specific scope（命令级范围）`pressWorking.deviceActions.<commandName>` in Driver Service（驱动服务）.
4. Keep `下压计数清零` failure as `PARTIAL_OK（部分成功）` when `MES通信状态` succeeds.
5. Use `SSE（服务器发送事件）` first for `GET /deviceEvents/stream`; preserve the same payload（载荷） if later switched to `WebSocket（网页套接字）` by a separate spec.

## Execution Notes（执行说明）

1. Use `RED -> GREEN -> verification（失败 -> 通过 -> 验证）` inside every implementation Task（实现任务）.
2. Keep the shortest working diff（最小可工作差异）: no new dependency（依赖）, no new route（路由）, no speculative native bridge（原生桥接） work.
3. `PressJobPage（压机作业页）` receives injected callbacks（注入回调） only; it must not import `driverClient（驱动客户端）`, `erpClient（企业资源计划客户端）`, or logging service（日志服务） directly.
4. `App.tsx（应用入口）` may close over `sessionToken（会话令牌）`; it must not pass token（令牌）, signed lease（签名租约）, or raw signal config（原始信号配置） into `PressJobPage（压机作业页）`.
5. Driver Service（驱动服务） must not log sensitive values（敏感值） and must use `ILogger（日志抽象）`, `audit_log（审计日志表）`, or `diagnostic_log（诊断日志表）`; never `Console.WriteLine`.
6. All added or changed code comments must include `@author PopoY` in file headers and use Chinese or Chinese-English mixed wording.
7. Generated commit message（提交消息）, if a Git repository（Git 仓库） is available during execution, must be Chinese except English technical terms（专业术语）.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| 七个按钮变为真实动作入口 | Task 05, Task 06 |
| 前置校验覆盖 team/operator/process、active lease 和 current job state（当前作业状态） | Task 05, Task 06 |
| `/executeDeviceCommand` 只接收白名单字段并拒绝裸设备字段 | Task 01, Task 04 |
| Driver Service（驱动服务）内部解析 active lease（活跃租约）和 signalConfig（信号配置） | Task 02 |
| 所有写设备动作执行 read-back confirmation（回读确认） | Task 02 |
| `建立通信` 只覆盖 MES communication status（MES 通信状态），不触发 press counter clear（下压计数清零） | Task 02, Task 05 |
| `开始加工` 执行 precheck -> start device（含 press counter clear（下压计数清零）） -> ERP start -> monitor（监测） | Task 02, Task 03, Task 06 |
| ERP start（开始加工）失败时 rollback（回滚） | Task 06 |
| `pressDownCountMonitor（下压计数监测）` 由 Driver Service（驱动服务）持有，不允许 Web polling（网页轮询） | Task 03, Task 06, Task 07 |
| Threshold event（阈值事件）触发 `type=start` parameter record（参数记录）且幂等 | Task 03, Task 06, Task 07 |
| `完成加工` 执行 final snapshot -> end parameter -> ERP complete -> cleanup | Task 06 |
| cleanup（收尾）失败进入 `CleanupPending（清理待完成）` 并阻止下一次开始加工 | Task 02, Task 06 |
| `移入 / 移出 / 入线 / 出线` 语义动作、partial result（部分结果）和刷新规则 | Task 05, Task 06 |
| UI（界面）、日志、diagnostic summary（诊断摘要）无敏感字段 | Task 01, Task 04, Task 07 |
| `correlationId（关联 ID）` 串联 request/action/response/audit/diagnostic | Task 01, Task 04, Task 07 |

## Verification Gates（验证门禁）

Driver focused tests（驱动聚焦测试）:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~DeviceCommandContractTests|FullyQualifiedName~PressDeviceCommandExecutorTests|FullyQualifiedName~PressDownCountMonitorTests|FullyQualifiedName~DeviceEventStreamTests"
```

Driver regression（驱动回归）:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj
```

Frontend focused tests（前端聚焦测试）:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/driverClient.test.ts src/services/driverDeviceEventsClient.test.ts src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx src/services/logging.test.ts
```

Frontend regression（前端回归）:

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

Visual smoke（视觉冒烟）:

```bash
cd qt-app/frontend
pnpm dev
```

Then verify at `1280x720 viewport（视口）`:

1. Seven action buttons（七个动作按钮） are visible, do not overlap, and show per-button loading（独立加载状态）.
2. Missing team/operator/process（班组/人员/工艺） messages are Chinese.
3. Driver not ready（驱动未就绪） blocks high-risk actions but `建立通信` may retry bootstrap driver flow（启动驱动流程）.
4. Start/complete/move-out/line-out confirm paths（确认路径） do not leak raw response（原始响应）.
5. Device event disconnect（事件断开） shows Chinese diagnostic hint（诊断提示） and does not start Web polling（网页轮询）.
6. UI（界面） and logs contain no `sessionToken`, `signedLease`, `signature`, raw `signalConfig`, `privateKey`, `credential`, `deviceId`, `ip`, `port`, or Modbus address（Modbus 地址）.

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: sections 1 through 15 map to Tasks 01 through 07.
- Placeholder scan（占位扫描）: no unspecified implementation bucket is used; every task lists concrete files, tests, commands, and acceptance evidence.
- YAGNI（你不会需要它） decision: no new dependency（依赖）, no new native（原生） work, no UI redesign（界面重设计）, no Driver-to-ERP coupling（驱动到企业资源计划耦合）, no Web polling（网页轮询）.

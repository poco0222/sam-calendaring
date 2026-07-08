# Driver Signal Snapshot SSE Design

> @file Driver Service 主动信号快照 SSE 推送设计说明
> @author PopoY
> @created 2026-07-03
> @purpose 固化 Driver Service（驱动服务）在获取 lease authorization（租约授权）后，每 10 秒读取 signal snapshot（信号快照）并通过 SSE（Server-Sent Events，服务器发送事件）推送给 QT App（Qt 应用）的最小实现边界、日志策略和保留规则。

## 1. Goal（目标）

在 `Driver Service（驱动服务）` 持有有效 `active lease（活跃租约）` 后，由驱动侧主动每 10 秒读取一次授权范围内的 `signal snapshot（信号快照）`，并通过已有 `/deviceEvents/stream` 的 `SSE（服务器发送事件）` 通道推送到 `QT App（Qt 应用）`。

推送后，`Bootstrap Dashboard（启动仪表盘）` 的信号快照和 `PressJobPage（压机作业页）` 的实时信号必须从同一份 `driverSession（驱动会话）` 状态更新，不新增两套刷新逻辑。

## 2. Non-Goals（不做范围）

1. 不新增 `WebSocket（网页套接字）`、消息队列、远程日志平台或外部 observability platform（可观测性平台）。
2. 不让 `QT App（Qt 应用）` 传裸 `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）` 或完整 `signalConfig（信号配置）`。
3. 不把每 10 秒成功读取写入 `audit_log（审计日志表）`。
4. 不把每 10 秒成功读取逐条写入 `diagnostic_log（诊断日志表）`。
5. 不在前端新增 polling（轮询）作为主路径；前端只消费 Driver Service（驱动服务）主动推送。
6. 不改变人工点击“刷新快照”的既有行为；manual refresh（手动刷新）仍可走完整日志链路。
7. 不改变 ERP（企业资源计划）接口，也不新增续租逻辑。

## 3. Current Context（当前上下文）

当前项目已有以下基础：

1. `DriverEndpoints.MapDriverV1Endpoints` 已注册 `/getSignalSnapshot`、`/executeDeviceCommand` 和 `/deviceEvents/stream`。
2. `DriverSessionManager.GetSignalSnapshotAsync` 已能基于 `active lease（活跃租约）` 读取授权信号，并返回 `signalValues（信号值）`。
3. `DeviceEventHub` 已能 `PublishAsync（发布）` 白名单事件，并把事件写成 `SSE（服务器发送事件）` 帧。
4. `DeviceEventStreamItem` 已有 `SnapshotValues（快照值）` 白名单字段，可复用为推送 payload（载荷）。
5. 前端 `BootstrapDashboard（启动仪表盘）` 和 `PressJobPage（压机作业页）` 都读 `driverSession.data.signalSnapshot.signalValues`。
6. 前端 `driverDeviceEventsClient` 当前只使用 `EventSource.onmessage`，需要补充 `addEventListener（事件监听）` 才能稳定接收 named event（命名事件）。

## 4. Design Decision（设计决策）

采用方案：**Driver Service background publisher（后台发布器） + existing SSE hub（现有事件中心） + failure-only diagnostics（仅异常诊断日志）**。

1. 新增 `SignalSnapshotPublisherService（信号快照发布服务）`，注册为 `HostedService（托管服务）`。
2. 服务循环周期为 10 秒。
3. 每次 tick（计时触发）先判断是否存在 `active lease（活跃租约）`，没有则跳过读取。
4. 如 `DeviceEventHub（设备事件中心）` 没有 subscriber（订阅者），默认跳过读取，避免无人查看时空耗设备通信。
5. 读取逻辑复用 `DriverSessionManager.GetSignalSnapshotAsync`，但后台路径使用 `diagnostic mode（诊断模式） = FailureOnly（仅异常）`，避免成功 tick（计时读取）产生大量日志。
6. 成功读取后发布 `signalSnapshotChanged` 事件，payload（载荷）只包含安全字段。
7. 失败时写入 `SignalSnapshotPublisherReadFailed`，连续失败按 throttle（节流）规则限频。
8. 失败恢复为成功时写入 `SignalSnapshotPublisherRecovered`。

放弃方案：

1. Frontend polling（前端轮询）：改动更少，但不符合“驱动主动读取并 SSE 推送”的目标。
2. 每次成功都写 diagnostic log（诊断日志）：会把诊断页淹没，降低排障效率。
3. 每 24 小时清理但仍逐条写成功日志：只能控制磁盘大小，不能控制日志可读性。
4. 新增 WebSocket（网页套接字）：当前是单向推送，SSE（服务器发送事件）已足够。

## 5. Data Flow（数据流）

```text
applyLeaseAndConfig（应用租约与配置）
  -> DriverStateStore（驱动状态存储）保存 active lease（活跃租约）
  -> SignalSnapshotPublisherService（信号快照发布服务）每 10 秒 tick（计时触发）
  -> DriverSessionManager.GetSignalSnapshotAsync（读取授权信号快照）
  -> DeviceEventHub.PublishAsync（发布 signalSnapshotChanged）
  -> /deviceEvents/stream SSE（服务器发送事件）
  -> QT App EventSource（事件源）
  -> driverSession.signalSnapshot（驱动会话信号快照）
  -> BootstrapDashboard（启动仪表盘）与 PressJobPage（压机作业页）同步刷新
```

## 6. Backend Contract（后端契约）

### 6.1 Publisher（发布服务）

新增 `SignalSnapshotPublisherService（信号快照发布服务）`：

| Rule（规则） | Contract（契约） |
| --- | --- |
| Interval（间隔） | 默认 10 秒。 |
| Lease gate（租约门控） | 只有 `leaseState = Active` 且 lease（租约）未过期时读取。 |
| Subscriber gate（订阅者门控） | 没有 SSE subscriber（订阅者）时跳过读取。 |
| Read path（读取路径） | 复用 `DriverSessionManager.GetSignalSnapshotAsync`，不复制 Modbus（工业通信协议）读取逻辑。 |
| Log mode（日志模式） | 后台自动读取使用 `FailureOnly（仅异常）`。 |
| Event name（事件名） | `signalSnapshotChanged`。 |
| Cancellation（取消） | Driver Service（驱动服务）停止时立刻取消 loop（循环）。 |

### 6.2 SSE Event（服务器发送事件）

新增事件名：

```text
signalSnapshotChanged
```

事件 payload（载荷）沿用 `DeviceEventStreamItem`，字段约束：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `eventId` | Yes | Driver Service（驱动服务）生成的事件 ID。 |
| `correlationId` | Yes | 后台读取生成的 correlationId（关联 ID），例如 `signal-snapshot-publisher-{timestamp}`。 |
| `eventName` | Yes | 固定为 `signalSnapshotChanged`。 |
| `commandName` | Yes | 固定为 `signalSnapshotPublisher`，避免和手动 `getSignalSnapshot` 混淆。 |
| `resultCode` | Yes | 成功时为 `OK`。 |
| `occurredAt` | Yes | UTC 时间。 |
| `snapshotValues` | Yes | 只包含 safe signal code（安全信号码）和值。 |

禁止在 payload（载荷）中携带：

```text
signedLease
signature
signaturePayload
signalConfig
privateKey
credential
sessionToken
targetEndpoint
raw ip
raw port
raw deviceId
registerAddress
writeValue
```

### 6.3 Snapshot Mapping（快照映射）

`GetSignalSnapshotResponse.SignalValues（信号值）` 需要映射为 `DeviceEventSnapshotValue[]（设备事件快照值数组）`：

1. key 使用已有 `SignalPoint.EffectiveKey（有效键）` 或 `signalCode（信号码）`。
2. value 只保留当前值，不保留 `rawRegisters（原始寄存器）`。
3. 遇到 ERP metadata row（ERP 元数据行）时，只取 `value` 字段。
4. 如果 key 命中敏感字段黑名单，则丢弃该项。

## 7. Logging Policy（日志策略）

### 7.1 Audit Log（审计日志）

10 秒自动读取与推送不写 `audit_log（审计日志表）`。

理由：

1. 自动 tick（计时读取）不是人工命令，也不是业务状态变更。
2. `audit_log（审计日志表）` 应继续表示命令最终事实，避免混入高频 telemetry（遥测）数据。
3. 需要审计的人工动作仍通过 `/applyLeaseAndConfig`、`/getSignalSnapshot`、`/executeDeviceCommand` 写入 audit（审计）。

### 7.2 Diagnostic Log（诊断日志）

10 秒自动读取成功不逐条写 `diagnostic_log（诊断日志表）`。针对 10 秒自动读取 tick（计时读取）本身，只记录失败和恢复；`SignalSnapshotPublisherStarted/Stopped（发布服务启动/停止）` 属于 service lifecycle（服务生命周期），不是每次读取记录。

允许记录以下事件：

| Event（事件） | When（何时记录） | Level（级别） | Category（分类） |
| --- | --- | --- | --- |
| `SignalSnapshotPublisherStarted` | service（服务）启动 | `Information` | `Startup` |
| `SignalSnapshotPublisherStopped` | service（服务）停止 | `Information` | `Startup` |
| `SignalSnapshotPublisherReadFailed` | 读取失败或返回非 `OK` | `Warning` | `Device` |
| `SignalSnapshotPublisherRecovered` | 连续失败后首次成功 | `Information` | `Device` |

默认不写 `SignalSnapshotPublisherSkipped` 到 `diagnostic_log（诊断日志表）`；如后续需要排查跳过原因，只允许走 `ILogger（日志抽象）` 的 debug-level（调试级别）摘要，不进入诊断日志表。

失败日志节流规则：

1. 首次失败立即记录。
2. 同一 failure key（失败键）在连续失败期间每 5 分钟最多记录一次。
3. failure key（失败键）由 `resultCode（结果码） + exceptionType（异常类型）` 组成。
4. 恢复成功时记录一次 `SignalSnapshotPublisherRecovered`，并重置失败节流状态。

日志正文必须是中文，字段名保持 English identifier（英文标识）。

## 8. Retention Policy（保留策略）

新增 `DiagnosticLogRetentionService（诊断日志保留服务）`，或在现有 hosted/background service（托管/后台服务）中加入最小清理任务。无论放在哪里，都必须支持 startup cleanup（启动清理）和 recurring cleanup（周期清理），不能只在启动时清理一次。

默认规则：

| Rule（规则） | Value（值） |
| --- | --- |
| Retention（保留期） | 7 days（7 天） |
| Cleanup interval（清理间隔） | 24 hours（24 小时） |
| Startup cleanup（启动清理） | Driver Service（驱动服务）启动后执行一次 |
| Recurring cleanup（周期清理） | Driver Service（驱动服务）运行期间每 24 hours（24 小时）执行一次 |
| Target table（目标表） | 仅 `diagnostic_log（诊断日志表）` |
| Audit table（审计表） | 不清理 `audit_log（审计日志表）` |

清理逻辑：

```text
DELETE FROM diagnostic_log WHERE created_at < cutoffUtc
```

第一版不做：

1. 不做 size-based retention（按大小保留）。
2. 不做 per-category retention（按分类保留）。
3. 不做 UI（界面）配置页。
4. 不做手动清理按钮。

## 9. Frontend Contract（前端契约）

### 9.1 EventSource（事件源）

`driverDeviceEventsClient` 必须用 `addEventListener（事件监听）` 接收 named event（命名事件）：

```text
signalSnapshotChanged
pressDownCountMonitorStarted
pressDownCountChanged
pressDownCountThresholdReached
pressDownCountMonitorFailed
pressDownCountMonitorStopped
```

保留现有 `onerror（错误处理）`，但避免每次连接波动都刷爆本地诊断摘要。

### 9.2 Driver Session（驱动会话）

`useDriverSession（驱动会话 Hook）` 增加一个最小更新入口：

```text
applySignalSnapshotEvent(event)
```

行为：

1. 只接受 `eventName = signalSnapshotChanged` 且 `resultCode = OK` 的事件。
2. 将 `snapshotValues（快照值）` 映射为 `signalValues（信号值）`。
3. 保留当前 `applyResult（授权结果）`。
4. 更新 `signalSnapshot.correlationId` 和 `signalSnapshot.signalValues`。
5. 不触发 `applyLeaseAndConfig（应用租约与配置）`。
6. 不触发 `bootstrapSession.retry（启动会话重试）`。

### 9.3 Shared Rendering（共享渲染）

`BootstrapDashboard（启动仪表盘）` 和 `PressJobPage（压机作业页）` 不新增独立 state（状态）。

它们继续读取：

```text
driverSession.data.signalSnapshot.signalValues
```

因此只要 `driverSession（驱动会话）` 被 SSE event（服务器发送事件）更新，两个界面自然同步刷新。

## 10. Error Handling（错误处理）

1. 无 active lease（活跃租约）：后台服务跳过读取，不写默认日志。
2. lease expired（租约过期）：后台服务停止读取；首次发现时可记录一条 `SignalSnapshotPublisherReadFailed`，`resultCode = LEASE_EXPIRED`。
3. device timeout（设备超时）：记录 `SignalSnapshotPublisherReadFailed`，按 5 分钟节流。
4. device rejected（设备拒绝/通信失败）：记录 `SignalSnapshotPublisherReadFailed`，按 5 分钟节流。
5. SSE subscriber（订阅者）断开：继续保留现有 `DeviceEventStreamDisconnected` 日志，不记录快照读取。
6. 单次读取超过 10 秒：下一轮不并发启动；后台 loop（循环）等待本次读取结束后再进入下一次 delay（延迟）。

## 11. Security Boundary（安全边界）

必须继续遵守项目根目录 `AGENTS.md` 的日志规则：

1. 不记录完整 `signedLease（签名租约）`。
2. 不记录 `signature（签名）` 或 `signature payload（签名原文）`。
3. 不记录 `signalConfig（信号配置）` 原文。
4. 不记录 `privateKey（私钥）`、`credential（凭据）`、`sessionToken（会话令牌）`。
5. 不记录 raw `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）`。
6. 第三方异常只记录 `exceptionType（异常类型）`、中文摘要、hash（哈希）和 `correlationId（关联 ID）`，不记录完整 stack trace（堆栈）或大段异常原文。
7. SSE payload（服务器发送事件载荷）和 diagnostic log（诊断日志）都不得携带 `rawRegisters（原始寄存器）`。

## 12. Test Plan（测试计划）

Backend focused tests（后端聚焦测试）：

1. 有 active lease（活跃租约）且有 subscriber（订阅者）时，publisher（发布服务）发布 `signalSnapshotChanged`。
2. 无 subscriber（订阅者）时不读取设备。
3. 自动成功读取不写 `audit_log（审计日志表）`。
4. 自动成功读取不逐条写 `diagnostic_log（诊断日志表）`。
5. 读取失败写 `SignalSnapshotPublisherReadFailed`，且 payload/log 不含敏感字段。
6. 连续失败按 5 分钟 throttle（节流）。
7. 失败后恢复写 `SignalSnapshotPublisherRecovered`。
8. retention（保留策略）删除 7 天以前的 `diagnostic_log（诊断日志表）`，不删除 `audit_log（审计日志表）`。

Frontend focused tests（前端聚焦测试）：

1. `subscribeDriverDeviceEvents（订阅驱动设备事件）` 能接收 named event（命名事件） `signalSnapshotChanged`。
2. `applySignalSnapshotEvent（应用信号快照事件）` 能更新 `driverSession.data.signalSnapshot.signalValues`。
3. 已有 `pressDownCountChanged（下压计数变化）` 和 `pressDownCountThresholdReached（下压计数达到阈值）` 处理不回归。
4. 事件 payload（载荷）包含敏感 key（键）时会被 frontend narrowing（前端收窄）丢弃。

Regression gates（回归门禁）：

```bash
cd driver-service
dotnet test
```

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

Manual smoke（手动冒烟）：

1. 启动 Driver Service（驱动服务）和 QT App（Qt 应用）。
2. 成功获取 lease authorization（租约授权）。
3. 打开启动仪表盘，确认信号快照 10 秒内刷新。
4. 进入压机作业页，确认实时信号同源刷新。
5. 断开设备或模拟超时，确认诊断日志只出现节流后的异常摘要。
6. 等待恢复，确认出现一次 recovered（恢复）记录。
7. 查询诊断日志，确认没有成功 tick（计时读取）刷屏。

## 13. Acceptance Criteria（验收标准）

1. Driver Service（驱动服务）在有效 active lease（活跃租约）期间每 10 秒主动读取 signal snapshot（信号快照）。
2. 读取结果通过 `/deviceEvents/stream` 推送 `signalSnapshotChanged` SSE event（服务器发送事件）。
3. Bootstrap Dashboard（启动仪表盘）和 PressJobPage（压机作业页）使用同一份 `driverSession（驱动会话）` 状态更新。
4. 自动成功读取不写 `audit_log（审计日志表）`。
5. 自动成功读取不逐条写 `diagnostic_log（诊断日志表）`。
6. 自动读取失败和恢复有可检索 diagnostic log（诊断日志），且有 throttle（节流）。
7. diagnostic log（诊断日志）默认 7 天保留，每 24 小时自动清理一次。
8. 清理只作用于 `diagnostic_log（诊断日志表）`，不清理 `audit_log（审计日志表）`。
9. SSE payload（服务器发送事件载荷）和日志都不泄漏敏感字段。
10. 现有 manual refresh（手动刷新）和 pressDownCount monitor（下压计数监测）事件不回归。

## 14. Spec Self-Review（规格自检）

1. Placeholder scan（占位扫描）：未保留待定或待办占位项。
2. Scope check（范围检查）：范围限定为 Driver Service（驱动服务）后台快照推送、SSE（服务器发送事件）消费、diagnostic log retention（诊断日志保留），不引入新传输协议或 ERP（企业资源计划）改动。
3. Consistency check（一致性检查）：日志策略与 `AGENTS.md`、`driver-service-v1-logging-spec.md` 的敏感字段边界一致。
4. YAGNI（你不会需要它）检查：不做 size-based retention（按大小保留）、UI 配置页、WebSocket（网页套接字）、远程日志平台或 per-category retention（按分类保留）。
5. Ambiguity check（歧义检查）：默认保留期、清理间隔、事件名、日志事件、跳过条件和验收标准均已明确。

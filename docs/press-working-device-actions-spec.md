# Press Working Device Actions Spec

> @file 压机作业设备动作规格说明
> @author PopoY
> @created 2026-07-02
> @purpose 固化 `建立通信 / 开始加工 / 完成加工 / 移入 / 移出 / 入线 / 出线` 七个按钮从 `sam-erp` 迁移到 `sam-calendaring` 的 Frontend（前端）、Driver Service（驱动服务）、ERP Qt API（企业资源计划 Qt 接口）、安全和日志边界。

## 1. Goal（目标）

在现有 `QT App（Qt 应用）` 的 `PressJobPage（压机作业页）` 上接入七个剩余生产按钮的真实业务逻辑：

1. `建立通信`：向设备写入 `MES communication status（MES 通信状态）= true`，不触发 `press counter clear（下压计数清零）`。
2. `开始加工`：通过 Driver precheck/start（驱动预检/启动）触发 `press counter clear（下压计数清零）` 后，再与 ERP start job（企业资源计划开始作业）把当前压机作业切到加工中。
3. `完成加工`：记录 end parameter snapshot（结束参数快照）、完成 ERP job（企业资源计划作业）并执行 Driver cleanup（驱动收尾）。
4. `移入`：向设备写入 `allow move in（允许移入）= true`。
5. `移出`：向设备写入 `allow move out（允许移出）= true`；需要换模且加工中时复用完成加工 workflow（完成加工流程）。
6. `入线`：向设备写入 `is line out（是否出线）= false`，并更新 `ERP Server（企业资源计划服务器）` 侧设备业务状态为 `0`。
7. `出线`：向设备写入 `is line out（是否出线）= true`，并更新 `ERP Server（企业资源计划服务器）` 侧设备业务状态为 `9`；加工中时可确认后复用完成加工 workflow（完成加工流程）。

本规格采用最小迁移方案：`QT App（Qt 应用）` 做 Action Orchestration（动作编排），`Driver Service（驱动服务）` 只执行授权范围内的 semantic command（语义命令）到 Modbus Device（Modbus 设备），`ERP Server（企业资源计划服务器）` 只处理业务状态落库。`QT App（Qt 应用）` 不传裸 `deviceId（设备 ID）`、`ip（网络地址）`、`port（端口）`、`signalName（信号名）`、`registerAddress（寄存器地址）` 或任意点位覆盖字段。

本规格不改变现有 bootstrap（启动引导）链路：`applyLeaseAndConfig（应用租约和配置）` 与 `getSignalSnapshot（获取信号快照）` 仍由启动流程负责。“建立通信”不是新增裸 `/connect（连接）` 接口，也不是重新设计 lease（租约）流程；它只是在 active lease（活跃租约）已经存在后，下发 `MES communication status（MES 通信状态）` 等业务语义信号。

## 2. Non-Goals（不做范围）

1. 不接入新的 `lock mold（锁定模具）` 或 `unlock mold（解锁模具）` 逻辑；它们已有独立规格和计划。
2. 不照搬 `sam-erp` 的 `/modbus/plc/write/signals/{deviceId}` 到 `QT App（Qt 应用）`。
3. 不让 `QT App（Qt 应用）` 决定 Modbus（工业通信协议）点位地址、寄存器类型、设备端点或设备 ID。
4. 不让 `Driver Service（驱动服务）` 访问 `ERP Server（企业资源计划服务器）`。
5. 不新增裸 `/connect（连接）`、`/renewLease（续租）` 或绕过 active lease（活跃租约）的设备接口。
6. 不在 Web Frontend（网页前端）实现 `pressDownCount（下压计数）` polling（轮询）、threshold calculation（阈值判断）或常驻 timer（定时器）；`开始加工` 后仅允许由 `Driver Service（驱动服务）` 启动 bounded pressDownCount monitor（有界下压计数监测），并通过 one-way device event stream（单向设备事件流）通知 `QT App（Qt 应用）` 做 parameter record（参数记录）。
7. 不创建 implementation plan（实施计划）或 Task（任务）文档；本文件只定义 spec（规格说明）。

## 3. Reference Behavior（参考行为）

参考 `sam-erp` 的 `PressWorkingTimeFeedback（冲压工时反馈）` 和 `pressProcessingMixin（压机加工混入逻辑）`：

| Button（按钮） | `sam-erp` 行为 | 本项目迁移口径 |
| --- | --- | --- |
| `建立通信` | 写 `MES通信状态=true`，再写 `下压计数清零=true`。 | `Driver Service（驱动服务）` 在 active lease（活跃租约）存在后执行 `connectMes` command（命令），只写 `MES通信状态=true`；`下压计数清零` 已移动到开始/完成加工阶段，不新增裸设备连接流程。 |
| `开始加工` | 校验待加工状态、人员/班组、已锁模和预计时长；并行写 `MES通信状态=true` 与调用 `handleStartPressJob(status=1)`；旧 Web 侧用 timer（定时器）轮询 `下压计数 >= 5` 后记录开始参数。 | `QT App（Qt 应用）` 先 Driver precheck/start（驱动预检/启动），`startDeviceSession` 必须先写 `下压计数清零=true`，再写可选 `开始信号=true`；成功后调用 ERP Qt start endpoint（开始加工端点）。ERP 失败时调用 Driver rollback（驱动回滚）。开始参数记录改为 Driver-owned monitor（驱动侧监测）：Driver 监听 `pressDownCount（下压计数）>=5` 并通过 device event stream（设备事件流）通知 QT App 调用参数落库。 |
| `完成加工` | 校验加工中；并行执行 PLC 完工清零与 MES 完工；MES 完工前记录 `recordStartParams(type=end)`。 | `QT App（Qt 应用）` 先取 final signal snapshot（最终信号快照）并记录 end parameters（结束参数），ERP 完工成功后再调用 Driver cleanup（驱动收尾）；ERP 失败不 cleanup（收尾）。 |
| `移入` | 写 `允许移入=true`。 | `Driver Service（驱动服务）` 执行 `moveIn` command（命令），只写设备信号。 |
| `移出` | 写 `允许移出=true`；旧系统换模时可联动完成加工。 | 默认只执行 `moveOut` command（命令）；选择 `change mold（换模）` 且加工中时复用完成加工 workflow（完成加工流程）。 |
| `入线` | 写 `是否出线=false`，并更新设备状态为 `0`。 | `QT App（Qt 应用）` 用同一个 `correlationId（关联 ID）` 并行调用 Driver command（驱动命令）和 ERP machine status API（设备状态接口）。 |
| `出线` | 写 `是否出线=true`，并更新设备状态为 `9`；旧系统加工中会确认并自动完工。 | 加工中时先二次确认，再复用完成加工 workflow（完成加工流程），之后执行 `lineOut` 和 ERP machine status update（设备状态更新）。 |

可迁移模式：

1. 保留 `Promise.allSettled（全部完成结算）` 的独立容错思想，用于 `入线 / 出线` 的设备写入和 ERP 状态更新。
2. 保留中文业务提示，但不保留旧前端直接传 `deviceId（设备 ID）` 写 PLC（可编程逻辑控制器）的模式。
3. 保留按钮前置校验，并按本项目 fail-closed（失败关闭）策略收紧：至少需要 `teamId（班组 ID）`、`operatorId（人员 ID）`、`processId（预选工艺 ID）`、current job state（当前作业状态）和 locked mold（已锁模）信息，用于业务记录和 diagnostic summary（诊断摘要）。

参考源码路径：

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/views/sam-smes2/prd/partsOrder/pressWorking/pressWorkingTimeFeedback.vue
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/mixins/pressProcessingMixin.js
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/api/modbus/plc.js
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/api/modbus/pressJob.js
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-plc/src/main/java/com/yr/plc/controller/PlcController.java
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-plc/src/main/java/com/yr/plc/service/impl/PlcServiceImpl.java
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/controller/PressJobInfoController.java
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java
```

## 4. Architecture（架构）

### 4.1 Responsibility Split（职责拆分）

| Component（组件） | Responsibility（职责） |
| --- | --- |
| `PressJobPage（压机作业页）` | 展示七个按钮、执行前置校验、维护 button loading state（按钮加载状态）、触发注入的动作回调、展示中文结果；不得用 Web timer（网页定时器）监听 `pressDownCount（下压计数）`。 |
| `App.tsx（应用入口）` | 持有 `sessionToken（会话令牌）`、`driverBaseUrl（驱动服务地址）` 和 `erpBaseUrl（企业资源计划地址）`，向 `PressJobPage（压机作业页）` 注入 Driver command（驱动命令）、ERP status update（企业资源计划状态更新）、device event subscription（设备事件订阅）和 diagnostic callback（诊断回调）；接收 Driver event（驱动事件）后调用 QT-side handler（Qt 侧处理方法）完成参数落库。 |
| `driverClient.ts（驱动客户端）` | 新增 `executeDeviceCommand（执行设备命令）` typed client（类型化客户端）和 `subscribeDriverDeviceEvents（订阅驱动设备事件）` typed client（类型化客户端），只发送白名单请求字段。 |
| `erpClient.ts（企业资源计划客户端）` | 新增 Qt 专用 start/end/parameter/machine status（开始/完成/参数/设备状态）客户端，`sessionToken（会话令牌）` 只在客户端内部作为 Authorization header（授权请求头）使用。 |
| `Driver Service（驱动服务）` | 基于 active lease（活跃租约）和已校验的 `signalConfig（信号配置）` 查找 semantic signal（语义信号），执行 precheck/start/write/cleanup/rollback（预检/启动/写入/收尾/回滚）并 read-back confirmation（回读确认）；`开始加工` 成功后负责 `pressDownCountMonitor（下压计数监测）` 的 bounded polling（有界轮询）和 realtime event（实时事件）上报。 |
| `ERP Server（企业资源计划服务器）` | 基于服务端 session（会话）、station context（工位上下文）、`granteeHostId（授权主机 ID）` 或绑定关系解析当前压机，更新 job/status/parameter record（作业/状态/参数记录）。 |

当前 `Driver Service V1（驱动服务第一版）` 只有 `applyLeaseAndConfig（应用租约和配置）`、`getSignalSnapshot（获取信号快照）` 和 `diagnosticLogs（诊断日志）` 能力，`IModbusAdapter（Modbus 适配器接口）` 也只有 connect/read（连接/读取）能力。因此后续 implementation plan（实施计划）必须把 write command（写命令）作为显式 Driver Service extension（驱动服务扩展）处理，不能把设备写入混进既有 V1 read path（读取路径）里偷跑。

### 4.2 Data Flow（数据流）

```text
QT App PressJobPage
  -> validate teamId/operatorId/processId, current job state, and driver readiness（校验班组/人员/工艺、当前作业状态和驱动就绪）
  -> App injected callback（应用层注入回调）
  -> Driver Service POST /executeDeviceCommand
  -> Driver loads active lease + signalConfig（读取活跃租约和信号配置）
  -> Driver writes semantic Modbus signal and confirms read-back（写入语义信号并回读确认）
  -> QT App refreshes signal snapshot（刷新信号快照）
```

`入线 / 出线` 额外执行：

```text
QT App PressJobPage
  -> Promise.allSettled([
       Driver Service /executeDeviceCommand,
       ERP Qt machine status endpoint
     ])
  -> show success, partial success, or failure（展示成功、部分成功或失败）
  -> record diagnostic summary（记录诊断摘要）
```

`开始加工` 执行顺序：

```text
QT App PressJobPage
  -> validate pending job + locked molds + expectedDuration（校验待加工、已锁模和预计时长）
  -> Driver Service execute precheckForStart（驱动开始前检查）
  -> Driver Service execute startDeviceSession（驱动启动设备会话）
  -> ERP Qt start job endpoint（企业资源计划开始作业端点）
  -> if ERP fails, Driver Service execute rollbackStartSignal（企业资源计划失败时回滚开始信号）
  -> if needParameterRecords=true, Driver Service execute startPressDownCountMonitor（需要开始参数时启动驱动侧下压计数监测）
  -> Driver Service emits pressDownCount events（驱动服务上报下压计数事件）
  -> QT-side handler records ERP parameters type=start when threshold reached（达到阈值后 Qt 侧处理方法记录开始参数）
  -> refresh current jobs + signal snapshot（刷新当前作业和信号快照）
```

`完成加工` 执行顺序：

```text
QT App PressJobPage
  -> validate running job（校验加工中）
  -> Driver Service get final signal snapshot（获取最终信号快照）
  -> ERP Qt record parameters type=end（记录结束参数）
  -> ERP Qt complete job endpoint（企业资源计划完成作业端点）
  -> only after ERP success, Driver Service execute cleanupDeviceSession（仅企业资源计划成功后执行驱动收尾）
  -> cleanup failure enters CleanupPending（收尾失败进入清理待完成）
  -> refresh current jobs + signal snapshot（刷新当前作业和信号快照）
```

## 5. Button Function Contract（按钮功能契约）

### 5.1 Shared Preflight（通用前置校验）

七个按钮触发前必须满足：

1. `bootstrap session（启动会话）` 已成功。
2. `driver session（驱动会话）` 已有 active lease（活跃租约）。
3. `driver session（驱动会话）` 的 `deviceSessionState（设备会话状态）` 为 `Connected（已连接）`；否则不得执行 `开始加工 / 完成加工 / 移入 / 移出 / 入线 / 出线`。
4. `teamId（班组 ID）` 已选择。
5. `operatorId（人员 ID）` 已选择。
6. `processId（预选工艺 ID）` 已选择；这是相对 `sam-erp` 的本项目 fail-closed（失败关闭）改造。
7. `current jobs（当前作业）` 查询已完成；查询失败或状态未知时，`开始加工 / 完成加工 / 移入 / 移出 / 入线 / 出线` 默认禁止。
8. 当前没有同一按钮的 pending request（挂起请求）。

`建立通信` 允许在 `deviceSessionState（设备会话状态）` 不是 `Connected（已连接）` 时触发 existing driver retry（既有驱动重试），但 retry（重试）只能复用 `applyLeaseAndConfig（应用租约和配置）` 与 `getSignalSnapshot（获取信号快照）`，不能传裸设备端点。retry（重试）成功后才允许继续执行 `connectMes` write command（写命令）。

### 5.2 Idempotency（幂等）与重复点击

每次按钮触控生成一组稳定 action identity（动作身份），同一次用户确认内复用：

| Field（字段） | Required（必需） | Rule（规则） |
| --- | --- | --- |
| `correlationId` | Yes | 串联 UI action（界面动作）、Driver command（驱动命令）、ERP request（企业资源计划请求）、audit log（审计日志）和 diagnostic log（诊断日志）。 |
| `idempotencyKey` | Yes | 写设备动作必填；同一次按钮触控内固定，不同触控生成新值。 |
| `localJobSessionId` | Yes | 有 current job row（当前作业行）时使用行内值；没有当前作业时生成 `press-device-action-*` 本地动作会话 ID，不使用裸设备字段代替。 |

UI（界面）必须在 request pending（请求挂起）期间禁用同一按钮。Driver Service（驱动服务）收到重复 `idempotencyKey（幂等键）` 时应返回同 key 上一次可确认结果，或返回 `DEVICE_BUSY（设备忙）`，不得重复写设备。ERP start/complete/status/parameter endpoint（企业资源计划开始/完成/状态/参数端点）也必须识别同 key，避免重复落库。

### 5.3 建立通信

Command（命令）：

```text
connectMes
```

Driver write steps（驱动写入步骤）：

| Signal Name（信号名） | Signal（信号） | Write Value（写入值） | Required（必需） |
| --- | --- | --- | --- |
| `MES通信状态` | `MES communication status（MES 通信状态）` | `true` | Yes |

Result rule（结果规则）：

1. `MES通信状态` 完成并回读确认，返回 `OK`。
2. `MES通信状态` 失败，返回失败，UI（界面）提示：“建立通信失败，请检查设备连接后重试。”

### 5.4 开始加工

Start preconditions（开始前置条件）：

1. 当前作业 status（状态）必须为 `0`，表示 pending/not started（待加工/未开始）。
2. 当前至少有一套 locked mold（已锁定模具）。
3. `expectedDuration（预计时长）` 必填，必须大于 `0`，格式为整数或最多一位小数，例如 `1`、`1.5`、`0.5`。
4. 如果 Driver Service（驱动服务）处于 `CleanupPending（清理待完成）`，禁止开始加工。

Driver commands（驱动命令）：

```text
precheckForStart
startDeviceSession
rollbackStartSignal
startPressDownCountMonitor
stopPressDownCountMonitor
```

`precheckForStart（开始前检查）` 至少校验：

1. active lease（活跃租约）有效且未过期。
2. `deviceSessionState（设备会话状态）` 为 `Connected（已连接）`。
3. command（命令）落在 `allowedScopes（授权范围）` 内。
4. 需要的 writable signal（可写信号）均存在并在 `allowedAddressRanges（授权地址范围）` 内。

`startDeviceSession（启动设备会话）` write steps（写入步骤）：

| Signal Name（信号名） | Signal（信号） | Write Value（写入值） | Required（必需） |
| --- | --- | --- | --- |
| `MES通信状态` | `MES communication status（MES 通信状态）` | `true` | Yes |
| `下压计数清零` | `press counter clear（下压计数清零）` | `true` | Yes，失败时不得继续写 `开始信号` |
| `开始信号` | `press start（开始信号）` | `true` | No，只有 `signalConfig（信号配置）` 明确提供 `signalName=开始信号` 时启用 |

ERP start request（企业资源计划开始请求）：

```json
{
  "correlationId": "press-start-...",
  "idempotencyKey": "press-start-...",
  "localJobSessionId": "press-job-row-...",
  "operatorId": "zhangsan",
  "teamId": "PLINE-01",
  "processId": "CRAFT-001",
  "expectedDuration": "1.5"
}
```

Server-side requirements（服务端要求）：

1. `ERP Server（企业资源计划服务器）` 从 token（令牌）和 station context（工位上下文）解析当前绑定压机。
2. 不接收 `deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）` 作为信任字段。
3. 重复 status（状态）更新返回中文业务错误或 idempotent replay（幂等重放）。
4. 成功后更新 press job（压机作业）为 `status=1`，写入 operator（操作员）、startTime（开始时间）、expectedDuration（预计时长），并同步 press mold job（压机模具作业）为进行中。

Compensation（补偿）：

1. Driver start（驱动启动）失败时，不调用 ERP start（企业资源计划开始）。
2. Driver start（驱动启动）成功但 ERP start（企业资源计划开始）失败时，`QT App（Qt 应用）` 必须调用 `rollbackStartSignal（回滚开始信号）`。
3. rollback（回滚）失败时 Driver Service（驱动服务）进入 `Faulted（故障）` 或保留 diagnostic log（诊断日志），UI（界面）提示人工处理。

Start parameter record（开始参数记录）：

1. 如果当前作业声明 `needParameterRecords（需要参数记录）= true`，`QT App（Qt 应用）` 只能在 ERP start success（企业资源计划开始成功）后调用 `startPressDownCountMonitor（启动下压计数监测）`，不得在 Web Frontend（网页前端）启动 `setInterval（定时器）`、`requestAnimationFrame（动画帧）`、query refetch loop（查询重复拉取）或手写 polling（轮询）。
2. `Driver Service（驱动服务）` 是 `pressDownCountMonitor（下压计数监测）` owner（所有者），只从 active lease（活跃租约）和本地 `signalConfig（信号配置）` 解析 `signalName=下压计数` 的授权点位，不接收 `QT App（Qt 应用）` 传入的 `deviceId（设备 ID）`、`ip（网络地址）`、`port（端口）`、`signalName（信号名）`、`registerAddress（寄存器地址）` 或阈值覆盖。
3. threshold（阈值）一期固定为 `pressDownCount >= 5`，来源是 Driver Service config/spec constant（驱动服务配置/规格常量），不是 Web UI logic（网页界面逻辑）。poll interval（轮询间隔）和 max duration（最大持续时间）也由 Driver Service（驱动服务）本地配置控制。
4. `Driver Service（驱动服务）` 监测到 `pressDownCount（下压计数）` 变化时可节流发送 `pressDownCountChanged（下压计数变化）` realtime event（实时事件）；达到阈值时必须发送一次 `pressDownCountThresholdReached（下压计数阈值已达到）` event（事件），并携带 narrowed snapshot（收窄快照）或等价的安全参数载荷。
5. `QT App（Qt 应用）` 收到 `pressDownCountThresholdReached（下压计数阈值已达到）` 后调用 QT-side handler（Qt 侧处理方法）`handlePressParameterThresholdReached（处理参数阈值达到）`，该方法再调用 ERP parameter endpoint（参数端点）记录 `type=start`。`Driver Service（驱动服务）` 不调用 ERP API（企业资源计划接口）。
6. 同一 `localJobSessionId（本地作业会话 ID） + type=start` 只能落库一次。Driver event（驱动事件）允许 at-least-once delivery（至少一次投递），但 `QT App（Qt 应用）` 和 `ERP Server（企业资源计划服务器）` 必须用 `parameterIdempotencyKey（参数幂等键）` 去重。
7. monitor（监测）在 threshold reached（达到阈值）、timeout（超时）、`完成加工` cleanup（收尾）、`rollbackStartSignal（回滚开始信号）`、active lease（活跃租约）失效、device disconnected（设备断开）或收到 `stopPressDownCountMonitor（停止下压计数监测）` 后停止。
8. 未配置 `pressDownCount（下压计数）` 或 monitor start（监测启动）失败时不回滚已成功的开始加工，但必须记录 diagnostic summary（诊断摘要）并提示“开始加工已完成，开始参数监听未启动，请查看诊断日志。”，且不得 fallback（降级）为 Web polling（网页轮询）。

### 5.5 完成加工

Complete preconditions（完成前置条件）：

1. 当前作业 status（状态）必须为 `1`，表示 running（加工中）。
2. 当前至少有一套 locked mold（已锁定模具）。
3. current job（当前作业）必须有可用于串联的 `localJobSessionId（本地作业会话 ID）`。

Driver commands（驱动命令）：

```text
cleanupDeviceSession
```

Complete workflow（完成流程）：

1. `QT App（Qt 应用）` 先调用 `getSignalSnapshot（获取信号快照）` 取得 final snapshot（最终快照）。
2. `QT App（Qt 应用）` 调用 ERP parameter endpoint（参数端点）记录 `type=end`。
3. `QT App（Qt 应用）` 调用 ERP complete endpoint（完成加工端点）更新 `status=3`。
4. ERP complete（企业资源计划完成）成功后，`QT App（Qt 应用）` 才调用 `cleanupDeviceSession（清理设备会话）`。
5. `type=end` parameter record（结束参数记录）失败时，不调用 ERP complete（企业资源计划完成），避免无参数完工。
6. ERP complete（企业资源计划完成）失败时，不调用 cleanup（收尾），避免设备已收尾但业务仍可重试。

`cleanupDeviceSession（清理设备会话）` write steps（写入步骤）：

| Signal Name（信号名） | Signal（信号） | Write Value（写入值） | Required（必需） |
| --- | --- | --- | --- |
| `MES通信状态` | `MES communication status（MES 通信状态）` | `false` | No，一期如现场 PLC 不需要断开可配置为跳过 |
| `下压计数清零` | `press counter clear（下压计数清零）` | `false` | Yes |
| `下压计数清零` | `press counter clear（下压计数清零）` | `true` | Yes |

ERP complete request（企业资源计划完成请求）：

```json
{
  "correlationId": "press-complete-...",
  "idempotencyKey": "press-complete-...",
  "localJobSessionId": "press-job-row-...",
  "operatorId": "zhangsan",
  "teamId": "PLINE-01",
  "processId": "CRAFT-001",
  "status": "3"
}
```

Server-side requirements（服务端要求）：

1. `ERP Server（企业资源计划服务器）` 从 token（令牌）和 station context（工位上下文）解析当前绑定压机。
2. 当前 press job（压机作业）不是 `status=1` 时返回中文业务错误。
3. 成功后写入 endOperator（完工人员）、endTime（完成时间）、workingTime（加工时长），同步 press mold job（压机模具作业）完工，并清空当前设备作业缓存。

Cleanup failure（收尾失败）：

1. ERP complete（企业资源计划完成）成功但 cleanup（收尾）失败时，Driver Service（驱动服务）进入 `CleanupPending（清理待完成）`。
2. `CleanupPending（清理待完成）` 必须阻止下一次 `开始加工`，直到人工或后续 cleanup retry（收尾重试）成功。
3. UI（界面）提示：“完成加工已落库，设备收尾失败，请查看诊断日志并处理。”

### 5.6 移入

Command（命令）：

```text
moveIn
```

Driver write steps（驱动写入步骤）：

| Signal Name（信号名） | Signal（信号） | Write Value（写入值） |
| --- | --- | --- |
| `允许移入` | `allow move in（允许移入）` | `true` |

成功后只刷新 signal snapshot（信号快照），不更新 ERP machine status（企业资源计划设备状态）。

### 5.7 移出

Command（命令）：

```text
moveOut
```

Driver write steps（驱动写入步骤）：

| Signal Name（信号名） | Signal（信号） | Write Value（写入值） |
| --- | --- | --- |
| `允许移出` | `allow move out（允许移出）` | `true` |

如果用户选择 `change mold（换模）` 且当前 status（状态）为 `1`，`QT App（Qt 应用）` 必须先二次确认，再复用 `完成加工` workflow（完成加工流程）。完成加工 workflow（完成加工流程）结束后再执行 `moveOut`；其中任一阶段失败都展示 partial result（部分结果）并记录 diagnostic summary（诊断摘要）。

### 5.8 入线

Command（命令）：

```text
lineIn
```

Driver write steps（驱动写入步骤）：

| Signal Name（信号名） | Signal（信号） | Write Value（写入值） |
| --- | --- | --- |
| `是否出线` | `is line out（是否出线）` | `false` |

ERP status update（企业资源计划状态更新）：

```json
{
  "correlationId": "press-line-in-...",
  "idempotencyKey": "press-line-in-...",
  "localJobSessionId": "press-device-action-...",
  "status": "0",
  "reason": "lineIn"
}
```

`QT App（Qt 应用）` 必须用同一个 `correlationId（关联 ID）` 调用 Driver command（驱动命令）和 ERP status update（企业资源计划状态更新）。任一侧失败时展示 partial result（部分结果），并记录 diagnostic summary（诊断摘要）。

### 5.9 出线

Command（命令）：

```text
lineOut
```

Driver write steps（驱动写入步骤）：

| Signal Name（信号名） | Signal（信号） | Write Value（写入值） |
| --- | --- | --- |
| `是否出线` | `is line out（是否出线）` | `true` |

ERP status update（企业资源计划状态更新）：

```json
{
  "correlationId": "press-line-out-...",
  "idempotencyKey": "press-line-out-...",
  "localJobSessionId": "press-device-action-...",
  "status": "9",
  "reason": "lineOut"
}
```

如果当前 status（状态）为 `1`，`QT App（Qt 应用）` 必须二次确认：“当前有正在加工的模具，出线将自动完成加工，是否确认出线？”确认后复用 `完成加工` workflow（完成加工流程），再执行 `lineOut` 和 ERP status update（设备状态更新）。如果用户取消，则不调用 Driver 或 ERP。

如果 `current jobs（当前作业）` 查询失败、为空但无法判断设备是否加工中，或 status（状态）字段缺失，`出线` 必须 fail closed（失败关闭），不得默认当作可出线。

## 6. Driver Service API Contract（驱动服务接口契约）

### 6.1 POST /executeDeviceCommand

Request（请求）只允许以下字段：

```json
{
  "correlationId": "string",
  "commandName": "connectMes",
  "localJobSessionId": "press-device-action-...",
  "idempotencyKey": "press-connect-...",
  "timeoutMs": 5000
}
```

`commandName（命令名）` 可选值：

```text
connectMes
precheckForStart
startDeviceSession
rollbackStartSignal
startPressDownCountMonitor
stopPressDownCountMonitor
cleanupDeviceSession
moveIn
moveOut
lineIn
lineOut
```

Monitor command rules（监测命令规则）：

1. `startPressDownCountMonitor（启动下压计数监测）` 不写设备，只在 Driver Service（驱动服务）内部启动 bounded polling（有界轮询）。它仍走 `/executeDeviceCommand`，以复用 strict JSON contract（严格 JSON 契约）、`correlationId（关联 ID）`、`idempotencyKey（幂等键）` 和 audit/diagnostic log（审计/诊断日志）。
2. `stopPressDownCountMonitor（停止下压计数监测）` 不写设备，只取消同一 `localJobSessionId（本地作业会话 ID）` 下仍在运行的 monitor（监测）。
3. 两个 monitor command（监测命令）都不得接收 threshold（阈值）、poll interval（轮询间隔）、signal key（信号键）或设备点位字段；这些信息只来自 Driver Service config（驱动服务配置）和 active lease（活跃租约）。
4. 重复启动同一 `localJobSessionId（本地作业会话 ID）` 的 monitor（监测）时，Driver Service（驱动服务）返回已有 monitor（监测）的确认摘要，或返回 `MONITOR_ALREADY_RUNNING（监测已运行）`，不得创建多个轮询任务。

禁止字段：

```text
signedLease
signature
signalConfig
sessionToken
deviceId
ip
port
targetEndpoint
targetEndpointOverride
signalName
signalCode
registerAddress
address
pointOverride
writeValue
expectedDuration
operatorId
teamId
processId
```

Success response（成功响应）：

```json
{
  "correlationId": "string",
  "commandName": "connectMes",
  "localJobSessionId": "press-device-action-...",
  "idempotencyKey": "press-connect-...",
  "resultCode": "OK",
  "message": "设备动作执行成功",
  "leaseState": "Active",
  "deviceSessionState": "Connected",
  "completedSteps": ["MES通信状态", "下压计数清零"],
  "failedSteps": []
}
```

Partial response（部分成功响应）：

```json
{
  "correlationId": "string",
  "commandName": "connectMes",
  "localJobSessionId": "press-device-action-...",
  "idempotencyKey": "press-connect-...",
  "resultCode": "PARTIAL_OK",
  "message": "设备动作部分完成，请查看诊断日志",
  "leaseState": "Active",
  "deviceSessionState": "Connected",
  "completedSteps": ["MES通信状态"],
  "failedSteps": ["下压计数清零"]
}
```

Failure response（失败响应）：

```json
{
  "correlationId": "string",
  "commandName": "moveIn",
  "localJobSessionId": "press-device-action-...",
  "idempotencyKey": "press-move-in-...",
  "resultCode": "DEVICE_REJECTED",
  "message": "设备回读确认失败",
  "leaseState": "Active",
  "deviceSessionState": "Faulted",
  "completedSteps": [],
  "failedSteps": ["允许移入"]
}
```

### 6.2 Result Codes（结果码）

| Code（代码） | Meaning（含义） |
| --- | --- |
| `OK` | 全部 write step（写入步骤）成功并通过回读确认。 |
| `PARTIAL_OK` | 至少一个 write step（写入步骤）成功，至少一个失败。 |
| `LEASE_INVALID` | active lease（活跃租约）不存在、字段不完整或不可用。 |
| `LEASE_EXPIRED` | active lease（活跃租约）已过期。 |
| `COMMAND_NOT_ALLOWED` | `allowedScopes（授权范围）` 不允许当前 command（命令）。 |
| `SIGNAL_NOT_CONFIGURED` | `signalConfig（信号配置）` 缺少所需 semantic signal（语义信号）。 |
| `SIGNAL_NOT_WRITABLE` | 目标 signal（信号）不是可写点位或寄存器类型暂不支持写入。 |
| `DEVICE_TIMEOUT` | Modbus Device（Modbus 设备）通信超时。 |
| `DEVICE_REJECTED` | write（写入）后 read-back confirmation（回读确认）不一致。 |
| `DEVICE_BUSY` | 当前 device session state（设备会话状态）不允许写入。 |
| `CLEANUP_PENDING` | 上次 cleanup（收尾）未完成，禁止开始新作业。 |
| `ROLLBACK_FAILED` | ERP start（企业资源计划开始）失败后的 Driver rollback（驱动回滚）未完成。 |
| `IDEMPOTENCY_REPLAY` | `idempotencyKey（幂等键）` 命中过去已确认结果，响应返回上一次结果摘要。 |
| `MONITOR_ALREADY_RUNNING` | 同一 `localJobSessionId（本地作业会话 ID）` 的 `pressDownCountMonitor（下压计数监测）` 已存在。 |
| `MONITOR_NOT_RUNNING` | 请求停止的 monitor（监测）不存在或已结束。 |
| `MONITOR_TIMEOUT` | monitor（监测）在 max duration（最大持续时间）内未达到阈值。 |
| `EVENT_STREAM_UNAVAILABLE` | device event stream（设备事件流）不可用或发送失败。 |

### 6.3 Device Event Stream（设备事件流）

一期推荐使用 `SSE（Server-Sent Events，服务器发送事件）` 暴露单向 realtime event stream（实时事件流）：

```text
GET /deviceEvents/stream
```

如实机 Qt WebEngine（Qt 网页引擎）环境对 `SSE（服务器发送事件）` 支持存在问题，可在不改变 event payload（事件载荷）的前提下替换为 `WebSocket（网页套接字）` 或 local native bridge event stream（本地原生桥接事件流）。不论使用哪种传输，Web Frontend（网页前端）都只能 subscribe（订阅）事件，不得用 polling（轮询）补偿。

Event names（事件名）：

```text
pressDownCountMonitorStarted
pressDownCountChanged
pressDownCountThresholdReached
pressDownCountMonitorFailed
pressDownCountMonitorStopped
```

`pressDownCountThresholdReached（下压计数阈值已达到）` payload（载荷）示例：

```json
{
  "eventId": "driver-event-...",
  "correlationId": "press-start-...",
  "localJobSessionId": "press-job-row-...",
  "eventName": "pressDownCountThresholdReached",
  "commandName": "pressDownCountMonitor",
  "resultCode": "OK",
  "pressDownCount": 5,
  "threshold": 5,
  "parameterIdempotencyKey": "press-param-start-...",
  "occurredAt": "2026-07-02T10:30:00Z",
  "snapshotValues": {
    "safeSignalCode": "value"
  }
}
```

Event payload rules（事件载荷规则）：

1. `snapshotValues（快照值）` 必须是 narrowed snapshot（收窄快照），只包含 ERP parameter endpoint（企业资源计划参数端点）需要的 safe signal code（安全信号码）和值；不得包含 raw `signalConfig（原始信号配置）`、Modbus address（Modbus 地址）、`deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）`。
2. `pressDownCountChanged（下压计数变化）` 用于 realtime reporting（实时汇报），可以只携带 `pressDownCount（下压计数）`、`eventId（事件 ID）`、`correlationId（关联 ID）` 和 `localJobSessionId（本地作业会话 ID）`，并应按 Driver config（驱动配置）节流，避免日志和 UI 事件风暴。
3. `pressDownCountThresholdReached（下压计数阈值已达到）` 是唯一触发 `type=start` parameter record（开始参数记录）的事件。
4. Event stream（事件流）不得把 `sessionToken（会话令牌）`、`signedLease（签名租约）`、`signature（签名）` 或 raw `signalConfig（原始信号配置）` 放入 query string（查询字符串）、header（请求头）或日志。
5. Event stream（事件流）断开时，`QT App（Qt 应用）` 记录 diagnostic summary（诊断摘要）并允许人工 retry monitor（重试监测）；不得自动切换成 Web polling（网页轮询）。

## 7. Signal Config Contract（信号配置契约）

`ERP Server（企业资源计划服务器）` 下发给 `Driver Service（驱动服务）` 的 `signalConfig（信号配置）` 必须保留 ERP legacy signalName（旧信号名）和 writable（可写）能力字段。推荐在每个 signal point（信号点）上携带：

```json
{
  "signalCode": "SAFE_SIGNAL_CODE",
  "signalName": "允许移入",
  "registerAddress": 100,
  "registerType": "coil",
  "signalType": "write",
  "writable": true
}
```

Driver lookup rule（驱动查找规则）：

1. 优先按 ERP legacy `signalName（旧信号名）` 查找。
2. 不允许 `QT App（Qt 应用）` 传 `semanticKey（语义键）` 或 `signalName（信号名）`。
3. Driver Service（驱动服务）内部由 command catalog（命令目录）固定 `commandName（命令名） -> signalName（信号名）`，不新增独立 whitelist mapping（白名单映射表）。
4. 查找到的点位仍必须落在 `allowedAddressRanges（授权地址范围）` 内。
5. command（命令）必须落在 `allowedScopes（授权范围）` 内，推荐 scope（范围）为 `pressWorking.deviceActions` 或 `pressWorking.deviceActions.<commandName>`。

Required signal names（必需信号名）：

| Signal Name（信号名） | Used By（使用按钮） |
| --- | --- |
| `MES通信状态` | `建立通信` |
| `下压计数清零` | `建立通信` |
| `开始信号` | `开始加工` optional（可选） |
| `下压计数` | `Driver Service（驱动服务）` `pressDownCountMonitor（下压计数监测）` |
| `允许移入` | `移入` |
| `允许移出` | `移出` |
| `是否出线` | `入线 / 出线` |

## 8. Modbus Write Contract（Modbus 写入契约）

`IModbusAdapter（Modbus 适配器接口）` 后续需要扩展最小 write capability（写入能力）：

```text
WriteAsync(point, value, timeout, cancellationToken)
```

支持范围：

1. `coil（线圈）`：写入 `true / false`，并通过 read coil（读取线圈）确认。
2. `holding register（保持寄存器）`：写入 `1 / 0` 或 `ushort（无符号 16 位整数）`，并通过 read holding register（读取保持寄存器）确认。
3. 其他类型默认返回 `SIGNAL_NOT_WRITABLE`。

写入规则：

1. 每个 write command（写命令）执行前确保 device session（设备会话）已连接；未连接时可使用 active lease（活跃租约）中的 `targetEndpoint（目标端点）` 建立连接。
2. 不从 HTTP request（HTTP 请求）读取设备端点或点位。
3. 写入完成必须做 read-back confirmation（回读确认）。
4. 回读值不一致时返回 `DEVICE_REJECTED`。
5. 写设备命令不自动 retry（重试）；UI（界面）只做按钮 loading（加载）和防重复点击。

## 9. ERP Qt API Contract（企业资源计划 Qt 接口契约）

### 9.1 POST /api/qt/press-working/press-job-starts

Request（请求）：

```json
{
  "correlationId": "press-start-...",
  "idempotencyKey": "press-start-...",
  "localJobSessionId": "press-job-row-...",
  "operatorId": "zhangsan",
  "teamId": "PLINE-01",
  "processId": "CRAFT-001",
  "expectedDuration": "1.5"
}
```

Server-side requirements（服务端要求）：

1. `ERP Server（企业资源计划服务器）` 必须从 token（令牌）和 station context（工位上下文）解析当前绑定压机。
2. 不接收 `deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）` 作为信任字段。
3. 当前作业必须为 `status=0（待加工）`。
4. 至少存在一套 locked mold（已锁定模具）。
5. `expectedDuration（预计时长）` 必须大于 `0`。
6. 成功后返回服务端生成或确认的 `localJobSessionId（本地作业会话 ID）`、`startedAt（开始时间）` 和 `status=1`。

### 9.2 POST /api/qt/press-working/press-job-parameters

Request（请求）：

```json
{
  "correlationId": "press-param-...",
  "idempotencyKey": "press-param-...",
  "localJobSessionId": "press-job-row-...",
  "type": "start",
  "signalValues": {
    "safeSignalCode": "value"
  }
}
```

Allowed type（允许类型）：

```text
start
end
```

Server-side requirements（服务端要求）：

1. `signalValues（信号值）` 必须是 `QT App（Qt 应用）` 从 `Driver Service（驱动服务）` response/event（响应/事件）取得的 narrowed snapshot（收窄快照），不得包含 raw `signalConfig（原始信号配置）`。
2. `ERP Server（企业资源计划服务器）` 根据服务端绑定关系写入当前进行中的 press mold job（压机模具作业）参数记录。
3. 未找到加工中作业时返回中文业务错误。
4. `type=start` 必须支持 `parameterIdempotencyKey（参数幂等键）` 或请求中的 `idempotencyKey（幂等键）` 去重，确保同一 `localJobSessionId（本地作业会话 ID）` 的开始参数只落库一次。

### 9.3 POST /api/qt/press-working/press-job-completions

Request（请求）：

```json
{
  "correlationId": "press-complete-...",
  "idempotencyKey": "press-complete-...",
  "localJobSessionId": "press-job-row-...",
  "operatorId": "zhangsan",
  "teamId": "PLINE-01",
  "processId": "CRAFT-001",
  "status": "3"
}
```

Server-side requirements（服务端要求）：

1. `ERP Server（企业资源计划服务器）` 必须从 token（令牌）和 station context（工位上下文）解析当前绑定压机。
2. 不接收 `deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）` 作为信任字段。
3. 当前作业必须为 `status=1（加工中）`。
4. 成功后写入 endOperator（完工人员）、endTime（完成时间）、workingTime（加工时长），同步完成 press mold job（压机模具作业），并清空当前设备作业缓存。

### 9.4 POST /api/qt/press-working/machine-status

Request（请求）：

```json
{
  "correlationId": "press-line-in-...",
  "idempotencyKey": "press-line-in-...",
  "localJobSessionId": "press-device-action-...",
  "status": "0",
  "reason": "lineIn"
}
```

允许值：

| Field（字段） | Values（可选值） |
| --- | --- |
| `status` | `0`, `9` |
| `reason` | `lineIn`, `lineOut` |

Headers（请求头）：

| Header（请求头） | Required（必需） | Note（说明） |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer sessionToken`，只由 `erpClient（企业资源计划客户端）` 内部使用。 |
| `X-Correlation-Id` | Yes | 与 Driver command（驱动命令）使用同一个 `correlationId（关联 ID）`。 |

Server-side requirements（服务端要求）：

1. `ERP Server（企业资源计划服务器）` 必须从 token（令牌）和 station context（工位上下文）解析当前绑定压机。
2. 不接收 `deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）` 作为信任字段。
3. `idempotencyKey（幂等键）` 用于防止同一次触控重复落库。
4. `localJobSessionId（本地作业会话 ID）` 只用于串联本地动作或当前作业，不作为设备授权字段。
5. `status=0` 表示入线或恢复可用。
6. `status=9` 表示出线或维修态。
7. 返回中文业务错误，不返回 raw exception（原始异常）或内部 SQL（结构化查询语言）。

Response（响应）：

```json
{
  "code": 200,
  "msg": "设备状态更新完成",
  "data": {
    "status": "0"
  }
}
```

## 10. Frontend Contract（前端契约）

### 10.1 PressJobPage Props（页面属性）

`PressJobPage（压机作业页）` 不直接 import（导入） `driverClient（驱动客户端）`、`erpClient（企业资源计划客户端）` 或 `logging service（日志服务）`。建议由 `App.tsx（应用入口）` 注入：

```text
executePressDeviceCommand(input)
subscribeDriverDeviceEvents(input, onEvent)
startPressJob(input)
recordPressJobParameters(input)
completePressJob(input)
updatePressMachineStatus(input)
refreshSignalSnapshot()
refreshPressJobCurrentJobs()
recordPressDeviceActionDiagnostic(summary)
```

### 10.2 UI State（界面状态）

1. 每个按钮维护独立 loading state（加载状态）。
2. 当前按钮 loading（加载）时禁用同一按钮，避免重复写设备。
3. Driver lease（驱动租约）未 active（活跃）时禁用 `开始加工 / 完成加工 / 移入 / 移出 / 入线 / 出线`；`建立通信` 可尝试 existing driver retry（既有驱动重试），retry（重试）后仍未 active（活跃）则提示：“设备授权未就绪，请稍后重试。”
4. 操作成功后刷新 signal snapshot（信号快照）。
5. 每次按钮触控生成并复用同一组 `correlationId（关联 ID）`、`idempotencyKey（幂等键）` 和 `localJobSessionId（本地作业会话 ID）`。
6. `入线 / 出线` 的 Driver command（驱动命令）和 ERP status update（企业资源计划状态更新）必须同用一个 `correlationId（关联 ID）`。
7. `current jobs（当前作业）` 查询失败或状态未知时，高风险按钮 fail closed（失败关闭）。
8. `PressJobPage（压机作业页）` 和 React component（React 组件）不得使用 `setInterval（定时器）`、`requestAnimationFrame（动画帧）`、query refetch loop（查询重复拉取）或手写 polling（轮询）监听 `pressDownCount（下压计数）`。
9. device event stream（设备事件流）断开时只展示中文提示并记录 diagnostic summary（诊断摘要），不得自动 fallback（降级）为 Web polling（网页轮询）。

### 10.3 Device Event Handling（设备事件处理）

`App.tsx（应用入口）` 或 QT shell（Qt 外壳）负责订阅 `Driver Service（驱动服务）` 的 device event stream（设备事件流），并把事件转给 QT-side handler（Qt 侧处理方法）。一期可以先在 `App.tsx（应用入口）` 中实现该 handler（处理方法），后续如需要 C++ native bridge（C++ 原生桥接）承载参数存储，也必须保持同一安全载荷。

Required handler（必需处理方法）：

```text
handlePressParameterThresholdReached(event)
```

Handler rule（处理规则）：

1. 只处理 `eventName=pressDownCountThresholdReached`。
2. 使用 `event.parameterIdempotencyKey（参数幂等键）` 作为 ERP parameter request（企业资源计划参数请求）的 `idempotencyKey（幂等键）`。
3. 调用 `recordPressJobParameters（记录压机作业参数）` 时固定传 `type=start`，并只传 `event.snapshotValues（事件快照值）` 的 narrowed snapshot（收窄快照）。
4. 如果同一 `localJobSessionId（本地作业会话 ID） + type=start` 已处理过，直接忽略重复事件并记录轻量 diagnostic summary（诊断摘要），不得重复调用 ERP parameter endpoint（参数端点）。
5. 如果参数落库失败，保留 retry affordance（重试入口）或 diagnostic hint（诊断提示）；不得要求 Web Frontend（网页前端）重新轮询 `pressDownCount（下压计数）`。

### 10.4 User Messages（用户提示）

| Scenario（场景） | Message（提示） |
| --- | --- |
| 缺少班组 | `请先选择班组。` |
| 缺少人员 | `请先选择人员。` |
| 缺少预选工艺 | `请先选择预选工艺。` |
| 当前作业状态未知 | `当前作业状态未确认，请刷新后重试。` |
| Driver 未就绪 | `设备授权未就绪，请稍后重试。` |
| 建立通信成功 | `通信已建立。` |
| 开始加工成功 | `开始加工完成。` |
| 开始参数监听未启动 | `开始加工已完成，开始参数监听未启动，请查看诊断日志。` |
| 开始参数监听中断 | `开始参数监听中断，请查看诊断日志后重试监听。` |
| 开始参数已记录 | `开始参数已记录。` |
| 完成加工成功 | `完成加工完成。` |
| 预计时长错误 | `预计时长格式错误，应为大于0的整数或小数（最多一位小数）。` |
| 移入成功 | `移入信号已下发。` |
| 移出成功 | `移出信号已下发。` |
| 入线成功 | `入线完成。` |
| 出线成功 | `出线完成。` |
| 部分成功 | `部分动作完成，请查看诊断日志。` |
| 未知失败 | `设备动作失败，请查看诊断日志后重试。` |

UI（界面）不得展示 raw response（原始响应）、`sessionToken（会话令牌）`、`signedLease（签名租约）`、`signature（签名）`、`signalConfig（信号配置）`、`deviceId（设备 ID）`、`ip（网络地址）`、`port（端口）` 或 Modbus address（Modbus 地址）。

## 11. Security and Logging（安全与日志）

1. 每个 external request（外部请求）必须有 `correlationId（关联 ID）`。
2. `correlationId（关联 ID）` 必须串联 `QT App（Qt 应用）` action（动作）、Driver command（驱动命令）、ERP status update（企业资源计划状态更新）、audit log（审计日志）和 diagnostic log（诊断日志）。
3. `Driver Service（驱动服务）` 新增日志必须使用 `ILogger（日志抽象）`、`audit_log（审计日志表）` 或 `diagnostic_log（诊断日志表）`，不得使用 `Console.WriteLine`。
4. 禁止记录完整 `signedLease（签名租约）`、`signature（签名）`、`signalConfig（信号配置）` 原文、`privateKey（私钥）`、`credential（凭据）`、`sessionToken（会话令牌）`。
5. Driver audit（驱动审计）只记录白名单字段：`correlationId（关联 ID）`、`idempotencyKey（幂等键）`、`localJobSessionId（本地作业会话 ID）`、`commandName（命令名）`、`resultCode（结果码）`、`durationMs（耗时毫秒）`、`leaseState（租约状态）`、`deviceSessionState（设备会话状态）`、`leaseId（租约 ID）`、`targetDeviceId（目标设备 ID）`、`fencingToken（隔离令牌）` 摘要、`completedSteps（完成步骤）`、`failedSteps（失败步骤）`。
6. QT diagnostic summary（Qt 诊断摘要）只记录：`correlationId（关联 ID）`、`idempotencyKey（幂等键）`、`localJobSessionId（本地作业会话 ID）`、`buttonKey（按钮键）`、`commandName（命令名）`、`operatorId（人员 ID）`、`teamId（班组 ID）`、`processId（预选工艺 ID）`、`resultCode（结果码）`、`durationMs（耗时毫秒）`、`driverResultCode（驱动结果码）`、`erpResultCode（企业资源计划结果码）`。
7. Parameter snapshot（参数快照）只允许作为 ERP business payload（企业资源计划业务载荷）发送到 parameter endpoint（参数端点）；QT diagnostic summary（Qt 诊断摘要）和 Driver logs（驱动日志）不得记录完整 `signalValues（信号值）`。
8. 第三方异常只记录 `exceptionType（异常类型）`、中文摘要、hash（哈希）和 `correlationId（关联 ID）`。
9. `pressDownCountMonitor（下压计数监测）` 日志只记录 monitor lifecycle（监测生命周期）事件：started/changed-throttled/threshold-reached/timeout/stopped/failed（启动/变化节流/达到阈值/超时/停止/失败）、`correlationId（关联 ID）`、`localJobSessionId（本地作业会话 ID）`、`resultCode（结果码）`、`durationMs（耗时毫秒）` 和 `pressDownCount（下压计数）` 当前数值；不得记录完整 snapshot（快照）或 raw `signalConfig（原始信号配置）`。
10. Device event stream（设备事件流）连接、断开和重连不得记录 query string（查询字符串）原文；如需定位，只记录 `correlationId（关联 ID）`、`eventName（事件名）`、`eventId（事件 ID）` 和中文摘要。

## 12. Error Handling（错误处理）

### 12.1 Driver Command Failure（驱动命令失败）

1. `LEASE_INVALID / LEASE_EXPIRED`：提示设备授权未就绪，并建议重新启动或刷新授权。
2. `SIGNAL_NOT_CONFIGURED`：提示当前设备信号配置缺失，记录 diagnostic log（诊断日志）。
3. `SIGNAL_NOT_WRITABLE`：提示当前信号不支持写入，记录 diagnostic log（诊断日志）。
4. `DEVICE_TIMEOUT`：提示设备通信超时。
5. `DEVICE_REJECTED`：提示设备回读确认失败。
6. `DEVICE_BUSY`：提示设备当前状态不允许执行该动作。
7. `CLEANUP_PENDING`：提示上次设备收尾未完成，禁止开始加工。

### 12.2 ERP Status Failure（企业资源计划状态失败）

`入线 / 出线` 中 ERP status update（企业资源计划状态更新）失败时：

1. 如果 Driver command（驱动命令）成功，展示 partial result（部分结果）。
2. 不自动回滚设备信号。
3. 记录 diagnostic summary（诊断摘要），等待人工查看诊断日志后处理。

### 12.3 Start Parameter Monitor Failure（开始参数监测失败）

`开始加工` 已完成但 `pressDownCountMonitor（下压计数监测）` 启动、运行或事件发送失败时：

1. 不回滚 ERP start（企业资源计划开始）和 Driver start（驱动启动）。
2. Driver Service（驱动服务）记录 diagnostic log（诊断日志）和 safe lifecycle event（安全生命周期事件）。
3. `QT App（Qt 应用）` 展示中文提示：“开始加工已完成，开始参数监听未启动，请查看诊断日志。”或“开始参数监听中断，请查看诊断日志后重试监听。”
4. 如果当前作业仍为 `status=1（加工中）`，允许用户或系统显式重试 `startPressDownCountMonitor（启动下压计数监测）`；不得由 Web Frontend（网页前端）自行 polling（轮询）补偿。
5. monitor timeout（监测超时）不自动完成加工、不自动清理设备、不自动写空参数记录。

### 12.4 Driver Success But Snapshot Refresh Failure（驱动成功但快照刷新失败）

动作已成功但 `getSignalSnapshot（获取信号快照）` 失败时：

1. 保持动作成功结果。
2. 提示：“动作已执行，信号快照刷新失败，请稍后手动刷新。”
3. 记录 diagnostic summary（诊断摘要）。

### 12.5 Compensation And Refresh（补偿与刷新）

| Action（动作） | Touches Device（涉及设备） | Touches ERP（涉及企业资源计划） | Failure Rule（失败规则） | Refresh Rule（刷新规则） |
| --- | --- | --- | --- | --- |
| `建立通信` | Yes | No | 不自动回滚；失败只记录 Driver diagnostic（驱动诊断）。 | Driver 成功后刷新 signal snapshot（信号快照）。 |
| `开始加工` | Yes | Yes | Driver start（驱动启动）失败不调用 ERP；ERP start（企业资源计划开始）失败必须调用 rollbackStartSignal（回滚开始信号）并停止 monitor（监测）；ERP start（企业资源计划开始）成功后才启动 `pressDownCountMonitor（下压计数监测）`，monitor（监测）失败不回滚已开始加工。 | ERP start（企业资源计划开始）成功后刷新 current jobs（当前作业）和 signal snapshot（信号快照）；达到 `pressDownCount >= 5` 后由 device event（设备事件）触发 `type=start` parameter record（开始参数记录）。 |
| `完成加工` | Yes | Yes | ERP complete（企业资源计划完成）失败不 cleanup（收尾）；ERP 成功但 cleanup（收尾）失败进入 CleanupPending（清理待完成）。 | ERP complete（企业资源计划完成）成功后刷新 current jobs（当前作业）；cleanup（收尾）后刷新 signal snapshot（信号快照）。 |
| `移入` | Yes | No | 不自动回滚；失败只记录 Driver diagnostic（驱动诊断）。 | Driver 成功后刷新 signal snapshot（信号快照）。 |
| `移出` | Yes | Optional | 普通移出不自动回滚；换模移出先复用完成加工 workflow（完成加工流程），再下发移出信号。 | Driver 成功后刷新 signal snapshot（信号快照）；若触发完成加工则刷新 current jobs（当前作业）。 |
| `入线` | Yes | Yes | Driver 或 ERP 任一失败都展示 partial result（部分结果）；不自动回滚另一侧成功结果。 | Driver 成功刷新 signal snapshot（信号快照）；ERP 成功刷新 current jobs（当前作业）。 |
| `出线` | Yes | Yes | 加工中先复用完成加工 workflow（完成加工流程）；状态未知或 current jobs（当前作业）查询失败时 fail closed（失败关闭）；执行后任一侧失败都展示 partial result（部分结果）。 | Driver 成功刷新 signal snapshot（信号快照）；ERP 成功刷新 current jobs（当前作业）。 |

只有 `完成加工` cleanup（收尾）失败时进入 `CleanupPending（清理待完成）`。其他动作失败不进入 `CleanupPending（清理待完成）`，但必须记录 diagnostic log（诊断日志）。

## 13. Implementation Boundaries（实施边界）

后续 implementation plan（实施计划）可以最小涉及以下文件，但本 spec（规格说明）不创建 Task（任务）：

```text
qt-app/frontend/src/domain/driver.ts
qt-app/frontend/src/services/driverClient.ts
qt-app/frontend/src/services/driverClient.test.ts
qt-app/frontend/src/services/driverDeviceEventsClient.ts
qt-app/frontend/src/services/driverDeviceEventsClient.test.ts
qt-app/frontend/src/services/erpClient.ts
qt-app/frontend/src/services/erpClient.test.ts
qt-app/frontend/src/services/nativeBridge.ts
qt-app/frontend/src/App.tsx
qt-app/frontend/src/App.test.tsx
qt-app/frontend/src/components/PressJobPage.tsx
qt-app/frontend/src/components/PressJobPage.test.tsx
driver-service/src/Sam.Calendaring.DriverService/Contracts/*
driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs
driver-service/src/Sam.Calendaring.DriverService/Events/*
driver-service/src/Sam.Calendaring.DriverService/Modbus/IModbusAdapter.cs
driver-service/src/Sam.Calendaring.DriverService/Modbus/NModbusAdapter.cs
driver-service/src/Sam.Calendaring.DriverService/Modbus/MockModbusAdapter.cs
driver-service/src/Sam.Calendaring.DriverService/Monitoring/*
driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs
driver-service/tests/Sam.Calendaring.DriverService.Tests/*
```

必须保持不变的边界：

1. `QT App（Qt 应用）` 不接收或传递裸设备端点。
2. `Driver Service（驱动服务）` 不调用 ERP API（企业资源计划接口）。
3. ERP status update（企业资源计划状态更新）不走 Driver Service（驱动服务）。
4. Driver command（驱动命令）不携带 `signedLease（签名租约）` 或 `signalConfig（信号配置）`，只使用本地 active lease（活跃租约）。
5. `开始加工 / 完成加工` 属于一期范围，后续 Task（任务）必须覆盖它们的 UI flow（界面流程）、ERP API（企业资源计划接口）、Driver command（驱动命令）、rollback/cleanup（回滚/收尾）和 verification（验证）。
6. `pressDownCountMonitor（下压计数监测）` 属于一期范围，但 owner（所有者）必须是 Driver Service（驱动服务）；Frontend（前端）只做 event subscription（事件订阅）和 QT-side handler dispatch（Qt 侧处理方法分发）。

## 14. Acceptance Criteria（验收标准）

1. 七个按钮从 placeholder（占位）变为真实动作入口。
2. 点击七个按钮前会校验 `teamId（班组 ID）`、`operatorId（人员 ID）`、`processId（预选工艺 ID）`、active lease（活跃租约）和当前作业状态。
3. Driver command request（驱动命令请求）只包含 `correlationId（关联 ID）`、`commandName（命令名）`、`localJobSessionId（本地作业会话 ID）`、`idempotencyKey（幂等键）`、`timeoutMs（超时毫秒）`。
4. Driver Service（驱动服务）拒绝包含 `deviceId/ip/port/signalName/registerAddress/writeValue` 的请求。
5. Driver Service（驱动服务）从 active lease（活跃租约）和 `signalConfig（信号配置）` 内部解析点位。
6. 每个写设备动作完成 read-back confirmation（回读确认）。
7. `建立通信` 只覆盖 `MES communication status（MES 通信状态）`，不得触发 `press counter clear（下压计数清零）`。
8. `开始加工` 按 `precheckForStart -> startDeviceSession -> ERP start` 顺序执行，`startDeviceSession` 必须在 `开始信号` 前触发 `press counter clear（下压计数清零）`；Driver 失败不落库，ERP 失败必须 rollback（回滚）。
9. `开始加工` 且 `needParameterRecords（需要参数记录）= true` 时，ERP start（企业资源计划开始）成功后由 `Driver Service（驱动服务）` 启动 `pressDownCountMonitor（下压计数监测）`，不是 Web Frontend（网页前端）启动 polling（轮询）。
10. `Driver Service（驱动服务）` 使用 active lease（活跃租约）和 `signalConfig（信号配置）` 读取 `pressDownCount（下压计数）`，在 `pressDownCount >= 5` 时发送 `pressDownCountThresholdReached（下压计数阈值已达到）` event（事件）。
11. `QT App（Qt 应用）` 收到 threshold event（阈值事件）后调用 QT-side handler（Qt 侧处理方法），再调用 ERP parameter endpoint（参数端点）记录 `type=start`，且同一 `localJobSessionId + type=start（本地作业会话 ID + 类型）` 只落库一次。
12. Frontend（前端）代码不存在针对 `pressDownCount（下压计数）` 的 `setInterval（定时器）`、`requestAnimationFrame（动画帧）`、query refetch loop（查询重复拉取）或 manual polling（手写轮询）。
13. Device event payload（设备事件载荷）只包含白名单字段和 narrowed snapshot（收窄快照），不包含 raw `signalConfig（原始信号配置）`、Modbus address（Modbus 地址）或裸设备字段。
14. `完成加工` 按 `final snapshot -> type=end parameter record -> ERP complete -> cleanupDeviceSession` 顺序执行，`cleanupDeviceSession` 必须触发 `press counter clear（下压计数清零）` 脉冲；参数记录或 ERP 完成失败不 cleanup（收尾）。
15. ERP complete（企业资源计划完成）成功但 cleanup（收尾）失败时进入 `CleanupPending（清理待完成）`，下一次开始加工 fail closed（失败关闭）。
16. `移入` 只写设备信号，不更新 ERP machine status（企业资源计划设备状态）。
17. `移出` 默认只写设备信号；换模且加工中时先复用完成加工 workflow（完成加工流程）再移出。
18. `入线 / 出线` 同时执行 Driver command（驱动命令）和 ERP machine status update（企业资源计划设备状态更新），并能展示 partial result（部分结果）。
19. 当前作业加工中时，`出线` 二次确认后自动复用完成加工 workflow（完成加工流程），再执行出线动作。
20. 当前作业状态未知、current jobs（当前作业）查询失败或 Driver 未 `Connected（已连接）` 时，高风险按钮 fail closed（失败关闭）。
21. UI（界面）、日志、diagnostic summary（诊断摘要）不出现 `sessionToken（会话令牌）`、`signedLease（签名租约）`、`signature（签名）`、raw `signalConfig（原始信号配置）`、`privateKey（私钥）`、`credential（凭据）`、`deviceId（设备 ID）`、`ip（网络地址）`、`port（端口）`。
22. 所有 Driver Service（驱动服务）新增日志都能用同一个 `correlationId（关联 ID）` 串起 `RequestReceived -> ActionStarted/Completed -> ResponseSent -> audit_log/diagnostic_log（审计日志/诊断日志）`。

## 15. Verification Scope（验证范围）

后续 implementation plan（实施计划）至少需要覆盖：

1. Driver API contract tests（驱动接口契约测试）：字段白名单、未知字段拒绝、标准 JSON（数据格式）响应。
2. Driver command tests（驱动命令测试）：十一个 command（命令）映射到正确 semantic key（语义键）、monitor lifecycle（监测生命周期）或 state transition（状态迁移），缺失 signal（信号）返回 `SIGNAL_NOT_CONFIGURED`。
3. Modbus write tests（Modbus 写入测试）：coil（线圈）写入、holding register（保持寄存器）写入、回读失败。
4. Driver monitor tests（驱动监测测试）：`pressDownCount >= 5` threshold reached（达到阈值）、`pressDownCount（下压计数）` 未配置、timeout（超时）、rollback/cleanup cancel（回滚/收尾取消）、duplicate start（重复启动）和 duplicate event（重复事件）。
5. Device event stream contract tests（设备事件流契约测试）：`pressDownCountMonitorStarted/Changed/ThresholdReached/Failed/Stopped（监测启动/变化/达到阈值/失败/停止）` payload（载荷）白名单、断线处理、无 token/query secret（令牌/查询密钥）。
6. Audit/diagnostic log tests（审计/诊断日志测试）：白名单字段、异常摘要、无敏感信息；monitor（监测）日志不得写完整 snapshot（快照）。
7. Frontend client tests（前端客户端测试）：Driver request（驱动请求）、device event subscription（设备事件订阅）和 ERP request（企业资源计划请求）字段白名单、`idempotencyKey（幂等键）` 复用。
8. PressJobPage tests（压机作业页测试）：前置校验、button loading（按钮加载）、重复点击禁用、success（成功）、partial（部分成功）、failure（失败）、开始回滚、完成收尾、加工中出线自动完工确认、状态未知 fail closed（失败关闭），以及不含 `pressDownCount（下压计数）` polling（轮询）代码。
9. App wiring tests（应用接线测试）：不把 `sessionToken（会话令牌）`、`signedLease（签名租约）` 或 raw `signalConfig（原始信号配置）` 传入 `PressJobPage（压机作业页）`；收到 threshold event（阈值事件）后调用 `recordPressJobParameters(type=start)`，重复事件不重复落库。

## 16. Open Decisions For Plan Gate（进入计划前需确认的决策）

1. ERP Qt API（企业资源计划 Qt 接口）最终路径是否采用 `/api/qt/press-working/machine-status`。
2. `signalConfig（信号配置）` 中 writable（可写）字段是否统一由 ERP ModbusSignals（企业资源计划信号配置）页面维护。
3. `allowedScopes（授权范围）` 使用单一 scope（范围）`pressWorking.deviceActions`，还是 command-specific scope（命令级范围）`pressWorking.deviceActions.<commandName>`。
4. `下压计数清零` 失败时是否保持 `PARTIAL_OK（部分成功）`，还是让 `建立通信` 整体失败。
5. Device event stream（设备事件流）一期默认采用 `SSE（服务器发送事件）`，实机 Qt WebEngine（Qt 网页引擎）如不稳定则切换为 `WebSocket（网页套接字）`；无论选择哪种 transport（传输方式），payload（载荷）和 Web no-polling（网页不轮询）边界不变。

以上决策只影响后续 implementation plan（实施计划），不影响本 spec（规格说明）对安全边界和迁移方向的结论。

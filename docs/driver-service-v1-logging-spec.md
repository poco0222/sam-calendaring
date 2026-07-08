# Driver Service V1 Logging Spec

> @file Driver Service V1 日志输出、记录与 QT 诊断日志页规格说明
> @author PopoY
> @created 2026-06-27
> @purpose 固化 Driver Service（驱动服务）完整日志输出、持久记录、QT App（Qt 应用）独立诊断日志页面和 AGENTS.md（代理规则文档）约束。

## 1. Goal（目标）

本规格用于补齐 `Driver Service V1（驱动服务第一版）` 的日志链路，并让现场人员能在 `QT App（Qt 应用）` 中通过独立页面快速排障。

完成后必须满足：

1. `Driver Service（驱动服务）` 启动、请求接收、执行动作、执行结果、响应写回和异常摘要都有日志输出。
2. 每次命令最终结果都写入 `audit_log（审计日志表）`。
3. 过程型排障事件写入 `diagnostic_log（诊断日志表）`。
4. `QT App（Qt 应用）` 提供独立 `Diagnostic Logs Page（诊断日志页面）`，不侵占 `Bootstrap Dashboard（启动仪表盘）` 空间。
5. `Diagnostic Logs Page（诊断日志页面）` 必须严格复用现有 `PRODUCT.md（产品说明）`、`DESIGN.md（设计说明）`、`Ant Design（组件库）` 和当前现场控制台风格。
6. 日志规则必须在后续实现阶段落到项目根目录 `AGENTS.md（代理规则文档）`，成为后续开发的硬约束。

## 2. Non-Goals（不做范围）

本规格不做以下内容：

1. 不新增 `/renewLease（续租接口）`，`periodic renew（周期续租）` 和 `supersede（替换旧租约）` 仍复用 `/applyLeaseAndConfig`。
2. 不实现 `precheckForStart（开始前检查）`、`startDeviceSession（启动设备会话）`、`cleanupDeviceSession（清理设备会话）`、`rollbackStartSignal（回滚开始信号）`。
3. 不引入完整 `observability platform（可观测性平台）`、远程日志中心、`OpenTelemetry（开放遥测）` 或外部配置中心。
4. 不引入 `Serilog`、`NLog`、`log4net` 等第三方 `logging framework（日志框架）`，除非后续明确证明内置能力无法满足现场需求。
5. 不把日志查看器嵌入 `Bootstrap Dashboard（启动仪表盘）`。
6. 不为了日志让 `QT App（Qt 应用）` 额外传裸 `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）`。
7. 不记录完整 `signedLease（签名租约）`、`signature payload（签名原文）`、`signalConfig（信号配置）` 原文、`privateKey（私钥）`、`credential（凭据）` 或 `sessionToken（会话令牌）`。

## 3. Current Context（当前上下文）

当前项目已有以下基础：

1. `Driver Service（驱动服务）` 使用 `.NET 10`、`ASP.NET Core Minimal API（最小 API）`、`Windows Service（Windows 服务）`、`SQLite + WAL（嵌入式数据库 + 预写日志）`、`NModbus（Modbus 通信库）` 和 `ILogger（日志抽象）`。
2. `Driver Service（驱动服务）` 已有 `audit_log（审计日志表）`，用于保存命令级最终结果。
3. `Driver Service（驱动服务）` 当前 `ILogger（日志抽象）` 使用较少，主要在 `DriverWorker（驱动后台任务）` 中记录启动和停止。
4. `QT App（Qt 应用）` 已有 `Bootstrap Dashboard（启动仪表盘）`，用于展示启动链路状态。
5. `QT App（Qt 应用）` 已有 `LogRecord（日志记录）` 的白名单诊断合同，但当前主要输出到 `console（控制台）`，不是现场可检索页面。
6. 当前项目目录内尚无本仓库专属 `AGENTS.md（代理规则文档）`。

## 4. Logging Layers（日志分层）

日志分为三层，各自职责固定，不能混用。

| Layer（层） | 载体 | 目的 | 内容 |
| --- | --- | --- | --- |
| Runtime Log（运行日志） | `ILogger（日志抽象）` | 服务运行时输出 | 启动、请求、动作、响应、异常摘要 |
| Audit Log（审计日志） | `audit_log（审计日志表）` | 命令最终事实记录 | 每次命令的最终结果、状态和耗时 |
| Diagnostic Log（诊断日志） | `diagnostic_log（诊断日志表）` | QT 页面排障时间线 | 可筛选的启动、请求、执行、设备、响应事件 |

`audit_log（审计日志表）` 只保存命令最终事实。`diagnostic_log（诊断日志表）` 保存过程时间线。二者不得合并成一张含义混乱的表。

## 5. Log Field Contract（日志字段契约）

所有日志事件字段名使用稳定 English identifier（英文标识）。日志正文、错误说明、排查提示必须使用中文。

通用字段：

```text
createdAt
level
category
statusClass
eventName
eventStage
correlationId
commandName
resultCode
httpStatusCode
durationMs
leaseState
deviceSessionState
leaseId
targetDeviceId
fencingToken
exceptionType
message
```

字段说明：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `createdAt` | Yes | UTC 时间，ISO 8601 格式 |
| `level` | Yes | `Information`、`Warning`、`Error` |
| `category` | Yes | 日志分类，见分类契约 |
| `statusClass` | Yes | `Normal（正常）` 或 `Abnormal（异常）` |
| `eventName` | Yes | 稳定事件名，例如 `RequestReceived` |
| `eventStage` | No | `Start`、`Completed`、`Failed`、`Skipped` |
| `correlationId` | No | 请求链路关联 ID |
| `commandName` | No | 命令名，例如 `applyLeaseAndConfig` |
| `resultCode` | No | 稳定结果码，例如 `OK`、`DEVICE_TIMEOUT` |
| `httpStatusCode` | No | HTTP 状态码 |
| `durationMs` | No | 耗时毫秒 |
| `leaseState` | No | 租约状态 |
| `deviceSessionState` | No | 设备会话状态 |
| `leaseId` | No | 租约 ID |
| `targetDeviceId` | No | 目标设备 ID |
| `fencingToken` | No | 隔离令牌 |
| `exceptionType` | No | 异常类型名，不含完整堆栈 |
| `message` | Yes | 中文说明 |

禁止字段：

```text
signedLease
signature
signaturePayload
signalConfig 原文
privateKey
credential
sessionToken
rawRequestBody
rawResponseBody
raw ip
raw port
raw deviceId override
targetEndpoint 原文
```

如现场确需定位设备端点，只允许记录 `targetEndpointHash（目标端点哈希）` 或在本机调试模式下临时开启更详细日志；该能力不属于 V1 默认行为。

## 6. Category Contract（分类契约）

`category（分类）` 固定为以下值：

| Category（分类） | 中文含义 | 示例事件 |
| --- | --- | --- |
| `Startup` | 启动 | 服务启动、停止、配置加载 |
| `Request` | 请求 | 请求接收、请求契约校验失败 |
| `Execution` | 执行 | 租约校验、状态保存、读取计划生成 |
| `Device` | 设备 | Modbus 连接、身份探测、信号读取 |
| `Response` | 响应 | 响应写回、状态码映射 |
| `Audit` | 审计 | audit log 写入成功或失败 |

`statusClass（状态分类）` 固定为：

```text
Normal
Abnormal
```

判定规则：

1. `level = Warning` 或 `level = Error` 时，`statusClass = Abnormal`。
2. `resultCode` 存在且不等于 `OK` 时，`statusClass = Abnormal`。
3. 其余可判定成功的 `Information` 事件，`statusClass = Normal`。

## 7. Required Runtime Events（必须输出的运行事件）

启动类事件：

```text
ServiceStarting
ServiceStarted
ServiceStopping
ServiceStopped
StateStoreInitialized
```

请求类事件：

```text
RequestReceived
RequestContractValidationFailed
RequestRejected
RequestCompleted
```

执行类事件：

```text
ApplyLeaseStarted
ValidateLeaseStarted
ValidateLeaseCompleted
SaveLeaseStarted
SaveLeaseCompleted
GetSignalSnapshotStarted
PlanSignalReadCompleted
```

设备类事件：

```text
DeviceConnectStarted
DeviceConnectCompleted
DeviceConnectFailed
IdentityProbeStarted
IdentityProbeCompleted
IdentityProbeFailed
SignalReadStarted
SignalReadCompleted
SignalReadFailed
```

响应类事件：

```text
ResponseSending
ResponseSent
ResponseFailed
```

审计类事件：

```text
AuditLogAppendStarted
AuditLogAppendCompleted
AuditLogAppendFailed
```

每个事件都必须带中文 `message（说明）`。第三方异常不得大段写入常规日志，只允许记录 `exceptionType（异常类型）` 和中文摘要。

## 8. Audit Log（审计日志）

现有 `audit_log（审计日志表）` 继续作为命令最终事实记录。

每次命令最终必须保存：

```text
correlation_id
lease_id
target_device_id
fencing_token
command_name
duration_ms
result_code
lease_state
device_session_state
message
```

`/applyLeaseAndConfig` 必须覆盖以下分支：

```text
字段缺失
CleanupPending
LEASE_INVALID
LEASE_EXPIRED
HOST_MISMATCH
SIGNAL_CONFIG_MISMATCH
FENCING_TOKEN_STALE
DEVICE_TIMEOUT
DEVICE_REJECTED
OK
```

`/getSignalSnapshot` 必须覆盖以下分支：

```text
没有 active lease（活跃租约）
LEASE_EXPIRED
DEVICE_IDENTITY_MISMATCH
DEVICE_TIMEOUT
DEVICE_REJECTED
OK
```

`audit_log（审计日志表）` 不记录过程事件，不记录完整请求体或响应体。

## 9. Diagnostic Log Storage（诊断日志存储）

新增 `diagnostic_log（诊断日志表）`，用于支持 `QT App（Qt 应用）` 独立诊断日志页面。

最小表字段：

```text
id
created_at
level
category
status_class
event_name
event_stage
correlation_id
command_name
result_code
http_status_code
duration_ms
lease_state
device_session_state
lease_id
target_device_id
fencing_token
exception_type
message
```

存储规则：

1. 默认保存最近足够排障的诊断事件，不设计复杂归档。
2. 未传 time range（时间范围）时，查询接口默认返回最近 100 条，最大返回 500 条。
3. 传入 `fromUtc/toUtc（UTC 起止时间）` 时，查询接口返回时间范围内全部日志，用于 QT App（Qt 应用）本地分页。
4. 表结构必须保持白名单字段，不允许新增自由 JSON blob（自由 JSON 数据块）来塞原始上下文。
5. 写入失败不能影响驱动命令的业务响应，但必须通过 `ILogger（日志抽象）` 输出中文失败摘要。

## 10. Diagnostic Logs API（诊断日志接口）

新增只读接口：

```text
GET /diagnosticLogs
```

查询参数：

```text
statusClass=abnormal|normal|all
category=startup|request|execution|device|response|audit|all
correlationId=可选
fromUtc=可选，UTC 起始时间，ISO 8601 格式
toUtc=可选，UTC 结束时间，ISO 8601 格式
limit=可选；未传 fromUtc/toUtc 时默认100，最大500
```

响应示例：

```json
{
  "resultCode": "OK",
  "logs": [
    {
      "createdAt": "2026-06-27T10:00:00Z",
      "level": "Error",
      "category": "Device",
      "statusClass": "Abnormal",
      "eventName": "SignalReadFailed",
      "eventStage": "Failed",
      "correlationId": "driver-xxx",
      "commandName": "getSignalSnapshot",
      "resultCode": "DEVICE_TIMEOUT",
      "httpStatusCode": 504,
      "durationMs": 5000,
      "message": "设备通信超时",
      "exceptionType": "TimeoutException"
    }
  ]
}
```

接口约束：

1. 只读，不提供删除、修改或清空日志接口。
2. 仍只服务本机 `QT App（Qt 应用）`。
3. `CORS（跨源资源共享）` 必须允许 `GET` 和现有 `POST`，但仍只接受 `file://` 或 `null` 来源。
4. 非 2xx 响应也必须返回中文 JSON 错误响应。

## 11. QT App Page Model（Qt 应用页面模型）

`QT App（Qt 应用）` 必须拆成至少两个页面：

```text
Bootstrap Dashboard（启动仪表盘）
Diagnostic Logs Page（诊断日志页面）
```

页面切换使用一个最小 `App Shell（应用外壳）`。V1 可以用 `view state（视图状态）` 切换，不强制引入 `React Router（React 路由库）`。

允许的最小状态：

```text
currentView = "dashboard" | "diagnostics"
```

如后续需要深链，可升级为 `hash route（哈希路由）`：

```text
#/dashboard
#/diagnostics
```

本规格不要求现在引入完整路由库。页面数量超过 2 到 3 个时再评估。

## 12. Diagnostic Logs Page（诊断日志页面）

`Diagnostic Logs Page（诊断日志页面）` 是独立现场排障工具页，不是展示型 `dashboard（仪表盘）`。

页面结构固定为：

```text
App Shell
  Navigation:
    启动仪表盘
    诊断日志

Diagnostic Logs Page
  Toolbar:
    标题
    异常 / 正常 / 全部
    全部 / 启动 / 请求 / 执行 / 设备 / 响应 / 审计
    correlationId 搜索
    刷新日志
    自动刷新开关

  Main:
    Diagnostic Log Table

  Detail:
    Selected Log Detail
```

默认行为：

1. 进入页面默认选中 `全部`。
2. 默认拉取最近三天内全部日志。
3. 当前范围为空时显示 `当前没有日志`。
4. 点击 `异常` 可只查看异常流水。
5. 点击某一行或某个 `correlationId（关联 ID）` 后，只看同一链路。
6. `自动刷新` 默认关闭。

## 13. Frontend Design Contract（前端设计契约）

本节为强制约束。后续实现不得偏离，避免在前端页面上反复调细节、调布局。

### 13.1 不侵占启动仪表盘

`Diagnostic Logs Page（诊断日志页面）` 必须是独立页面，不嵌入、不压缩、不改造现有 `Bootstrap Dashboard（启动仪表盘）` 内容区。

`Bootstrap Dashboard（启动仪表盘）` 只允许新增进入诊断日志页的一级导航入口，不允许把日志表格、日志筛选器或日志详情面板放入启动仪表盘内部。

### 13.2 复用现有 Design System（设计系统）

前端必须继续遵循当前项目已有约束：

1. 复用 `PRODUCT.md（产品说明）` 中的 `product register（产品型界面定位）`。
2. 复用 `DESIGN.md（设计说明）` 中的 `Field Control Desk（现场控制台）` 方向。
3. 复用现有 `Ant Design（组件库）` 组件语言。
4. 复用当前 `Bootstrap Dashboard（启动仪表盘）` 的紧凑、克制、现场可读规则。
5. 不新增新的主题体系、色板、字体、卡片风格或动效体系。

允许使用的主要组件：

```text
Button
Segmented
Table
Tag
Descriptions
Empty
Typography
Row
Col
Switch
Input.Search
Tooltip
```

不允许为了日志页新造一套自定义控件。

### 13.3 页面布局固定

`Diagnostic Logs Page（诊断日志页面）` 布局固定为工具页。

禁止默认使用：

```text
Modal（弹窗）
卡片瀑布流
复杂 draggable split-pane（可拖拽分栏）
nested cards（嵌套卡片）
```

主体必须以 `Table（表格）` 为核心。现场排障需要密度、排序和可扫读性，不使用重复卡片列表作为主视图。

### 13.4 视觉约束

诊断日志页必须满足：

1. 1280x720 作为第一验收 `viewport（视口）`。
2. 首屏能看到筛选区、表格 header（表头）和至少 8 条日志行。
3. 表格使用 `small density（紧凑密度）`。
4. 主要触控操作不低于 44px 高度。
5. 圆角沿用现有 6px 左右，不出现大圆角卡片。
6. 不使用 `gradient text（渐变文字）`。
7. 不使用 `glassmorphism（玻璃拟态）`。
8. 不使用 `decorative motion（装饰性动效）`。
9. 不使用 `broad shadow（大阴影）`。
10. 不使用低对比灰字。
11. 状态色只用于状态，不用于装饰。

### 13.5 筛选器固定

一级状态筛选固定为：

```text
异常
正常
全部
```

默认选中：

```text
异常
```

二级分类筛选固定为：

```text
全部
启动
请求
执行
设备
响应
审计
```

状态展示必须使用中文 `Tag（标签）` 文案，不允许只靠颜色表达状态。

### 13.6 表格列固定

默认列顺序固定为：

```text
时间
状态
分类
命令
结果码
耗时
说明
correlationId
```

列宽按 1280x720 验收：

| Column（列） | Width（宽度） |
| --- | --- |
| 时间 | 150px 左右 |
| 状态 | 72px 左右 |
| 分类 | 72px 左右 |
| 命令 | 150px 左右 |
| 结果码 | 160px 左右 |
| 耗时 | 80px 左右 |
| 说明 | 自适应 |
| correlationId | 180px 左右，可省略中间字符 |

长文本不得撑破布局。必须使用 `ellipsis（省略）`、`Tooltip（提示）` 或详情区展示完整白名单内容。

### 13.7 详情区白名单

点击日志行后，详情区只允许展示：

```text
createdAt
level
category
statusClass
eventName
eventStage
correlationId
commandName
resultCode
httpStatusCode
durationMs
leaseState
deviceSessionState
leaseId
targetDeviceId
fencingToken
exceptionType
message
```

详情区禁止展示任何原始请求体、完整响应体、完整授权包、签名原文或凭据。

### 13.8 前端修改边界

后续实现 `Diagnostic Logs Page（诊断日志页面）` 原则上只允许修改或新增以下文件：

```text
qt-app/frontend/src/App.tsx
qt-app/frontend/src/domain/diagnosticLog.ts
qt-app/frontend/src/services/diagnosticLogClient.ts
qt-app/frontend/src/services/diagnosticLogClient.test.ts
qt-app/frontend/src/components/DiagnosticLogsPage.tsx
qt-app/frontend/src/components/DiagnosticLogsPage.test.tsx
qt-app/frontend/src/components/DiagnosticLogsPage.css
```

原则上不重写 `Bootstrap Dashboard（启动仪表盘）`。如必须改，只能增加应用级导航入口，不能重排已有状态区。

## 14. AGENTS.md Rules（代理规则文档规则）

后续实现阶段必须在项目根目录新增或更新：

```text
AGENTS.md
```

至少落入以下规则：

1. 所有 `Driver Service（驱动服务）` 新增日志必须使用 `ILogger（日志抽象）` 或现有日志存储服务，不得直接使用 `Console.WriteLine`。
2. 日志字段名使用稳定 English identifier（英文标识），日志正文、错误说明、排查建议必须中文。
3. 严禁记录完整 `signedLease（签名租约）`、`signature（签名）`、`signalConfig（信号配置）` 原文、`privateKey（私钥）`、`credential（凭据）`、`sessionToken（会话令牌）`。
4. 第三方异常不得大段写入常规日志；只允许 `exceptionType（异常类型）`、中文摘要、hash（哈希）和 `correlationId（关联 ID）`。
5. 每个外部请求必须能用 `correlationId（关联 ID）` 串联 `RequestReceived -> ActionStarted/Completed -> ResponseSent -> audit_log/diagnostic_log（审计日志/诊断日志）`。
6. 不得为了日志让 `QT App（Qt 应用）` 额外传裸 `ip/port/deviceId（网络地址/端口/设备 ID）`。
7. `Diagnostic Logs Page（诊断日志页面）` 必须遵循本规格的 `Frontend Design Contract（前端设计契约）`，不得引入新的视觉体系。
8. 所有新增或修改代码注释必须包含 `@author PopoY`，说明文字必须中文或中英混合，不能全英文。

## 15. Acceptance Criteria（验收标准）

后端验收：

1. 服务启动、停止、状态库初始化有 `Startup（启动）` 诊断日志。
2. `/applyLeaseAndConfig` 和 `/getSignalSnapshot` 有请求接收和响应写回诊断日志。
3. 租约校验、状态保存、设备连接、身份探测、信号读取有执行诊断日志。
4. 异常分支记录 `exceptionType（异常类型）` 和中文摘要，不记录完整堆栈到常规日志。
5. 每次命令最终结果继续写入 `audit_log（审计日志表）`。
6. `/diagnosticLogs` 能按 `statusClass（状态分类）`、`category（分类）`、`correlationId（关联 ID）`、`fromUtc/toUtc（UTC 起止时间）` 和 `limit（数量限制）` 查询。
7. 日志不包含禁止字段。

前端验收：

1. `Diagnostic Logs Page（诊断日志页面）` 是独立页面。
2. `Bootstrap Dashboard（启动仪表盘）` 不出现日志表格、日志筛选器或日志详情面板。
3. 默认打开诊断日志页时选中 `异常`。
4. 筛选器包含固定选项。
5. 表格列名和顺序固定。
6. 支持按 `correlationId（关联 ID）` 查看同一链路。
7. 渲染 HTML 不包含敏感字段名和值。
8. 1280x720 下可看到筛选区、表头和至少 8 条日志行。
9. 页面风格与现有 `Field Control Desk（现场控制台）` 保持一致。

## 16. Verification（验证）

后续实现计划应包含以下验证命令。

后端：

```bash
cd driver-service
dotnet test
dotnet build
```

前端：

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/DiagnosticLogsPage.test.tsx src/services/diagnosticLogClient.test.ts
./node_modules/.bin/vite build
```

视觉验收：

1. 使用 1280x720 `viewport（视口）` 检查 `Bootstrap Dashboard（启动仪表盘）` 未被侵占。
2. 使用 1280x720 `viewport（视口）` 检查 `Diagnostic Logs Page（诊断日志页面）` 筛选、表格和详情区可读。
3. 分别检查 light theme（浅色主题）和 dark theme（深色主题）。

## 17. Future Plan Placement（后续计划落库位置）

本文件只定义 `spec（规格说明）`，不生成实现计划。

后续单独输出实现计划时，按以下目录落库：

```text
docs/driver-service-v1-logging-spec-plan/
```

建议任务文件：

```text
00-overview.md
task-01-logging-contract-and-agents-rules.md
task-02-driver-diagnostic-log-storage.md
task-03-host-request-response-logging.md
task-04-session-and-modbus-action-logging.md
task-05-qt-diagnostic-logs-page-with-existing-design-contract.md
task-06-verification-record.md
```

后续计划必须继续遵循 `RED -> GREEN -> verification（失败 -> 通过 -> 验证）`，每个 `Task（任务）` 独立 markdown（标记语言）落库。

# Driver Service V1 Spec

> @file Driver Service 第一版规格说明
> @author PopoY
> @created 2026-06-26
> @purpose 固化 Driver Service V1 的最小接口、租约校验、状态、错误、日志和真实 Modbus 接入边界。

## 1. Goal（目标）

`Driver Service V1（驱动服务第一版）` 只负责打通 `QT App（Qt 应用）` 启动仪表盘中的驱动状态区域。

最小链路：

```text
QT App
-> POST /applyLeaseAndConfig
-> Driver Service 离线验签
-> 校验 signedLease + signalConfig
-> 保存 active lease（活跃租约）
-> POST /getSignalSnapshot
-> 建立真实或 Mock Modbus Session
-> 返回 signalValues
```

V1 完成后的界面目标：

```text
resultCode: OK
leaseState: Active
deviceSessionState: Connected
correlationId: 有值
signalValues: 有快照
```

## 2. Non-Goals（不做范围）

V1 不做以下内容：

1. 不做 `precheckForStart（开始前检查）`。
2. 不做 `startDeviceSession（启动设备会话）`。
3. 不做 `cleanupDeviceSession（清理设备会话）`。
4. 不做 `rollbackStartSignal（回滚开始信号）`。
5. 不做完整 `production workflow（生产流程）`。
6. 不做远程 `API Gateway（接口网关）`。
7. 不让 `Driver Service（驱动服务）` 访问 `ERP Server（企业资源计划服务器）`。
8. 不接收裸 `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）` 作为授权依据。
9. 不在 V1 引入完整 `OpenAPI（开放接口规范）` 工具链。
10. 不提前设计复杂业务表。

## 3. Tech Stack（技术栈）

沿用已落库的 `Driver Service Tech Stack（驱动服务技术栈）`：

```text
.NET 10 LTS
+ Worker Service
+ Windows Service
+ ASP.NET Core Minimal API
+ SQLite + WAL
+ NModbus
+ System.Security.Cryptography
+ System.Text.Json
+ ILogger
```

V1 不新增：

1. `MVC Controller（MVC 控制器）`
2. `gRPC（远程过程调用）`
3. `GraphQL（查询语言）`
4. `Redis（内存数据库）`
5. `RabbitMQ（消息队列）`
6. `Kafka（消息队列）`
7. 外部配置中心

## 4. Local Binding（本地绑定）

`Driver Service（驱动服务）` 默认只监听本机地址：

```text
http://127.0.0.1:<configuredPort>
```

`QT App（Qt 应用）` 通过 `driverBaseUrl（驱动服务地址）` 调用本服务。

`driverBaseUrl（驱动服务地址）` 只是本机传输地址，不是设备授权地址。真实设备的 `targetEndpoint（目标端点）` 只能来自 `signedLease（签名租约）`。

## 5. API Contract（接口契约）

V1 固定两个 `Endpoint（端点）`：

```text
POST /applyLeaseAndConfig
POST /getSignalSnapshot
```

不新增 `/renewLease`。`periodic renew（周期续租）` 和 `supersede（替换旧租约）` 都复用 `/applyLeaseAndConfig`。

所有接口返回 `application/json（JSON 响应体）`。非 `2xx` 响应也必须返回标准 JSON，不能只返回纯文本异常。

## 6. POST /applyLeaseAndConfig

### Request（请求）

只允许四个字段：

```json
{
  "correlationId": "string",
  "timeoutMs": 5000,
  "signedLease": {},
  "signalConfig": {}
}
```

禁止字段：

```text
ip
port
deviceId
targetEndpointOverride
addressOverride
pointOverride
```

### Response（响应）

成功响应：

```json
{
  "correlationId": "string",
  "resultCode": "OK",
  "message": "授权已更新，刷新快照时连接设备",
  "leaseState": "Active",
  "deviceSessionState": "Disconnected",
  "leaseId": "string",
  "targetDeviceId": "string",
  "fencingToken": "string or number"
}
```

成功响应只表示 `signedLease（签名租约）` 与 `signalConfig（信号配置）` 已通过校验并保存；设备连接和信号读取由 `/getSignalSnapshot（获取信号快照）` 触发。

失败响应：

```json
{
  "correlationId": "string",
  "resultCode": "LEASE_INVALID",
  "message": "租约无效或字段不完整",
  "leaseState": "None",
  "deviceSessionState": "Disconnected",
  "leaseId": "string",
  "targetDeviceId": "string",
  "fencingToken": "string or number"
}
```

成功码固定为：

```text
OK
```

## 7. POST /getSignalSnapshot

### Request（请求）

只允许两个字段：

```json
{
  "correlationId": "string",
  "timeoutMs": 5000
}
```

不允许从 `QT App（Qt 应用）` 传入点位、地址、设备 ID 或设备端点。

### Response（响应）

成功响应：

```json
{
  "correlationId": "string",
  "resultCode": "OK",
  "message": "信号快照获取成功",
  "signalValues": {
    "signalName": "value"
  }
}
```

失败响应：

```json
{
  "correlationId": "string",
  "resultCode": "DEVICE_TIMEOUT",
  "message": "设备通信超时",
  "signalValues": {}
}
```

`message（消息）` 必须是中文。当前 `QT App（Qt 应用）` 主要依赖 `resultCode（结果码）` 和 `signalValues（信号值）`，不依赖 `message（消息）` 做状态判断。

## 8. Lease Validation（租约校验）

`applyLeaseAndConfig（应用租约与配置）` 必须按顺序执行：

1. 校验 `signedLease（签名租约）` 字段完整性。
2. 使用本地配置的 `public key（公钥）` 或 `certificate（证书）` 做 `offline signature verification（离线验签）`。
3. 校验 `notBefore（生效时间）` 和 `expiresAt（过期时间）`。
4. 校验 `granteeHostId（被授权主机 ID）` 等于本机身份。
5. 校验 `targetDeviceId（目标设备 ID）` 存在。
6. 校验 `targetEndpoint（目标端点）` 来自签名内容。
7. 重新计算 `signalConfigHash（信号配置哈希）`，必须和租约声明一致。
8. 校验 `fencingToken（隔离令牌）` 不低于本机已见最大值。
9. 校验 `allowedScopes（授权范围）` 和 `allowedAddressRanges（授权地址范围）` 可解释。
10. 通过后进入 `Lease State（租约状态） = Active`。

如果 `signedLease（签名租约）` 缺少签名算法、`kid（密钥 ID）` 或签名字段，直接返回 `LEASE_INVALID（租约无效）`。`Driver Service（驱动服务）` 不猜算法，不访问 `ERP Server（企业资源计划服务器）` 补资料。

## 9. State Model（状态模型）

### Lease State（租约状态）

只支持：

```text
None
Pending
Active
Superseded
Expired
Released
```

V1 主要产生：

```text
None -> Pending -> Active
Pending -> Expired
Pending -> Superseded
Pending -> None
```

### Device Session State（设备会话状态）

只支持：

```text
Disconnected
Connecting
Connected
Prechecked
Running
CleanupPending
Faulted
```

V1 主要产生：

```text
Disconnected -> Connecting -> Connected
Connecting -> Faulted
Connected -> Faulted
```

`Prechecked（已预检）`、`Running（运行中）`、`CleanupPending（清理待完成）` 保留枚举。V1 不主动进入这些状态，除非本地持久化里已经存在 `CleanupPending（清理待完成）` 阻塞状态。

## 10. Error Model（错误模型）

标准 `resultCode（结果码）`：

| resultCode | HTTP status（HTTP 状态码） | 含义 |
| --- | ---: | --- |
| `OK` | 200 | 成功 |
| `LEASE_INVALID` | 400 | 租约无效或字段不完整 |
| `LEASE_EXPIRED` | 409 | 租约过期 |
| `HOST_MISMATCH` | 403 | 本机身份不匹配 |
| `SIGNAL_CONFIG_MISMATCH` | 400 | 信号配置哈希不匹配 |
| `FENCING_TOKEN_STALE` | 409 | 隔离令牌过旧 |
| `DEVICE_IDENTITY_MISMATCH` | 409 | 设备身份不匹配 |
| `DEVICE_TIMEOUT` | 504 | 设备通信超时 |
| `DEVICE_REJECTED` | 502 | 设备拒绝或回读失败 |
| `DEVICE_BUSY` | 409 | 当前状态不允许 |
| `CLEANUP_PENDING` | 409 | 上次清理未完成 |

约束：

1. `resultCode（结果码）` 使用稳定英文枚举。
2. `message（消息）` 必须是中文，不能返回大段英文说明。
3. `QT App（Qt 应用）` 可展示 `resultCode（结果码）`，但面向操作员的说明必须使用中文。
4. 自定义异常的 `Message（异常消息）` 必须使用中文。
5. 第三方库返回的英文异常不得直接透传给界面；只允许记录异常类型、摘要或哈希。

## 11. Modbus Boundary（Modbus 边界）

V1 支持两种 `Adapter（适配器）`：

1. `NModbusAdapter（真实 Modbus 适配器）`
2. `MockModbusAdapter（模拟 Modbus 适配器）`

选择方式使用本地配置：

```text
Driver:Mode = Real | Mock
```

真实 `Modbus Device（Modbus 设备）` 规则：

1. 使用 `NModbus（Modbus 通信库）`，不手写协议栈。
2. `ip/port（网络地址/端口）` 只能来自 `signedLease.targetEndpoint（签名租约目标端点）`。
3. 可读点位只能来自 `signalConfig（信号配置）` 和 `allowedAddressRanges（授权地址范围）` 的交集。
4. `getSignalSnapshot（获取信号快照）` 只读授权点位。
5. 如果 `signalConfig（信号配置）` 提供 `identityProbe（身份探测点位）`，V1 必须读取并校验。
6. 如果 `signalConfig（信号配置）` 未提供 `identityProbe（身份探测点位）`，V1 不发明额外身份探测。
7. V1 没有写设备命令；后续写命令必须做 `read-back confirmation（回读确认）`。

## 12. Persistence（本地持久化）

V1 只需要最小 `SQLite（嵌入式数据库）` 数据：

1. 当前 `active lease summary（活跃租约摘要）`。
2. 本机已见最大 `fencingToken（隔离令牌）`。
3. 当前 `leaseState（租约状态）`。
4. 当前 `deviceSessionState（设备会话状态）`。
5. `audit log（审计日志）`。

不要先设计完整业务表。V1 的持久化目标只是恢复状态、阻止旧令牌、支持排查问题。

## 13. Logging（日志）

每次命令至少记录：

```text
correlationId
leaseId
targetDeviceId
fencingToken
commandName
durationMs
resultCode
leaseState
deviceSessionState
```

日志约束：

1. 日志字段名可以使用稳定英文标识。
2. 日志正文、错误说明和人工排查提示必须使用中文。
3. 不记录 `private key（私钥）`。
4. 不记录完整 `signedLease（签名租约）`。
5. 不记录完整 `signature payload（签名原文）`。
6. 不记录可复用 `credential（凭据）`。
7. 第三方库英文异常不得作为大段正文写入常规日志；需要排障时记录 `exceptionType（异常类型）`、摘要、哈希和 `correlationId（关联 ID）`。
8. 只有本机调试模式允许记录完整 `stack trace（堆栈跟踪）`，且不能返回给 `QT App（Qt 应用）`。

## 14. Threading（线程模型）

1. `Minimal API handler（最小接口处理器）` 不直接长时间阻塞设备 I/O。
2. 设备连接和读取由内部 `DriverSessionManager（驱动会话管理器）` 统一串行化。
3. 同一时间只允许一个 `active device session（活跃设备会话）` 控制同一设备。
4. 每个命令必须尊重 `timeoutMs（超时时间）`。
5. `getSignalSnapshot（获取信号快照）` 在没有 `Active lease（活跃租约）` 时返回 `LEASE_INVALID（租约无效）` 或 `LEASE_EXPIRED（租约过期）`。

## 15. Acceptance Criteria（验收标准）

V1 完成时必须验证：

1. `QT App（Qt 应用）` 能调用 `/applyLeaseAndConfig`。
2. 请求体不包含裸 `ip/port/deviceId（网络地址/端口/设备 ID）`。
3. 有效租约返回 `resultCode = OK`。
4. 有效租约返回 `leaseState = Active`。
5. 有效租约在首次快照前返回 `deviceSessionState = Disconnected`。
6. `/getSignalSnapshot` 连接真实或模拟设备后返回 `signalValues（信号值）`。
7. 租约过期返回 `LEASE_EXPIRED（租约过期）`。
8. 主机不匹配返回 `HOST_MISMATCH（主机不匹配）`。
9. `signalConfigHash（信号配置哈希）` 不匹配返回 `SIGNAL_CONFIG_MISMATCH（信号配置不匹配）`。
10. 旧 `fencingToken（隔离令牌）` 返回 `FENCING_TOKEN_STALE（隔离令牌过旧）`。
11. 设备超时返回 `DEVICE_TIMEOUT（设备超时）`。
12. 全流程不访问 `ERP Server（企业资源计划服务器）`。
13. 日志包含 `correlationId（关联 ID）`，不包含完整敏感授权包。
14. 自定义错误消息和日志正文没有大段英文说明。
15. 仪表盘右下角能显示 `OK / Active / Connected / correlationId（成功 / 活跃 / 已连接 / 关联 ID）`。

## 16. Later Plan Split（后续计划拆分建议）

后续依据本 `spec（规格说明）` 输出 `Task（任务）` 时，建议只拆：

1. `Task 01: Driver Project Shell（驱动项目壳）`
2. `Task 02: API Contract Tests（接口契约测试）`
3. `Task 03: Lease Validation（租约校验）`
4. `Task 04: Session State + SQLite（会话状态 + 嵌入式数据库）`
5. `Task 05: Mock + NModbus Snapshot（模拟驱动 + 真实 Modbus 快照）`
6. `Task 06: QT Integration Verification（Qt 集成验证）`

按用户落库规则，计划目录应放在：

```text
docs/driver-service-v1-spec-plan/
```

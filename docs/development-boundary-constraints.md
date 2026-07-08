# Development Boundary Constraints

> @file 开发前边界约束
> @author PopoY
> @created 2026-06-25
> @purpose 基于 `drawio` 时序图固化 QT App 与 Driver Service 开发前必须先对齐的接口、状态、线程、错误和验收边界。

## 设计原则

1. `QT App` 是业务编排者，负责人机交互、调用 `ERP Server`、调用 `Driver Service` 和展示结果。
2. `ERP Server` 是授权与业务落库中心，负责签发 `signed connection lease`（签名连接授权租约）和处理业务数据。
3. `Driver Service` 是本地设备网关，只负责离线验签、连接设备、读写授权范围内的 `Modbus TCP` 信号和保存本地审计。
4. `Driver Service` 不直接访问 `ERP Server`，不接受裸 `deviceId`、`ip`、`port` 或前端明文字段作为设备授权依据。

## Station Account Login（工控机账号免登录）

1. 每台工控机在 `ERP Server` 中已有固定操作账号，`QT App` 启动时从本机配置读取该账号标识、`granteeHostId` 和 `stationId`。
2. `QT App` 启动后先调用 `ERP auto-login API`（ERP 免登录接口），由 `ERP Server` 返回登录态、当前工控机默认设备范围和业务上下文。
3. 登录成功后，`QT App` 再向 `ERP Server` 获取压机连接信息、`signal config`（信号配置）和 `signed connection lease`（签名连接授权租约）。
4. `lease claims`（租约声明）中的 `operatorId` 默认对应工控机固定账号；如业务需要记录现场人员，必须使用独立业务字段，不复用登录账号语义。
5. 固定账号配置不得写入前端 `localStorage`；如需要保存凭据，优先放在 `QT native config`（Qt 原生配置）或操作系统受保护存储中。
6. `Driver Service` 不参与 `ERP auto-login API`，只接收 `QT App` 传来的 `signedLease + signalConfig`。

## Interface Contract（接口契约）

开发前必须先落定以下契约；可以先用 `Markdown` 表格，不需要先引入复杂的 `OpenAPI` 工具链。

1. `ERP Server -> QT App`
   - `ERP auto-login API` 返回登录态、工控机账号上下文、默认设备范围和业务上下文。
   - 授权接口返回设备连接信息、`signal config`（信号配置）和 `signed connection lease`。
   - 基础 `lease claims`（租约声明）至少包含：`leaseId`、`targetDeviceId`、`targetEndpoint`、`granteeHostId`、`operatorId`、`stationId`、`jobId`、`signalConfigHash`、`allowedScopes`、`allowedAddressRanges`、`issuedAt`、`notBefore`、`expiresAt`、`fencingToken`、`signature`。
   - `takeover`（接管）场景额外包含：`takeoverFlag`、`takeoverReason`。
2. `QT App -> Driver Service`
   - 只传递 `signedLease` 和匹配的 `signalConfig`，不允许单独覆盖 `ip`、`port` 或 `deviceId`。
   - 每个命令必须带 `correlationId`（关联 ID），涉及作业的命令必须带 `localJobSessionId`。
   - 首批命令只约束这些：`applyLeaseAndConfig`、`precheckForStart`、`startDeviceSession`、`getSignalSnapshot`、`cleanupDeviceSession`、`rollbackStartSignal`。
   - `applyLeaseAndConfig` 同时用于 `periodic renew`（周期续租）和 `supersede`（替换旧租约），不新增单独续租命令。
3. `Driver Service -> Modbus Device`
   - 读写范围只能来自 `allowedScopes` 和 `allowedAddressRanges`。
   - 写操作必须回读确认；回读失败视为设备动作失败。

## State Machine（状态机）

开发前至少按以下状态建模，不提前拆更细。

1. `Lease State`（租约状态）
   - `None`：无租约。
   - `Pending`：已收到租约，等待验签和设备身份校验。
   - `Active`：验签通过且设备身份匹配。
   - `Superseded`：被更高 `fencingToken` 替代。
   - `Expired`：超过 `expiresAt`。
   - `Released`：主动释放或结束清理完成。
2. `Device Session State`（设备会话状态）
   - `Disconnected`：未连接设备。
   - `Connecting`：正在连接设备。
   - `Connected`：连接成功且身份校验通过。
   - `Prechecked`：开始前检查通过。
   - `Running`：加工中。
   - `CleanupPending`：`ERP Server` 已结束成功，但设备收尾失败，禁止下一次开始。
   - `Faulted`：驱动、通信或设备异常。

## Threading Model（线程模型）

1. `QT App` 的 `UI Thread`（界面线程）不得阻塞等待 `Driver Service` 或 `ERP Server` 响应。
2. `native bridge`（原生桥接）对前端暴露 `Promise` 风格异步 API，不暴露同步阻塞调用。
3. `Driver Service` 的 `Minimal API` 请求处理与设备轮询/订阅循环分离，设备 I/O 不阻塞 HTTP 请求线程。
4. 驱动事件回到 `QT App` 时必须统一切回 UI 可安全处理的上下文，再更新界面状态。

## Timeout / Retry / Idempotency（超时 / 重试 / 幂等）

1. 每个 `QT App -> Driver Service` 命令必须定义 `timeoutMs`；默认值开发前确认，未配置时由 `Driver Service` 使用可配置的保守默认值。
2. 查询类命令可以重试；写设备类命令默认不自动重试。
3. 写设备类命令如需重试，必须携带稳定的 `idempotencyKey`（幂等键），并由 `Driver Service` 识别重复请求。
4. `startDeviceSession` 和 `cleanupDeviceSession` 必须能返回上一次同 `idempotencyKey` 的执行结果，避免重复写开始或结束信号。

## Error Model（错误模型）

`Driver Service` 对 `QT App` 返回标准错误码，底层异常只进日志。

| Code | 含义 |
| --- | --- |
| `LEASE_INVALID` | 租约签名无效或字段不完整 |
| `LEASE_EXPIRED` | 租约已过期 |
| `HOST_MISMATCH` | `granteeHostId` 与本机身份不匹配 |
| `SIGNAL_CONFIG_MISMATCH` | `signalConfigHash` 不匹配 |
| `FENCING_TOKEN_STALE` | `fencingToken` 低于本地已见令牌 |
| `DEVICE_IDENTITY_MISMATCH` | 设备身份或指纹不匹配 |
| `DEVICE_TIMEOUT` | 设备通信超时 |
| `DEVICE_REJECTED` | 设备回读确认失败或拒绝执行 |
| `DEVICE_BUSY` | 当前状态不允许执行命令 |
| `CLEANUP_PENDING` | 上次收尾未完成，禁止开始新作业 |

`QT App` 还必须单独处理 `ERP_AUTO_LOGIN_FAILED`（ERP 免登录失败），该错误不传给 `Driver Service`。

## Logging / Diagnostics（日志 / 诊断）

`QT App` 和 `Driver Service` 日志至少保留以下字段：

1. `correlationId`
2. `leaseId`
3. `localJobSessionId`
4. `targetDeviceId`
5. `fencingToken`
6. `commandName`
7. `durationMs`
8. `resultCode`
9. `stationAccountId`

日志不得记录私钥、完整签名原文或完整敏感授权包；需要排障时记录 `hash`（哈希）或摘要。

## Real Modbus / Mock Driver（真实 Modbus / 模拟驱动）

当前已有真实 `Modbus Device`（Modbus 设备）可接入，`Driver Service` 第一阶段可以直接实现 `NModbus` 适配器，但仍保留最小 `Mock Driver`（模拟驱动）。

真实设备接入必须遵守：

1. 设备端点只能来自 `signedLease` 中受签名保护的 `targetEndpoint`，不得在代码中硬编码 `ip` 或 `port`。
2. 点位读写只能来自 `signalConfig` 和租约授权范围，`QT App` 不直接传入任意地址。
3. 写设备后必须回读确认；回读失败返回 `DEVICE_REJECTED`。
4. 真实设备联调时必须记录 `correlationId`、`leaseId`、`targetDeviceId`、`commandName`、`durationMs` 和 `resultCode`。

`Mock Driver` 至少覆盖：

1. 成功连接和返回信号快照。
2. 租约无效。
3. 租约过期。
4. 主机不匹配。
5. `signalConfigHash` 不匹配。
6. 设备通信超时。
7. 设备回读失败。
8. `CleanupPending` 阻止下一次开始。

## Acceptance Criteria（验收标准）

开发完成前至少验证以下链路：

1. `QT App` 启动时使用本机配置账号调用 `ERP auto-login API`，不展示普通账号密码登录页。
2. `ERP auto-login API` 失败时，`QT App` 停止后续设备授权流程并提示配置或账号异常。
3. 登录成功后，`QT App` 能获取压机连接信息、`signal config` 和 `signed connection lease`。
4. `QT App` 只能通过 `signedLease + signalConfig` 让 `Driver Service` 连接设备。
5. 真实 `Modbus Device` 联调时，设备端点来自 `signedLease`，点位来自 `signalConfig`，写操作必须回读确认。
6. 签名无效、过期、主机不匹配、`signalConfigHash` 不匹配时，`Driver Service` 必须拒绝连接。
7. 临时接管场景下，旧 `fencingToken` 不能继续控制设备。
8. 设备开始成功但 `ERP Server` 开始失败时，`QT App` 必须调用 `rollbackStartSignal`。
9. `ERP Server` 结束失败时，`QT App` 不调用 `cleanupDeviceSession`。
10. `ERP Server` 结束成功但设备清理失败时，`Driver Service` 进入 `CleanupPending` 并阻止下一次开始。
11. `Driver Service` 全流程不直接访问 `ERP Server`。

## 暂不约束

以下内容开发中按最小可用推进，暂不单独建规则：

1. 完整目录结构。
2. 全量 `SQLite` 表结构。
3. 完整 `OpenAPI` 文档。
4. UI 组件细节。
5. 自动安装脚本。

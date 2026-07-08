# QT App V1 Bootstrap Spec

> @file QT App 第一版启动切片规格说明
> @author PopoY
> @created 2026-06-25
> @purpose 固化 QT App V1 的最小启动链路、接口边界、状态模型和验收标准。

## 1. Goal（目标）

`QT App V1（Qt 应用第一版）` 只实现 `Bootstrap Slice（启动切片）`，用于跑通从 `ERP Server（企业资源计划服务器）` 获取授权包并交给 `Driver Service（驱动服务）` 的最短链路。

```text
QT App 启动
-> 读取本机工控机配置
-> 调用 ERP auto-login API
-> 获取 ERP login session
-> 获取 signalConfig + signedLease
-> 调用 Driver Service applyLeaseAndConfig
-> 展示 driver/device 状态和一次 signal snapshot
```

第一版的成功标准是证明 `signedLease（签名租约） + signalConfig（信号配置） -> Driver Service（驱动服务） -> Modbus Device（Modbus 设备）` 这条链路可用。

## 2. Non-Goals（不做范围）

1. 不做完整 `press working（压机加工）` 业务页面。
2. 不做完整 `start / end production（开始 / 结束加工）` 流程。
3. 不做完整 `takeover（接管）` UI（用户界面）。
4. 不设计完整 `SQLite（嵌入式数据库）` 表结构。
5. 不引入完整 `OpenAPI（开放接口规范）` 工具链。
6. 不在前端实现 `Modbus TCP（Modbus 通信协议）`。
7. 不允许前端传裸 `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）` 覆盖设备授权。
8. 不把固定账号配置写入 `localStorage（浏览器本地存储）`。

## 3. Tech Stack（技术栈）

采用已落库的 `QT App Tech Stack（Qt 应用技术栈）`：

```text
Qt WebEngine + React + TypeScript + TSX + Ant Design 6.4.5 + Vite
```

职责边界：

1. `Qt WebEngine（Qt 内嵌浏览器引擎）` 承载前端页面。
2. `React（前端框架）` 实现 UI（用户界面）和状态渲染。
3. `TypeScript（类型脚本）` 定义接口响应、状态模型和领域类型。
4. `TSX（TypeScript JSX 组件写法）` 作为默认组件写法。
5. `Ant Design 6.4.5（Ant Design 组件库）` 作为默认 UI（用户界面）组件库。
6. `Vite（前端构建工具）` 作为默认开发和构建工具。
7. `QWebChannel（Qt Web 通道）` 作为 `native bridge（原生桥接）` 的默认候选，不暴露同步阻塞 API（接口）。

参考：[qt-app-tech-stack.md](./qt-app-tech-stack.md)

### Ant Design Global Config（Ant Design 全局配置）

第一版必须先建立根级 `AntdRootProvider（Ant Design 根提供器）`，所有 UI（用户界面）都从它继承全局配置。

固定配置：

1. `ConfigProvider（全局配置）` 设置 `locale={zhCN}`，`zhCN` 从 `antd/es/locale/zh_CN` 引入。
2. `ConfigProvider（全局配置）` 设置 `componentSize="medium"`。
3. `ConfigProvider（全局配置）` 的 `theme.algorithm（主题算法）` 必须由根级 `theme mode（主题模式）` 决定，支持 `light（浅色）`、`dark（深色）`、`system（跟随系统）` 三种模式；无本机偏好时默认使用 `system（跟随系统）`。
4. 使用 `HappyProvider（动态波纹提供器）` 承载 `wave effect（波纹效果）`。
5. 使用 `ConfigProvider.config({ holderRender })` 让 `message`、`modal`、`notification` 静态方法继承同一套 `Provider（提供器）`。
6. 业务组件优先使用 `App.useApp()` 或 hooks 形态调用反馈组件；`holderRender` 只作为静态方法兼容入口。

主题 `token（设计令牌）` 的公共部分固定为：

```json
{
  "token": {
    "colorPrimary": "#0078c8",
    "colorInfo": "#0078c8",
    "colorSuccess": "#52c41a",
    "colorWarning": "#faad14",
    "colorError": "#ff4d4f",
    "borderRadius": 6,
    "fontFamily": "IBM Plex Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  }
}
```

`light（浅色）` 模式使用 `theme.defaultAlgorithm（默认浅色算法）`，并补充：

```json
{
  "token": {
    "colorTextBase": "#000000",
    "colorBgBase": "#ffffff"
  }
}
```

`dark（深色）` 模式使用 `theme.darkAlgorithm（深色算法）`，并补充：

```json
{
  "token": {
    "colorPrimary": "#0a84ff",
    "colorTextBase": "#f5f5f7",
    "colorTextSecondary": "#d1d1d6",
    "colorBgBase": "#151518",
    "colorBgContainer": "#242428",
    "colorBgElevated": "#2c2c30",
    "colorBorder": "#6e6e73"
  }
}
```

实现时必须集中到一个模块，例如 `qt-app/frontend/src/app/AntdRootProvider.tsx`。页面组件不得重复声明 `locale（国际化）`、`componentSize（组件尺寸）`、`theme（主题）` 或 `HappyProvider（动态波纹提供器）`。
这些 `token（设计令牌）` 只能通过 `ConfigProvider.theme.token` 注入，不允许业务组件直接读取或硬编码 `colorBgBase`、`colorTextBase` 等派生基础色。
右上角必须提供图标式 `Segmented（分段控制器）` 作为 `theme mode（主题模式）` 控件，允许操作员在 `light（浅色）`、`dark（深色）`、`system（跟随系统）` 之间切换，并通过 `localStorage（本地存储）` 记住选择。

## 4. Local Config（本机配置）

`QT App（Qt 应用）` 启动时从本机配置读取以下字段：

| Field | Meaning |
| --- | --- |
| `stationAccountId` | 工控机在 `ERP Server（企业资源计划服务器）` 中对应的固定账号 |
| `granteeHostId` | 当前工控机授权主机 ID |
| `stationId` | 当前工位 ID |
| `erpBaseUrl` | `ERP Server（企业资源计划服务器）` 地址 |
| `driverBaseUrl` | 本机 `Driver Service（驱动服务）` 地址 |
| `configVersion` | 本机配置版本 |

约束：

1. 固定账号配置不得写入 `localStorage（浏览器本地存储）`。
2. 凭据类配置优先放入 `QT native config（Qt 原生配置）` 或操作系统受保护存储。
3. 第一版只读取配置，不做配置编辑 UI（用户界面）。
4. 配置缺失时停止后续链路，进入 `ConfigInvalid（配置无效）` 状态。

## 5. Startup Flow（启动流程）

1. `QT App（Qt 应用）` 初始化。
2. `native bridge（原生桥接）` 读取本机配置。
3. 校验 `stationAccountId`、`granteeHostId`、`stationId`、`erpBaseUrl`、`driverBaseUrl`。
4. 调用 `ERP auto-login API（ERP 免登录接口）`。
5. 获取 `ERP login session（ERP 登录态）` 和 `station context（工位上下文）`。
6. 调用 `Lease Authorization API（租约授权接口）`。
7. 获取 `signalConfig（信号配置）`、`signedLease（签名租约）`。
8. 调用 `Driver Service（驱动服务）` 的 `applyLeaseAndConfig`。
9. 展示 `Lease State（租约状态）` 和 `Device Session State（设备会话状态）`。
10. 调用 `getSignalSnapshot` 并展示一次 `signal snapshot（信号快照）`。

硬边界：

1. `Driver Service（驱动服务）` 不参与 `ERP auto-login API（ERP 免登录接口）`。
2. `QT App（Qt 应用）` 只把 `signedLease（签名租约） + signalConfig（信号配置）` 传给 `Driver Service（驱动服务）`。
3. `targetEndpoint（目标端点）` 必须来自受签名保护的 `signedLease（签名租约）`。
4. 点位读写必须来自 `signalConfig（信号配置）` 和租约授权范围。
5. 如果 `ERP Server（企业资源计划服务器）` 响应中包含 `deviceConnectionInfo（设备连接信息）`，`QT App（Qt 应用）` 必须忽略它，不得转发、拆解或用于覆盖设备授权。

参考：[development-boundary-constraints.md](./development-boundary-constraints.md)

## 6. UI Scope（界面范围）

第一版只做一个 `Bootstrap Dashboard（启动仪表盘）` 页面。

页面区域：

1. `Station Context（工位上下文）`：展示 `stationAccountId`、`stationId`、`granteeHostId`、`configVersion`。
2. `ERP Login Status（ERP 登录状态）`：展示免登录成功/失败、耗时、失败原因。
3. `Lease Package Status（租约授权包状态）`：展示 `leaseId`、`targetDeviceId`、`expiresAt`、`fencingToken`、`signalConfigHash`。
4. `Driver Status（驱动状态）`：展示 `applyLeaseAndConfig` 结果、`Lease State（租约状态）`、`Device Session State（设备会话状态）`。
5. `Signal Snapshot（信号快照）`：展示一次 `getSignalSnapshot` 返回结果。
6. `Error Panel（错误面板）`：展示标准错误码、用户提示、`correlationId（关联 ID）`。

启动动作按钮只保留：

1. `Retry Login（重试登录）`
2. `Renew Authorization（重获授权）`
3. `Refresh Snapshot（刷新快照）`

页面右上角允许保留一个图标式 `theme mode（主题模式）` 控件；它属于全局显示偏好，不计入启动动作按钮。

## 7. State Model（状态模型）

`QT App V1（Qt 应用第一版）` 只维护启动链路状态：

```text
Idle
LoadingConfig
ConfigInvalid
LoggingIn
LoginFailed
LoginSucceeded
FetchingLease
LeaseFetchFailed
ApplyingLease
DriverRejected
DriverConnected
SnapshotReady
Faulted
```

`Lease State（租约状态）` 和 `Device Session State（设备会话状态）` 以 `Driver Service（驱动服务）` 返回为准，前端只展示，不重新解释权限。

第一版展示的 `Lease State（租约状态）`：

```text
None
Pending
Active
Superseded
Expired
Released
```

第一版展示的 `Device Session State（设备会话状态）`：

```text
Disconnected
Connecting
Connected
Prechecked
Running
CleanupPending
Faulted
```

## 8. API Contract（接口契约）

第一版先用 `Markdown（标记文档）` 和 `TypeScript type（TypeScript 类型）` 固化契约，不引入复杂 `OpenAPI（开放接口规范）` 工具链。

`ERP auto-login API（ERP 免登录接口）`：

| Direction | Fields |
| --- | --- |
| Request | `stationAccountId`、`granteeHostId`、`stationId` |
| Response | `sessionToken`、`stationContext`、`defaultDeviceScope`、`businessContext` |

`Lease Authorization API（租约授权接口）`：

| Direction | Fields |
| --- | --- |
| Request | `sessionToken`、`stationId`、`granteeHostId` |
| Response | `signalConfig`、`signedLease` |

基础 `lease claims（租约声明）` 至少包含：

```text
leaseId
targetDeviceId
targetEndpoint
granteeHostId
operatorId
stationId
jobId
signalConfigHash
allowedScopes
allowedAddressRanges
issuedAt
notBefore
expiresAt
fencingToken
signature
```

`QT App（Qt 应用） -> Driver Service（驱动服务）` 第一版使用：

1. `applyLeaseAndConfig`
2. `getSignalSnapshot`

每个请求必须包含：

```text
correlationId
timeoutMs
```

## 9. Error Handling（错误处理）

`QT App（Qt 应用）` 必须单独处理 `ERP_AUTO_LOGIN_FAILED（ERP 免登录失败）`，该错误不传给 `Driver Service（驱动服务）`。

第一版必须能展示以下 `Driver Service（驱动服务）` 标准错误码：

| Code | UI Behavior |
| --- | --- |
| `LEASE_INVALID` | 显示租约无效，停止连接 |
| `LEASE_EXPIRED` | 显示租约过期，提示重新获取授权 |
| `HOST_MISMATCH` | 显示工控机身份不匹配 |
| `SIGNAL_CONFIG_MISMATCH` | 显示信号配置不匹配 |
| `FENCING_TOKEN_STALE` | 显示授权令牌已过期或被接管 |
| `DEVICE_IDENTITY_MISMATCH` | 显示设备身份不匹配 |
| `DEVICE_TIMEOUT` | 显示设备通信超时 |
| `DEVICE_REJECTED` | 显示设备拒绝或回读失败 |
| `DEVICE_BUSY` | 显示当前设备状态不允许操作 |
| `CLEANUP_PENDING` | 显示上次收尾未完成，禁止继续 |

## 10. Threading / Async（线程 / 异步）

1. `UI Thread（界面线程）` 不阻塞等待 `ERP Server（企业资源计划服务器）` 或 `Driver Service（驱动服务）`。
2. `native bridge（原生桥接）` 暴露 `Promise（异步承诺）` 风格 API（接口）。
3. 所有 HTTP 调用都必须有 `timeoutMs（超时时间）`。
4. 驱动事件回到前端时，必须统一进入 UI（用户界面）安全上下文再更新状态。

## 11. Logging / Diagnostics（日志 / 诊断）

`QT App V1（Qt 应用第一版）` 日志至少记录：

```text
correlationId
leaseId
localJobSessionId
targetDeviceId
fencingToken
commandName
durationMs
resultCode
stationAccountId
```

日志不得记录：

1. 私钥。
2. 完整签名原文。
3. 完整敏感授权包。
4. 可直接复用的凭据。

## 12. Acceptance Criteria（验收标准）

1. 启动时读取本机配置，不展示普通账号密码登录页。
2. 配置缺失时停止流程，并显示配置异常。
3. `ERP auto-login API（ERP 免登录接口）` 成功后能显示工控机账号上下文。
4. `ERP auto-login API（ERP 免登录接口）` 失败时，不继续请求设备授权。
5. 登录成功后能获取 `signalConfig（信号配置） + signedLease（签名租约）`。
6. 能调用 `Driver Service（驱动服务）` 的 `applyLeaseAndConfig`。
7. `Driver Service（驱动服务）` 拒绝无效租约时，前端展示标准错误码。
8. `Driver Service（驱动服务）` 验签通过后，前端展示 `Active（已激活）` 或连接成功状态。
9. 能调用 `getSignalSnapshot` 并展示一次信号快照。
10. 全链路日志包含 `correlationId（关联 ID）`。
11. 前端没有任何裸 `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）` 覆盖入口。
12. 前端没有把固定账号配置写入 `localStorage（浏览器本地存储）`。

## 13. Plan Location（计划位置）

实现计划按用户规则放在同目录派生目录：

```text
docs/qt-app-v1-bootstrap-spec-plan/
```

每个 `Task（任务）` 使用独立 `Markdown（标记文档）` 文件。

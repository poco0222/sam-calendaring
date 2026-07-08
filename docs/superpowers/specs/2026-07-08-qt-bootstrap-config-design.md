# QT bootstrap config 首启配置与仪表盘配置面板设计

> @file QT bootstrap config（启动配置）设计文档  
> @author PopoY  
> @created 2026-07-08  
> @purpose 定义 QT App（Qt 应用）首次启动配置页、启动仪表盘配置面板、ERP 参数开关和本机 QSettings（Qt 配置存储）写入边界。

## 背景

当前 QT App（Qt 应用）通过 `AppConfigBridge` 从本机 `QSettings（Qt 配置存储）` 读取 6 个 bootstrap config（启动配置）字段：

- `stationAccountId（工位账号 ID）`
- `granteeHostId（授权主机 ID）`
- `stationId（工位/设备 ID）`
- `erpBaseUrl（ERP 服务地址）`
- `driverBaseUrl（驱动服务地址）`
- `configVersion（配置版本）`

这些配置现在只能读，不能在 UI（用户界面）里写。不同工控机部署时，`stationAccountId / granteeHostId / stationId` 需要按设备维护；`erpBaseUrl / driverBaseUrl / configVersion` 通常固定，但仍需要展示和保底可配置。

## 目标

1. 配置缺失时显示 first-run blocking page（首次启动阻塞页），允许填写并保存 6 个配置项。
2. `granteeHostId（授权主机 ID）` 默认读取当前工控机第一个可用 IPv4 address（IPv4 地址）。
3. 启动仪表盘右侧错误区域拆成上下两块：上方 `ErrorPanel（错误面板）`，下方 `BootstrapConfigPanel（启动配置面板）`。
4. dashboard config panel（仪表盘配置面板）受 ERP 参数 `approve.press.config` 控制：
   - `true`：允许编辑保存。
   - `false`：只读展示。
   - 读取失败、参数缺失或值不是 `true`：按 `false` 处理。
5. first-run blocking page（首次启动阻塞页）不受 `approve.press.config` 控制。

## 非目标

1. 不新增路由系统，不引入新的 state management（状态管理）库。
2. 不把配置写入 frontend localStorage（前端本地存储）；配置仍以 native QSettings（原生 Qt 配置存储）为准。
3. 不在日志中输出完整 URL 之外的敏感字段；本次 6 个字段不包含 `sessionToken（会话令牌）`、`signedLease（签名租约）`、`signature（签名）`、`credential（凭据）`。
4. 不改 ERP `system/config` 参数页面本身；假设 ERP 侧会新增 `approve.press.config` 参数。

## 方案选择

### 方案 A：独立阻塞页 + 仪表盘内配置面板（采用）

配置缺失时阻塞整个 App shell（应用外壳），只显示配置页。配置完整并保存后重新读取 QSettings（Qt 配置存储）并启动 bootstrap flow（启动引导流程）。登录成功后，在启动仪表盘右侧错误面板下方展示配置面板，并按 `approve.press.config` 决定是否允许编辑。

优点：首启状态清晰，不会进入半可用页面；后续维护入口固定在启动仪表盘。  
代价：需要新增 native save method（原生保存方法）和一个小型配置面板。

### 方案 B：弹窗配置

配置缺失时在启动仪表盘上弹 Modal（弹窗）。  
不采用：弹窗背后的仪表盘在配置缺失时不可用，状态表达更绕。

### 方案 C：只靠安装脚本写配置

安装时写入 QSettings（Qt 配置存储），App 不提供 UI（用户界面）修改入口。  
不采用：现场维护成本高，配置缺失或部署失误时无法自助恢复。

## UI 设计

### FirstRunConfigPage（首次启动配置页）

触发条件：`readMissingBootstrapConfigFields(config)` 返回任一缺失字段。

页面行为：

- 独占首屏，不显示 dashboard（仪表盘）、diagnostics（诊断日志）、pressJob（压机作业）导航。
- 表单展示 6 个字段。
- `granteeHostId` 初始值优先使用 QSettings 现有值；如果为空，则使用 native bridge（原生桥）返回的 default host IP（默认主机地址）；仍允许人工覆盖。
- `erpBaseUrl / driverBaseUrl / configVersion` 可以预填默认值，但仍展示在表单中，避免现场默认值不一致时卡死。
- 保存成功后调用现有 `bootstrapSession.retry()` 或等价 reload flow（重新启动流程），进入正常 bootstrap auto-login（自动登录）。

### BootstrapConfigPanel（启动配置面板）

位置：`BootstrapDashboard（启动仪表盘）` 右侧列。原右侧 `ErrorPanel（错误面板）` 容器高度拆分为：

- 上半：`ErrorPanel（错误面板）`
- 下半：`BootstrapConfigPanel（启动配置面板）`

展示规则：

- 始终展示 6 个配置项。
- `approve.press.config=true` 时，字段可编辑，展示保存按钮。
- `approve.press.config=false` 或权限状态未知时，字段只读，保存按钮禁用或隐藏。
- 保存成功后重新读取本机 QSettings（Qt 配置存储），并重新 bootstrap（启动引导）。

## 权限控制

ERP 侧新增参数：

```text
approve.press.config
```

QT App（Qt 应用）在 auto-login（自动登录）成功并拿到 `sessionToken（会话令牌）` 后调用：

```text
GET /system/config/configKey/approve.press.config
Authorization: Bearer <sessionToken>
```

该接口沿用 ERP Server（ERP 服务端）现有 `SysConfigController`，需要 authenticated session（已认证会话），但没有额外 permission（权限标识）。成功响应为 `AjaxResult（统一响应对象）`，QT App（Qt 应用）只读取 `data` 字段；参数不存在时 `data` 为空字符串。

返回值按字符串处理：

- trim（去空白）后等于 `true`，允许编辑。
- 其它情况均不允许编辑。

first-run blocking page（首次启动阻塞页）不调用该参数，也不受该参数控制。

## Native Bridge 设计

`AppConfigBridge` 从只读扩展为受控读写：

- `readBootstrapConfig()`：继续返回 6 个配置字段。
- `saveBootstrapConfig(config)`：只允许保存 6 个白名单字段，写入 `QSettings` 后 `sync()`。
- `readDefaultHostAddress()` 或在 `readBootstrapConfig()` 返回中附加默认值：读取当前工控机默认 IPv4 address（IPv4 地址）。

默认 IPv4 address（IPv4 地址）选择规则：

1. 遍历 active network interface（活动网卡）。
2. 跳过 loopback（回环）和 link-local（链路本地）地址。
3. 取第一个 IPv4 address。
4. 取不到则返回空字符串，由人工填写。

写入边界：

- 不允许 frontend（前端）传任意 key。
- 不保存 `sessionToken（会话令牌）`、`signedLease（签名租约）`、`signalConfig（信号配置）` 等运行时数据。
- 保存失败返回结构化错误，不把异常大段写入常规日志。

## Frontend 设计

新增或调整模块：

- `types/native.ts`：扩展 `NativeConfigBridge`，增加保存配置和默认 IP 的类型。
- `services/nativeBridge.ts`：新增 `saveNativeConfig()`，复用现有 QWebChannel（Qt Web 通道）解析逻辑。
- `services/erpClient.ts`：新增读取 `approve.press.config` 的轻量函数。
- `hooks/useBootstrapSession.ts` 或独立小 hook：在登录成功后读取 config approval（配置审批开关）。
- `components/FirstRunConfigPage.tsx`：首启阻塞页。
- `components/BootstrapConfigPanel.tsx`：仪表盘配置面板。
- `components/BootstrapDashboard.tsx`：调整右侧布局，把错误面板高度缩小并在下方挂配置面板。

表单规则：

- 使用 Ant Design `Form + Row + Col` 布局。
- 所有字段 trim（去空白）后保存。
- `stationAccountId / granteeHostId / stationId` 必填。
- `erpBaseUrl / driverBaseUrl / configVersion` 必填。
- URL 字段仅做基础格式校验，不新增复杂 URL parser（URL 解析器）规则。

## Error Handling（错误处理）

- 保存失败：表单内展示中文错误摘要。
- 读取 `approve.press.config` 失败：按只读处理，并展示“配置修改未授权或开关不可用”。
- bootstrap auto-login（自动登录）失败：继续走现有 `ErrorPanel（错误面板）`。
- 首启保存后仍登录失败：留在正常启动仪表盘错误态，而不是回到首启页，除非配置字段仍缺失。

## Testing（测试）

最小测试集：

1. native config bridge spec（原生配置桥测试）：保存 6 个字段后能读回。
2. native default host address test（默认主机地址测试）：无可用 IPv4 时返回空字符串；有可用地址时过滤 loopback/link-local。
3. frontend nativeBridge test（前端原生桥测试）：`saveNativeConfig()` 调用 bridge 并处理成功/失败。
4. FirstRunConfigPage test（首次启动配置页测试）：缺失配置时可保存，保存成功触发 retry（重试）。
5. BootstrapConfigPanel test（启动配置面板测试）：`approve.press.config=true` 可编辑，`false`/失败只读。
6. BootstrapDashboard layout test（启动仪表盘布局测试）：右侧同时渲染错误面板与配置面板。

## Rollout（落地顺序）

1. 扩展 native bridge（原生桥）读写与默认 IP。
2. 扩展 frontend native bridge service（前端原生桥服务）。
3. 新增 first-run blocking page（首次启动阻塞页）。
4. 新增 ERP config approval（ERP 配置审批开关）读取。
5. 新增 dashboard config panel（仪表盘配置面板）并调整右侧布局。
6. 跑 native/frontend focused tests（聚焦测试），再跑相关 regression gates（回归检查）。

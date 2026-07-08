# QT App Press Working Spec

> @file QT App 压机作业页面规格说明
> @author PopoY
> @created 2026-06-30
> @purpose 固化 QT App（Qt 应用）压机作业页面第一版 frontend-only（仅前端）布局、交互占位和信号快照复用边界。

## 1. Goal（目标）

新增一个 `Press Working Page（压机作业页面）`，用于现场操作员在 1280x720 `touch IPC（触控工控机）` 上查看当前压机作业、选择班组/人员/预选工艺，并查看实时信号。

第一版只实现 `frontend page shell（前端页面外壳）`：

1. 渲染四行固定布局。
2. 所有操作按钮只预留 `handler（处理函数）`。
3. 不接真实 `API（接口）`。
4. 不写 `mock data（模拟数据）`。
5. 不新增 `Driver Service（驱动服务）` 命令。
6. 不改变 `Bootstrap Dashboard（启动仪表盘）` 和 `Diagnostic Logs Page（诊断日志页面）` 现有行为。

## 2. Non-Goals（不做范围）

1. 不实现班组、人员、预选工艺的数据加载。
2. 不实现建立通信、锁定模具、开始加工、完成加工、移入、移出、入线、出线的真实业务逻辑。
3. 不实现 `ERP Server（企业资源计划服务器）` 作业落库。
4. 不实现 `Driver Service（驱动服务）` 写设备信号。
5. 不实现状态机推进、自动刷新、轮询或 `WebSocket（网页套接字）`。
6. 不引入 `router（路由）`、新组件库、新主题体系或新图标依赖。
7. 不传裸 `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）` 或任意 `Modbus（工业通信协议）` 点位。

## 3. Tech Stack（技术栈）

沿用当前 `QT App（Qt 应用）` 前端技术栈：

```text
React + TypeScript + TSX + Ant Design 6.4.5 + Vite
```

约束：

1. 页面组件使用 `Ant Design（组件库）`。
2. 筛选区使用 `Form（表单） + Row/Col（栅格） + Select（选择器）`。
3. 当前作业信息使用 `Table（表格）`。
4. 当前状态使用 `Tag（标签）`。
5. 实时信号复用现有 `SignalSnapshotTable（信号快照表）`。
6. 不新增 `Element Plus（组件库）`、`Vue（前端框架）` 或 `react-router（路由库）`。

## 4. Page Entry（页面入口）

第一版直接扩展 `App.tsx` 的一级 `view（视图）`：

```text
dashboard      -> 启动仪表盘
diagnostics    -> 诊断日志
pressJob       -> 压机作业
```

新增文件建议：

```text
qt-app/frontend/src/components/PressJobPage.tsx
qt-app/frontend/src/components/PressJobPage.css
qt-app/frontend/src/components/PressJobPage.test.tsx
```

修改文件建议：

```text
qt-app/frontend/src/App.tsx
```

## 5. Layout Contract（布局契约）

页面采用四行布局，必须适配 1280x720 `viewport（视口）`。外层不可让整页滚动，局部区域按需要滚动。

### 5.1 Row 1: Filters（筛选区）

第一行包含三个筛选框：

| Field（字段） | Component（组件） | Label（标签） | 第一版行为 |
| --- | --- | --- | --- |
| `teamId` | `Select（选择器）` | 班组 | `options（选项）` 为空，不造 `mock data（模拟数据）` |
| `operatorId` | `Select（选择器）` | 人员 | `options（选项）` 为空，不造 `mock data（模拟数据）` |
| `processId` | `Select（选择器）` | 预选工艺 | `options（选项）` 为空，不造 `mock data（模拟数据）` |

约束：

1. 使用 `Form（表单） + Row/Col（栅格）`，不使用 `inline form（内联表单）`。
2. `Select（选择器）` 使用中文 `placeholder（占位提示）`：请选择班组、请选择人员、请选择预选工艺。
3. 没有 `options（选项）` 时显示 `Empty（空状态）` 或 `Ant Design（组件库）` 默认空态，不硬编码假数据。
4. `onChange（变更处理）` 只调用预留 `handler（处理函数）`，不发请求。

### 5.2 Row 2: Actions and Status（操作区与状态）

第二行左侧为操作按钮，右侧或尾部为当前状态 `Tag（标签）`。

按钮固定为：

```text
建立通信
锁定模具
开始加工
完成加工
移入
移出
入线
出线
```

状态固定展示：

```text
当前状态：未启动
```

第一版约束：

1. 每个按钮都有独立 `handler（处理函数）` 占位。
2. `handler（处理函数）` 只保留空实现或 `void`，不弹成功提示，不改状态，不写日志，不请求后端。
3. 不根据按钮点击模拟状态变化。
4. 按钮使用中文文案，触控高度不低于 44px。
5. 主要按钮可使用 `type="primary"`，但状态色只用于状态，不用于装饰。
6. 当前状态 `Tag（标签）` 默认 `default（默认）`，文案为“未启动”。

### 5.3 Row 3: Current Job Table（当前作业信息表）

第三行为当前作业信息 `Table（表格）`，列固定为：

| Column（列） | Data Index（数据字段） | Width（建议宽度） |
| --- | --- | --- |
| 压机 | `pressName` | 120px |
| 模具号 | `moldNo` | 140px |
| 预计时长(小时) | `plannedDurationHours` | 140px |
| 实际时长(小时) | `actualDurationHours` | 140px |
| 开始时间 | `startedAt` | 180px |
| 当前状态 | `status` | 120px |

第一版约束：

1. `dataSource（数据源）` 为空数组。
2. 不写 `mock row（模拟行）`。
3. 空态显示“暂无当前作业”。
4. `Table（表格）` 使用 `size="small"` 或当前项目同等紧凑密度。
5. `rowKey（行键）` 预留为 `localJobSessionId`，无数据时不触发。
6. 当前状态列后续用 `Tag（标签）`，第一版无数据不渲染状态行。

### 5.4 Row 4: Realtime Signals（实时信号）

第四行为实时信号区域，布局和展示逻辑直接复用现有 `SignalSnapshotTable（信号快照表）`。

输入契约沿用：

```text
parameterGroupOptions?: ParameterGroupOption[]
signalValues?: Record<string, unknown> | null
```

第一版约束：

1. 不复制 `SignalSnapshotTable（信号快照表）` 的分组、打包、是/否转换、`unit（单位）` 展示逻辑。
2. 不改 `SignalSnapshotTable（信号快照表）` 行为。
3. 没有 `signalValues（信号值）` 时显示现有空态：“暂无信号快照数据。”
4. 先从当前 `driverSession.data?.signalSnapshot?.signalValues` 读取可用快照；没有就传空值，不造假数据。
5. 字典翻译继续使用 `bootstrapSession.data?.parameterGroupOptions`。

## 6. Component Contract（组件契约）

新增 `PressJobPage（压机作业页）` `props（属性）` 建议：

```text
bootstrapSession?: UseBootstrapSessionResult
driverSession?: UseDriverSessionResult
```

原因：

1. 复用现有启动链路产生的 `signal snapshot（信号快照）`。
2. 不新增数据服务。
3. 不让页面自己重新读取授权包或设备配置。
4. 保持 `frontend-only（仅前端）` 边界。

内部 `state（状态）` 只允许保存筛选框当前值：

```text
teamId?: string
operatorId?: string
processId?: string
```

不允许保存模拟作业行、模拟状态、模拟信号值。

## 7. Handler Contract（处理函数契约）

预留方法固定为：

```text
handleTeamChange
handleOperatorChange
handleProcessChange
handleConnect
handleLockMold
handleStartProcessing
handleCompleteProcessing
handleMoveIn
handleMoveOut
handleLineIn
handleLineOut
```

第一版规则：

1. `handler（处理函数）` 不得调用 `fetch（网络请求）`。
2. `handler（处理函数）` 不得调用 `Driver Service（驱动服务）` client。
3. `handler（处理函数）` 不得调用 `ERP Server（企业资源计划服务器）` client。
4. `handler（处理函数）` 不得写 `localStorage（本地存储）`。
5. `handler（处理函数）` 不得制造成功、失败或状态变化。
6. 如需避免 `lint（静态检查）` 未使用，可以在方法内保留最小 `void value` 或空函数。

## 8. Visual Design Contract（视觉设计契约）

沿用 `Field Control Desk（现场控制台）`：

1. 1280x720 为第一验收尺寸。
2. 页面使用克制、紧凑、可触控布局。
3. 不使用 `nested cards（嵌套卡片）`。
4. 不使用 `gradient text（渐变文字）`。
5. 不使用 `glassmorphism（玻璃拟态）`。
6. 不使用 `decorative motion（装饰性动效）`。
7. 不使用 `broad shadow（大阴影）`。
8. 圆角沿用当前约 6px。
9. 中文为用户可见主语言。
10. 状态不只靠颜色表达，必须有中文 `Tag（标签）` 文案。

## 9. Safety and Sensitive Data（安全与敏感信息）

前端页面不得展示、记录或派生以下原文：

```text
signedLease
signature
signature payload
signalConfig 原文
privateKey
credential
sessionToken
raw ip
raw port
raw deviceId override
```

如后续需要排障，只能展示白名单摘要、`hash（哈希）` 或 `correlationId（关联 ID）`。

## 10. Acceptance Criteria（验收标准）

第一版完成后必须满足：

1. 顶部一级导航出现“压机作业”。
2. 进入“压机作业”后首屏可见四行区域：筛选区、操作区、当前作业信息、实时信号。
3. 第一行显示班组、人员、预选工艺三个 `Select（选择器）`。
4. 第二行显示 8 个操作按钮和“当前状态：未启动”。
5. 第三行显示固定列的空 `Table（表格）`，空态为“暂无当前作业”。
6. 第四行复用 `SignalSnapshotTable（信号快照表）`，无数据时显示“暂无信号快照数据。”
7. 点击任意按钮不产生真实业务效果、不模拟状态变化、不发请求。
8. 代码不新增第三方依赖。
9. 代码注释包含 `@author PopoY`，说明为中文或中英混合。
10. `pnpm test` 的相关前端测试通过，必要时补一个 `PressJobPage.test.tsx（压机作业页测试）` 验证静态渲染与无 `mock data（模拟数据）`。

## 11. Future Plan（后续计划）

后续如果依据本 `spec（规格）` 生成 `implementation plan（实现计划）`，按当前项目落库模式创建：

```text
docs/qt-app-press-working-spec-plan/00-overview.md
docs/qt-app-press-working-spec-plan/task-01-press-working-page-shell.md
```

每个 `Task（任务）` 独立 `Markdown（标记文档）`，不把多个任务混在同一个文件里。

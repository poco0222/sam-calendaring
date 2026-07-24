<!--
@file spec.md - 压机历史作业查询能力规格
@author PopoY
@created 2026-07-24 17:04:06
@purpose 定义当前认证 QT 工位的历史作业列表、详情、交互和安全验收场景。
-->

## ADDED Requirements

### Requirement: 历史作业一级入口与现有视觉体系一致
QT App MUST 在“压机作业”右侧提供第四个一级入口“历史作业”，并 MUST 复用现有 App Shell（应用外壳）、Ant Design（组件库）与 Design Token（设计变量），不得改变“压机作业”既有四行布局。

#### Scenario: 在固定工控机视口打开历史作业
- **WHEN** 操作员在 1280×720 应用视口选择“历史作业”
- **THEN** 系统显示单行筛选区和占据剩余高度的八列历史表格，页面不产生页面级滚动条
- **AND** 一级导航顺序为“启动仪表盘、诊断日志、压机作业、历史作业”

#### Scenario: 浅色和深色主题显示历史页面
- **WHEN** 操作员切换现有浅色或深色主题
- **THEN** 历史页面的颜色、圆角、边框和状态反馈继续使用现有主题与 `--qt-app-control-blue*` 变量
- **AND** 系统不引入渐变、玻璃效果、宽阴影或独立主题 Provider（提供器）

### Requirement: 历史列表按已提交筛选条件服务端分页
系统 MUST 默认查询工控机本地当天已完成的模具作业，MUST 支持必填且不可清除的最多 31 个自然日范围、可选模具号和作业人员筛选，并 MUST 以每页 10 条进行服务端分页。

#### Scenario: 首次进入页面
- **WHEN** 操作员首次进入“历史作业”
- **THEN** 前端按工控机本地时区提交当天零点至下一日零点的半开完工时间区间
- **AND** 服务端仅返回当前认证设备、状态为已完成的记录，并按 `end_time DESC, id DESC` 排序

#### Scenario: 提交新的筛选条件
- **WHEN** 操作员修改日期、模具号或人员并点击“查询”
- **THEN** 系统校验日期非空且不超过 31 个自然日，把 `draftFilters（编辑中筛选）` 复制为 `appliedQuery（已提交查询快照）`
- **AND** 新查询从第 1 页开始且每页固定 10 条

#### Scenario: 修改筛选但未查询时翻页
- **WHEN** 操作员修改筛选控件但未点击“查询”，随后切换页码
- **THEN** 系统继续使用最近一次 `appliedQuery`，不得隐式提交当前编辑值

#### Scenario: 日期范围无效
- **WHEN** 日期为空或超过 31 个自然日
- **THEN** 系统禁用查询并显示中文校验提示
- **AND** 前端不得发起无界历史请求

### Requirement: 历史列表使用稳定作业身份和明确状态
历史列表 MUST 一行表示一条已完成的 `press_mould_job_info`，MUST 使用其真实主键作为稳定 `mouldJobId`，并 MUST 展示压机、模具号、作业人员、工艺、开始时间、完成时间、实际时长和中文完工状态。

#### Scenario: 展示历史记录
- **WHEN** 服务端返回一页已完成模具作业
- **THEN** 前端按固定八列显示记录并把 `mouldWorkingTime` 秒数转换为一位小数小时文本
- **AND** 未识别状态显示“状态未知”，不得直接回显原始枚举

#### Scenario: 返回空列表或列表失败
- **WHEN** 当前查询没有记录或列表请求失败
- **THEN** 系统分别显示中文空状态或错误提示与对应重试入口
- **AND** 失败不得清空最近一次成功的已提交筛选快照

### Requirement: 详情抽屉提供脱敏追溯信息
系统 MUST 在选择历史记录后从右侧打开占应用视口 70% 宽度的标准 Drawer（抽屉），展示四列两行概要、开始/完工参数对照和可可靠关联的操作记录。

#### Scenario: 通过触控或键盘打开详情
- **WHEN** 操作员点击、触控或在聚焦行按 `Enter` 或 `Space`
- **THEN** 系统按稳定 `mouldJobId` 加载详情并打开默认 `body` Portal（传送挂载点）和标准遮罩的 70% 宽 Drawer
- **AND** 遮罩存在期间底层导航和列表不可交互

#### Scenario: 关闭详情
- **WHEN** 操作员使用关闭按钮或 `Escape` 关闭 Drawer
- **THEN** 系统保持列表、页码和筛选状态不变
- **AND** 焦点返回原触发行，挂起的旧详情响应不得重新打开或写入详情

#### Scenario: 展示概要和历史班组缺口
- **WHEN** 详情数据加载成功
- **THEN** 概要按四列两行展示压机、模具号、状态、时长、班组/人员、工艺、开始时间和完成时间
- **AND** 因历史班组未持久化，班组/人员显示为“未记录 / {作业人员}”

### Requirement: 参数和操作记录只展示可靠白名单数据
系统 MUST 对开始参数和完工参数按参数名称对齐，MUST 保留仅一侧存在的有效值，并 MUST 只展示可按作业身份可靠关联的成功操作记录。

#### Scenario: 一侧参数缺失或损坏
- **WHEN** 开始或完工参数仅一侧存在，或者一侧 JSON 记录损坏
- **THEN** 系统继续展示另一侧有效记录，缺失值显示“未记录”，损坏侧显示中文格式异常状态
- **AND** 详情其他区域保持可用

#### Scenario: 作业发生操作 session 切换
- **WHEN** 同一作业的 `START`、`COMPLETE` 和无父作业 ID 的 `MACHINE_STATUS` 分布在多个、但至少有一条已绑定该作业的 `local_job_session_id`
- **THEN** 服务端按该作业任意已绑定记录的 session 汇集操作，并始终限定当前认证 `device_id`
- **AND** 服务端不得按设备和时间窗口猜测操作归属

#### Scenario: 没有可靠操作记录
- **WHEN** 当前作业没有可可靠关联的操作记录
- **THEN** Drawer 显示“该作业没有可查看的操作记录”
- **AND** 系统不得补造锁模、解锁或失败操作

### Requirement: 历史接口遵循认证、时区和敏感信息边界
ERP MUST 只从现有 QT bootstrap context 取得当前 `deviceId`，MUST 使用带 offset（偏移量）的严格时间边界，并 MUST 对响应、错误和日志执行固定字段白名单。

#### Scenario: 查询工控机本地自然日
- **WHEN** 前端提交 `YYYY-MM-DDTHH:mm:ssZ` 格式的本地午夜起点和下一自然日排他上界
- **THEN** 后端使用显式 offset 转换为同一 instant（时间点），不得依赖 ERP JVM 默认时区
- **AND** 缺失 offset、尾随字符、非法日期、非午夜或超过 31 日的输入返回固定中文 HTTP 400

#### Scenario: 尝试跨设备读取详情
- **WHEN** 当前认证工位请求不属于其 `deviceId` 的 `mouldJobId`
- **THEN** 服务端不得返回该记录，并以固定中文 HTTP 404 响应

#### Scenario: 后端查询发生未知异常
- **WHEN** Mapper 或 Service 抛出包含内部信息的 RuntimeException（运行时异常）
- **THEN** Controller 在端点内转换为固定中文 HTTP 500，不把原始异常消息或堆栈交给全局异常处理器
- **AND** 响应和普通日志均不得包含原始异常、参数 JSON、设备网络、凭据、租约或令牌字段

### Requirement: 并发请求和关联标识保持独立
前端 MUST 对列表和详情分别执行 latest-request-wins（最新请求生效），并 MUST 为每次列表、详情及对应重试生成独立 `correlationId（关联 ID）`。

#### Scenario: 列表请求逆序完成
- **WHEN** 旧列表请求在新列表请求之后完成
- **THEN** 只有当前列表 `requestVersion` 对应的响应可以更新页面

#### Scenario: 不同详情请求逆序完成
- **WHEN** 操作员先后请求不同 `mouldJobId` 的详情且旧请求最后完成
- **THEN** 只有当前详情版本且身份匹配的响应可以更新 Drawer

#### Scenario: 核对请求生命周期
- **WHEN** 发起列表、详情或重试请求
- **THEN** 请求 MUST 携带独立 `X-Correlation-Id`
- **AND** ERP 日志可用该标识串联 `RequestReceived → ActionStarted/Completed → ResponseSent`，且日志只含稳定英文标识和固定中文摘要

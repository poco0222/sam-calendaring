# Comet Design Handoff

- Change: add-qt-press-job-history
- Phase: design
- Mode: compact
- Context hash: 353efb0abf87b5b97e6941bca4019a835d2f4ed8342d08d450b8350997031d5f

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/add-qt-press-job-history/proposal.md

- Source: openspec/changes/add-qt-press-job-history/proposal.md
- Lines: 1-37
- SHA256: a648d41a5fd0aaba021101c0fa31c921bfd5d4fd5e09e36e5898e547b787886f

```md
<!--
@file proposal.md - QT App 历史作业能力提案
@author PopoY
@created 2026-07-24 17:03:20
@purpose 说明历史作业第四一级入口、只读查询和详情追溯能力的业务目标与变更边界。
-->

## Why

QT App（Qt 应用）当前只能处理和查看正在进行的压机作业，现场操作员缺少在当前认证工位内查询已完成作业、核对参数及追溯操作记录的入口。需要在不改变既有“压机作业”四行布局和安全边界的前提下，提供适合 1280×720 触控工控机的只读历史查询能力。

## What Changes

- 在“压机作业”右侧增加第四个一级入口“历史作业”，使用全宽表格展示当前工位的已完成模具作业。
- 支持默认当天、最多 31 个自然日、模具号和作业人员筛选，以及每页 10 条的服务端分页。
- 点击记录后使用应用视口 70% 宽的右侧 Drawer（抽屉）展示作业概要、开始/完工参数和可可靠关联的操作记录。
- 在 ERP 增加两个受 QT bootstrap context（启动上下文）约束的只读历史接口；设备身份来自认证上下文，不接受客户端设备或网络字段。
- 对列表、详情、参数和操作记录执行字段白名单投影，并使用独立 `correlationId（关联 ID）` 与 latest-request-wins（最新请求生效）约束。
- 继续复用现有 Ant Design（组件库）、Design Token（设计变量）、压机数据表和 `qt_press_job_operation`；不新增数据库迁移、主题体系、缓存或汇总表。

## Capabilities

### New Capabilities

- `press-job-history-query`: 当前认证 QT 工位的历史作业筛选、分页列表、脱敏详情、参数对照、操作追溯及 70% 宽详情抽屉。

### Modified Capabilities

无。既有压机作业、完工前置检查和当前状态时长契约保持不变。

## Impact

- QT App 前端：`App.tsx`、压机领域类型、`erpClient`、新增历史作业页面及对应测试和样式。
- ERP 后端：`QtPressWorkingController`、压机模具作业 Mapper/Service、操作记录查询及对应测试。
- API：新增 `GET /api/qt/press-working/history-jobs` 与 `GET /api/qt/press-working/history-jobs/{mouldJobId}`。
- 依赖：只把 Ant Design 已使用的同版本 Day.js 声明为前端直接依赖，不引入第二套日期库。
- 数据库：复用既有表结构，不新增 Liquibase（数据库迁移）变更。

```

## openspec/changes/add-qt-press-job-history/design.md

- Source: openspec/changes/add-qt-press-job-history/design.md
- Lines: 1-89
- SHA256: 544d1edf36f0c2b2cc01994ca2002843d496313b40662a84540a48eb2506629d

[TRUNCATED]

```md
<!--
@file design.md - QT App 历史作业高层技术设计
@author PopoY
@created 2026-07-24 17:04:06
@purpose 记录跨 QT 前端与 ERP 后端的历史作业查询架构、安全边界和关键取舍。
-->

## Context

QT App 前端是 Qt WebEngine 承载的 React + Ant Design 应用，一级导航和 ERP 回调集中在 `App.tsx`，现有“压机作业”页面采用固定 1280×720 的无页面级滚动布局。ERP 已通过 `QtPressWorkingController` 和 token 中的 QT bootstrap context（启动上下文）限定当前工位，压机历史数据位于 `press_mould_job_info`，成功生命周期操作位于 `qt_press_job_operation`。

本变更跨 `sam-calendaring` 前端和 `sam-erp-be` 后端，但构成一个不可拆分的只读查询能力。详细视觉契约见 `docs/superpowers/specs/2026-07-24-press-job-history-page-design.md`，逐文件实施步骤见 `docs/superpowers/plans/2026-07-24-press-job-history-page.md`。

## Goals / Non-Goals

**Goals:**

- 为当前认证工位提供可筛选、服务端分页的已完成历史作业列表。
- 通过 70% 宽右侧 Drawer（抽屉）查看概要、开始/完工参数和真实存在的成功操作记录。
- 保持现有 Design Token（设计变量）、鉴权上下文、敏感信息边界和触控可访问性。
- 通过稳定作业身份、独立请求版本和 `correlationId（关联 ID）` 保证可追溯且不被过期响应覆盖。

**Non-Goals:**

- 不编辑、删除、补录、重新执行、导出或汇总历史作业。
- 不修改“压机作业”现有四行布局及其 PLC（可编程逻辑控制器）流程。
- 不新增数据库字段、汇总表、缓存、搜索索引或失败操作补录。
- 不根据当前组织关系推断历史班组，不按设备和时间窗口猜测操作归属。

## Decisions

### 一条列表记录对应一个已完成模具作业

列表使用 `press_mould_job_info.id` 作为稳定 `mouldJobId`，而不是聚合父级 `press_job_info`。这样模具号、工艺、开始/完工参数和详情标题具有唯一含义；跨日拆分后的真实子记录也保持可追溯。

备选方案是父作业聚合，但一个父作业可能包含多个模具和参数集合，会使八列表格及单条详情语义不稳定，因此不采用。

### 新增两个受认证工位约束的只读接口

ERP 新增：

- `GET /api/qt/press-working/history-jobs`
- `GET /api/qt/press-working/history-jobs/{mouldJobId}`

Controller 必须通过现有 token 解析 `deviceId`，查询始终带 `device_id + mouldJobId/status` 限定。客户端不得传 `deviceId`、IP、端口或 Driver Session（驱动会话）。旧 `/modbus/pressjob/getHistoryPressJobList/{deviceId}` 接口允许客户端选择设备且不满足分页语义，因此不复用。

### 时间边界由工控机以显式 offset 表达

前端把选中自然日转换为 `YYYY-MM-DDTHH:mm:ssZ` 半开区间，后端使用 Java 8 `OffsetDateTime` 严格解析并转换为 `Date`。这避免 ERP JVM 默认时区与工控机不一致时发生日期偏移；后端同时验证午夜边界、开始早于结束及最多 31 个自然日。

备选的无 offset 文本依赖服务端默认时区，无法满足工控机本地自然日契约，因此不采用。

### 复用现有持久化，不新增迁移

列表和参数读取 `press_mould_job_info`；操作记录通过该作业任意已绑定操作的 `local_job_session_id` 扩展关联 `MACHINE_STATUS`，内外查询都限定当前 `device_id`。锁模、解锁和失败操作没有可靠的作业外键，首版保持缺失。

历史班组也未持久化，概要固定显示“未记录 / 作业人员”。只有业务未来要求精确历史班组或失败操作时，才另立结构变更。

### 后端和前端均执行白名单投影

后端只返回列表/详情固定字段，`mouldJobId` 和 `BigDecimal mouldWorkingTime` 使用 JSON string；参数只投影名称、标量值、单位、记录时间和状态。Controller 在端点内把输入、认证、404 和未知异常转换为固定中文 HTTP 响应，不让原始异常进入会回显消息和堆栈的全局处理器。

`erpClient` 从 `unknown` 开始再次收窄响应，App Shell（应用外壳）把 token 留在请求回调闭包，页面只接收脱敏 View Model（视图模型）。

### 页面使用本地状态和现有 Ant Design 组件

历史页维护 `draftFilters（编辑中筛选）` 与 `appliedQuery（已提交查询快照）`；查询提交后回到第 1 页，翻页只使用已提交快照。列表和详情各有独立单调 `requestVersion`，关闭 Drawer 时使旧详情响应失效并恢复触发行焦点。

页面复用现有 `Segmented`、`RangePicker`、`Table`、`Drawer`、`Descriptions`、`Alert` 和 Design Token。Day.js 采用 Ant Design 已解析的相同版本并声明为直接依赖，不增加状态库、第二套日期库或自定义 Drawer。

## Risks / Trade-offs

- [ERP 与前端需协调发布] → 接口先以固定契约和双侧 contract test（契约测试）锁定，前端只调用新路径。
- [操作 session 在作业 ID 返回前后会切换] → 关联该作业任意已绑定记录的 session，并覆盖 session A/B 回归场景。
- [历史参数 JSON 可能损坏] → 单侧标记 `invalid`，保留详情其他区域和另一侧有效参数。
- [全局异常处理器会回显异常正文] → 历史端点内闭合所有预期及未知 RuntimeException（运行时异常），只记录固定中文摘要。
- [列表数据未来增长] → 首版固定每页 10 条和最多 31 日；只有生产查询证据表明需要时再增加索引或汇总结构。
- [历史班组及部分操作不完整] → 页面明确显示“未记录”或空状态，不制造推断数据。

## Migration Plan

```

Full source: openspec/changes/add-qt-press-job-history/design.md

## openspec/changes/add-qt-press-job-history/tasks.md

- Source: openspec/changes/add-qt-press-job-history/tasks.md
- Lines: 1-48
- SHA256: 87cb94890f2398dee153ed8c099eb67df71cca44c33b52720ff4c0cfa8de8397

```md
<!--
@file tasks.md - QT App 历史作业实施任务
@author PopoY
@created 2026-07-24 17:04:06
@purpose 以可验证检查项跟踪历史作业跨前后端实现、测试和审查。
-->

## 1. 隔离环境与基线

- [ ] 1.1 从前端 `main` 与 ERP 后端 `master` 创建隔离 worktree（工作树），记录基线提交并运行前端、后端基线测试。
- [ ] 1.2 确认后端基线包含压机生命周期接口、`QtPressJobOperation` 和既有 Liquibase operation changelog，且两个工作树没有用户未归属修改。

## 2. ERP 历史数据查询

- [ ] 2.1 先写失败的 Mapper contract test（映射契约测试），再实现当前设备、完成状态、半开时间区间、可选筛选和稳定倒序的历史列表/详情 SQL。
- [ ] 2.2 先覆盖 session A/B 失败场景，再实现按作业任意已绑定 `local_job_session_id` 汇集成功操作记录的安全查询。
- [ ] 2.3 先写失败的 Service delegation test（服务委派测试），再通过现有 `IPressMouldJobInfoService` 暴露最薄的设备绑定只读方法。

## 3. ERP 历史接口与安全投影

- [ ] 3.1 先写失败的 Controller test，覆盖带 offset 的严格时间解析、最多 31 个自然日、固定分页、认证设备限定和真实 HTTP 状态。
- [ ] 3.2 实现历史列表与详情两个 GET endpoint、PageHelper 服务端分页及固定响应白名单，确保 ID 和时长均为 JSON string。
- [ ] 3.3 实现参数/操作记录白名单和端点内安全异常转换，测试原始异常消息、堆栈及敏感字段不会进入响应或日志。
- [ ] 3.4 运行 ERP 定向测试和 `yr-admin` Java 8 模块构建，提交后端实现并完成任务级代码审查。

## 4. QT App 请求契约

- [ ] 4.1 先写失败的 `erpClient` 测试，再增加历史 Query/List/Detail View Model（视图模型）、两个 GET 请求和响应字段收窄。
- [ ] 4.2 覆盖 URL offset、授权与独立 `X-Correlation-Id`、敏感字段剔除、未知状态以及时长 null/小数/超大值边界。

## 5. QT App 历史页面

- [ ] 5.1 声明 Ant Design 已解析的同版本 Day.js 直接依赖，不引入第二套日期库。
- [ ] 5.2 先写失败的历史页面测试，再实现默认当天、31 日上限、`draftFilters/appliedQuery`、每页 10 条服务端分页和独立列表/详情请求版本。
- [ ] 5.3 使用现有 Ant Design 组件和 Design Token 实现八列表格、中文空错状态、触控/键盘行为与 70% 宽详情 Drawer。
- [ ] 5.4 实现 4×2 概要、64%/36% 参数/操作区域、参数单侧保留、操作空状态和关闭后焦点恢复。

## 6. App Shell 集成

- [ ] 6.1 先写失败的 App integration test（应用集成测试），再在“压机作业”右侧增加第四个一级入口和显式渲染分支。
- [ ] 6.2 在 App Shell 内注入两个历史只读回调，确保页面 props 不包含 token、ERP 地址、设备、网络、租约或 Driver Session。

## 7. 验证与交付

- [ ] 7.1 运行 ERP 全部目标测试、Java 8 模块构建、QT App 相关 Vitest 和 production build（生产构建）。
- [ ] 7.2 在 1280×720 下核对浅色/深色布局、44px 触控目标、固定表头分页、70% Drawer、遮罩、焦点和局部滚动。
- [ ] 7.3 执行敏感字段、日志、Liquibase 无新增迁移及工作树范围扫描，完成最终 correctness/security/regression（正确性/安全性/回归）审查。
- [ ] 7.4 记录 Comet Verify（验证）证据；Archive（归档）、合并和 push（推送）继续作为独立授权门。

```

## openspec/changes/add-qt-press-job-history/specs/press-job-history-query/spec.md

- Source: openspec/changes/add-qt-press-job-history/specs/press-job-history-query/spec.md
- Lines: 1-125
- SHA256: 7ef5a9d30a7bbcb9601c6373a9446432f605a227b5bc77b3c4df4893ea63e8b4

[TRUNCATED]

```md
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

```

Full source: openspec/changes/add-qt-press-job-history/specs/press-job-history-query/spec.md

<!--
@file design.md - QT App 历史作业高层技术设计
@author PopoY
@created 2026-07-24 17:04:06
@editor PopoY
@edited 2026-07-24 17:16:18
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

1. 从包含压机生命周期能力和 `qt_press_job_operation` 的 ERP `master` 基线直接建立隔离 worktree。
2. ERP 功能分支完成后只合并回 `master`；`dev`、`dev-popo` 及其他长期分支不得作为基线、中间集成分支或合并目标。
3. 先发布并验证 ERP 只读接口，再发布 QT App 第四入口和历史页面。
4. 不执行数据库迁移；部署前确认既有 operation changelog 已在目标环境生效。
5. 回滚时移除 QT App 新入口并回退 ERP 新 GET 路由及查询方法；既有业务表和生命周期写入不受影响。

## Open Questions

无阻塞问题。历史班组、锁模/解锁及失败操作的精确追溯明确延后，若业务提出必须记录，再创建独立 schema change（结构变更）。

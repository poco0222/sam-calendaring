> Editor: PopoY
> Edited: 2026-07-27 10:49:02

## MODIFIED Requirements

### Requirement: 历史作业一级入口与现有视觉体系一致
QT App MUST 保持现有“历史作业”一级入口、App Shell（应用外壳）、Ant Design（组件库）和 Design Token（设计变量），并 MUST 把筛选区调整为单行平铺。

#### Scenario: 在固定工控机视口打开历史作业
- **WHEN** 操作员在 1280×720 应用视口选择“历史作业”
- **THEN** 日期、模具号、作业人员和查询按钮显示在同一行
- **AND** 查询按钮同时显示既有 `SearchOutlined` 和“查询”文字，保留键盘操作与可访问名称
- **AND** 页面不得引入新的主题、依赖或视觉体系

### Requirement: 历史列表按已提交筛选条件服务端分页
系统 MUST 保持当前认证设备、已完成状态、每页 10 条、最多 31 个自然日和已提交查询快照边界，并 MUST 提供最近 1、3、7、30 个本地自然日快捷范围。

#### Scenario: 选择日期快捷范围
- **WHEN** 操作员选择最近 1、3、7 或 30 日
- **THEN** 前端设置包含今天在内的对应本地自然日范围
- **AND** 提交时把结束日期转换为下一本地自然日零点的排他上界

#### Scenario: 修改筛选但未查询时翻页
- **WHEN** 操作员修改筛选控件但未点击“查询”，随后切换页码
- **THEN** 系统继续使用最近一次已提交查询快照
- **AND** 不得隐式提交当前编辑值

### Requirement: 详情抽屉提供脱敏追溯信息
系统 MUST 在选择历史记录后从右侧打开占应用视口 80% 宽度的标准 Drawer（抽屉），并 MUST 保持现有概要、参数对照和关闭交互。

#### Scenario: 打开并关闭详情
- **WHEN** 操作员通过触控、鼠标或键盘打开详情
- **THEN** 系统按稳定 `mouldJobId` 加载详情并打开 80% 宽 Drawer
- **AND** 关闭后保持列表、页码和筛选状态，焦点返回原触发行

### Requirement: 历史详情按父作业展示新操作日志
系统 MUST 先以认证 `deviceId + mouldJobId` 取得目标历史行及其父 `pressJobInfoId`，再按 `deviceId + pressJobInfoId` 查询 `modbus_handle_log`，并 MUST 按 `handle_time ASC, id ASC` 返回时间、操作、结果、内容、班组和作业人员。父作业关联 MUST 只能由认证 QT 专用服务端路径建立。

#### Scenario: 父作业存在新日志
- **WHEN** 目标父作业至少存在一条 `press_job_info_id` 已关联的新日志
- **THEN** 详情只展示这组新日志，不混入 `qt_press_job_operation`
- **AND** 同一父作业下兄弟模具共享该父作业时间线

#### Scenario: 旧作业完全没有新日志
- **WHEN** 目标父作业完全没有 `press_job_info_id` 已关联的新日志
- **THEN** 系统整组降级展示现有 `qt_press_job_operation` 生命周期投影
- **AND** 系统不得按设备与时间窗口猜测或混入 `press_job_info_id = null` 的日志

#### Scenario: 通用日志入口尝试伪造父作业关联
- **WHEN** 客户端向通用 `POST /modbus/handleLog` 提交目标父作业的 `pressJobInfoId`
- **THEN** 通用入口忽略该字段，所写日志不得进入父作业时间线
- **AND** 若目标父作业没有其他可信新日志，详情仍整组降级到现有 Qt 生命周期投影

#### Scenario: 查询班组和作业人员名称
- **WHEN** 服务端投影新日志
- **THEN** 系统使用 `team_id` 和 `handle_by` 关联现有班组与用户主数据
- **AND** 不保存或补造名称快照，任一字段无法关联时返回缺失状态

### Requirement: 参数和操作记录只展示可靠白名单数据
系统 MUST 只把 JSON Boolean（布尔值）原始值 `true` / `false` 显示为“是/否”，并 MUST 复用诊断日志 Timeline CSS（时间线样式）展示操作记录。

#### Scenario: 参数值为 JSON Boolean
- **WHEN** 开始或完工参数值是 JSON Boolean 原始值 `true` 或 `false`
- **THEN** 前端分别显示“是”或“否”
- **AND** 字符串、数字和其他类型保持原有白名单格式，不得猜测转换

#### Scenario: 展示操作时间线
- **WHEN** 详情返回新日志或旧作业降级记录
- **THEN** Drawer 按时间正序逐条展示时间、操作、成功/失败、内容、班组和作业人员
- **AND** 任一缺失字段统一显示“未记录”

#### Scenario: 没有可展示记录
- **WHEN** 当前作业既没有新日志，也没有可降级的 Qt 生命周期记录
- **THEN** Drawer 显示“该作业没有可查看的操作记录”

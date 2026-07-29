## Why

诊断日志当前用手写圆点模拟时间线，既没有相邻节点连接线，也偏离项目已采用的 Ant Design（组件库）实现。历史作业的模具号仍是自由输入，人员候选又来自全量用户，未复用压机作业已经验证的模具远程搜索、小键盘和班组级联能力，容易产生误选并扩大无关人员数据范围。

## What Changes

- 将诊断日志详情中的手写时间线替换为 Ant Design `Timeline`，保留按 `correlationId（关联 ID）` 排序、选择和脱敏展示行为，并由组件内建节点和连接线负责时间线结构。
- 将历史作业的模具号筛选改为与模具锁定面板一致的下拉远程搜索，复用现有模具候选接口和 `NumericKeypad（数字小键盘）`；只有选中的模具号进入既有 `mouldCode` 查询参数。
- 在历史作业筛选区增加班组下拉框，将“作业人员”改为“人员”，并复用压机作业的班组数据和人员级联接口；切换班组时清空旧人员选择，只展示当前班组人员。
- 继续复用现有 Ant Design、ERP client（ERP 客户端）和前端领域类型，不新增依赖，不修改后端接口、数据库或历史查询参数合同。

## Capabilities

### New Capabilities

- `driver-diagnostic-log-viewing`: 约束诊断日志按关联链使用 Ant Design `Timeline` 展示节点和连接线，同时保持现有脱敏与交互边界。

### Modified Capabilities

- `press-job-history-query`: 将历史作业模具号改为远程候选选择并支持数字小键盘，新增班组筛选且由班组级联人员候选。

## Impact

- 影响 QT App 前端的 `DiagnosticLogsPage`、`PressJobHistoryPage`、`App` 及对应样式和测试。
- 复用现有模具候选、班组和人员接口；历史列表仍只提交日期、`mouldCode`、`operator` 和分页字段。
- 不影响 Driver Service（驱动服务）日志写入、ERP 后端、数据库结构、设备请求或敏感信息边界。

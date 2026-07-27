> Editor: PopoY
> Edited: 2026-07-27 08:32:28

## Why

当前 QT App（Qt 应用）历史详情只能从 `qt_press_job_operation` 投影部分成功生命周期，不能完整呈现真实操作的成功或失败、班组和作业人员。SAM ERP 已有 `modbus_handle_log` 和旧 Vue `logHandle` 链路，本变更只补齐最小关联、上报和展示能力，不再建立新的作业会话、幂等或日志模型。

## What Changes

- 复用 `modbus_handle_log`，仅新增 nullable（可空）的 `press_job_info_id`、`team_id`，以及 `(device_id, press_job_info_id, handle_time, id)` 查询索引；继续复用 `handle_type`、`handle_content`、`handle_result`、`handle_by`、`handle_time`。
- 新增最薄的 QT operation-log endpoint（操作日志端点）。QT 在真实操作成功返回或抛错后，异步上报固定操作码与成功/失败结果；日志失败不得改变主操作结果。
- ERP 从认证上下文取得 `deviceId`，使用现有 Qt `START` 记录和 `localJobSessionId` 解析现有 `pressJobInfoId`；无法解析时只保存 device-only log（仅设备日志），不按设备与时间窗口猜测。
- 操作码只覆盖 `START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE`。服务端映射固定中文名称和内容，不接受自由文本。
- 历史详情按认证设备与父作业 ID 查询新日志；存在新日志时展示新日志，完全没有新日志的旧作业继续降级展示 `qt_press_job_operation`。
- 调整历史页面：筛选单行平铺、查询按钮显示 `SearchOutlined` 与“查询”、日期提供最近 1/3/7/30 个本地自然日、Drawer（抽屉）宽度改为 80%、仅把 JSON Boolean（布尔值）`true` / `false` 翻译为“是/否”，并复用诊断日志 Timeline（时间线）样式。

## Capabilities

### New Capabilities

- `press-job-operation-log`：定义最小数据扩展、固定操作码上报、作业关联、失败隔离和敏感信息边界。

### Modified Capabilities

- `press-job-history-query`：定义父作业操作时间线、旧数据降级和历史页面展示调整。

## Impact

- SAM ERP：`modbus_handle_log` Liquibase（数据库迁移）、最薄日志端点、历史详情投影和自动化测试。
- QT App：六类真实操作完成后的 best-effort（尽力而为）异步上报，以及历史详情和筛选界面。
- 数据兼容：不迁移、不回填、不猜测旧日志；班组和人员名称在查询时关联现有主数据，缺失时显示“未记录”。
- 安全：请求不得包含设备网络信息、原始参数、信号配置、异常正文或安全材料。

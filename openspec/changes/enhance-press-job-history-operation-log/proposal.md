## Why

当前 QT App（Qt 应用）的历史作业详情把 `qt_press_job_operation` 幂等记录当作业务操作日志，未复用 SAM ERP 已有的 `modbus_handle_log`，导致锁模、解锁、失败结果、操作内容、班组和作业人员等追溯信息缺失。历史作业页面同时存在筛选纵向占高、日期缺少快捷入口、详情空间不足和 Boolean（布尔值）直出英文等现场使用问题，需要在同一用户旅程内统一修正。

## What Changes

- 复用并补强 SAM ERP 现有 `modbus_handle_log`，由 ERP 服务端基于认证工位和已校验的作业上下文记录压机业务操作，不再让 QT App 复制旧 Vue `logHandle` 或上传裸设备网络字段。
- 为压机业务日志增加可靠的作业/会话关联、`correlationId（关联 ID）`、班组与作业人员历史快照；新记录可按历史作业身份查询，既有无法可靠归属的日志不得按设备和时间窗口猜测。
- 保留 `qt_press_job_operation` 作为 Idempotency（幂等）与 Replay（重放）记录；历史详情优先展示业务操作日志，旧 Qt 作业在缺少业务日志时才使用现有成功生命周期记录降级展示。
- 覆盖锁模、建立通信、开始加工、开始/完工参数、移入/移出、入线/出线、完成加工和解锁等业务动作；ERP 原子生命周期动作在可信业务边界写入，需要 Driver（驱动）真实结果的动作通过 QT 安全适配端点写入同一张日志表。操作结果、内容、班组、人员和时间通过白名单契约返回，Driver Service（驱动服务）的 `audit_log` / `diagnostic_log` 继续只承担技术审计与诊断职责。
- 将历史作业筛选控件和标签改为单行平铺，查询按钮使用语义化搜索图标。
- 日期范围增加“最近一天、最近三天、最近一周、最近一月”四个快捷选项，仍遵守最多 31 个自然日和已提交查询快照边界。
- 将历史详情 Drawer（抽屉）宽度从视口 70% 调整为 80%，Boolean 参数统一显示“是/否”。
- 将操作记录改为整段日志式 Timeline（时间线），逐条展示操作时间、操作名称、结果、班组和作业人员。

## Capabilities

### New Capabilities

- `press-job-operation-log`: 定义压机业务操作日志的服务端写入、可靠作业关联、人员/班组历史快照、兼容降级和敏感信息边界。

### Modified Capabilities

- `press-job-history-query`: 调整历史作业筛选、日期快捷项、80% 详情抽屉、Boolean 翻译和业务操作时间线的查询及展示要求。

## Impact

- QT App：`PressJobPage` 操作请求契约、`erpClient`、历史作业页面、领域类型、样式和测试。
- SAM ERP 后端：`modbus_handle_log` Liquibase（数据库迁移）、Domain（领域模型）、Mapper（映射器）、Service（服务）、`QtPressWorkingController` 压机动作端点、历史详情投影和测试。
- 数据兼容：迁移只增加 nullable（可空）关联/快照字段和索引，不删除或改写既有日志；既有 `handle_by`、日志查询页面和压机时间线保持可用。
- 安全边界：不记录参数 JSON、信号配置原文、令牌、租约、IP、端口或第三方异常正文；不得通过当前组织关系伪造历史班组。
- 非目标：不新增第三张业务日志表，不合并或移除 Driver Service 技术日志，不改变历史列表分页大小、31 日上限或设备隔离规则。

> Editor: PopoY
> Edited: 2026-07-27 08:46:41

## ADDED Requirements

### Requirement: 压机操作日志复用既有 ERP 日志表
系统 MUST 使用既有 `modbus_handle_log` 保存 QT 压机操作日志，MUST 只新增 nullable（可空）的 `press_job_info_id`、`team_id` 和 `(device_id, press_job_info_id, handle_time, id)` 查询索引，并 MUST 复用既有 `handle_type`、`handle_content`、`handle_result`、`handle_by`、`handle_time`。

#### Scenario: 保存已关联操作日志
- **WHEN** ERP 能从认证设备和现有 Qt 作业记录解析 `pressJobInfoId`
- **THEN** 系统写入该父作业 ID、班组 ID、操作员 ID、固定中文操作名称与内容、字符串 `true` / `false` 结果和记录时间
- **AND** 系统不得另建压机业务日志表或保存班组、人员名称快照

#### Scenario: 保存未关联设备日志
- **WHEN** 操作发生在可解析的 `START` 之前，或现有 `localJobSessionId` 无法解析父作业
- **THEN** 系统可按认证设备写入 `press_job_info_id = null` 的 device-only log（仅设备日志）
- **AND** 系统不得后续回填或按设备加时间窗口猜测父作业

### Requirement: QT 操作日志端点保持最薄可信边界
ERP MUST 提供最薄的 QT operation-log endpoint（操作日志端点），请求 MUST 只包含 `correlationId`、`localJobSessionId`、`operationCode`、`result`、`teamId`、`operatorId`。ERP MUST 从认证上下文取得 `deviceId` 与 `granteeHostId`，并 MUST 复用现有 `localJobSessionId` 的 `press-job-id-*` 直连或 Qt `START` 会话映射解析现有 `pressJobInfoId`。

#### Scenario: 接收合法日志请求
- **WHEN** 认证 QT 客户端提交六个允许字段，`operationCode` 在允许列表内且 `result` 是 JSON Boolean `true` 或 `false`
- **THEN** ERP 使用认证 `deviceId` 和现有作业关联写入一条日志
- **AND** `teamId` 写入 `team_id`，`operatorId` 写入 `handle_by`，`correlationId` 只用于技术诊断串联

#### Scenario: 完成加工后解析父作业
- **WHEN** `COMPLETE` 已清除设备当前作业，但日志请求携带现有 `press-job-id-*` 或可查询的 Qt `START` 会话
- **THEN** ERP 只确认该父作业属于认证设备与授权主机后写入已关联日志
- **AND** 解析不得要求作业仍为进行中或仍存在于设备当前作业缓存

#### Scenario: 请求包含敏感或自由文本字段
- **WHEN** 请求尝试提交 `deviceId`、IP、port（端口）、原始参数、信号配置、异常正文、凭据、令牌、租约、签名、操作名称或操作内容
- **THEN** 端点不得使用这些值写入业务日志
- **AND** 服务端不得为了日志新增会话、请求去重或人员班组关系校验

### Requirement: 操作码和中文内容由服务端固定映射
系统 MUST 只接受 `START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE`，并 MUST 由服务端按结果映射固定中文名称和内容，不得接受客户端自由文本。

#### Scenario: 记录操作成功
- **WHEN** 允许列表操作以 `result=true` 上报
- **THEN** `handle_type` 分别映射为“开始加工”“开始参数记录”“完工参数记录”“入线”“出线”“完成加工”
- **AND** `handle_content` 分别映射为对应的“{操作}成功”固定中文内容
- **AND** `handle_result` 保存字符串 `true`

#### Scenario: 记录操作失败
- **WHEN** 允许列表操作以 `result=false` 上报
- **THEN** `handle_type` 使用相同固定操作名称
- **AND** `handle_content` 分别映射为对应的“{操作}失败”固定中文内容
- **AND** `handle_result` 保存字符串 `false`

#### Scenario: 上报未支持的操作码或结果
- **WHEN** `operationCode` 不在允许列表内，或 `result` 不是 JSON Boolean
- **THEN** ERP 拒绝请求且不写日志

### Requirement: QT 只在真实操作结束后尽力上报
QT MUST 在对应真实操作结果确定后按现有 ERP 或 workflow（工作流）结果码异步上报，成功结果 MUST 上报 `result=true`，错误结果或抛错 MUST 上报 `result=false`，并 MUST 保持日志调用与主操作结果隔离。`START`、`PARAMETER_START`、`PARAMETER_END`、`COMPLETE` MUST 在各自 ERP 调用边界判断；`LINE_IN`、`LINE_OUT` MUST 在 Driver 与 ERP 两侧汇总后判断。

#### Scenario: 主操作成功后日志写入失败
- **WHEN** 真实操作已成功且异步日志调用失败
- **THEN** QT 保留原成功结果
- **AND** 只写包含 `correlationId`、操作码和固定中文摘要的脱敏诊断

#### Scenario: 主操作失败后日志写入失败
- **WHEN** 真实操作已抛出原业务错误且异步日志调用也失败
- **THEN** QT 保留原业务错误
- **AND** 系统不得用日志错误替换原错误或记录异常正文

#### Scenario: ERP 操作以结果码结束
- **WHEN** `START`、`PARAMETER_START`、`PARAMETER_END` 或 `COMPLETE` 的 ERP 调用返回结果码
- **THEN** `OK` / `IDEMPOTENCY_REPLAY` 上报 `result=true`，其他结果码上报 `result=false`
- **AND** ERP 调用抛错时上报 `result=false`，后续 workflow 结果不得反向改写该条操作日志

#### Scenario: 入线或出线以状态结果结束
- **WHEN** `LINE_IN` 或 `LINE_OUT` workflow 以正常返回值给出整体结果
- **THEN** 只有 `OK` 上报 `result=true`
- **AND** `PARTIAL_OK` / `FAILED` 必须上报 `result=false`

#### Scenario: 日志请求结果不确定
- **WHEN** 异步日志请求超时、断网或进程退出
- **THEN** 系统不重试、不排队、不补偿、不回填
- **AND** 主操作不得等待该日志请求完成

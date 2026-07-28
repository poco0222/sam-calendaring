## MODIFIED Requirements

### Requirement: 压机操作日志复用既有 ERP 日志表和作业关联
系统 MUST 使用既有 `modbus_handle_log` 保存 QT 压机操作日志，MUST 只使用既有 nullable（可空）的 `press_job_info_id`、`team_id` 和 `(device_id, press_job_info_id, handle_time, id)` 查询索引，并 MUST 复用既有 `handle_type`、`handle_content`、`handle_result`、`handle_by`、`handle_time`。系统 MUST NOT 为本变更新增 session（会话）字段、索引或日志表。

#### Scenario: 保存已关联操作日志
- **WHEN** ERP 从可信服务端上下文取得真实 `pressJobInfoId`
- **THEN** 系统写入该父作业 ID、班组 ID、操作员 ID、固定中文操作名称与内容、字符串 `true` / `false` 结果和记录时间
- **AND** 系统不得保存班组或人员名称快照

#### Scenario: 保存未关联设备日志
- **WHEN** 当前真实操作没有可解析的父作业
- **THEN** 系统按认证设备写入 `press_job_info_id = null` 的 device-only log（仅设备日志）
- **AND** 系统不得按模具号、操作员或时间窗口猜测父作业

### Requirement: 首次锁模持久化待开始父子作业
ERP MUST 在首次锁模业务事务中使用既有 `press_job_info` 和 `press_mould_job_info` 持久化待开始作业，MUST 使用既有 `status=0` 表示待开始，并 MUST 将生成的父、子 ID 同步保存到设备当前作业 JSON。成功锁模 MUST 具有真实 `press_job_info_id`。

#### Scenario: 首次成功锁模
- **WHEN** 认证设备没有当前父作业，且选中模具通过校验并成功锁定
- **THEN** ERP 在同一事务插入一个 `status=0` 的父作业和本次选中模具对应的 `status=0` 子作业
- **AND** 每个子作业 MUST 绑定新父作业 ID
- **AND** 设备当前父、子作业 JSON MUST 保存相同的真实数据库 ID

#### Scenario: 首次锁模事务失败
- **WHEN** 首次锁模在事务内任一步骤失败
- **THEN** 新父、子作业和设备当前 JSON 更新 MUST 一起回滚
- **AND** 系统不得留下只有父记录、只有子记录或 JSON 与数据库 ID 不一致的待开始状态

#### Scenario: 待开始阶段继续锁模
- **WHEN** 当前父作业已有真实 ID 且 `status=0`，操作员成功锁定其他模具
- **THEN** ERP MUST 复用同一父作业 ID，只插入本次新增的 `status=0` 子作业
- **AND** 系统不得把父对象非空误判为加工中或生成父 ID 为空的 `status=1` 子作业

#### Scenario: 加工中继续锁模
- **WHEN** 当前父作业为 `status=1`，且现有业务规则允许成功锁定其他模具
- **THEN** ERP MUST 复用同一父作业 ID 并沿用现有运行中子作业状态规则
- **AND** 本变更不得放宽现有运行中锁模校验

#### Scenario: 存量待开始 JSON 的 ID 为空
- **WHEN** 设备当前可信 JSON 包含 `id=null,status=0` 的父作业或子作业，且发生下一次锁模或 `START`
- **THEN** ERP MUST 在当前业务事务内将该父作业和仍锁定的子作业懒持久化一次，再继续本次操作
- **AND** 系统不得批量迁移、按时间猜测或重复插入已经拥有真实 ID 的记录
- **AND** 父 ID 为空但部分子作业已有 ID 时，ERP MUST 在 `START` 事务内按 ID 锁定并验证已有子作业的数据库身份，只用可信数据库实体绑定新父 ID 并替换设备 JSON 中的缓存实体
- **AND** 可信数据库子作业的 `craftCode` MUST 与已通过入口校验的缓存子作业 `craftCode` 精确一致，替换后的 Qt 子作业 MUST 继续满足所选 `processId`
- **AND** 已有子作业存在冲突父 ID、跨设备、跨授权主机、非 `status=0`、缓存/数据库 `craftCode` 不一致、重复 ID 或重复模具号时，ERP MUST 在父、子和设备 JSON 写入前拒绝操作

#### Scenario: mixed Qt START 拒绝数据库工艺漂移
- **WHEN** mixed legacy 缓存子作业的 `craftCode` 与 Qt 所选 `processId` 一致，但相同 ID 的可信数据库子作业具有不同 `craftCode`
- **THEN** ERP MUST 在创建父作业、插入或更新子作业、更新设备 JSON 前拒绝 `START`
- **AND** ERP MUST NOT 以替换可信实体为由启动与 Qt 所选工艺不一致的数据库子作业

### Requirement: START 和待开始解锁复用既有作业记录
`START` MUST 将当前持久化待开始父、子作业从 `status=0` 更新为 `status=1`，MUST NOT 再次插入父、子作业或替换父 ID。待开始解锁 MUST 使用既有 `status=4` 收口不再参与本次加工的记录。

#### Scenario: 开始加工
- **WHEN** 当前父作业和仍锁定子作业已有真实 ID 且均为 `status=0`，并且 `START` 成功
- **THEN** ERP 将同一父作业和当前子作业更新为 `status=1`
- **AND** 更新前后的父、子 ID MUST 保持不变

#### Scenario: 待开始阶段部分解锁
- **WHEN** 当前父作业为 `status=0`，且只解锁部分已选模具
- **THEN** ERP 将选中子作业更新为 `status=4` 并从设备当前子作业 JSON 移除
- **AND** 父作业保持 `status=0`，其他仍锁定子作业保持待开始

#### Scenario: 待开始阶段全部解锁
- **WHEN** 当前父作业为 `status=0`，且本次解锁后不再有锁定模具
- **THEN** ERP 将本次剩余子作业和父作业更新为 `status=4`
- **AND** ERP 清空设备当前父、子作业 JSON
- **AND** 后续锁模 MUST 创建新的待开始父作业，不得复用已终止父作业

#### Scenario: 加工中解锁
- **WHEN** 当前父作业为 `status=1`
- **THEN** ERP 沿用现有加工中解锁限制和子作业收口状态
- **AND** 本变更不得允许解锁现有规则禁止的最后一套或全部模具

#### Scenario: 解锁模具号列表规范化
- **WHEN** QT 解锁请求的 `moldNos` 包含首尾空格、空项或重复模具号
- **THEN** ERP Controller MUST 按原顺序 trim、丢弃空项并去重，再把规范化后的非空集合交给解锁 Service
- **AND** 规范化后为空的请求 MUST 在主业务调用前拒绝，且不得记录一次已执行的 `UNLOCK_MOLD`
- **AND** ERP MUST NOT 丢弃或忽略规范化集合中的 stale/partial 模具号；任一模具号未命中当前锁定集合时，主业务 MUST 失败并记录真实失败结果

### Requirement: QT 操作日志端点保持最薄可信边界
ERP MUST 保持既有 QT operation-log endpoint（操作日志端点），请求 MUST 只包含 `correlationId`、`localJobSessionId`、`operationCode`、`result`、`teamId`、`operatorId`。ERP MUST 从认证上下文取得 `deviceId` 与 `granteeHostId`。该端点 MUST 只接受 QT 实际执行的 `CONNECT`、`MOVE_IN`、`MOVE_OUT`、`START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE` 九类操作；`LOCK_MOLD` 和 `UNLOCK_MOLD` MUST 只由 ERP 对应业务端点内部记录。

#### Scenario: 接收合法 QT 日志请求
- **WHEN** 认证 QT 客户端提交六个允许字段，`operationCode` 在 QT 九类允许列表内且 `result` 是 JSON Boolean `true` 或 `false`
- **THEN** ERP 使用认证设备和可信作业上下文写入一条日志
- **AND** `teamId` 写入 `team_id`，`operatorId` 写入 `handle_by`，`correlationId` 只用于技术诊断串联

#### Scenario: QT 尝试提交模具动作日志
- **WHEN** QT operation-log endpoint 收到 `LOCK_MOLD` 或 `UNLOCK_MOLD`
- **THEN** ERP MUST 拒绝请求且不写日志
- **AND** 锁模、解锁日志只能由对应可信业务端点生成，以避免伪造或重复记录

#### Scenario: 完成加工后解析父作业
- **WHEN** `COMPLETE` 已清除设备当前作业，但日志请求携带现有 `press-job-id-*` 或可查询的 Qt `START` 会话
- **THEN** ERP 只确认该父作业属于认证设备与授权主机后写入已关联日志
- **AND** 解析不得要求作业仍为进行中或仍存在于设备当前作业缓存

#### Scenario: 建立通信时没有当前作业
- **WHEN** `CONNECT` 已实际调用 Driver Service（驱动服务）并得到结果，但当前没有可解析父作业
- **THEN** ERP 按认证设备保存 device-only log
- **AND** 不得因为没有父作业而拒绝建立通信日志

#### Scenario: 请求包含敏感、关联或自由文本字段
- **WHEN** 请求尝试提交 `deviceId`、`pressJobInfoId`、IP、port（端口）、原始参数、信号配置、异常正文、凭据、令牌、租约、签名、操作名称或操作内容
- **THEN** 端点在调用认证解析和 Service（服务）前以固定中文业务错误拒绝请求，且不得使用这些值写入业务日志
- **AND** DTO（数据传输对象）只记录不含字段名和值的内部未知字段标记，不得在 JSON 反序列化阶段抛出包含 DTO、字段或第三方异常栈的错误

### Requirement: 父作业关联只能由可信服务端路径建立
系统 MUST 只允许 QT 专用 Service（服务）在校验认证 `deviceId`、`granteeHostId` 和现有作业身份后写入 `press_job_info_id`，或由锁模/解锁业务 Service 返回其事务中的真实父 ID。既有通用 `POST /modbus/handleLog` MUST 忽略客户端提交的 `pressJobInfoId`，并 MUST 保持普通 device-only log（仅设备日志）写入能力。

#### Scenario: 通用日志入口提交父作业
- **WHEN** 已认证客户端向 `POST /modbus/handleLog` 提交非空 `pressJobInfoId`
- **THEN** Controller（控制器）在调用既有 Service 前清空该字段，最终日志不得建立父作业关联
- **AND** 系统不得为此新增来源列、权限体系或通用 Writer（写入器）框架

#### Scenario: QT 专用服务建立父作业关联
- **WHEN** QT 操作日志端点通过 `press-job-id-*`、现有 Qt `START` 会话映射或认证设备当前 JSON 解析出父作业
- **THEN** QT 专用 Service 只在确认父作业属于认证设备与授权主机后写入非空 `press_job_info_id`
- **AND** 当前 JSON fallback（降级）只允许使用非空真实父 ID，不得按时间或模具号推测

#### Scenario: 成功锁定模具
- **WHEN** 认证 QT 锁模业务事务成功并返回真实父作业 ID
- **THEN** ERP 锁模 Controller 在主事务结束后尽力写入关联该父 ID 的 `LOCK_MOLD` 成功日志
- **AND** QT App 不得另行上报 `LOCK_MOLD`

#### Scenario: 成功解锁模具
- **WHEN** 认证 QT 解锁业务事务成功并返回操作前的真实父作业 ID
- **THEN** ERP 解锁 Controller 在主事务结束后尽力写入关联该父 ID 的 `UNLOCK_MOLD` 成功日志
- **AND** 待开始全部解锁已清空当前 JSON 也不得丢失该关联

#### Scenario: 锁模或解锁业务失败
- **WHEN** 锁模或解锁主业务抛错，且事务回滚后没有可确认的稳定父作业 ID
- **THEN** ERP MAY（可以）保存 `press_job_info_id = null` 的失败日志
- **AND** 日志失败或无父 ID 不得替换原业务错误

### Requirement: 十一类操作码和中文内容由服务端固定映射
系统 MUST 只支持 `LOCK_MOLD`、`UNLOCK_MOLD`、`CONNECT`、`MOVE_IN`、`MOVE_OUT`、`START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE` 十一类业务操作，并 MUST 由服务端按结果映射固定中文名称和内容，不得接受客户端自由文本。

#### Scenario: 记录操作成功
- **WHEN** 允许的可信入口以 `result=true` 记录一类操作
- **THEN** `handle_type` 分别映射为“锁定模具”“解锁模具”“建立通信”“移入”“移出”“开始加工”“开始参数记录”“完工参数记录”“入线”“出线”“完成加工”
- **AND** `handle_content` 映射为对应的“{操作}成功”固定中文内容
- **AND** `handle_result` 保存字符串 `true`

#### Scenario: 记录操作失败
- **WHEN** 允许的可信入口以 `result=false` 记录一类操作
- **THEN** `handle_type` 使用相同固定操作名称
- **AND** `handle_content` 映射为对应的“{操作}失败”固定中文内容
- **AND** `handle_result` 保存字符串 `false`

#### Scenario: 上报未支持的操作码或结果
- **WHEN** QT operation-log endpoint 收到不在其九类允许列表内的 `operationCode`，或 `result` 不是 JSON Boolean
- **THEN** ERP 拒绝请求且不写日志

### Requirement: 系统只在真实操作结束后尽力记录
系统 MUST 在对应真实外部操作已经发起且结果确定后，按现有 ERP、Driver 或 workflow（工作流）结果码记录日志；成功结果 MUST 使用 `result=true`，错误结果或抛错 MUST 使用 `result=false`，并 MUST 保持日志与主操作结果隔离。打开面板、普通按钮点击、本地前置校验失败和用户取消 MUST NOT 产生业务操作日志。

#### Scenario: 主操作成功后日志写入失败
- **WHEN** 真实操作已成功且日志写入失败
- **THEN** 系统保留原成功结果
- **AND** 只写包含 `correlationId`、操作码和固定中文摘要的脱敏诊断

#### Scenario: 主操作失败后日志写入失败
- **WHEN** 真实操作已抛出原业务错误且日志写入也失败
- **THEN** 系统保留原业务错误
- **AND** 不得用日志错误替换原错误或记录第三方异常正文

#### Scenario: 锁定或解锁模具提交结束
- **WHEN** 操作员已经选择模具并向 ERP 提交 `LOCK_MOLD` 或 `UNLOCK_MOLD`，且 ERP 主调用已返回或抛错
- **THEN** ERP 按主调用的真实成功或失败记录对应操作结果
- **AND** 主调用成功后的 current jobs（当前作业）刷新失败不得把已成功的业务操作记为失败

#### Scenario: 只操作锁模界面
- **WHEN** 操作员只打开锁模面板、选择或取消模具，或请求被 QT 本地前置校验阻止而没有提交 ERP 锁模业务
- **THEN** 系统不得写入 `LOCK_MOLD` 或 `UNLOCK_MOLD` 日志

#### Scenario: 建立通信、移入或移出结束
- **WHEN** `CONNECT`、`MOVE_IN` 或 `MOVE_OUT` 已实际调用 Driver Service 并返回现有成功结果码
- **THEN** QT 使用 `result=true` 记录对应操作
- **AND** Driver 返回其他结果码或抛错时使用 `result=false`

#### Scenario: 移出流程先完成加工
- **WHEN** 加工中的 `MOVE_OUT` workflow 先完成参数记录和完成加工，再执行真实移出命令
- **THEN** 系统分别记录 `PARAMETER_END`、`COMPLETE` 和 `MOVE_OUT`
- **AND** 不得把三个真实动作折叠为一条日志

#### Scenario: ERP 操作以结果码结束
- **WHEN** `START`、`PARAMETER_START`、`PARAMETER_END` 或 `COMPLETE` 的 ERP 调用返回结果码
- **THEN** `OK` / `IDEMPOTENCY_REPLAY` 使用 `result=true`，其他结果码使用 `result=false`
- **AND** ERP 调用抛错时使用 `result=false`，后续 workflow 结果不得反向改写该条操作日志

#### Scenario: 入线或出线以状态结果结束
- **WHEN** `LINE_IN` 或 `LINE_OUT` workflow 以正常返回值给出整体结果
- **THEN** 只有 `OK` 使用 `result=true`
- **AND** `PARTIAL_OK` / `FAILED` 必须使用 `result=false`

#### Scenario: QT 日志请求结果不确定
- **WHEN** 异步日志请求超时、断网或进程退出
- **THEN** 系统不重试、不排队、不补偿、不按时间或设备回填
- **AND** 主操作不得等待该日志请求完成

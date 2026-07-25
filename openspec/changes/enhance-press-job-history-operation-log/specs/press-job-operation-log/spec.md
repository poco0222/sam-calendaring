## ADDED Requirements

### Requirement: 压机业务操作统一写入既有 ERP 日志
系统 MUST 使用 SAM ERP 既有 `modbus_handle_log` 保存压机业务操作，MUST 保留 `qt_press_job_operation` 的幂等与重放职责，并 MUST 保留 Driver Service 的 `audit_log` / `diagnostic_log` 技术审计与诊断职责，不得新增第三张压机业务日志表。

#### Scenario: 记录 QT 压机业务操作
- **WHEN** QT 压机业务操作产生可记录结果
- **THEN** ERP 把该结果写入扩展后的 `modbus_handle_log`
- **AND** 系统不得把同一业务追溯数据另存到新的平行日志表

#### Scenario: 执行幂等重放
- **WHEN** ERP 将请求识别为已成功处理的 Idempotency（幂等）重放
- **THEN** 系统返回既有成功结果且不重复写入业务操作日志
- **AND** `qt_press_job_operation` 继续保存重放判定所需记录

### Requirement: 锁模日志通过服务端会话精确关联模具作业
ERP MUST 在第一条模具锁定时生成服务端父作业 `pressOperationSessionId`，MUST 为每条模具生成独立 `mouldOperationSessionId`，MUST 将两类会话保存到设备当前作业 JSON，并 MUST 在子作业落库后以模具会话键回填真实 `pressJobInfoId` 与 `mouldJobId`。QT MUST 使用 ERP 返回的父作业会话作为待开始阶段的 `localJobSessionId`，不得使用显示字段派生值建立业务日志关联。

#### Scenario: 锁模发生在作业主键生成之前
- **WHEN** 操作员成功锁定一条尚未开始加工的模具
- **THEN** ERP 生成服务端控制的父作业会话和模具操作会话，并将模具会话写入锁模日志
- **AND** 锁模请求无需携带 `deviceId`、IP、端口或客户端生成的模具会话键

#### Scenario: QT 读取待开始作业身份
- **WHEN** QT 在第一次锁模后重新读取当前作业
- **THEN** ERP 返回持久化在设备当前作业 JSON 中的 `pressOperationSessionId`
- **AND** QT 将其作为后续 Driver 操作日志的 `localJobSessionId`，应用重启或重新读取不得改变该值

#### Scenario: 开始加工后形成真实子作业
- **WHEN** ERP 在开始加工事务内插入父作业和各条模具子作业
- **THEN** 系统按完全相同的模具操作会话键回填对应锁模日志的父、子作业 ID
- **AND** 后续该模具操作日志均携带真实 `mouldJobId`

#### Scenario: 加工中追加锁定模具
- **WHEN** 当前父作业已经开始加工，操作员再锁定一条新模具且 ERP 立即插入新的 `press_mould_job_info`
- **THEN** ERP 为新模具生成 `mouldOperationSessionId`，并在插入成功后写入携带真实 `pressJobInfoId`、`mouldJobId` 和模具会话的锁模日志
- **AND** 系统不得把该加工中锁模日志保留为空 `mouldJobId`

#### Scenario: 无可靠关联的预作业被解锁
- **WHEN** 模具在开始加工前解锁且未形成持久化子作业
- **THEN** 其日志保持未归属状态且不得显示在任一历史作业详情
- **AND** 系统不得按设备、模具号或时间窗口猜测归属

#### Scenario: 模具作业发生跨日拆分
- **WHEN** 单模具跨日完成，或多模具父作业中的一条模具因加工中解锁而拆分为多个历史行
- **THEN** 每个拆分行继承该模具同一 `mouldOperationSessionId`
- **AND** 每个历史行均可读取完整模具生命周期日志且不得包含兄弟模具日志

### Requirement: 每条操作保存可信班组和作业人员快照
QT 压机业务日志请求 MUST 只提交班组与作业人员 ID，ERP MUST 使用现有班组范围和部门人员关系完成校验，并 MUST 为每条已接受操作保存操作时的 `teamId`、`teamName`、`operatorId` 与 `operatorName` 快照。

#### Scenario: 操作人员属于所选班组
- **WHEN** ERP 校验所选班组有效且作业人员属于该班组
- **THEN** 系统从 ERP 主数据生成名称快照并随操作日志保存
- **AND** 历史组织关系变化不得改写已保存快照

#### Scenario: 班组或人员校验失败
- **WHEN** 首次执行的班组不在压机作业范围、已停用，或人员不属于该班组
- **THEN** ERP 拒绝业务操作或纯 Driver 操作日志上报
- **AND** 系统不得把前端提交的名称或未校验身份写入业务日志

### Requirement: 压机操作覆盖完整且结果来源受控
系统 MUST 记录锁模、建立/断开通信、开始加工、开始/完工参数、移入/移出、入线/出线、完成加工和解锁的 allowlist（允许列表）操作码、固定中文内容、成功/失败结果、`correlationId` 与时间；ERP 原子生命周期动作 MUST 在可信业务边界写入，纯 Driver 动作及需要 Driver 实际结果的入线/出线 MUST 通过 QT 安全适配端点写入同一日志表。

#### Scenario: ERP 生命周期动作成功
- **WHEN** 锁模、开始、参数、完成或解锁业务变更成功
- **THEN** 对应成功日志与业务写入处于同一事务
- **AND** 父作业级动作按当时实际子作业列表为每个 `mouldJobId` 写一条日志

#### Scenario: 已验证身份后的 ERP 动作失败
- **WHEN** actor（操作者）和设备上下文已经通过验证但业务动作随后失败并回滚
- **THEN** ERP Service（服务）使用已验证的脱敏失败上下文，通过独立 Spring Bean 的 `REQUIRES_NEW` 事务补写固定中文失败日志
- **AND** 只有能从稳定会话或真实主键解析的失败日志才可进入历史作业详情

#### Scenario: actor 校验失败
- **WHEN** actor 或设备上下文未通过可信校验
- **THEN** 系统拒绝动作且不得写入业务操作日志

#### Scenario: 失败日志写入自身失败
- **WHEN** 原业务事务已失败且独立失败日志写入也发生异常
- **THEN** 系统保留并返回原业务错误
- **AND** 日志写入异常只形成脱敏技术诊断，不得覆盖原业务错误

#### Scenario: 纯 Driver 动作完成
- **WHEN** 建立/断开通信或移入/移出得到 Driver Service 结果
- **THEN** QT 在该次真实 Driver 命令的执行边界向 ERP 上报允许列表操作码、结果码、关联 ID、现有 `idempotencyKey`、作业本地会话和 actor ID
- **AND** ERP 从 bootstrap context 解析设备，并按开始前设备当前作业中的模具会话或开始后的真实子作业扇出写入 `modbus_handle_log`

#### Scenario: 入线或出线动作结束
- **WHEN** 同一次入线或出线的 Driver 命令与 ERP 状态请求均已结束
- **THEN** QT 只通过安全适配端点写一次整体业务结果，两侧均成功时为 `true`，任一侧失败时为 `false`
- **AND** 固定中文白名单内容分别显示成功、部分完成或失败，不保存原始技术结果
- **AND** ERP `machine-status` 幂等记录继续保留但不得再重复写入 `modbus_handle_log`

#### Scenario: 开始前多模具执行纯 Driver 动作
- **WHEN** 多条模具已经锁定但尚未开始加工，随后实际执行建立通信或移入动作
- **THEN** ERP 在认证设备行锁内按当前作业 JSON 中每条 `mouldOperationSessionId` 扇出日志
- **AND** 开始加工后这些日志通过相同模具会话精确归属于各自历史作业

#### Scenario: Driver 参与动作日志上报发生重试
- **WHEN** 相同认证设备、操作码与 `idempotencyKey` 的 Driver 参与动作日志请求因网络结果不确定而重试
- **THEN** ERP 对操作码、结果码、`localJobSessionId`、`operatorId` 与 `teamId` 计算 canonical fingerprint（规范指纹），并仅在既有指纹一致时识别 replay（重放）
- **AND** 指纹一致时不得重复写入整组日志；同键不同指纹必须拒绝且不得新增或改写业务日志
- **AND** 同指纹 replay 在设备认证和允许列表校验后、当前 actor 主数据重新校验前返回，并保留首次执行已经保存的 actor 快照
- **AND** 详细或部分成功结果码只保留在技术日志，业务日志结果映射为字符串 `true` 或 `false`

#### Scenario: 旧 Driver 日志在作业切换后到达
- **WHEN** 作业 A 的 Driver 日志请求延迟到作业 B 已成为设备当前作业后才到达
- **THEN** ERP 必须以请求 `localJobSessionId` 精确匹配当前父作业会话，或通过既有 START 幂等记录解析作业 A 的真实 `pressJobInfoId`
- **AND** 系统不得按请求到达时的设备当前作业把日志写入作业 B
- **AND** 无法证明会话属于当前预作业或已持久化作业时，只能保存为未归属设备日志

#### Scenario: 未实际执行纯 Driver 命令
- **WHEN** 完工参数失败导致清理命令未执行，或嵌套完工流程尚未执行随后计划的出线/移出命令
- **THEN** 系统不得提前生成断开通信、出线或移出业务日志
- **AND** 每次实际命令最多形成一组按模具扇出的业务日志

#### Scenario: 上报不受支持的操作或结果
- **WHEN** QT 安全适配端点收到非允许列表操作码、结果码或超长标识
- **THEN** ERP 返回固定中文 HTTP 400 且不写日志

### Requirement: 历史查询只返回可靠且脱敏的业务日志
历史作业详情 MUST 按当前认证 `deviceId` 与稳定 `mouldJobId` 认证目标行，MUST 优先使用该行持久化的 `mouldOperationSessionId` 查询同一模具生命周期日志，MUST 按 `handleTime ASC, id ASC` 返回操作码、中文名称、内容、结果、班组/人员快照和时间，并 MUST 在新业务日志完全不存在时才以既有 Qt 成功生命周期记录整组降级。

#### Scenario: 新作业存在可靠业务日志
- **WHEN** 当前 `mouldJobId` 对应的 `mouldOperationSessionId` 或该作业 ID 至少存在一条可靠 `modbus_handle_log`
- **THEN** 详情只返回该模具作业的业务日志且不混入 Qt 幂等记录
- **AND** 同一父作业下兄弟模具的独有锁模或解锁记录不得出现

#### Scenario: 旧 Qt 作业没有可靠业务日志
- **WHEN** 当前历史作业既没有模具会话关联日志，也没有直接携带 `mouldJobId` 的业务日志
- **THEN** 系统继续以 `qt_press_job_operation` 投影现有成功生命周期记录
- **AND** 缺失班组显示“未记录”，不得从当前组织关系补造历史快照

#### Scenario: 写入或返回日志内容
- **WHEN** ERP 处理压机业务日志
- **THEN** 日志和响应不得包含参数 JSON、信号配置原文、寄存器值、IP、端口、凭据、令牌、租约、签名或第三方异常正文
- **AND** 外部请求可通过 `correlationId` 与 Driver 技术日志关联但不得复制其敏感正文

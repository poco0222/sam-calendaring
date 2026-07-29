## MODIFIED Requirements

### Requirement: 首次锁模持久化待开始父子作业
ERP MUST 在首次锁模业务事务中使用既有 `press_job_info` 和 `press_mould_job_info` 持久化待开始作业，MUST 使用既有 `status=0` 表示待开始，并 MUST 将生成的父、子 ID 同步保存到设备当前作业 JSON。成功锁模 MUST 具有真实 `press_job_info_id`。ERP MUST 将旧版首次锁模生成的无 ID、空子状态待开始 JSON 作为窄兼容形状，在下一次锁模、`START` 或解锁事务内规范化并懒持久化。

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

#### Scenario: 存量待开始 JSON 的 ID 或子状态为空
- **WHEN** 设备当前可信 JSON 的父作业为 `id=null,status=0`，子作业为 `id=null,pressJobInfoId=null,status=null` 或 `status=0`，且发生下一次锁模、`START` 或解锁
- **THEN** ERP MUST 先把该窄兼容形状中的空子状态规范化为 `0`，再在当前业务事务内将父作业和仍锁定子作业懒持久化一次并继续本次操作
- **AND** 直接解锁时 MUST 在应用既有 `status=4` 收口前取得并回写真实父子 ID
- **AND** 系统不得批量迁移、按时间猜测或重复插入已经拥有真实 ID 的记录
- **AND** 任一子作业存在非空非 `0` 状态、冲突父 ID、跨设备、跨授权主机、重复 ID 或重复模具号时，ERP MUST 在父、子和设备 JSON 写入前拒绝操作
- **AND** 父 ID 为空但部分子作业已有 ID 时，ERP MUST 在 `START` 事务内按 ID 锁定并验证已有子作业的数据库身份，只用可信数据库实体绑定新父 ID并替换设备 JSON 中的缓存实体
- **AND** 可信数据库子作业的 `craftCode` MUST 与已通过入口校验的缓存子作业 `craftCode` 精确一致，替换后的 Qt 子作业 MUST 继续满足所选 `processId`

#### Scenario: mixed Qt START 拒绝数据库工艺漂移
- **WHEN** mixed legacy 缓存子作业的 `craftCode` 与 Qt 所选 `processId` 一致，但相同 ID 的可信数据库子作业具有不同 `craftCode`
- **THEN** ERP MUST 在创建父作业、插入或更新子作业、更新设备 JSON 前拒绝 `START`
- **AND** ERP MUST NOT 以替换可信实体为由启动与 Qt 所选工艺不一致的数据库子作业

### Requirement: START 和待开始解锁复用既有作业记录
`START` MUST 将当前持久化待开始父、子作业从 `status=0` 更新为 `status=1`，MUST NOT 再次插入父、子作业或替换父 ID。待开始解锁 MUST 使用既有 `status=4` 收口不再参与本次加工的记录。旧版无 ID、空子状态待开始 JSON MUST 先在当前事务内完成窄规范化和懒持久化，不得要求现场先结束或清空作业。

#### Scenario: 开始加工
- **WHEN** 当前父作业和仍锁定子作业已有真实 ID且均为 `status=0`，并且 `START` 成功
- **THEN** ERP 将同一父作业和当前子作业更新为 `status=1`
- **AND** 更新前后的父、子 ID MUST 保持不变

#### Scenario: 存量待开始作业开始加工
- **WHEN** 当前父作业为 `id=null,status=0`，所有子作业为 `id=null,pressJobInfoId=null,status=null` 或 `status=0`，且设备、授权主机、模具号和工艺校验均通过
- **THEN** ERP MUST 在同一 `START` 事务内规范化空子状态、懒持久化父子记录并把同一批记录更新为 `status=1`
- **AND** 设备当前 JSON MUST 保存生成的真实父子 ID，不得要求操作员重新锁模

#### Scenario: 待开始阶段部分解锁
- **WHEN** 当前父作业为 `status=0`，且只解锁部分已选模具
- **THEN** ERP 将选中子作业更新为 `status=4` 并从设备当前子作业 JSON 移除
- **AND** 父作业保持 `status=0`，其他仍锁定子作业保持待开始

#### Scenario: 待开始阶段全部解锁
- **WHEN** 当前父作业为 `status=0`，且本次解锁后不再有锁定模具
- **THEN** ERP 将本次剩余子作业和父作业更新为 `status=4`
- **AND** ERP 清空设备当前父、子作业 JSON
- **AND** 后续锁模 MUST 创建新的待开始父作业，不得复用已终止父作业

#### Scenario: 存量待开始作业直接解锁
- **WHEN** 当前父作业为 `id=null,status=0`，所有子作业为 `id=null,pressJobInfoId=null,status=null` 或 `status=0`，且解锁请求精确命中当前锁定模具
- **THEN** ERP MUST 在同一解锁事务内规范化空子状态、懒持久化父子记录，再对选中记录应用既有部分或全部解锁规则
- **AND** 成功解锁 MUST 返回懒持久化得到的真实父作业 ID 供 `UNLOCK_MOLD` 日志关联
- **AND** 任一步骤失败时，父子持久化、`status=4` 更新和设备 JSON 更新 MUST 一起回滚

#### Scenario: 加工中解锁
- **WHEN** 当前父作业为 `status=1`
- **THEN** ERP 沿用现有加工中解锁限制和子作业收口状态
- **AND** 本变更不得允许解锁现有规则禁止的最后一套或全部模具

#### Scenario: 解锁模具号列表规范化
- **WHEN** QT 解锁请求的 `moldNos` 包含首尾空格、空项或重复模具号
- **THEN** ERP Controller MUST 按原顺序 trim、丢弃空项并去重，再把规范化后的非空集合交给解锁 Service
- **AND** 规范化后为空的请求 MUST 在主业务调用前拒绝，且不得记录一次已执行的 `UNLOCK_MOLD`
- **AND** ERP MUST NOT 丢弃或忽略规范化集合中的 stale/partial 模具号；任一模具号未命中当前锁定集合时，主业务 MUST 失败并记录真实失败结果

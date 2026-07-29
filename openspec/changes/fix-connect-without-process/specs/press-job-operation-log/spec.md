## MODIFIED Requirements

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

#### Scenario: 建立通信未选择预选工艺
- **WHEN** 操作员已选择班组和人员、未选择 `processId`，并执行 `CONNECT`
- **THEN** QT MUST NOT 返回“请先选择预选工艺。”
- **AND** 其他前置条件通过时，QT 继续调用既有 Driver Service（驱动服务）建立通信
- **AND** `MOVE_IN`、`MOVE_OUT`、`LINE_IN` 和 `LINE_OUT` 仍 MUST 要求预选工艺

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

#### Scenario: 日志请求结果不确定
- **WHEN** 异步日志请求超时、断网或进程退出
- **THEN** 系统不重试、不排队、不补偿、不按时间或设备回填
- **AND** 主操作不得等待该日志请求完成

---
comet_change: enhance-press-job-history-operation-log
role: technical-design
canonical_spec: openspec
---

# 压机历史作业操作日志复用技术设计

- Author: PopoY
- Created: 2026-07-25 10:23:37
- Change: `enhance-press-job-history-operation-log`
- Canonical requirements: `openspec/changes/enhance-press-job-history-operation-log/specs/`
- Related UI design: `docs/superpowers/specs/2026-07-24-press-job-history-page-design.md`

## 1. 设计目的与边界

本文只深化 OpenSpec 已确认方案的实现结构、事务边界、数据契约和验证方法，不复制第二份需求规格。

本次设计解决两个根因：

1. 当前历史详情把 `qt_press_job_operation` 的成功幂等记录投影成操作日志，无法表达锁模、解锁、Driver（驱动）动作失败、操作内容、班组和人员快照。
2. 锁模发生时 `press_mould_job_info` 尚未落库，不能用 `mouldJobId` 直接关联；按设备、模具号和时间窗口回填会在多模具、重复锁模和跨日场景串线。

采用以下职责分离：

| 存储 | 唯一职责 | 本次处理 |
| --- | --- | --- |
| `modbus_handle_log` | 压机 Business Operation Log（业务操作日志） | 扩展关联、结果、班组和人员快照，历史详情以它为主 |
| `qt_press_job_operation` | Qt 生命周期 Idempotency（幂等）与 Replay（重放） | 保留，不扩展为业务日志；旧作业无业务日志时才整组降级投影 |
| Driver `audit_log` / `diagnostic_log` | 技术审计、诊断和外部请求链路 | 保留，不复制进 ERP 历史详情 |
| `sys_oper_log` | `@Log` 驱动的通用接口审计 | 保留，不承担压机业务时间线 |

明确不做：

- 不新增第三张压机业务日志表。
- 不迁移或猜测关联既有 `modbus_handle_log`。
- 不改变旧 Vue 日志管理入口及其查询行为。
- 不把参数 JSON、信号配置、寄存器、网络地址、安全材料或第三方异常正文写进业务日志。
- 不改历史列表分页大小、31 个自然日上限和认证设备隔离规则。

## 2. 总体结构

### 2.1 最小新增组件

ERP 后端只增加一个具体 Spring Bean（组件）`PressOperationLogWriter`，不增加单实现接口、工厂或新的日志框架。

它承担三项紧密相关的职责：

1. 复用现有 `FmPlineMapper`、`UserDeptService` 校验 `teamId` / `operatorId`，返回不可变 actor snapshot（操作者快照）。
2. 根据稳定 operation code（操作码）生成固定中文 `handle_type` / `handle_content`，写入扩展后的 `ModbusHandleLogMapper`。
3. 提供由外部 Service（服务）调用的 `REQUIRES_NEW` 失败写入方法；该方法不接收原始请求或异常正文。

`PressJobInfoServiceImpl` 当前已有的班组/人员校验逻辑移动到该 Bean 复用；班组工艺校验仍留在 `PressJobInfoServiceImpl`，因为它属于开始加工规则而不是日志职责。

### 2.2 写入路径

压机操作分成两类：

| 类型 | 操作 | 日志结果来源 |
| --- | --- | --- |
| ERP 原子生命周期 | 锁模、开始加工、开始参数、完工参数、完成加工、解锁 | 对应 ERP 业务事务的真实成功或失败 |
| Driver 参与动作 | 建立通信、断开通信、移入、移出、入线、出线 | 实际 Driver 命令结果；入线/出线同时汇总 ERP `machine-status` 结果 |

ERP 原子动作直接在原 Service 事务中写成功日志。Driver 参与动作由 Qt 在真实命令完成后调用新的安全适配端点，ERP 仍写入同一张 `modbus_handle_log`。

聚合诊断回调只写 Driver 技术日志，不产生 ERP 业务日志，避免把未执行命令或嵌套流程重复记账。

## 3. 数据模型

### 3.1 `modbus_handle_log` 增量列

通过新的 Liquibase（数据库迁移）文件增加全部 nullable（可空）列，确保旧入口和既有数据继续可读写：

| 列 | Java 字段 | 建议类型 | 说明 |
| --- | --- | --- | --- |
| `press_job_info_id` | `pressJobInfoId` | `BIGINT` | 父作业关联；父级动作扇出和排查使用 |
| `mould_job_id` | `mouldJobId` | `BIGINT` | 具体历史模具作业 ID |
| `mould_operation_session_id` | `mouldOperationSessionId` | `VARCHAR(64)` | 服务端生成的模具生命周期关联键 |
| `correlation_id` | `correlationId` | `VARCHAR(128)` | 串联一次外部请求与技术日志 |
| `idempotency_key` | `idempotencyKey` | `VARCHAR(191)` | Driver 参与动作安全上报的去重键 |
| `request_fingerprint` | `requestFingerprint` | `CHAR(64)` | Driver 日志同幂等键请求内容的 SHA-256 规范指纹 |
| `operation_code` | `operationCode` | `VARCHAR(32)` | 稳定英文操作码 |
| `team_id` | `teamId` | `VARCHAR(64)` | 操作时班组 ID 快照 |
| `team_name` | `teamName` | `VARCHAR(128)` | 操作时班组名称快照 |
| `operator_name` | `operatorName` | `VARCHAR(128)` | 与既有 `handle_by` 配套的人员名称快照 |

既有字段继续保持原语义：

- `handle_by`：操作员 ID。
- `handle_type`：固定中文操作名称。
- `handle_content`：固定中文业务摘要。
- `handle_result`：只保存字符串 `true` / `false`。
- `handle_time`：ERP 服务器写入时间。
- `ip`：Qt 新链路始终不赋值；旧入口保持既有行为。

新增索引：

```text
idx_mhl_mould_job_time       (mould_job_id, handle_time, id)
idx_mhl_mould_session        (mould_operation_session_id)
idx_mhl_press_job_time       (press_job_info_id, handle_time, id)
idx_mhl_correlation          (correlation_id)
idx_mhl_device_op_idempotent (device_id, operation_code, idempotency_key)
```

不增加 Foreign Key（外键）：业务日志允许未归属设备级记录，且日志生命周期不能受业务行删除或历史脏数据约束。

### 3.2 父作业和模具会话

`PressJobInfo` 增加只用于设备当前作业 JSON 的 `pressOperationSessionId`。第一次锁模建立父作业时由 ERP 生成 UUID，并随 `modbus_device.press_job_info_json` 持久化；不新增 `press_job_info` 数据库列。当前作业接口返回该值，QT 优先把它作为待开始及后续生命周期稳定的 `localJobSessionId`。开始加工后，现有 START `qt_press_job_operation.local_job_session_id` 继续把该会话映射到真实 `press_job_info_id`。

旧设备当前 JSON 没有 `pressOperationSessionId` 时，QT 可保留现有显示派生身份，但 ERP 不得用该身份建立业务日志作业关联。

`press_mould_job_info` 新增：

```text
mould_operation_session_id VARCHAR(64) NULL
idx_pmji_mould_session (mould_operation_session_id)
```

`PressMouldJobInfo.mouldOperationSessionId` 同时参与：

- `press_mould_job_info` Mapper 读写；
- `modbus_device.press_mould_job_info_json` 的 FastJSON（JSON 序列化）读写；
- 跨日完成和加工中解锁形成的新历史分段复制。

父作业会话和模具会话均由 ERP 使用 UUID 生成。Qt 不生成、不覆盖，也不将父作业 `localJobSessionId` 当作模具会话。

### 3.3 操作码与固定摘要

业务日志只允许以下稳定操作码：

| `operation_code` | `handle_type` | 成功摘要 | 失败摘要 |
| --- | --- | --- | --- |
| `LOCK_MOLD` | 锁定模具 | 锁定模具成功 | 锁定模具失败 |
| `CONNECT` | 建立通信 | 建立通信成功 | 建立通信失败 |
| `START_PROCESSING` | 开始加工 | 开始加工成功 | 开始加工失败 |
| `RECORD_START_PARAMETERS` | 记录开始参数 | 开始参数记录成功 | 开始参数记录失败 |
| `RECORD_END_PARAMETERS` | 记录完工参数 | 完工参数记录成功 | 完工参数记录失败 |
| `MOVE_IN` | 移入 | 移入成功 | 移入失败 |
| `MOVE_OUT` | 移出 | 移出成功 | 移出失败 |
| `LINE_IN` | 入线 | 入线成功 | 入线失败 |
| `LINE_OUT` | 出线 | 出线成功 | 出线失败 |
| `COMPLETE_PROCESSING` | 完成加工 | 完成加工成功 | 完成加工失败 |
| `DISCONNECT` | 断开通信 | 断开通信成功 | 断开通信失败 |
| `UNLOCK_MOLD` | 解锁模具 | 解锁模具成功 | 解锁模具失败 |

`LINE_IN` / `LINE_OUT` 的 `PARTIAL_OK` 使用“入线部分完成”或“出线部分完成”，但 `handle_result` 仍为 `false`。除此之外，不允许客户端提交自由文本日志内容。

## 4. 模具会话关联

### 4.1 锁模阶段

`PressMouldJobInfoServiceImpl.lockPressMouldCodeForQt` 在认证设备行锁和 actor 校验通过后处理每条选中模具：

1. 检查模具未被重复锁定且属于当前认证设备。
2. 当前父作业没有 `pressOperationSessionId` 时生成一次并保存；后续追加模具沿用该父作业会话。
3. 为每条新模具生成独立 UUID，写入 `PressMouldJobInfo.mouldOperationSessionId`。
4. 把父作业会话和模具会话保存到设备当前 JSON。
5. 当前父作业尚未开始时，为每条实际新增模具写一条模具会话非空、`press_job_info_id` / `mould_job_id` 为空的 `LOCK_MOLD` 成功日志。
6. 当前父作业已经开始时，沿用现有逻辑立即插入新的 `press_mould_job_info`；插入成功后写一条携带真实 `press_job_info_id`、`mould_job_id` 和模具会话的 `LOCK_MOLD` 成功日志。

同一事务回滚时，子作业插入、设备当前 JSON 和成功日志一起回滚。重试后没有发生新状态变化时不得重复写成功日志。加工中追加锁模不得进入待开始的空 ID 回填路径。

### 4.2 开始加工阶段

`PressJobInfoServiceImpl.startPressJobForQt` 保持当前顺序中的设备行锁和 `qt_press_job_operation` replay 检查，并在第一次执行时：

1. 从锁定设备当前 JSON 取得 `pressOperationSessionId` 和各模具的服务端会话键，并要求开始请求使用该稳定父作业会话作为 `localJobSessionId`。
2. 完成现有班组、人员、工艺和状态校验。
3. 插入 `press_job_info` 及每条 `press_mould_job_info`，后者必须保存原会话键。
4. 逐条按 `device_id + mould_operation_session_id` 回填此前日志的 `press_job_info_id` / `mould_job_id`。
5. 为实际子作业逐条写 `START_PROCESSING` 成功日志。
6. 最后写入现有 `qt_press_job_operation` 幂等记录，把该父作业会话映射到真实 `press_job_info_id`。

步骤 3 至 6 保持同一事务；任何一步失败都不留下半组关联。发生 replay 时在步骤 1 前返回，不回填、不重复写业务日志。

### 4.3 开始后的父级动作扇出

开始参数、完工参数、完成加工和能关联到当前作业的入线/出线属于父作业级动作，但历史列表以模具子作业为行。写入时按当时已经校验的实际子作业列表扇出：

- 每条日志携带自己的 `mould_job_id` 和 `mould_operation_session_id`。
- 同一次用户操作共享 `correlation_id`、`idempotency_key`、actor snapshot（操作者快照）和时间。
- 不在查询时把父级日志广播给兄弟模具。

### 4.4 解锁和跨日拆分

解锁前先保存目标模具的当前 ID、会话键及 actor snapshot，随后执行现有解锁/分段逻辑：

- 开始前解锁：日志保留模具会话，但没有持久化 `mould_job_id`，因此不会进入任何历史详情。
- 加工中解锁：完成段和随后产生的分段均复制原 `mouldOperationSessionId`；解锁日志写入原会话。
- 跨日完成：每个日期分段均复制原会话，查询任一分段都得到该模具完整生命周期日志。

会话只关联同一模具，不关联同一父作业下的其他模具。

## 5. Actor（操作者）校验与快照

### 5.1 请求字段

Qt 只提交 ID，不提交名称：

| 请求 | 已有字段 | 本次补充 |
| --- | --- | --- |
| 锁模 | `operatorId`, `teamId` | 无 |
| 开始加工 | `operatorId`, `teamId` | 无 |
| 开始/完工参数 | 无 | `operatorId`, `teamId` |
| 完成加工 | `operatorId` | `teamId` |
| 解锁 | `operatorId` | `teamId` |
| Driver 操作日志 | 新请求 | `operatorId`, `teamId` |

名称由 ERP 从主数据生成，不信任 Qt 显示文本。

### 5.2 校验顺序

`PressOperationLogWriter.resolveActorSnapshot(teamId, operatorId)` 复用当前开始加工逻辑：

1. `FmPlineMapper.selectPlnListByDept2("30")` 确认班组属于压机范围。
2. `FmPlineMapper.selectFmPlineByCode(teamId)` 确认班组存在且未停用。
3. 从 `responsibleTeam`，为空时从 `sysOrgCode`，取得责任部门。
4. `UserDeptService.getUserListByDepartId` 确认用户属于该部门且账号未删除、未停用。
5. 快照 `team.getCode()`、`team.getName()`、`user.getUserName()`、`user.getNickName()`。

actor 校验必须先于可产生业务副作用的操作。校验失败时拒绝请求，不写业务日志，也不把前端名称回显进日志。

## 6. 事务与失败日志

### 6.1 成功日志

`PressOperationLogWriter.writeSuccess(...)` 不开启独立事务，直接参与调用方已有事务。调用顺序统一为：

```text
输入/认证校验
→ 设备行锁与 replay 检查
→ actor 校验并捕获快照
→ 执行业务变更
→ 写成功业务日志
→ 写既有 qt_press_job_operation（适用时）
→ 提交
```

这样业务变化、业务日志和幂等记录要么全部提交，要么全部回滚。

### 6.2 失败日志

在 actor、设备和稳定作业上下文通过校验后，Service 在执行可能失败的业务段前构造脱敏 `FailureLogContext`。它只包含：

- 认证 `deviceId`；
- 已确认的父/子作业 ID 或模具会话；
- operation code（操作码）；
- `correlationId` / `idempotencyKey`；
- actor snapshot；
- 固定失败摘要所需枚举。

捕获业务异常后，调用外部注入的 `PressOperationLogWriter.writeFailureInNewTransaction(...)`。该 public 方法使用：

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
```

随后重新抛出原业务异常。失败上下文不得引用尚未提交的新主键；开始加工失败优先用锁模阶段已经持久化的模具会话。

如果失败日志自身写入失败：

- 保留原业务异常作为响应原因。
- ERP 常规日志只记录 `exceptionType`、固定中文摘要、异常摘要 hash 和 `correlationId`。
- 不记录异常堆栈正文、参数 JSON、信号配置或安全材料。

## 7. Driver 参与动作安全适配

### 7.1 端点与请求

新增：

```http
POST /api/qt/press-working/operation-logs
X-Correlation-Id: <same correlationId>
Authorization: Bearer <session token>
```

请求白名单：

```text
correlationId: string, max 128, 必须与 header 一致
idempotencyKey: string, max 191, 精确匹配
localJobSessionId: string, max 512, 用于稳定父作业身份和过期动作检查
operationCode: CONNECT | DISCONNECT | MOVE_IN | MOVE_OUT | LINE_IN | LINE_OUT
resultCode: OK | PARTIAL_OK | FAILED
operatorId: string, max 64
teamId: string, max 64
```

端点不接受 `deviceId`、IP、端口、日志正文、Driver 原始响应、信号配置、寄存器、异常正文、凭据、令牌、租约或签名材料。设备继续由 `resolveQtPressContext()` 解析。

成功响应沿用现有 lifecycle（生命周期）结果形状：

```text
correlationId
localJobSessionId
resultCode: OK | IDEMPOTENCY_REPLAY
message
```

### 7.2 服务端处理

端点调用 ERP Service，在认证设备行锁内执行：

1. 校验 operation/result allowlist（操作码/结果允许列表）和字段长度。
2. 对 `operationCode + resultCode + localJobSessionId + operatorId + teamId` 使用现有 canonical 规则计算 SHA-256 `requestFingerprint`；指纹由 ERP 计算，Qt 不提交。
3. 按 `device_id + operation_code + idempotency_key` 查询业务日志：已有记录且指纹相同立即返回 replay，并保留首次执行保存的 actor 快照；指纹不同则固定拒绝且不写日志。
4. 仅首次执行校验当前 actor 主数据并生成快照；同指纹 replay 不因人员或班组后来停用而失败。
5. 请求会话与设备当前 JSON 的 `pressOperationSessionId` 完全一致时，按当前每条非空模具会话扇出，这是唯一允许的待开始关联。
6. 请求会话能按 `press-job-id-*` 或既有 START 幂等记录解析到真实父作业时，只读取该父作业的子作业和模具会话，不读取请求到达时的其他当前作业。
7. 请求会话既不匹配当前预作业、也不能解析到已持久化父作业时，只写一条没有作业关联的设备级日志。
8. 在一个事务中完成整组扇出写入，组内每条日志保存同一 `requestFingerprint`。

设备行锁保证相同设备的并发重试串行化；整组日志在一个事务内提交，因此命中任一同键同指纹记录即可视为整组 replay。延迟的作业 A 请求即使在作业 B 成为当前作业后到达，也只能解析到 A 或成为未归属日志，绝不能扇出到 B。无需新增幂等表或分布式锁。

### 7.3 Qt 执行边界

Qt 前端只在实际执行过的 Driver 命令结束后上报：

- 建立/断开通信、移入/移出：直接使用该次 Driver 响应映射结果。
- 入线/出线：等待 Driver 命令和 ERP `machine-status` 两个 Promise 都 settled（结束），再生成一次整体结果。
- 两侧成功为 `OK`；一侧成功一侧失败为 `PARTIAL_OK`；两侧失败为 `FAILED`。
- `machine-status` 继续写 `qt_press_job_operation` 做状态更新幂等，不再写 `modbus_handle_log`。
- 完工参数失败而清理命令未执行时，不上报 `DISCONNECT`。
- 嵌套流程内已经上报的 Driver 动作，外层聚合诊断回调不得再次上报。

操作日志端点调用失败时不得重放真实 PLC（可编程逻辑控制器）命令。若重试日志请求，必须复用原 `idempotencyKey`；最终仍失败时，界面提示“设备动作已结束，但操作日志记录失败”，同时写脱敏技术诊断。

## 8. 历史详情投影

### 8.1 认证和查询顺序

现有 `GET /api/qt/press-working/history-jobs/{mouldJobId}` 保持 URL 不变：

1. 校验 `X-Correlation-Id`，拒绝客户端设备网络字段。
2. 使用 bootstrap context（启动上下文）解析认证 `deviceId`。
3. 继续通过 `PressMouldJobInfoMapper.selectQtPressJobHistoryDetail(deviceId, mouldJobId)` 验证目标历史行属于当前设备。
4. 目标行有 `mouldOperationSessionId` 时，按 `device_id + mould_operation_session_id` 查询业务日志。
5. 目标行没有会话时，仅按 `device_id + mould_job_id` 查询可靠的新业务日志。
6. 查询结果固定按 `handle_time ASC, id ASC` 排序。

不得使用父作业 ID、模具号或时间范围扩大查询。

### 8.2 业务日志与旧数据降级

返回策略是整组二选一：

- 查询到至少一条可靠 `modbus_handle_log`：只返回这组业务日志。
- 完全没有可靠业务日志：沿用当前 `QtPressJobOperationMapper.selectHistoryByPressJobInfoId`，投影旧 Qt 成功生命周期操作。

禁止把两种来源混合，避免同一开始/完成动作出现两次。未落库预作业日志、没有可靠会话/作业 ID 的旧日志和兄弟模具日志都不进入详情。

### 8.3 Operation View Model（操作视图模型）

`PressJobHistoryOperation` 收窄为以下白名单：

```ts
type PressJobHistoryOperation = {
  operationCode?: string;
  operationTime?: string;
  operationName: string;
  result: "success" | "failed" | "unknown";
  content?: string;
  teamId?: string;
  teamName?: string;
  operatorId?: string;
  operatorName?: string;
};
```

映射规则：

- `handle_result == "true"` → `success`。
- `handle_result == "false"` → `failed`。
- 其他既有值 → `unknown`，页面显示“未记录”，不得猜测成功。
- `handle_by` → `operatorId`；名称使用保存的 `operator_name`，缺失时不关联当前组织表伪造历史。
- 旧 Qt 降级记录的结果固定为 `success`，内容、班组和人员缺失时显示“未记录”。

参数值继续通过现有 JSON 标量白名单解析；不扩大返回字段。

## 9. 历史页面实现

### 9.1 单行筛选和查询按钮

`PressJobHistoryPage` 保留当前 `draftFilters` / `appliedQuery` 两阶段查询快照，只调整布局：

- `.press-job-history-page__filters` 使用 `flex-wrap: nowrap`。
- 每个 `.press-job-history-page__field` 改为标签在左、控件在右，不改变 `<label>` 语义。
- 固定控件合理宽度，1280×720 下不产生页面级滚动条。
- 日期错误提示使用现有可访问文本和错误状态，但不得把其他筛选控件挤到第二行。
- 查询按钮使用已安装的 `SearchOutlined`，同时保留“查询”文字、按钮语义和键盘能力。

### 9.2 日期快捷项

增加纯函数 `createHistoryDatePresets(now: Dayjs)`，返回：

| 标签 | 值 |
| --- | --- |
| 最近一天 | `[today, today]` |
| 最近三天 | `[today - 2 days, today]` |
| 最近一周 | `[today - 6 days, today]` |
| 最近一月 | `[today - 29 days, today]` |

把结果传给现有 Ant Design RangePicker（日期范围选择器）的 `presets`。选择快捷项只更新 `draftFilters`；仍需点击“查询”才更新 `appliedQuery`。`buildHistoryQuery` 继续把结束日转换为下一自然日零点的排他上界，最多 31 个自然日的校验保持不变。

### 9.3 Drawer（抽屉）和参数翻译

- 将历史详情 Drawer 当前 `size="70%"` 改为 `size="80%"`。
- `formatHistoryParameterValue` 只对 `typeof value === "boolean"` 的值返回“是”或“否”。
- 字符串 `"true"` / `"false"`、数字 `1` / `0` 和其他标量继续按原值显示，不进行类型猜测。

### 9.4 整段日志时间线

操作记录继续使用语义化 `<ol>` / `<li>`，复用 `DiagnosticLogsPage` 现有时间线的布局和 Design Token（设计变量），不新增依赖或独立主题：

```text
● 2026-07-25 08:32:10  [成功] 建立通信
  建立通信成功
  班组：压机一班 · 作业人员：张三
```

每条固定展示：

- 完整操作时间；
- 成功、失败或未记录 Tag（标签）；
- 中文操作名称；
- 固定中文内容；
- 班组名称和作业人员名称，缺失时显示“未记录”。

时间线内容允许在详情抽屉内部滚动，但不引入页面级滚动。空记录继续显示明确空状态。

## 10. 代码改动边界

### 10.1 SAM ERP 后端

主要修改文件：

- `yr-admin/src/main/resources/db/liquibase/changelog/smes/`：新增压机操作日志关联迁移。
- `sam-erp/.../domain/ModbusHandleLog.java`：增加业务日志字段。
- `sam-erp/.../mapper/ModbusHandleLogMapper.java` 与 XML：兼容读写、会话回填、精确查询、幂等检查。
- `sam-erp/.../domain/PressJobInfo.java`：增加只随设备当前 JSON 保存的父作业操作会话。
- `sam-erp/.../domain/PressMouldJobInfo.java` 与 Mapper XML：增加模具会话持久化和查询字段。
- `sam-erp/.../service/impl/PressOperationLogWriter.java`：actor 校验、固定映射、成功/失败写入。
- `PressMouldJobInfoServiceImpl`：锁模会话、锁模/解锁日志、跨日会话继承。
- `PressJobInfoServiceImpl`：开始回填、参数/完成日志、Driver 安全上报事务；保留现有幂等记录。
- `IPressJobInfoService` / `IPressMouldJobInfoService`：只扩展实际调用需要的最小参数和方法。
- `QtPressWorkingController`：请求 DTO、`operation-logs` 端点和历史详情业务日志投影。

不修改旧 `ModbusHandleLogController` 的公共契约，不让 Qt 调用旧 `/modbus/handle/log`。

### 10.2 QT App

主要修改文件：

- `qt-app/frontend/src/domain/pressJob.ts`：actor 字段、安全日志请求/响应和历史操作类型。
- `qt-app/frontend/src/services/erpClient.ts`：新增 `/operation-logs` 调用，保持敏感字段递归拒绝检查。
- `qt-app/frontend/src/components/PressJobPage.tsx`：在真实 Driver 执行边界和入线/出线汇总点调用安全日志端点。
- `PressJobHistoryPage.tsx` / `.css`：筛选、日期快捷项、80% 抽屉、Boolean 翻译和时间线。

不新增 npm package（依赖包），不提取新的通用 Design System（设计系统）组件。

## 11. Test Strategy（测试策略）

### 11.1 ERP 自动化测试

在现有测试结构上补充最小、可运行的回归检查：

1. Liquibase migration（迁移）：新列、索引、nullable 兼容及 rollback 声明。
2. `ModbusHandleLogMapper`：新字段读写；会话回填必须同时限制 `device_id`；历史查询按时间和 ID 正序。
3. 锁模：父作业会话稳定且每条模具会话不同；设备 JSON 与日志保存同值；重新读取/应用重启不改变父作业会话；待开始日志允许空 ID 并在开始时回填；加工中追加锁模直接保存真实父/子 ID；重复/失败锁模不写成功日志。
4. 开始加工：真实子作业保存会话；旧锁模日志精确回填；replay 不重复写日志。
5. 参数和完成：按实际子作业扇出；业务回滚时成功日志回滚。
6. 失败路径：actor 和设备通过后使用 `REQUIRES_NEW` 保存固定失败日志；日志失败不覆盖原业务异常。
7. 解锁和跨日：所有分段继承同一模具会话，兄弟模具保持不同会话。
8. Driver 上报：allowlist、设备上下文、首次 actor 校验、actor 后续失效时同指纹 replay、开始前父会话匹配、开始后真实父作业解析、作业切换后的延迟请求隔离、无法证明时未归属、同键同指纹 replay、同键不同指纹拒绝和整组去重。
9. 历史详情：业务日志优先、兄弟模具隔离、时间正序、旧 Qt 整组降级、敏感字段不投影。

优先扩展当前 `PressMouldJobInfoServiceImplQtTest`、`PressMouldJobInfoHistoryMapperContractTest` 和相关 `PressJobInfoServiceImpl` 测试；只有跨类职责无法清晰覆盖时才新增测试类。

### 11.2 QT frontend（前端）自动化测试

- `erpClient.test.ts`：安全日志 URL、header/body、actor 字段、禁止敏感字段；参数/完成/解锁请求新增字段。
- `PressJobPage.test.tsx`：只为真实执行的 Driver 命令写日志；失败也上报；未执行不写；入线/出线只写一次并正确映射 `OK/PARTIAL_OK/FAILED`；日志失败不重放 PLC 命令。
- `PressJobHistoryPage.test.tsx`：单行筛选、搜索图标与文字、1/3/7/30 日期值、提交快照边界、80% Drawer、仅真实 Boolean 翻译、完整时间线和“未记录”。
- 必要时保留现有 `DiagnosticLogsPage.test.tsx` 作为视觉结构回归参考，不修改诊断日志业务行为。

### 11.3 构建与安全验证

- 使用项目约定 Java 8 和 Maven（构建工具）执行 SAM ERP 相关模块测试与编译。
- 执行 QT frontend 定向测试、TypeScript（类型检查）和 production build（生产构建）。
- 运行 `openspec validate enhance-press-job-history-operation-log --strict` 和 `git diff --check`。
- 联合验证只使用安全测试数据或 Mock（模拟）Driver；不向真实 PLC 发送探测或重复动作。
- 完成前由 Reviewer（审查代理）检查事务、幂等、设备隔离、敏感信息和缺失测试。

## 12. 发布与回滚

发布顺序：

1. 先执行全部 nullable 列和索引的 Liquibase 迁移。
2. 发布 ERP Domain、Mapper、日志写入、安全端点和历史投影。
3. 发布 QT actor 请求补充、Driver 结果上报和历史页面调整。
4. 用一条安全测试作业验证锁模至完成/解锁的精确时间线，再验证旧作业降级。

应用回滚时保留新增 nullable 列和索引，旧版本会忽略它们。只有确认没有新版本实例继续写入后，才执行单独数据库 rollback；不得删除或改写已产生的业务日志。

## 13. 风险与控制

| 风险 | 控制 |
| --- | --- |
| 父作业多模具导致日志串线 | 每模具独立会话，写入时扇出，查询时不按父作业广播 |
| 锁模早于子作业主键 | 锁模会话先落设备 JSON，开始事务按相同会话回填 |
| Driver 网络重试产生重复或错误日志 | 认证设备行锁 + `device_id/operation_code/idempotency_key` 检查 + 请求指纹一致性 |
| 作业 A 延迟日志串入作业 B | 服务端父作业会话匹配或 START 映射精确解析；无法证明时只写未归属日志 |
| 成功业务回滚但日志保留 | 成功日志参与调用方事务 |
| 业务失败回滚后没有追溯 | 已验证上下文通过外部 Bean 的 `REQUIRES_NEW` 写固定失败日志 |
| 失败日志掩盖原错误 | 捕获日志异常，只保留脱敏技术摘要，重新抛出原业务异常 |
| 当前组织关系伪造历史 | 写入时保存名称快照，查询不关联当前组织补名称 |
| 旧数据无法可靠归属 | 不猜测、不迁移；完全无业务日志时整组降级 Qt 成功记录 |
| 日志上报失败诱发重复 PLC 动作 | 只重试安全日志请求，绝不重放 Driver 命令 |
| 敏感信息进入业务日志 | 请求和 Writer 双重 allowlist，只保存固定中文摘要与必要 ID |

## 14. Spec Patches

- 已补充父作业 `pressOperationSessionId` 的服务端生成、设备当前 JSON 持久化和 QT 稳定使用场景。
- 已补充 Driver 日志在作业切换后的延迟隔离，以及同幂等键同指纹 replay / 不同指纹拒绝场景。
- 已补充同指纹 replay 先于当前 actor 主数据重新校验并保留首次快照的场景。
- 已补充加工中追加锁模必须直接保存真实父/子作业 ID 的场景。

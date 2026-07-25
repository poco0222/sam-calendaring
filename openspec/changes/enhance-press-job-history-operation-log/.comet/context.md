# Comet Design Handoff

- Change: enhance-press-job-history-operation-log
- Phase: design
- Mode: compact
- Context hash: effe1df3ca6cbaebb71861235231195a5fb6472586e2723cdaf0c858022dc511

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/enhance-press-job-history-operation-log/proposal.md

- Source: openspec/changes/enhance-press-job-history-operation-log/proposal.md
- Lines: 1-32
- SHA256: 36c9814fd6227e140cfb89342cdf6a8c07453428ff5ff0b6e59772fe531d5e4a

```md
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

```

## openspec/changes/enhance-press-job-history-operation-log/design.md

- Source: openspec/changes/enhance-press-job-history-operation-log/design.md
- Lines: 1-109
- SHA256: 007a3fc46a5ee24e290f235bccd3906783c9a25c8b22ba79c5d76184532ba745

[TRUNCATED]

```md
## Context

SAM ERP 已有 `modbus_handle_log` 作为压机 Modbus（工业通信协议）业务操作日志，旧 Vue 通过 `logHandle` 记录建立/断开通信、开始/完成加工、移入/移出和信号写入结果。当前 QT App 没有复用该链路：ERP 的 `qt_press_job_operation` 仅保存幂等与重放信息，Driver Service 的 `audit_log` / `diagnostic_log` 仅保存技术审计与诊断，前端诊断回调默认也不形成可供历史作业查询的 ERP 业务日志。

历史列表一行对应一条 `press_mould_job_info`。首次锁模时父、子作业只存在于 `modbus_device.press_job_info_json` / `press_mould_job_info_json`，尚无数据库主键；开始加工后才插入 `press_job_info` 和各条 `press_mould_job_info`。因此不能用设备、模具号和时间窗口把锁模日志猜测归属到历史作业，也不能继续按父作业 ID 把所有操作无差别展示给同一父作业下的每个模具。

本变更跨 QT App 与 SAM ERP，涉及公共请求契约、既有日志表增量迁移和历史详情投影。必须继续遵守 bootstrap context（启动上下文）设备隔离、`correlationId` 串联、敏感字段白名单及现有 Ant Design（组件库）视觉体系。

## Goals / Non-Goals

**Goals:**

- 以 `modbus_handle_log` 作为唯一压机业务操作日志，不新增平行日志表或复制旧 Vue `logHandle`。
- 将锁模到完成/解锁的日志可靠关联到具体 `mouldJobId`，并保存每次操作的班组与作业人员历史快照。
- 保留 `qt_press_job_operation` 的 Idempotency（幂等）/Replay（重放）职责，保留 Driver Service 技术日志职责。
- 为旧 Qt 历史作业提供不猜测、不伪造的兼容降级。
- 按需求完成历史筛选、快捷日期、Drawer（抽屉）、Boolean（布尔值）和 Timeline（时间线）展示调整。

**Non-Goals:**

- 不迁移、回填或按时间猜测既有 `modbus_handle_log` 的作业归属。
- 不把 Driver 原始信号、异常正文、网络信息或安全材料复制进 ERP 业务日志。
- 不改变旧 ERP 日志管理页面、历史列表分页大小、31 个自然日上限或设备授权模型。
- 不把 `sys_oper_log` 当成压机业务日志；它仍是基于 `@Log` 的通用接口审计。

## Decisions

### 1. 扩展既有 `modbus_handle_log`，不新建业务日志体系

通过 Liquibase（数据库变更管理）为 `modbus_handle_log` 增加以下 nullable（可空）字段：

| 字段 | 用途 |
| --- | --- |
| `press_job_info_id` | 父作业关联，用于父级动作扇出和排查 |
| `mould_job_id` | 历史详情的唯一可靠查询锚点 |
| `mould_operation_session_id` | 锁模早于子作业落库及跨日拆分时的服务端模具生命周期关联键 |
| `correlation_id` | 串联一次外部请求及对应技术日志 |
| `idempotency_key` | 纯 Driver 动作上报复用的稳定去重键 |
| `request_fingerprint` | Driver 日志同幂等键请求内容的 SHA-256 规范指纹 |
| `operation_code` | 稳定英文操作码，不从中文正文反推业务类型 |
| `team_id` / `team_name` | 操作时班组 ID 与名称快照 |
| `operator_name` | 与既有 `handle_by` 操作员 ID 配套的姓名快照 |

同时为 `press_mould_job_info` 增加 nullable 的 `mould_operation_session_id` 及索引，使每条跨日拆分行都能保留同一模具生命周期身份。`modbus_handle_log` 新增 `(mould_job_id, handle_time, id)`、`mould_operation_session_id`、`(press_job_info_id, handle_time, id)`、`correlation_id` 和 `(device_id, operation_code, idempotency_key)` 索引；不增加数据库外键，避免破坏既有可空日志和独立审计生命周期。既有 `handle_type` 保留中文名称，`handle_content` 保留固定中文业务摘要，`handle_result` 统一保存字符串 `true` / `false`，`handle_by` 继续保存操作员 ID。

替代方案是新建 Qt 专用日志表，但会形成第三套日志和重复查询模型；另一方案是只扩展 `qt_press_job_operation`，但会混淆业务追溯与幂等职责。两者均不采用。

### 2. ERP 为每条锁模模具生成稳定会话键，开始加工后精确回填

在 `PressJobInfo` 增加只随设备当前作业 JSON 保存的服务端 `pressOperationSessionId`，在 `PressMouldJobInfo` 增加仅由 ERP 控制并同时映射数据库列的 `mouldOperationSessionId`。第一次锁模时 ERP 生成父作业会话，并为每条选中模具生成独立 UUID；QT 重新读取当前作业后使用父作业会话作为稳定 `localJobSessionId`。待开始锁模日志先携带模具会话，`mould_job_id` 可为空；开始加工插入每条子作业后，ERP 在同一事务内按完全相同的模具会话回填既有日志的 `press_job_info_id` 与 `mould_job_id`，现有 START 幂等记录同时保存父作业会话到真实父作业 ID 的映射，再写开始加工日志。当前父作业已经开始时追加锁模，新模具会立即插入 `press_mould_job_info`，其锁模日志必须在插入后直接携带真实父、子作业 ID 和模具会话，不经过空 ID 回填路径。

父作业级的开始/完工参数、开始/完成加工和可关联的入线/出线动作，在写入时按当前父作业的实际子作业列表扇出为每个 `mould_job_id` 一条日志；同次操作共享 `correlation_id`。跨日完成或加工中解锁生成新历史行时，所有拆分行继承原模具的 `mould_operation_session_id`。历史详情先以认证 `device_id + mould_job_id` 取得目标行，再按该行的模具会话键读取同一模具生命周期日志；不会在查询阶段按父作业扩散给兄弟模具。旧行没有模具会话键时才退回直接 `mould_job_id` 查询或既有 Qt 降级。

现有前端由显示字段派生的待开始 `localJobSessionId` 不能承担该职责，改为优先使用 ERP 返回的 `pressOperationSessionId`；旧数据没有该值时仅保留现有显示身份兼容，但不得用它关联业务日志。按 `deviceId + mouldCode + 时间窗口` 回填也会在重复锁模、多模具和跨日场景误关联，均不采用。

### 3. 每次操作使用服务端校验后的人员/班组快照

QT 的锁模、解锁、开始、参数、完成、入线/出线及纯 Driver 动作日志请求均携带当前 `operatorId` 与 `teamId`；ERP 继续从 bootstrap context 取得设备，不接受 QT 传入 `deviceId`、IP 或端口。ERP 使用现有班组范围、`FmPline` 和部门人员关系校验二者，并从 `FmPline.name` 与 `SysUser.nickName` 生成快照，不能直接信任前端名称。

现有参数、完成和解锁请求缺少部分 actor（操作者）字段，按最小白名单补齐 ID；入线/出线由独立安全适配请求携带 actor，`machine-status` 不重复扩展。所有请求均不增加名称字段。验证失败的未授权 actor 不写业务日志。历史组织关系变化不反向覆盖快照；旧记录缺失班组时继续显示“未记录”。

替代方案是在查询时关联当前组织表，但会把当前班组伪装成历史班组；不采用。

### 4. ERP 原子生命周期动作在业务边界写入，Driver 参与动作复用同一安全写入器

增加一个小型 ERP 内部 `PressOperationLogWriter`，直接使用 `ModbusHandleLogMapper`，避免调用会自动采集 HTTP IP 的旧通用 `insertModbusHandleLog`。写入器只接收已校验的设备、作业关联、稳定操作码、固定中文摘要、结果和 actor 快照，不接收完整请求或原始异常；成功写入加入调用方事务，失败写入由同一独立 Spring Bean（组件）的 `REQUIRES_NEW` 方法提交。

- 锁模、开始加工、开始/完工参数、完成加工和解锁由对应 ERP Service（服务）在业务成功边界写入；成功日志与业务变更处于同一事务，幂等重放不重复写日志。
- 建立/断开通信、移入/移出等纯 Driver 动作不使用聚合诊断回调生成业务日志，而是在每次实际 Driver 命令完成或失败的执行边界调用 QT 安全适配端点。入线/出线在现有 Driver 命令与 ERP 状态请求全部 settled（结束）后，通过同一端点只写一次整体结果：两侧均成功为 `true`，任一侧失败为 `false`；ERP `machine-status` 服务不再重复写业务日志。端点只接受 allowlist（允许列表）的 `operationCode`、结果码、`correlationId`、现有 Driver `idempotencyKey`、`localJobSessionId`、`operatorId` 和 `teamId`；聚合诊断回调继续只写技术诊断。
- 纯 Driver 适配端点在认证设备行锁内处理。完成设备认证和允许列表校验后，端点先对操作码、结果码、本地会话和 actor ID 计算与现有生命周期一致的 canonical SHA-256 fingerprint（规范指纹），再按 `device_id + operation_code + idempotency_key` 查询：同指纹立即返回 replay 并保留首次 actor 快照，不因当前组织关系变化重新校验 actor；不同指纹拒绝且不写日志；只有首次执行才校验 actor。开始加工前，只有请求 `localJobSessionId` 与当前 JSON 的 `pressOperationSessionId` 完全一致时，才按其中每条模具会话扇出；开始加工后，按 `press-job-id-*` 或既有 START 幂等记录把该本地会话解析到唯一真实父作业，再按其子作业和模具会话扇出。旧请求延迟到下一作业后不得按新的当前作业写入；无法证明归属时只写未归属设备日志。
- ERP Service（服务）先完成设备与 actor 校验并构造脱敏失败上下文，再执行可能失败的业务段；捕获后调用写入器的 `REQUIRES_NEW` 方法写一条固定中文失败日志并重新抛出原业务异常。失败日志写入异常只进入脱敏技术日志，不得替换原业务响应。能从模具会话或已存在作业主键解析时才进入历史详情，否则仅作为未归属设备业务日志保留；actor 校验失败不写业务日志。

操作码限定为锁模、建立/断开通信、开始加工、开始/完工参数、移入/移出、入线/出线、完成加工和解锁。Driver 参与动作的结果码只映射为 `handle_result='true'/'false'`，其中 `OK` 为 `true`，`PARTIAL_OK` / `FAILED` 为 `false`；`handle_content` 使用“入线成功 / 入线部分完成 / 入线失败”等固定中文白名单摘要区分总体结果，详细结果继续保留在 Driver 技术日志。参数 JSON、信号配置、寄存器、令牌、租约、签名、IP、端口和第三方异常正文均不得写入。完工参数失败且清理命令未执行时不得生成断开通信日志；嵌套完工流程与随后实际出线/移出不得重复记录同一 Driver 动作。

直接复用旧 `/modbus/handle/log` 端点会接受客户端 `deviceId` 并自动记录请求 IP，不满足当前 QT 信任与敏感信息边界，因此只复用其表、Domain（领域模型）和 Mapper（映射器），新增最薄的 QT 安全适配入口。

### 5. 历史详情优先业务日志，旧作业整组降级

历史详情先以当前认证设备及当前 `mouldJobId` 读取目标历史行，再优先按其 `mouldOperationSessionId` 查询 `modbus_handle_log`，没有会话键时才按当前 `mouldJobId` 查询，结果按 `handle_time ASC, id ASC` 返回。只要存在可靠业务日志，就不混入 `qt_press_job_operation`，避免同一动作重复；完全没有可靠业务日志的旧 Qt 作业，继续使用现有 Qt 幂等记录投影成功的生命周期操作。


```

Full source: openspec/changes/enhance-press-job-history-operation-log/design.md

## openspec/changes/enhance-press-job-history-operation-log/tasks.md

- Source: openspec/changes/enhance-press-job-history-operation-log/tasks.md
- Lines: 1-39
- SHA256: 5b3bb3ae336973ec4d6d624e055205b5452a4523bcca348ae6b563790a1ac263

```md
## 1. ERP 日志数据模型

- [ ] 1.1 为 `modbus_handle_log` 增加可空作业关联、模具会话、操作码、关联 ID、幂等键、请求指纹、班组/人员快照字段及所需索引，并把变更纳入现有 Liquibase 链路
- [ ] 1.2 扩展 `ModbusHandleLog` 与 Mapper（映射器）的兼容读写、按 `deviceId + mouldJobId` 时间正序查询和按模具会话精确回填能力
- [ ] 1.3 为 `PressJobInfo` 增加只随设备当前 JSON 保存的服务端 `pressOperationSessionId`，为 `press_mould_job_info` / `PressMouldJobInfo` 增加 `mouldOperationSessionId`，验证两类会话可稳定读取且模具会话由所有跨日拆分行继承

## 2. ERP 可信操作日志写入

- [ ] 2.1 复用现有班组/人员主数据校验，实现最小 `PressOperationLogWriter`，只接受可信设备、作业关联、允许列表操作码、固定中文摘要、结果和 actor（操作者）快照
- [ ] 2.2 在锁模/解锁事务接入模具会话生成、成功日志和真实 `mouldJobId` 关联，待开始锁模使用会话占位、加工中追加锁模直接写真实父/子作业 ID，并保证未落库预作业不被猜测归属
- [ ] 2.3 在开始加工、开始/完工参数和完成加工事务接入按实际子作业扇出的成功日志，并保证幂等重放不重复写入
- [ ] 2.4 为已通过设备及 actor 校验后发生的 ERP 失败动作通过 `REQUIRES_NEW` 补写脱敏失败日志，并保证日志失败不覆盖原业务错误
- [ ] 2.5 增加 Driver（驱动）参与动作 QT 安全适配端点，在认证设备行锁内校验操作码、结果码、actor、`correlationId` 与现有 `idempotencyKey`，以父作业会话或 START 映射精确解析作业，并以 canonical 请求指纹实现同键同载荷 replay、同键异载荷拒绝

## 3. ERP 历史详情投影

- [ ] 3.1 将历史操作查询改为先认证当前设备与 `mouldJobId`，再优先按目标行的 `mouldOperationSessionId` 读取业务日志，返回时间、操作、结果、内容及班组/人员白名单字段
- [ ] 3.2 在业务日志完全不存在时整组降级到现有 Qt 成功生命周期记录，并确保兄弟模具日志、未归属日志和敏感字段不会进入详情
- [ ] 3.3 为日志迁移、父/模具会话稳定读取、待开始回填、加工中追加锁模真实 ID、跨日继承、首次 actor 校验及 actor 失效后的同指纹 replay、事务回滚/失败补写、纯 Driver 指纹去重和作业切换延迟隔离、精确历史查询及旧作业降级补充 ERP 自动化测试

## 4. QT 操作契约与业务日志上报

- [ ] 4.1 为参数、完成和解锁请求补齐 `operatorId` / `teamId` 白名单字段，让当前作业投影优先使用服务端 `pressOperationSessionId`，为 Driver 参与动作新增最小 actor/幂等上报契约，并同步前后端 DTO（数据传输对象）和契约测试
- [ ] 4.2 在每次真实建立/断开通信、移入/移出 Driver 命令执行边界及入线/出线两侧结果汇总点调用 ERP 安全适配端点，保持聚合诊断回调仅用于技术诊断且不产生未执行或重复业务日志
- [ ] 4.3 验证 QT 上报不包含 `deviceId`、IP、端口、信号配置、原始异常、凭据、令牌、租约或签名材料

## 5. 历史作业界面调整

- [ ] 5.1 将日期、模具号、作业人员和查询按钮改为单行平铺，并在保留“查询”文字与键盘能力的前提下增加现有搜索图标
- [ ] 5.2 为日期范围增加最近 1/3/7/30 个本地自然日快捷项，保持 31 日上限、排他结束上界和 `appliedQuery` 提交边界
- [ ] 5.3 将详情 Drawer（抽屉）宽度调整为 80%，只把 JSON Boolean 原始值翻译为“是/否”
- [ ] 5.4 复用诊断日志视觉把操作记录改为整段日志式 Timeline（时间线），逐条展示时间、操作、结果、内容、班组和作业人员，并处理旧记录“未记录”状态
- [ ] 5.5 更新历史作业组件、类型收窄和样式测试，覆盖固定 1280×720 视口、日期快捷项、Boolean 翻译、80% Drawer、时间线字段和无记录/降级状态

## 6. 联合验证

- [ ] 6.1 运行 SAM ERP 相关模块测试与 Java 8 Maven（构建工具）编译，确认 Liquibase、Mapper 和 Qt 压机端点通过
- [ ] 6.2 运行 QT frontend（前端）的定向测试、TypeScript（类型检查）和生产构建，记录真实命令与结果
- [ ] 6.3 以安全测试数据验证新作业从锁模到完成/解锁的日志精确归属、每条班组/人员展示、纯 Driver 动作写入和旧作业兼容降级，不向真实 PLC（可编程逻辑控制器）发送探测命令

```

## openspec/changes/enhance-press-job-history-operation-log/specs/press-job-history-query/spec.md

- Source: openspec/changes/enhance-press-job-history-operation-log/specs/press-job-history-query/spec.md
- Lines: 1-94
- SHA256: d42f6aabd72de3c452e3e2adf7e9dc3b465b15418211f98346a6407a4f4d1ecd

[TRUNCATED]

```md
## MODIFIED Requirements

### Requirement: 历史作业一级入口与现有视觉体系一致
QT App MUST 在“压机作业”右侧提供第四个一级入口“历史作业”，并 MUST 复用现有 App Shell（应用外壳）、Ant Design（组件库）与 Design Token（设计变量），不得改变“压机作业”既有四行布局。

#### Scenario: 在固定工控机视口打开历史作业
- **WHEN** 操作员在 1280×720 应用视口选择“历史作业”
- **THEN** 系统以单行平铺方式显示日期、模具号、作业人员和带搜索图标的“查询”按钮，并显示占据剩余高度的八列历史表格
- **AND** 筛选标签与控件不得上下堆叠，页面不得产生页面级滚动条
- **AND** 一级导航顺序为“启动仪表盘、诊断日志、压机作业、历史作业”

#### Scenario: 使用查询按钮
- **WHEN** 操作员通过触控、鼠标或键盘聚焦“查询”按钮
- **THEN** 按钮同时显示语义化搜索图标和“查询”文字
- **AND** 图标不得替代按钮的可访问名称或键盘操作能力

#### Scenario: 浅色和深色主题显示历史页面
- **WHEN** 操作员切换现有浅色或深色主题
- **THEN** 历史页面的颜色、圆角、边框和状态反馈继续使用现有主题与 `--qt-app-control-blue*` 变量
- **AND** 系统不引入渐变、玻璃效果、宽阴影或独立主题 Provider（提供器）

### Requirement: 历史列表按已提交筛选条件服务端分页
系统 MUST 默认查询工控机本地当天已完成的模具作业，MUST 支持必填且不可清除的最多 31 个自然日范围、最近一天/最近三天/最近一周/最近一月四个快捷选项、可选模具号和作业人员筛选，并 MUST 以每页 10 条进行服务端分页。

#### Scenario: 首次进入页面
- **WHEN** 操作员首次进入“历史作业”
- **THEN** 前端按工控机本地时区提交当天零点至下一日零点的半开完工时间区间
- **AND** 服务端仅返回当前认证设备、状态为已完成的记录，并按 `end_time DESC, id DESC` 排序

#### Scenario: 选择日期快捷范围
- **WHEN** 操作员选择“最近一天”“最近三天”“最近一周”或“最近一月”
- **THEN** 前端分别设置包含今天在内的最近 1、3、7 或 30 个本地自然日
- **AND** 查询提交时把结束日期转换为下一自然日零点的排他上界，所有快捷范围均不超过 31 个自然日

#### Scenario: 提交新的筛选条件
- **WHEN** 操作员修改日期、模具号或人员并点击“查询”
- **THEN** 系统校验日期非空且不超过 31 个自然日，把 `draftFilters（编辑中筛选）` 复制为 `appliedQuery（已提交查询快照）`
- **AND** 新查询从第 1 页开始且每页固定 10 条

#### Scenario: 修改筛选但未查询时翻页
- **WHEN** 操作员修改筛选控件但未点击“查询”，随后切换页码
- **THEN** 系统继续使用最近一次 `appliedQuery`，不得隐式提交当前编辑值

#### Scenario: 日期范围无效
- **WHEN** 日期为空或超过 31 个自然日
- **THEN** 系统禁用查询并显示中文校验提示
- **AND** 前端不得发起无界历史请求

### Requirement: 详情抽屉提供脱敏追溯信息
系统 MUST 在选择历史记录后从右侧打开占应用视口 80% 宽度的标准 Drawer（抽屉），展示四列两行概要、开始/完工参数对照和可可靠关联的操作记录。

#### Scenario: 通过触控或键盘打开详情
- **WHEN** 操作员点击、触控或在聚焦行按 `Enter` 或 `Space`
- **THEN** 系统按稳定 `mouldJobId` 加载详情并打开默认 `body` Portal（传送挂载点）和标准遮罩的 80% 宽 Drawer
- **AND** 遮罩存在期间底层导航和列表不可交互

#### Scenario: 关闭详情
- **WHEN** 操作员使用关闭按钮或 `Escape` 关闭 Drawer
- **THEN** 系统保持列表、页码和筛选状态不变
- **AND** 焦点返回原触发行，挂起的旧详情响应不得重新打开或写入详情

#### Scenario: 展示概要和班组人员
- **WHEN** 详情数据加载成功
- **THEN** 概要按四列两行展示压机、模具号、状态、时长、班组/人员、工艺、开始时间和完成时间
- **AND** 新业务日志存在可靠快照时显示对应班组与人员，旧记录缺失班组时显示“未记录 / {作业人员}”

### Requirement: 参数和操作记录只展示可靠白名单数据
系统 MUST 对开始参数和完工参数按参数名称对齐，MUST 保留仅一侧存在的有效值，MUST 把 JSON Boolean（布尔值）显示为中文“是/否”，并 MUST 以整段日志式 Timeline（时间线）展示可按模具作业身份可靠关联的业务操作记录。

#### Scenario: 一侧参数缺失或损坏
- **WHEN** 开始或完工参数仅一侧存在，或者一侧 JSON 记录损坏
- **THEN** 系统继续展示另一侧有效记录，缺失值显示“未记录”，损坏侧显示中文格式异常状态
- **AND** 详情其他区域保持可用

#### Scenario: 参数值为 Boolean
- **WHEN** 开始或完工参数值是 JSON Boolean 原始值 `true` 或 `false`
- **THEN** 前端分别显示“是”或“否”
- **AND** 字符串、数字和其他类型保持原有白名单格式，不得猜测转换为布尔值

#### Scenario: 展示业务操作时间线

```

Full source: openspec/changes/enhance-press-job-history-operation-log/specs/press-job-history-query/spec.md

## openspec/changes/enhance-press-job-history-operation-log/specs/press-job-operation-log/spec.md

- Source: openspec/changes/enhance-press-job-history-operation-log/specs/press-job-operation-log/spec.md
- Lines: 1-138
- SHA256: 60c62ae1d4445b1eecf1bc77bc3c4acda59142ac3464fcb4ba1ea3d2775c92b0

[TRUNCATED]

```md
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

```

Full source: openspec/changes/enhance-press-job-history-operation-log/specs/press-job-operation-log/spec.md

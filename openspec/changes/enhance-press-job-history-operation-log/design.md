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

未落库便解锁的预作业、无法可靠回填的旧日志和只有设备/时间相近的记录不显示在任何历史作业详情。既有全局 Modbus 日志页面仍可按原方式查看这些记录。

### 6. 历史页面只做现有组件能力内的布局调整

筛选区保持 Ant Design Form（表单）与 RangePicker（范围选择器），使用单行 flex（弹性布局）平铺；查询按钮在文字前增加现有 `SearchOutlined`。RangePicker 使用已安装日期库提供最近 1/3/7/30 个本地自然日预设，结束日期仍转换为下一自然日的排他上界。Drawer 宽度调整为 `80%`。

参数表只把 JSON Boolean 原始值 `true` / `false` 显示为“是”/“否”，不把字符串或数字猜成布尔值。操作区复用现有诊断日志页面的整段日志式时间线视觉，不新增 Timeline 依赖；每条固定展示时间、操作名称、成功/失败、内容、班组和作业人员。

## Risks / Trade-offs

- [同一父作业包含多个模具，父级动作会产生多条日志] → 以每模具独立会话精确查询换取可解释性；同次动作用相同 `correlation_id` 便于排查。
- [跨日拆分的多个历史行共享一条模具生命周期时间线] → 每个拆分行持久化同一 `mould_operation_session_id`，既避免复制日志，也不会混入兄弟模具。
- [业务部署后、前端部署前请求缺少新增 actor 字段] → 后端将新增字段作为必填契约并采用同批发布；数据库迁移先行，旧 Vue 端点不受影响。
- [失败动作可能发生在可靠作业身份形成之前] → 只保留未归属设备日志，不按时间回填，不伪造历史关联。
- [旧作业只能显示成功的 Qt 生命周期降级记录] → 明确标记兼容来源；未来数据只依赖新的业务日志，不迁移猜测旧数据。
- [旧通用日志入口仍会写 IP] → 本变更不扩大其使用范围；QT 路径绕过该入口并保持现有旧页面兼容。

## Migration Plan

1. 先部署 Liquibase 增量列与索引，包括日志表字段及模具作业的持久会话键；所有列可空，旧读写不受影响。
2. 部署 ERP Domain、Mapper、可信 actor 校验、业务日志写入、QT 安全适配端点及历史详情查询。
3. 部署 QT 请求白名单补充、纯 Driver 结果上报和历史页面展示调整。
4. 以一条新锁模到完成/解锁流程验证日志按 `mould_job_id` 精确归属，再验证一条旧作业仍走 Qt 幂等降级。

回滚应用时保留新增可空列和索引，旧版本会忽略它们；无需删除或改写日志数据。若必须回滚数据库，先确认无新应用实例写入，再单独移除索引与列。

## Open Questions

无。范围、信任边界、旧数据兼容和 UI 行为均已明确。

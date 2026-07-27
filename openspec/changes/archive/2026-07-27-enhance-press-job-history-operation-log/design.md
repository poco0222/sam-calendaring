> Editor: PopoY
> Edited: 2026-07-27 10:49:02

## Context

SAM ERP 已有 `modbus_handle_log` 业务操作日志和 Qt `START` 记录到 `press_job_info_id` 的关联。当前 QT App 在真实操作结束后没有统一写入这张表，历史详情只能降级投影 `qt_press_job_operation`，无法展示失败结果、固定内容和班组。

本设计采用已批准的 simple approach（简单方案）：只复用现有表、现有 Qt 作业关联和现有主数据，不建立第二套业务关系校验。方案仍须用户完成书面规格复核，确认前不得生成新实施计划或开始开发。

## Goals / Non-Goals

**Goals:**

- 每次真实操作结果确定后，QT 按业务结果异步记录一条不影响主流程的操作日志。
- 历史详情按认证设备和父作业展示新日志，并保留旧作业降级行为。
- 展示时间、操作、结果、内容、班组和作业人员，同时遵守敏感信息边界。
- 只有通过认证 QT 专用服务端路径解析的父作业 ID 才能进入历史时间线。
- 用最少字段、最薄端点和现有 UI（用户界面）体系完成需求。

**Non-Goals:**

- 不建立新的模具或会话身份模型，不增加新的请求指纹、幂等、锁或事务传播机制。
- 不扩展到锁模、解锁、连接、断开、移入或移出。
- 不做失败日志回填、名称快照、旧数据迁移或设备加时间窗口猜测。
- 不新增日志表、`mould_job_id`、日志表 `correlation_id` 列、依赖、主题或队列。
- 不新增 provenance（来源）字段、权限体系或 Writer（写入器）抽象。

## Decisions

### 1. 只对 `modbus_handle_log` 做两列一索引扩展

Liquibase（数据库迁移）只增加：

| 项目 | 定义 | 用途 |
| --- | --- | --- |
| `press_job_info_id` | nullable | 关联现有父作业；为空时为 device-only log |
| `team_id` | nullable | 查询时关联现有班组主数据 |
| 查询索引 | `(device_id, press_job_info_id, handle_time, id)` | 历史详情按设备、父作业和时间正序读取 |

既有字段保持原义：`handle_type` 保存固定中文操作名称，`handle_content` 保存固定中文内容，`handle_result` 按旧 `logHandle` 语义保存字符串 `true` / `false`，`handle_by` 保存 `operatorId`，`handle_time` 保存记录时间。班组和作业人员姓名不保存快照，查询时分别关联现有班组与用户主数据；无法关联时返回空值，由前端显示“未记录”。

### 2. 新端点只做固定映射和现有关联

新增 QT operation-log endpoint（操作日志端点），请求正文只允许：

| 字段 | 约束 |
| --- | --- |
| `correlationId` | 只用于请求诊断串联，不写入业务日志表 |
| `localJobSessionId` | 只用于复用 `press-job-id-*` 直连或现有 Qt `START` 会话映射 |
| `operationCode` | 仅允许六个固定值 |
| `result` | 仅允许 JSON Boolean `true` / `false` |
| `teamId` | 写入 `team_id` |
| `operatorId` | 写入 `handle_by` |

端点不得接收 `deviceId`、IP、port（端口）、原始参数、信号配置、异常正文、凭据、令牌、租约或签名。ERP 从认证上下文取得 `deviceId` 与 `granteeHostId`，再复用 `localJobSessionId` 的两条现有路径解析 `pressJobInfoId`：`press-job-id-*` 直接取得父作业 ID，其他值按认证设备下的 Qt `START` 记录查找。两条路径都只确认父作业属于认证设备和授权主机，不要求作业仍为进行中或仍存在于设备当前作业缓存，因此 `COMPLETE` 成功后的日志仍能关联已完成父作业。这只是复用现有关联，不新增会话模型、请求去重或人员班组关系校验。

未知请求字段不得在 Jackson（JSON 反序列化）阶段抛出包含字段名或字段值的异常。DTO（数据传输对象）只记录一个内部 unknown-field flag（未知字段标记），Controller（控制器）在调用认证解析和 Service（服务）前返回固定中文业务错误；不得把字段名、字段值、DTO 类型或第三方异常栈写入常规日志或响应。

无法解析父作业，或操作发生在可解析的 `START` 之前时，记录仍可按认证设备保存，但 `press_job_info_id = null`。这类记录不进入历史详情，后续不回填，也不按设备与时间窗口猜测归属。

### 3. 服务端映射固定中文日志

客户端不得提交操作名称或内容。服务端使用以下唯一映射：

| `operationCode` | `handle_type` | `result=true` 的 `handle_content` | `result=false` 的 `handle_content` |
| --- | --- | --- | --- |
| `START` | 开始加工 | 开始加工成功 | 开始加工失败 |
| `PARAMETER_START` | 开始参数记录 | 开始参数记录成功 | 开始参数记录失败 |
| `PARAMETER_END` | 完工参数记录 | 完工参数记录成功 | 完工参数记录失败 |
| `LINE_IN` | 入线 | 入线成功 | 入线失败 |
| `LINE_OUT` | 出线 | 出线成功 | 出线失败 |
| `COMPLETE` | 完成加工 | 完成加工成功 | 完成加工失败 |

端点只执行现有关联解析和单条日志写入，不引入额外 Writer（写入器）抽象。写入失败返回端点自身错误，由 QT 负责隔离。

### 3.1 父作业关联只允许服务端可信路径建立

既有通用 `POST /modbus/handleLog` 继续保存普通设备日志，但它是接收外部 Domain JSON（领域对象 JSON）的非可信入口。该 Controller 在调用现有 Service 前必须忽略客户端提交的 `pressJobInfoId`，使其不能建立父作业关联。QT 专用服务不经过该通用入口，而是在认证设备、授权主机和 `localJobSessionId` 校验后直接构造并写入关联，因此不受此限制。

该收紧只修改通用 HTTP 入口的输入边界；不改变 Domain、Mapper（映射器）或通用 Service 的 Java contract（Java 契约），不清理其他字段，也不增加来源列、权限模型或新抽象。

### 4. QT 在主操作之后 best-effort 异步上报

QT 在上述六类真实操作结果确定后异步上报。`START`、`PARAMETER_START`、`PARAMETER_END`、`COMPLETE` 在各自 ERP 调用边界判断，`OK` / `IDEMPOTENCY_REPLAY` 上报 `result=true`，其他返回码或抛错上报 `result=false`；`LINE_IN`、`LINE_OUT` 在 Driver 与 ERP 两侧汇总后判断，只有整体 `OK` 上报 `true`，`PARTIAL_OK` / `FAILED` 即使以正常返回值结束也上报 `false`。日志上报不等待响应，不改变原成功返回、状态结果或异常。

日志请求失败时只通过现有脱敏诊断能力记录 `correlationId`、操作码和固定中文摘要；不得记录请求原文或异常正文。不给日志上报增加队列、重试、补偿或失败回填。

### 5. 历史详情按父作业查询并整组降级

历史详情现有入口先由 `mouldJobId` 取得目标历史行及其父 `pressJobInfoId`。ERP 再按认证 `deviceId + pressJobInfoId` 查询 `modbus_handle_log`，排序为 `handle_time ASC, id ASC`。

只要查询到一条由可信服务端路径建立父作业关联的新日志，详情就展示这组新日志，不混入 `qt_press_job_operation`。通用日志入口提交的 `pressJobInfoId` 被忽略，不能制造新时间线或阻断降级。完全没有可信新日志的旧作业继续整组降级到现有 Qt 成功生命周期投影。兄弟模具共享同一父作业时间线，这是当前历史语义；不增加模具级日志关联。

每条响应只包含展示所需的时间、操作、结果、内容、班组和作业人员。名称通过现有主数据关联，任一缺失字段由前端显示“未记录”。

### 6. UI 只复用现有能力

- 筛选项单行平铺。
- 查询按钮使用既有 `SearchOutlined`，同时保留“查询”文字和键盘能力。
- 日期预设为包含今天的最近 1、3、7、30 个本地自然日，继续遵守 31 日上限和排他结束时间。
- Drawer 宽度为 80%。
- 仅 JSON Boolean 原始值 `true` / `false` 显示为“是/否”，字符串和数字不猜测转换。
- 操作记录复用诊断日志 Timeline CSS（时间线样式），每条展示时间、操作、结果、内容、班组和作业人员。
- 不新增依赖、主题或视觉体系。

## Risks / Trade-offs

- best-effort 上报不能保证每条日志必达，但能确保日志系统不阻塞真实操作；本方案明确不增加可靠消息机制。
- 名称查询反映现有主数据而非历史快照；主数据缺失时明确显示“未记录”。
- `START` 失败等无法解析父作业的日志只保留为设备级记录，不进入历史详情，避免错误归属。
- 父作业时间线会被同一父作业下兄弟模具共同看到，保持现有查询语义并避免新增模具关系。
- 通用日志入口仍接受既有 Domain JSON，但只忽略 `pressJobInfoId`；这是最窄兼容性收紧，其他遗留字段权限不在本次范围。

## Plan Gate

原最小 Implementation Plan（实施计划）已经批准并执行到 Task 2。Task 2 审查发现上述两个 Trust Boundary（信任边界）问题，用户已批准方案 A 的最小范围扩展；在本次书面增量规格复核完成前，不得修改 Task 2 生产代码。复核确认后只更新 Task 2 计划文件范围和测试步骤，再进入修复轮次 1/2。

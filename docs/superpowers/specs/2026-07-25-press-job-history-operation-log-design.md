---
comet_change: enhance-press-job-history-operation-log
role: technical-design
canonical_spec: openspec
---

# 压机历史作业操作日志最小技术设计

- Author: PopoY
- Created: 2026-07-25 10:23:37
- Editor: PopoY
- Edited: 2026-07-27 13:56:54
- Change: `enhance-press-job-history-operation-log`
- Canonical requirements: `openspec/changes/enhance-press-job-history-operation-log/specs/`

## 1. 状态与结论

本文件记录用户已批准的 simple approach（简单方案）：参考 `sam-erp-fe` 原有 `logHandle`，在每次真实操作结果确定后按业务结果异步写一条 `modbus_handle_log`。日志失败不得影响主操作，不为日志建立第二套业务关系校验。

原书面规格和最小 Implementation Plan（实施计划）已确认并执行到 Task 2。Task 2 审查发现两个 Trust Boundary（信任边界）问题；用户已批准方案 A 的最小范围扩展。本增量设计复核确认前，暂停 Task 2 生产代码修复。

## 2. 最小职责

| 组件 | 本次职责 |
| --- | --- |
| `modbus_handle_log` | 保存操作时间、固定中文操作名称/内容、成功/失败、班组 ID、作业人员 ID 和父作业 ID |
| Qt operation-log endpoint（操作日志端点） | 从认证上下文取得设备，复用 `press-job-id-*` 直连或现有 Qt `START` 会话映射，映射固定中文日志并写一条记录 |
| 通用 `/modbus/handleLog` | 继续保存普通设备日志，但忽略客户端提交的 `pressJobInfoId`，不得建立父作业关联 |
| QT App（Qt 应用） | 在真实操作结果确定后 best-effort（尽力而为）异步上报，不改变主结果 |
| 历史详情 | 按认证设备和父作业读取新日志；没有新日志时整组降级现有 Qt 生命周期记录 |
| 现有主数据 | 查询时解析班组和作业人员名称，不保存名称快照 |

Driver Service（驱动服务）的 `audit_log` / `diagnostic_log` 继续只承担技术审计与诊断，不作为历史详情业务数据源。

## 3. 数据设计

### 3.1 唯一数据库扩展

对 `modbus_handle_log` 只增加：

```text
press_job_info_id  nullable
team_id            nullable
index (device_id, press_job_info_id, handle_time, id)
```

不新增表或外键。索引同时满足设备隔离、父作业查询和 `handle_time ASC, id ASC` 稳定排序。

### 3.2 既有字段复用

| 业务值 | 既有字段 |
| --- | --- |
| 固定中文操作名称 | `handle_type` |
| 固定中文操作内容 | `handle_content` |
| 成功/失败（字符串 `true` / `false`） | `handle_result` |
| 作业人员 ID | `handle_by` |
| 记录时间 | `handle_time` |
| 设备 | 既有 `device_id` |

`team_id` 和 `handle_by` 在历史查询时分别关联现有班组与用户主数据。名称不写入日志表；关联不存在时前端显示“未记录”。因此历史展示反映当前可查主数据，不承诺历史名称快照。

## 4. 最薄日志端点

### 4.1 请求白名单

请求正文只能包含：

```json
{
  "correlationId": "...",
  "localJobSessionId": "...",
  "operationCode": "START",
  "result": true,
  "teamId": "...",
  "operatorId": "..."
}
```

- `result` 只允许 JSON Boolean `true` / `false`。
- `correlationId` 只用于现有技术诊断串联，不新增日志表列。
- `teamId` 写入 `team_id`；`operatorId` 写入 `handle_by`。
- 请求不得包含 `deviceId`、IP、port（端口）、原始参数、信号配置、异常正文、credential（凭据）、token（令牌）、lease（租约）或 signature（签名）。
- 未知字段由 DTO（数据传输对象）只记录一个不含名称和值的内部标记；Controller（控制器）在认证解析和 Service（服务）调用前返回固定中文业务错误，不在 Jackson（JSON 反序列化）阶段抛出异常。

### 4.2 服务端关联

ERP 从认证上下文取得 `deviceId` 与 `granteeHostId`，再复用现有 `localJobSessionId` 的两条路径解析既有 `pressJobInfoId`：`press-job-id-*` 直接取得父作业 ID，其他值按认证设备下的 Qt `START` 记录查询。两条路径都只确认父作业属于认证设备与授权主机，不要求作业仍在进行中或仍存在于设备当前作业缓存，因此完成加工后的日志仍能关联父作业。这是已有业务关联的只读复用，不增加会话模型、请求去重或人员班组关系验证。

解析成功时写入 `press_job_info_id`。解析失败或操作发生在可解析 `START` 之前时，仍可按认证设备写一条 `press_job_info_id = null` 的 device-only log（仅设备日志）。未关联日志不进入历史详情，后续不回填，也不按设备与时间窗口猜测。

只有上述 QT 专用服务端路径可以建立父作业关联。既有通用 `POST /modbus/handleLog` 直接接收 Domain JSON（领域对象 JSON），因此其 Controller 必须在调用现有 Service 前单行清空客户端提交的 `pressJobInfoId`。QT 专用服务通过认证上下文解析并直接调用 Mapper（映射器），不经过通用入口，现有可信写入不受影响。

防护只放在该 HTTP Trust Boundary（HTTP 信任边界）。不在通用 Service 清空字段，避免扩大 Java 调用契约；不新增 provenance（来源）列、权限模型、Writer（写入器）或 helper（辅助抽象）。

### 4.3 固定操作映射

| `operationCode` | `handle_type` | 成功内容 | 失败内容 |
| --- | --- | --- | --- |
| `START` | 开始加工 | 开始加工成功 | 开始加工失败 |
| `PARAMETER_START` | 开始参数记录 | 开始参数记录成功 | 开始参数记录失败 |
| `PARAMETER_END` | 完工参数记录 | 完工参数记录成功 | 完工参数记录失败 |
| `LINE_IN` | 入线 | 入线成功 | 入线失败 |
| `LINE_OUT` | 出线 | 出线成功 | 出线失败 |
| `COMPLETE` | 完成加工 | 完成加工成功 | 完成加工失败 |

客户端不提交操作名称或内容。端点拒绝其他操作码和非 Boolean 结果，完成现有关联解析后只写一条日志。

## 5. QT post-action（操作后）上报

每个允许操作沿用同一最小模式；入线/出线按整体状态判断，而不是按 Promise（异步结果）是否 fulfilled（已兑现）判断：

```text
执行真实操作
  ├─ START/PARAMETER/COMPLETE 的 ERP 返回 OK/IDEMPOTENCY_REPLAY：上报 true
  ├─ START/PARAMETER/COMPLETE 的 ERP 返回其他码或抛错：上报 false
  ├─ LINE_IN/LINE_OUT 两侧汇总为 OK：异步上报 result=true
  └─ LINE_IN/LINE_OUT 返回 PARTIAL_OK/FAILED 或抛错：异步上报 result=false
                         ↓
                 日志失败只写脱敏诊断
```

上报发生在真实操作结果已经确定之后。QT 不等待日志响应，不改变原成功结果、状态结果或异常；请求失败只记录 `correlationId`、操作码和固定中文摘要，不记录请求原文或异常正文。

本方案不提供队列、重试、补偿或失败回填。best-effort 的已知边界是断网、超时或进程退出可能丢失日志；这是避免日志反向阻塞设备真实操作的明确取舍。

## 6. 历史详情投影

1. 现有详情入口按认证 `deviceId + mouldJobId` 取得目标模具历史行。
2. 从该行取得父 `pressJobInfoId`。
3. 按认证 `deviceId + pressJobInfoId` 查询 `modbus_handle_log`，使用新增索引并按 `handle_time ASC, id ASC` 排序。
4. 查询到任一由可信 QT 服务端路径建立父作业关联的新日志时，只返回这组新日志。
5. 通用日志入口提交的 `pressJobInfoId` 被忽略，不能制造新时间线或阻断降级。
6. 完全没有可信新日志时，整组降级到现有 `qt_press_job_operation` 生命周期投影。

同一父作业下兄弟模具共享父作业时间线，保持当前历史语义。`press_job_info_id = null` 的设备级日志不会进入详情。

每条投影只返回：时间、操作、结果、内容、班组和作业人员。班组、人员或旧降级字段缺失时，前端统一显示“未记录”。

## 7. UI 调整

- 日期、模具号、作业人员和查询按钮单行平铺。
- 查询按钮复用 `SearchOutlined`，同时保留“查询”文字、键盘能力和可访问名称。
- 日期预设提供包含今天的最近 1、3、7、30 个本地自然日，提交时继续使用下一日零点排他上界和 31 日上限。
- Drawer（抽屉）宽度为 80%。
- 参数值只有 JSON Boolean 原始值 `true` / `false` 翻译为“是/否”；字符串、数字和其他类型不猜测转换。
- 操作记录复用诊断日志 Timeline CSS（时间线样式），逐条展示时间、操作、结果、内容、班组和作业人员。
- 不增加依赖、主题、渐变、玻璃效果或独立视觉体系。

## 8. 明确不做

- 不建立 mould/session 新模型：不使用 `pressOperationSessionId`、`mouldOperationSessionId`；不建立 request fingerprint 或新幂等：不使用 `requestFingerprint`；不增加 `REQUIRES_NEW`、`PressOperationLogWriter` 或其他 Writer（写入器）类。
- 不记录锁模、解锁、连接、断开、移入、移出；不做失败回填。
- 不保存班组或人员名称快照，不增加 `mould_job_id` 或日志表 `correlation_id` 列。
- 不迁移旧数据，不按设备与时间窗口猜测，不改变现有 Qt 生命周期幂等记录。
- 不增加 actor-team（人员班组）第二套关系校验、队列、重试、补偿、锁、依赖或新主题。
- 不新增来源字段、权限体系或通用 Writer；不修改 Domain、Mapper 或通用 Service 的 Java contract。

## 9. 实施前复核清单

- 数据库变更是否严格为两列一索引。
- 请求是否严格为六字段，且操作码严格为六个。
- 未知字段是否只触发 Controller 固定中文业务错误，且不会记录字段名、字段值或 Jackson/Spring 异常栈。
- 通用 `/modbus/handleLog` 是否在 Controller 边界清空 `pressJobInfoId`，同时不影响 QT 专用服务端关联。
- 是否只复用认证设备、`press-job-id-*` 直连与现有 Qt `START` 会话映射，并允许完成后的父作业关联。
- START/参数/COMPLETE 是否在各自 ERP 调用边界判断，入线/出线是否在两侧汇总后把 `PARTIAL_OK` / `FAILED` 记为失败。
- QT 是否只在真实操作结果确定后异步上报，且日志失败不影响主操作。
- 历史详情是否按父作业共享时间线，并在完全没有新日志时整组降级。
- UI 是否只做现有组件和样式内的指定调整。

原边界已确认并据此生成 Implementation Plan；本次增量边界经书面复核后，只补充 Task 2 的文件范围与测试步骤，实施期间不得突破本清单。

## 10. 归档语义校正

本次仅按 OpenSpec delta semantics（增量语义）把 `MODIFIED Requirements` 补全为归档后的完整需求与既有场景，并把全新父作业操作日志需求归入 `ADDED Requirements`；不改变已批准设计、实现或业务行为。

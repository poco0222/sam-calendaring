---
comet_change: enhance-press-job-history-operation-log
role: technical-design
canonical_spec: openspec
---

# 压机历史作业操作日志最小技术设计

- Author: PopoY
- Created: 2026-07-25 10:23:37
- Editor: PopoY
- Edited: 2026-07-27 08:32:28
- Change: `enhance-press-job-history-operation-log`
- Canonical requirements: `openspec/changes/enhance-press-job-history-operation-log/specs/`

## 1. 状态与结论

本文件记录用户已批准的 simple approach（简单方案）：参考 `sam-erp-fe` 原有 `logHandle`，在每次真实操作成功返回或抛错后异步写一条 `modbus_handle_log`。日志失败不得影响主操作，不为日志建立第二套业务关系校验。

该方案仍处于书面规格复核阶段。旧 Implementation Plan（实施计划）已废弃；用户书面确认前，不生成新计划、不恢复旧任务、不开始开发。

## 2. 最小职责

| 组件 | 本次职责 |
| --- | --- |
| `modbus_handle_log` | 保存操作时间、固定中文操作名称/内容、成功/失败、班组 ID、作业人员 ID和父作业 ID |
| Qt operation-log endpoint（操作日志端点） | 从认证上下文取得设备，复用现有 Qt `START` 关联，映射固定中文日志并写一条记录 |
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

### 4.2 服务端关联

ERP 从认证上下文取得 `deviceId`，使用现有 Qt `START` 记录与 `localJobSessionId` 解析既有 `pressJobInfoId`。这是已有业务关联的只读复用，不增加会话归属、请求去重或人员班组关系验证。

解析成功时写入 `press_job_info_id`。解析失败或操作发生在可解析 `START` 之前时，仍可按认证设备写一条 `press_job_info_id = null` 的 device-only log（仅设备日志）。未关联日志不进入历史详情，后续不回填，也不按设备与时间窗口猜测。

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

每个允许操作沿用同一最小模式：

```text
执行真实操作
  ├─ 成功返回：保持原返回，并异步上报 result=true
  └─ 抛出错误：保持原错误，并异步上报 result=false
                         ↓
                 日志失败只写脱敏诊断
```

上报发生在真实操作结果已经确定之后。QT 不等待日志响应，不改变原成功结果或原异常；请求失败只记录 `correlationId`、操作码和固定中文摘要，不记录请求原文或异常正文。

本方案不提供队列、重试、补偿或失败回填。best-effort 的已知边界是断网、超时或进程退出可能丢失日志；这是避免日志反向阻塞设备真实操作的明确取舍。

## 6. 历史详情投影

1. 现有详情入口按认证 `deviceId + mouldJobId` 取得目标模具历史行。
2. 从该行取得父 `pressJobInfoId`。
3. 按认证 `deviceId + pressJobInfoId` 查询 `modbus_handle_log`，使用新增索引并按 `handle_time ASC, id ASC` 排序。
4. 查询到任一新日志时，只返回这组新日志。
5. 完全没有新日志时，整组降级到现有 `qt_press_job_operation` 生命周期投影。

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

## 9. 书面复核清单

- 数据库变更是否严格为两列一索引。
- 请求是否严格为六字段，且操作码严格为六个。
- 是否只复用认证设备与现有 Qt `START` 作业关联。
- QT 是否只在真实操作返回或抛错后异步上报，且日志失败不影响主操作。
- 历史详情是否按父作业共享时间线，并在完全没有新日志时整组降级。
- UI 是否只做现有组件和样式内的指定调整。

全部确认后，才能依据本设计重新生成 Implementation Plan。

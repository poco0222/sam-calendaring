## Context

当前 QT App（Qt 应用）通过 `/api/qt/press-working/operation-logs` 向 ERP 的 `modbus_handle_log` 写入六类操作日志。请求只携带六个白名单字段，ERP 从认证上下文取得设备和授权主机，再用 `localJobSessionId` 解析可选的 `press_job_info_id`。历史详情只读取已关联父作业的新日志；无法关联的记录作为 device-only log（仅设备日志）保存。

锁模阶段已经构造完整的待开始 `PressJobInfo(status=0)` 和 `PressMouldJobInfo(status=0)`，但当前实现只把它们序列化到 `modbus_device` JSON，数据库 ID 仍为空；直到 `START` 才插入父、子记录。当前代码又以 `pressJobInfo != null` 判断“加工中”，导致待开始阶段第二次锁模可能生成 `status=1` 且父 ID 为空的子记录，随后被 `START` 校验拒绝。

本变更采用最小根因修复：首次锁模成功时持久化已经存在的待开始实体，后续所有动作直接复用同一 `press_job_info_id`。不引入第二套 session（会话）、日志关联字段、回填任务或数据库迁移。

## Goals / Non-Goals

**Goals:**

- 记录锁定模具、解锁模具、建立通信、移入、移出、开始加工、完成加工、入线、出线九类真实业务动作，并保留开始/完工参数两类日志。
- 只记录已经发起真实外部操作后的成功或失败，不记录面板、普通按钮、本地前置校验或取消。
- 成功锁模必须拥有并关联真实 `press_job_info_id`；`START` 延续同一父、子记录。
- 有可信父作业时建立关联；没有时保存设备级日志，不猜测归属。
- 日志失败不改变锁模、解锁、Driver command（驱动命令）或 ERP 主操作结果，并继续遵守敏感信息和 lifecycle logging（生命周期日志）边界。

**Non-Goals:**

- 不新增日志表、字段、索引、自由文本、队列、重试、补偿、旧数据批量迁移、来源权限体系或通用日志框架。
- 不新增 mould operation session（模具操作会话），不在 `START` 回填历史日志。
- 不按设备、模具号、操作员或时间窗口推测父作业，不把无父作业的设备日志强行展示到某次历史作业。
- 不修改 Driver Service（驱动服务）协议、信号配置、设备身份来源或 QT 页面视觉体系。

## Decisions

### 1. 固定十一类操作码，按动作所有权选择可信入口

| `operationCode` | `handle_type` | 成功内容 | 失败内容 | 记录入口 |
| --- | --- | --- | --- | --- |
| `LOCK_MOLD` | 锁定模具 | 锁定模具成功 | 锁定模具失败 | ERP 锁模端点 |
| `UNLOCK_MOLD` | 解锁模具 | 解锁模具成功 | 解锁模具失败 | ERP 解锁端点 |
| `CONNECT` | 建立通信 | 建立通信成功 | 建立通信失败 | QT operation-log endpoint |
| `MOVE_IN` | 移入 | 移入成功 | 移入失败 | QT operation-log endpoint |
| `MOVE_OUT` | 移出 | 移出成功 | 移出失败 | QT operation-log endpoint |
| `START` | 开始加工 | 开始加工成功 | 开始加工失败 | QT operation-log endpoint |
| `PARAMETER_START` | 开始参数记录 | 开始参数记录成功 | 开始参数记录失败 | QT operation-log endpoint |
| `PARAMETER_END` | 完工参数记录 | 完工参数记录成功 | 完工参数记录失败 | QT operation-log endpoint |
| `LINE_IN` | 入线 | 入线成功 | 入线失败 | QT operation-log endpoint |
| `LINE_OUT` | 出线 | 出线成功 | 出线失败 | QT operation-log endpoint |
| `COMPLETE` | 完成加工 | 完成加工成功 | 完成加工失败 | QT operation-log endpoint |

ERP 复用一个私有固定映射处理十一类名称和内容，不新增 Writer 类或框架。QT 专用六字段端点只接受 QT 自己执行的九类操作；`LOCK_MOLD` / `UNLOCK_MOLD` 只由对应 ERP 业务端点内部调用，避免客户端伪造模具动作或重复记录。

客户端不得提交操作名称、内容、设备、网络地址、信号配置、异常正文、凭据、令牌、租约、签名或父作业 ID。

### 2. 首次锁模直接持久化待开始父、子作业

锁模 Service（服务）继续在同一业务事务内完成校验和设备当前状态更新，但持久化规则调整为：

| 当前状态 | 锁模处理 |
| --- | --- |
| 无当前父作业 | 插入一个 `press_job_info(status=0)`，再插入本次选中 `press_mould_job_info(status=0)`，全部绑定真实父 ID |
| 待开始父作业 `status=0` | 复用父 ID，只插入本次新增的 `status=0` 子记录 |
| 加工中父作业 `status=1` | 复用父 ID，沿用现有运行中加模规则插入 `status=1` 子记录 |
| 存量 JSON 为 `id=null,status=0` | 先按可信当前 JSON 懒持久化父记录和已有子记录，再处理本次新增模具 |

事务成功前，把持久化后的父、子 ID 同步写回 `modbus_device.press_job_info_json` 和 `press_mould_job_info_json`。事务失败时父、子插入和设备 JSON 更新一起回滚，因此成功锁模必然能返回真实父 ID。

这同时修复当前以“父对象非空”误判加工中的问题；状态判断以持久化 `status` 为准，不再把待开始二次锁模当作运行中加模。

### 3. `START` 先收敛 mixed legacy，再迁移既有记录状态

正常路径下，`START` 校验当前父作业为 `status=0` 且已有真实 ID，然后更新同一父作业和仍在当前 JSON 中的 `status=0` 子记录为 `status=1`。不得再插入第二条父作业或替换父 ID。

存量 JSON 允许在一次事务中先完成以下 mixed legacy（混合存量）收敛，再继续相同的 `START` 状态迁移：

| 父、子 ID 状态 | `START` 处理 |
| --- | --- |
| 父 ID 为空、子 ID 全为空 | 插入一个待开始父作业，再插入仍锁定子作业并绑定新父 ID |
| 父 ID 为空、部分子 ID 已存在 | 插入一个待开始父作业；对已有 ID 的子作业按 ID 行锁并验证数据库身份后绑定新父 ID；其余子作业插入并绑定同一父 ID |
| 父 ID 已存在、部分子 ID 为空 | 复用待开始父 ID，只插入空 ID 子作业并绑定该父 ID |
| 父、子 ID 均已存在 | 不插入记录，只把同一批待开始记录迁移为加工中 |

已有 ID 的 mixed child（混合子作业）必须来自数据库行锁后的可信实体；设备 JSON 缓存只能提供待验证身份，不得覆盖数据库非身份字段。`craftCode` 属于本次 `START` 的工艺身份：可信数据库 child 的 `craftCode` 必须与已通过入口校验的缓存 child 精确一致，Qt 才能沿用缓存 `craftCode == processId` 的既有约束。子作业已有冲突父 ID、跨设备、跨授权主机、非 `status=0`、缓存/数据库 `craftCode` 不一致、重复 ID 或重复模具号时，在任何父、子或设备 JSON 写入前失败关闭。

待开始解锁规则为：

- 部分解锁：将选中子记录更新为 `status=4` 并从设备当前子记录 JSON 移除；父作业保持 `status=0`。
- 全部解锁：将剩余选中子记录和父作业更新为 `status=4`，清空设备当前父、子 JSON。
- 后续重新锁模：上一条已终止父作业不复用，创建新的 `status=0` 父作业。

加工中解锁继续沿用现有约束和 `status=3` 收口规则，不在本变更扩大业务行为。

历史列表当前只展示完成态子记录；`status=0` 待开始和 `status=4` 终止记录不会伪装为已完成历史。

### 4. 锁模和解锁日志由 ERP 在主事务之后记录

锁模/解锁 Service 成功返回其操作前后均可信的 `press_job_info_id`。Controller（控制器）在主业务 Service 调用返回、事务已结束后，再调用现有日志 Service 的窄方法记录 `LOCK_MOLD` / `UNLOCK_MOLD`：

```text
ERP 锁模/解锁事务成功
  → 返回服务端父作业 ID
  → Controller 尽力写固定操作日志
  → 日志失败仅安全记录摘要，原业务仍成功
```

主业务抛错时，Controller 尽力写 `result=false`；若事务回滚后没有稳定父 ID，允许保存设备级失败日志。成功锁模和成功解锁必须使用 Service 返回的真实父 ID。UI 刷新 current jobs（当前作业）发生在主业务成功之后，不参与操作日志成功/失败判定。

解锁请求补充复用页面已有的 `teamId`；`operatorId`、认证设备和授权主机继续来自既有可信边界。QT App 不为锁模/解锁再调用 operation-log endpoint，避免重复日志。

解锁 `moldNos` 延续既有集合语义：Controller 按原顺序 trim（去除首尾空格）、丢弃空项并去重，再把规范化后的非空集合交给 Service。规范化不是 stale/partial（陈旧或部分命中）容错；Service 仍必须要求规范化后的每个模具号精确命中当前锁定集合，否则主业务失败并按真实结果记录日志。

### 5. 普通设备动作沿用现有 action identity（动作身份）

`CONNECT`、`MOVE_IN`、`MOVE_OUT` 复用现有 `PressDeviceActionIdentity`、Driver result predicate（驱动结果判定）和 `reportPressJobOperationBestEffort`：

- `localJobSessionId` 能解析父作业时写入 `press_job_info_id`。
- 如果本地 identity 暂未刷新，ERP 可从认证设备的当前作业 JSON 读取非空、归属一致的父 ID 作为可信 fallback（降级）；不按时间或模具号猜测。
- 没有当前作业时保存 device-only log；建立通信明确允许该结果。
- Driver 返回现有成功集合时写 `result=true`，其他结果或异常写 `result=false`。
- 移出流程若先自动完成加工，分别记录 `PARAMETER_END`、`COMPLETE` 和最终 `MOVE_OUT`，不折叠真实动作。

`START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE` 保持现有结果边界。完成加工已清除当前 JSON 时，仍通过 `press-job-id-*` 或已有 Qt START 会话映射解析历史父作业。

### 6. 统一采用 post-action（操作后）和 best-effort（尽力而为）

日志只在外部调用已经发生并得到业务结果后发出。本地 preflight（前置校验）、打开/关闭面板和用户取消不产生业务日志。

QT 的日志 HTTP 请求继续不重试、不排队、不补偿，且不覆盖主操作结果。ERP 锁模/解锁日志在业务事务之后同步尝试一次，异常只记录 `correlationId`、操作码和固定中文摘要，不记录请求原文、第三方异常正文或敏感数据，也不改变原业务响应。

## Risks / Trade-offs

- [父作业比原流程更早落库] → 复用已有 `status=0` 待开始和 `status=4` 终止状态；列表仍按既有完成态过滤，不把待开始记录当成加工历史。
- [存量设备 JSON 的父、子 ID 为空] → 只在下一次锁模或 `START` 按当前可信 JSON 懒持久化一次；不批量扫描、不猜测时间。
- [日志写入失败] → 主业务不回滚；不新增队列、重试或补偿。
- [旧 QT App 不发送三类 Driver 新日志] → ERP 继续兼容原六码；ERP 先部署后，旧客户端的锁模/解锁也由服务端自动记录。
- [历史详情使用整组新日志优先] → 保持现有已批准语义；本变更不重新设计新旧日志混合策略。

## Migration Plan

1. 部署 ERP 后端：支持待开始父、子作业持久化、状态迁移、十一类固定映射和服务端锁模/解锁日志；不执行数据库迁移。
2. 存量 `id=null,status=0` 设备状态在下一次锁模或 `START` 自动懒持久化；不离线回填。
3. 部署 QT App：启用 `CONNECT`、`MOVE_IN`、`MOVE_OUT` 的 post-action 上报，并为解锁请求传递已有 `teamId`。
4. 回滚代码时保留已生成的 `status=0/4` 业务记录；它们使用既有 schema，不需要数据库 rollback。若需恢复旧版本，应先清理或启动仍处于待开始状态的设备作业，避免旧代码再次按空 ID 假设处理。

## Open Questions

无。首次锁模即持久化待开始父、子作业、直接复用 `press_job_info_id`、全部解锁使用 `status=4` 收口，以及不引入 session/索引/回填均已由用户确认。

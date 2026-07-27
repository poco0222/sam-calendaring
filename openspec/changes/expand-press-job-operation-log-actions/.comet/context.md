# Comet Design Handoff

- Change: expand-press-job-operation-log-actions
- Phase: design
- Mode: compact
- Context hash: 6be2bc392b12bc93b84058f0c53087285e82aff13c71d4a5b4142fbb0043e1a0

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/expand-press-job-operation-log-actions/proposal.md

- Source: openspec/changes/expand-press-job-operation-log-actions/proposal.md
- Lines: 1-33
- SHA256: d8689f3975a4d1427930c1b027e27ae5d5313f208cabc6399d6c550629969d22

```md
## Why

现有 QT press working（压机作业）操作日志只记录 `START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE` 六类操作，锁定模具、解锁模具、建立通信、移入和移出五类真实业务动作没有进入 `modbus_handle_log`。同时，锁模阶段已存在完整的待开始作业和模具信息，却仅保存在设备 JSON 中、没有 `press_job_info_id`，使成功锁模无法直接进入对应作业历史，并造成待开始阶段再次锁模与 `START` 校验不一致。

## What Changes

- 固定支持十一类操作码：`LOCK_MOLD`、`UNLOCK_MOLD`、`CONNECT`、`MOVE_IN`、`MOVE_OUT`、`START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE`，继续由 ERP 映射固定中文操作名称、内容和 Boolean（布尔值）结果。
- 只在真实 ERP、Driver 或 workflow（工作流）操作已经提交且结果确定后记录成功或失败；打开面板、普通按钮点击、本地校验失败和用户取消不记录。
- 首次锁模成功时直接插入 `status=0` 的 `press_job_info` 和已选 `press_mould_job_info`，把真实 ID 同步写回设备当前作业 JSON，并让 `LOCK_MOLD` 直接关联该 `press_job_info_id`。
- 待开始阶段继续锁模时复用同一父作业并新增 `status=0` 子记录；`START` 只把同一父、子记录从 `status=0` 更新为 `status=1`，不再重复插入。
- 待开始阶段部分解锁时把选中子记录更新为 `status=4`；全部解锁时把剩余子记录和父作业更新为 `status=4` 并清理设备当前作业 JSON。
- `LOCK_MOLD` / `UNLOCK_MOLD` 由 ERP 可信业务端点在主事务结束后尽力记录；QT App 不提交模具关联字段。`CONNECT`、`MOVE_IN`、`MOVE_OUT` 继续通过现有严格六字段 operation-log endpoint（操作日志端点）上报。
- 有可信当前父作业时建立关联，没有时保存 device-only log（仅设备日志）；不按模具号、操作员或时间窗口猜测归属。
- 兼容存量设备 JSON 中 `id=null,status=0` 的待开始数据：在下一次锁模或 `START` 时按当前可信 JSON 懒持久化一次，不做批量迁移。
- 保留 best-effort（尽力而为）、敏感信息边界、历史详情投影和整组 legacy fallback（旧日志降级）语义。
- 不新增字段、索引、日志表、队列、重试、补偿、自由文本、通用 Writer（写入器）框架、请求指纹或新的视觉体系。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `press-job-operation-log`: 从六类操作扩展到九类真实业务动作及两类参数记录，并让锁模阶段直接复用现有父作业 ID 建立可信关联。

## Impact

- QT App（Qt 应用）：扩展客户端负责的 operation code（操作码）类型，在建立通信、移入和移出的真实 Driver 结果边界复用现有 best-effort 上报；锁模和解锁不新增客户端日志请求。
- SAM ERP：调整待开始作业的持久化时机和 `status` 状态迁移；在锁模/解锁业务端点记录可信日志；扩展固定中文映射和 QT endpoint 白名单。
- 数据库：不变更 schema（模式），只复用现有 `press_job_info`、`press_mould_job_info`、`modbus_handle_log` 及其已有字段和索引。
- 验证：更新 QT action flow（动作流程）、ERP Controller/Service/Mapper 聚焦测试、相关模块构建和 OpenSpec 严格校验；无需 Liquibase 变更。

```

## openspec/changes/expand-press-job-operation-log-actions/design.md

- Source: openspec/changes/expand-press-job-operation-log-actions/design.md
- Lines: 1-127
- SHA256: 321c3cff71da28618829cc3124717bd1d906b65b3c3ca3e7cc448d85dfe8ecc6

[TRUNCATED]

```md
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

### 3. `START` 和待开始解锁只做既有记录的状态迁移

`START` 校验当前父作业为 `status=0` 且已有真实 ID，然后更新同一父作业和仍在当前 JSON 中的 `status=0` 子记录为 `status=1`。不得再插入第二条父作业或替换父 ID。

待开始解锁规则为：

- 部分解锁：将选中子记录更新为 `status=4` 并从设备当前子记录 JSON 移除；父作业保持 `status=0`。
- 全部解锁：将剩余选中子记录和父作业更新为 `status=4`，清空设备当前父、子 JSON。
- 后续重新锁模：上一条已终止父作业不复用，创建新的 `status=0` 父作业。

加工中解锁继续沿用现有约束和 `status=3` 收口规则，不在本变更扩大业务行为。

历史列表当前只展示完成态子记录；`status=0` 待开始和 `status=4` 终止记录不会伪装为已完成历史。

### 4. 锁模和解锁日志由 ERP 在主事务之后记录

锁模/解锁 Service 成功返回其操作前后均可信的 `press_job_info_id`。Controller（控制器）在主业务 Service 调用返回、事务已结束后，再调用现有日志 Service 的窄方法记录 `LOCK_MOLD` / `UNLOCK_MOLD`：


```

Full source: openspec/changes/expand-press-job-operation-log-actions/design.md

## openspec/changes/expand-press-job-operation-log-actions/tasks.md

- Source: openspec/changes/expand-press-job-operation-log-actions/tasks.md
- Lines: 1-26
- SHA256: 40bf6751ff2e8a1b62599af5b78d78fd1c4bdd2e05cdaa05770b084036e90c0e

```md
## 1. ERP 待开始作业生命周期

- [ ] 1.1 先补充聚焦测试：首次锁模插入 `status=0` 父、子记录并回写真实 ID；待开始二次锁模复用父 ID；存量 `id=null,status=0` JSON 只懒持久化一次
- [ ] 1.2 调整锁模 Service（服务），复用现有 Domain（领域对象）和 Mapper（映射器）在同一事务持久化待开始父、子记录，修正以对象非空误判加工中的逻辑
- [ ] 1.3 调整 `START`，将同一父作业和当前 `status=0` 子记录更新为 `status=1`，不得再次插入或改变父 ID
- [ ] 1.4 调整待开始解锁：部分解锁把选中子记录更新为 `status=4`；全部解锁把剩余子记录和父作业更新为 `status=4` 并清理设备 JSON

## 2. ERP 十一类操作日志契约

- [ ] 2.1 先补充聚焦测试：十一类固定中文映射、QT 九类白名单、Boolean（布尔值）校验、客户端关联字段防护和当前设备作业可信 fallback（降级）
- [ ] 2.2 复用现有日志 Service 的最小私有映射，扩展 `CONNECT` / `MOVE_IN` / `MOVE_OUT`，保持 QT operation-log endpoint（操作日志端点）严格六字段请求
- [ ] 2.3 让锁模/解锁 Service 返回可信父 ID，并由 ERP Controller（控制器）在主事务结束后尽力记录 `LOCK_MOLD` / `UNLOCK_MOLD`；成功必须关联，失败无稳定 ID 时允许设备级
- [ ] 2.4 保持通用 `/modbus/handleLog` 无法提交父作业关联，并覆盖跨设备、跨授权主机、未知字段和日志异常不覆盖主业务响应的回归测试

## 3. QT App 新增 Driver 动作上报

- [ ] 3.1 先扩展 `PressJobOperationCode`、ERP client（客户端）收窄和契约测试，使客户端负责的九类固定操作码继续使用同一六字段请求
- [ ] 3.2 为建立通信、移入和移出的真实 Driver result（驱动结果）接入现有 best-effort（尽力而为）上报，有父作业时关联、无父作业时允许设备级日志
- [ ] 3.3 保持锁模/解锁不从 QT 重复调用日志端点，为解锁请求传递页面已有 `teamId`，并证明面板、选择/取消、本地前置校验和 current jobs（当前作业）刷新不会产生错误日志
- [ ] 3.4 覆盖移出自动完成加工组合流程，分别保留 `PARAMETER_END`、`COMPLETE`、`MOVE_OUT`，并保持入线/出线整体结果与原六类日志行为不回归

## 4. 集成验证与审查

- [ ] 4.1 运行 QT App 聚焦测试、TypeScript（类型脚本）检查和 production build（生产构建），确认日志失败不改变主操作结果且不泄露敏感字段
- [ ] 4.2 使用项目 Java 8 和 Maven 工具链运行 ERP 聚焦测试、相关模块编译及 `git diff --check`，确认本变更没有 Liquibase 或 schema 改动
- [ ] 4.3 运行 `openspec validate --strict`，核对十一类操作、待开始状态迁移、设备级边界、历史投影和 non-goals（非目标），再完成规定的代码审查

```

## openspec/changes/expand-press-job-operation-log-actions/specs/press-job-operation-log/spec.md

- Source: openspec/changes/expand-press-job-operation-log-actions/specs/press-job-operation-log/spec.md
- Lines: 1-189
- SHA256: 97f73c49e2de24932e2f36098cc870177fe8ef610e373bbad8565dc0802192f5

[TRUNCATED]

```md
## MODIFIED Requirements

### Requirement: 压机操作日志复用既有 ERP 日志表和作业关联
系统 MUST 使用既有 `modbus_handle_log` 保存 QT 压机操作日志，MUST 只使用既有 nullable（可空）的 `press_job_info_id`、`team_id` 和 `(device_id, press_job_info_id, handle_time, id)` 查询索引，并 MUST 复用既有 `handle_type`、`handle_content`、`handle_result`、`handle_by`、`handle_time`。系统 MUST NOT 为本变更新增 session（会话）字段、索引或日志表。

#### Scenario: 保存已关联操作日志
- **WHEN** ERP 从可信服务端上下文取得真实 `pressJobInfoId`
- **THEN** 系统写入该父作业 ID、班组 ID、操作员 ID、固定中文操作名称与内容、字符串 `true` / `false` 结果和记录时间
- **AND** 系统不得保存班组或人员名称快照

#### Scenario: 保存未关联设备日志
- **WHEN** 当前真实操作没有可解析的父作业
- **THEN** 系统按认证设备写入 `press_job_info_id = null` 的 device-only log（仅设备日志）
- **AND** 系统不得按模具号、操作员或时间窗口猜测父作业

### Requirement: 首次锁模持久化待开始父子作业
ERP MUST 在首次锁模业务事务中使用既有 `press_job_info` 和 `press_mould_job_info` 持久化待开始作业，MUST 使用既有 `status=0` 表示待开始，并 MUST 将生成的父、子 ID 同步保存到设备当前作业 JSON。成功锁模 MUST 具有真实 `press_job_info_id`。

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

#### Scenario: 存量待开始 JSON 的 ID 为空
- **WHEN** 设备当前可信 JSON 包含 `id=null,status=0` 的父作业或子作业，且发生下一次锁模或 `START`
- **THEN** ERP MUST 在当前业务事务内将该父作业和仍锁定的子作业懒持久化一次，再继续本次操作
- **AND** 系统不得批量迁移、按时间猜测或重复插入已经拥有真实 ID 的记录

### Requirement: START 和待开始解锁复用既有作业记录
`START` MUST 将当前持久化待开始父、子作业从 `status=0` 更新为 `status=1`，MUST NOT 再次插入父、子作业或替换父 ID。待开始解锁 MUST 使用既有 `status=4` 收口不再参与本次加工的记录。

#### Scenario: 开始加工
- **WHEN** 当前父作业和仍锁定子作业已有真实 ID 且均为 `status=0`，并且 `START` 成功
- **THEN** ERP 将同一父作业和当前子作业更新为 `status=1`
- **AND** 更新前后的父、子 ID MUST 保持不变

#### Scenario: 待开始阶段部分解锁
- **WHEN** 当前父作业为 `status=0`，且只解锁部分已选模具
- **THEN** ERP 将选中子作业更新为 `status=4` 并从设备当前子作业 JSON 移除
- **AND** 父作业保持 `status=0`，其他仍锁定子作业保持待开始

#### Scenario: 待开始阶段全部解锁
- **WHEN** 当前父作业为 `status=0`，且本次解锁后不再有锁定模具
- **THEN** ERP 将本次剩余子作业和父作业更新为 `status=4`
- **AND** ERP 清空设备当前父、子作业 JSON
- **AND** 后续锁模 MUST 创建新的待开始父作业，不得复用已终止父作业

#### Scenario: 加工中解锁
- **WHEN** 当前父作业为 `status=1`
- **THEN** ERP 沿用现有加工中解锁限制和子作业收口状态
- **AND** 本变更不得允许解锁现有规则禁止的最后一套或全部模具

### Requirement: QT 操作日志端点保持最薄可信边界
ERP MUST 保持既有 QT operation-log endpoint（操作日志端点），请求 MUST 只包含 `correlationId`、`localJobSessionId`、`operationCode`、`result`、`teamId`、`operatorId`。ERP MUST 从认证上下文取得 `deviceId` 与 `granteeHostId`。该端点 MUST 只接受 QT 实际执行的 `CONNECT`、`MOVE_IN`、`MOVE_OUT`、`START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE` 九类操作；`LOCK_MOLD` 和 `UNLOCK_MOLD` MUST 只由 ERP 对应业务端点内部记录。

#### Scenario: 接收合法 QT 日志请求
- **WHEN** 认证 QT 客户端提交六个允许字段，`operationCode` 在 QT 九类允许列表内且 `result` 是 JSON Boolean `true` 或 `false`
- **THEN** ERP 使用认证设备和可信作业上下文写入一条日志
- **AND** `teamId` 写入 `team_id`，`operatorId` 写入 `handle_by`，`correlationId` 只用于技术诊断串联

#### Scenario: QT 尝试提交模具动作日志
- **WHEN** QT operation-log endpoint 收到 `LOCK_MOLD` 或 `UNLOCK_MOLD`
- **THEN** ERP MUST 拒绝请求且不写日志
- **AND** 锁模、解锁日志只能由对应可信业务端点生成，以避免伪造或重复记录

```

Full source: openspec/changes/expand-press-job-operation-log-actions/specs/press-job-operation-log/spec.md

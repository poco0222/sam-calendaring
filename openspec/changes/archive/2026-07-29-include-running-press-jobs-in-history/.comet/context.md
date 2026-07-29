# Comet Design Handoff

- Change: include-running-press-jobs-in-history
- Phase: design
- Mode: compact
- Context hash: c2421b5b3fc2d7600c3adb77406552e2783bb493c27c87e50e3ed2a74f2bdbfe

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/include-running-press-jobs-in-history/proposal.md

- Source: openspec/changes/include-running-press-jobs-in-history/proposal.md
- Lines: 1-29
- SHA256: b53e2025a1f172c698e5267afeff42f3109ebf6da9e7a5bfb4f85e13ff129e52

```md
## Why

“历史作业”详情同时承担按作业身份查询操作记录的职责，但当前列表和详情仅允许 `status=3` 的已完成作业，导致 `status=1` 的进行中作业没有操作记录入口。继续维持该限制将迫使系统新增一套重复的操作日志查询，而现有历史详情已经具备可靠的作业关联和脱敏展示能力。

## What Changes

- 历史列表和详情在继续限定当前认证设备的前提下，同时允许 `status=1` 的进行中作业和 `status=3` 的已完成作业。
- 已完成作业继续按 `end_time` 落入所选半开日期区间；进行中作业按作业区间与所选日期区间是否相交判断，确保跨日仍在运行的作业不会消失。
- 进行中作业在混合列表中置顶；同一状态组继续使用稳定时间和主键倒序，保证服务端分页顺序稳定。
- QT App 将状态 `1` 显示为“进行中”、状态 `3` 显示为“已完成”，并将“完工状态”调整为“作业状态”；进行中记录的完成时间显示“未完成”，实际时长显示“进行中”。
- 进行中作业详情复用现有 Drawer（抽屉）、参数对照和操作时间线；缺少完工参数属于正常未记录状态，不新增日志页面或查询接口。
- 不纳入待开始、暂停或终止作业，不新增状态筛选、数据库结构、日志写入路径、依赖或视觉体系。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `press-job-history-query`: 将历史作业列表和详情的可查询范围从仅已完成作业扩展为进行中与已完成作业，并明确日期、排序和进行中展示语义。

## Impact

- QT App：`PressJobHistoryPage` 的状态映射、列表列名、空状态、进行中字段展示和对应测试。
- ERP：`PressMouldJobInfoMapper` 的历史列表/详情查询合同及 Mapper、Controller 相关测试。
- API：既有 `/api/qt/press-working/history-jobs` 列表和详情路径会返回当前认证设备的 `status=1` 记录；字段结构不变。
- OpenSpec：更新共享 `press-job-history-query` 验收场景；不影响操作日志写入、父作业可靠关联、设备隔离和敏感信息边界。

```

## openspec/changes/include-running-press-jobs-in-history/design.md

- Source: openspec/changes/include-running-press-jobs-in-history/design.md
- Lines: 1-61
- SHA256: 4aeeaf60f1e074feb38bbb04fda7bb4b2a96fd19f42577f228fa65598a4a639a

```md
## Context

QT App 的“历史作业”通过现有 `/api/qt/press-working/history-jobs` 列表和详情接口，按认证设备、模具作业主键和父作业身份展示参数及操作记录。当前 ERP Mapper（映射器）在列表和详情中固定 `status='3'`，前端也只识别已完成状态；因此 `status='1'` 的进行中作业虽然已有稳定主键和持续产生的操作日志，却无法进入该查询链路。

本变更跨 QT App 与 ERP 两个仓库，但不改变接口路径、字段结构、数据库表或操作日志关联方式。现有设备隔离、父作业可靠关联、白名单响应和敏感信息边界必须保持不变。

## Goals / Non-Goals

**Goals:**

- 让当前认证设备的进行中与已完成模具作业共享现有历史列表和详情入口。
- 让跨日进行中作业在与所选日期范围相交时仍可查询。
- 让进行中作业的状态、完成时间、实际时长和未完成参数呈现准确且不误导。
- 保持服务端分页顺序稳定，并保持已完成作业的原查询语义。

**Non-Goals:**

- 不展示 `status=0/2/4` 的待开始、暂停或终止作业。
- 不新增操作日志页面、状态筛选、接口、数据库结构或历史数据迁移。
- 不计算或定时刷新进行中作业的实时耗时。
- 不改变操作日志写入、父作业关联、脱敏或设备认证边界。

## Decisions

### 1. 在既有查询中明确允许 `status IN ('1','3')`

列表和详情只把状态集合从已完成扩展为进行中与已完成，继续以认证 `deviceId` 和真实 `mouldJobId` 限定数据。这样可直接复用现有详情及操作时间线，不引入第二套日志查询。

替代方案是新增操作日志查询页或让前端直接按设备查询日志；前者重复现有能力，后者会失去可靠父作业身份并扩大敏感数据边界，因此不采用。

### 2. 完成态保留完工时间语义，进行态使用区间相交语义

已完成作业继续要求 `end_time >= startTime AND end_time < endTime`。进行中作业要求 `start_time < endTime`，且其尚未结束的作业区间与查询区间相交；这可覆盖昨天启动、今天仍在运行的作业，同时不会把查询结束时间之后才启动的作业带入结果。

替代方案是仅按进行中作业的 `start_time` 落入查询范围判断，但会再次漏掉跨日运行作业，因此不采用。

### 3. 进行中置顶，并按状态对应业务时间稳定倒序

列表先按“进行中、已完成”分组；进行中按 `start_time DESC`，已完成按 `end_time DESC`，最后统一按 `id DESC` 破除同秒并列。分页继续由现有 PageHelper（分页组件）完成。

替代方案是直接使用 `COALESCE(end_time,start_time) DESC` 混排，但新近完成记录可能把当前进行中作业压到后页，削弱操作日志入口的可发现性，因此不采用。

### 4. 前端只补齐现有模型的状态呈现

接口字段保持不变。前端将 `1` 映射为“进行中”、`3` 映射为“已完成”，未知状态仍显示“状态未知”；状态列和详情标签统一为“作业状态”。进行中记录缺少 `completedAt` 和 `actualDurationHours` 时分别显示“未完成”和“进行中”，完工参数缺失继续使用现有“未记录”语义，不增加计时器或新组件。

## Risks / Trade-offs

- [Risk] `OR` 状态与时间条件可能使现有索引利用率下降 → 保持认证设备和最多 31 个自然日边界，先以聚焦 Mapper 合同和现有数据规模验证；只有查询计划或现场指标证明需要时再单独增加索引。
- [Risk] 进行中作业在打开详情后完成，当前 Drawer 仍显示请求时快照 → 沿用现有手动重新打开/刷新语义，不新增轮询；后续只有明确提出实时刷新需求时再扩展。
- [Risk] 旧异常数据可能存在 `status=1` 但 `start_time` 为空 → 查询不展示该不可信记录，不以创建时间或设备时间猜测业务起点。

## Migration Plan

1. 先以失败测试锁定 Mapper 状态、日期、排序与详情边界，以及前端进行中呈现。
2. 同步发布 ERP 与 QT App；无需数据库迁移或历史回填。
3. 回滚时恢复 Mapper 的 `status='3'` 和前端完成态文案即可，数据没有新增或转换。

## Open Questions

无。进行中范围、跨日语义、排序、缺失字段呈现和排除状态已明确。

```

## openspec/changes/include-running-press-jobs-in-history/tasks.md

- Source: openspec/changes/include-running-press-jobs-in-history/tasks.md
- Lines: 1-14
- SHA256: dfe4745cc42bfb6ddd2087d90acc051d5fd7ac970ef040d0124bd82d0e6ef201

```md
## 1. ERP 查询契约

- [ ] 1.1 先修改 Mapper 和 Controller 聚焦测试，证明列表允许 `status=1/3`、跨日进行中作业按区间相交返回且置顶，并证明详情允许同设备进行中作业；运行测试取得预期 RED（失败）证据
- [ ] 1.2 最小修改 `PressMouldJobInfoMapper` 列表与详情 SQL，保留认证设备、半开时间、稳定分页和父作业身份边界，使 1.1 测试转为 GREEN（通过）

## 2. QT App 展示契约

- [ ] 2.1 先修改 `PressJobHistoryPage` 聚焦测试，锁定“进行中/已完成”状态映射、“作业状态”列名、进行中完成时间/时长和通用空状态文案；运行测试取得预期 RED 证据
- [ ] 2.2 最小修改历史列表与详情展示，复用现有类型、Tag、Drawer、参数缺失和操作时间线实现，使 2.1 测试转为 GREEN

## 3. 回归验证

- [ ] 3.1 运行 ERP 历史 Mapper/Controller 聚焦测试及相关模块测试，确认设备隔离、已完成查询和详情操作日志关联不回归
- [ ] 3.2 运行 QT App 历史页测试、完整 Vitest、TypeScript 检查、生产构建、`git diff --check` 和 OpenSpec strict validation（严格校验），记录真实结果

```

## openspec/changes/include-running-press-jobs-in-history/specs/press-job-history-query/spec.md

- Source: openspec/changes/include-running-press-jobs-in-history/specs/press-job-history-query/spec.md
- Lines: 1-120
- SHA256: 0da0ca183ae4a74f067b59a13c6b9a7f30e14f6870d87ee6f9324487d9fe8d0c

[TRUNCATED]

```md
## MODIFIED Requirements

### Requirement: 历史列表按已提交筛选条件服务端分页

系统 MUST 默认查询工控机本地当天与查询区间相交的进行中模具作业以及在区间内完成的模具作业，MUST 支持必填且不可清除的最多 31 个自然日范围、从远程候选中选择的可选模具号，以及由班组级联的可选人员筛选，MUST 提供最近 1、3、7、30 个本地自然日快捷范围，并 MUST 以每页 10 条进行服务端分页。班组 MUST 只限制人员待选数据，不得新增或隐式提交历史列表 `teamId` 查询参数；全量用户字典 MUST 只用于已有历史记录的名称翻译，不得作为人员筛选候选。

#### Scenario: 首次进入页面

- **WHEN** 操作员首次进入“历史作业”
- **THEN** 前端按工控机本地时区提交当天零点至下一日零点的半开查询区间
- **AND** 班组默认选择当前用户的默认班组、人员保持未选择，人员候选只来自该默认班组
- **AND** 服务端仅返回当前认证设备中与区间相交的 `status=1` 进行中记录以及 `end_time` 落入区间的 `status=3` 已完成记录
- **AND** 进行中记录置顶并按 `start_time DESC, id DESC` 排序，已完成记录随后按 `end_time DESC, id DESC` 排序

#### Scenario: 跨日进行中作业与查询区间相交

- **WHEN** 当前认证设备的 `status=1` 作业在查询开始时间之前启动，并在查询区间内仍未结束
- **THEN** 服务端 MUST 返回该进行中作业
- **AND** 系统不得要求其 `start_time` 落入查询区间或伪造 `end_time`

#### Scenario: 使用小键盘远程搜索模具

- **WHEN** 操作员聚焦模具号 Select，通过物理键盘或 `NumericKeypad（数字小键盘）` 输入文本并点击小键盘“确认”
- **THEN** 前端使用现有模具候选接口执行一次远程搜索，并以与模具锁定面板一致的下拉候选布局展示脱敏模具信息
- **AND** 历史场景传入空的 `lockedMoldNos`，不得读取或推测当前作业、设备或网络字段
- **AND** 空文本不得发起请求，过期响应不得覆盖较新的搜索结果，请求失败时清空候选并显示固定中文错误

#### Scenario: 只有选中的模具候选进入查询

- **WHEN** 操作员只输入模具文本但未选择候选，或者从远程结果中选择一个模具号
- **THEN** 未选择的输入文本不得写入已提交查询，选中的候选 MUST 写入 `draftFilters.mouldCode`
- **AND** 模具号 Select MUST 支持清除当前选择，清除后后续查询不得携带 `mouldCode`

#### Scenario: 班组级联人员候选

- **WHEN** 操作员选择另一个班组
- **THEN** 系统立即清空已选人员并加载目标班组的人员候选
- **AND** 人员控件标签和可访问名称均为“人员”，加载期间或未选择班组时不可选择人员
- **AND** 较早班组请求的迟到响应不得覆盖当前班组，加载失败时人员候选保持为空
- **AND** 人员候选不得包含全量用户字典中不属于当前班组的其他人员

#### Scenario: 提交新的筛选条件

- **WHEN** 操作员修改日期、选择模具候选或选择当前班组人员并点击“查询”
- **THEN** 系统校验日期非空且不超过 31 个自然日，把日期、已选 `mouldCode` 和已选 `operator` 从 `draftFilters（编辑中筛选）` 复制为 `appliedQuery（已提交查询快照）`
- **AND** 班组只保留在编辑中筛选状态，不进入历史列表请求
- **AND** 新查询从第 1 页开始且每页固定 10 条

#### Scenario: 修改筛选但未查询时翻页

- **WHEN** 操作员修改筛选控件但未点击“查询”，随后切换页码
- **THEN** 系统继续使用最近一次 `appliedQuery`
- **AND** 系统不得隐式提交当前编辑值

#### Scenario: 日期范围无效

- **WHEN** 日期为空或超过 31 个自然日
- **THEN** 系统禁用查询并显示中文校验提示
- **AND** 前端不得发起无界历史请求

#### Scenario: 选择日期快捷范围

- **WHEN** 操作员选择最近 1、3、7 或 30 日
- **THEN** 前端设置包含今天在内的对应本地自然日范围
- **AND** 提交时把结束日期转换为下一本地自然日零点的排他上界

### Requirement: 历史列表使用稳定作业身份和明确状态

历史列表 MUST 一行表示一条可查询的 `press_mould_job_info`，MUST 仅允许 `status=1` 的进行中作业和 `status=3` 的已完成作业，MUST 使用其真实主键作为稳定 `mouldJobId`，并 MUST 展示压机、模具号、作业人员、工艺、开始时间、完成时间、实际时长和中文作业状态。

#### Scenario: 展示已完成历史记录

- **WHEN** 服务端返回一条 `status=3` 的已完成模具作业
- **THEN** 前端按固定八列显示记录并把 `mouldWorkingTime` 秒数转换为一位小数小时文本
- **AND** 状态显示“已完成”

#### Scenario: 展示进行中作业

- **WHEN** 服务端返回一条 `status=1` 且没有完成时间和实际时长的进行中模具作业
- **THEN** 前端状态显示“进行中”、完成时间显示“未完成”、实际时长显示“进行中”

```

Full source: openspec/changes/include-running-press-jobs-in-history/specs/press-job-history-query/spec.md

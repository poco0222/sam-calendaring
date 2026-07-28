# Comet Design Handoff

- Change: refine-press-job-history-details
- Phase: design
- Mode: compact
- Context hash: 6bed57afc56aa834786fbd88d5b72f926c2b573ae58dbcb01c56e056839684bf

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/refine-press-job-history-details/proposal.md

- Source: openspec/changes/refine-press-job-history-details/proposal.md
- Lines: 1-29
- SHA256: f55eee17fcb1d4bdf078da74d012209b23b886d4655dd3910803b1e64cd2f888

```md
## Why

历史作业详情当前无法区分线圈/位状态参数与普通数值参数，导致已落库的线圈值仍显示为 `0/1`；同时筛选项、参数状态提示和操作时间线占用过多空间，降低了 1280×720 工控机视口下的可读性。需要在不泄露信号配置、不改变日志写入语义的前提下，统一现有与后续历史数据的状态值展示，并收紧详情布局。

## What Changes

- 日期范围、模具号、作业人员三个筛选项内部改为“描述在左、控件在右”，三个筛选项与查询按钮继续保持单行。
- ERP 在 Qt 专用与旧 Vue 仍使用的两条参数写入路径中保存安全的状态值类型标记；历史详情对缺少或携带非法标记的既有记录使用已保存的 `signalId/signalCode` 匹配当前设备信号配置，无法可靠识别时保留原值。
- 开始参数和完工参数统一将可靠识别的线圈/位状态 `0/1`、`false/true` 显示为“否/是”，普通数值保持原样。
- 参数区删除“未记录开始参数”“未记录完工参数”提示，保留无法从空表判断的格式异常提示。
- 操作时间线不再展示重复的“内容”，将班组和作业人员组合为一行，删除横向分割线，补齐圆点间竖向连接线，并按每页 5 条进行前端分页。
- 不删除 ERP 现有 `handle_content` 存储和历史响应字段，不新增依赖、主题、数据库表或日志体系。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `press-job-history-query`: 调整历史作业筛选布局、状态参数兼容投影、参数提示和操作时间线展示及分页要求。

## Impact

- QT App：`PressJobHistoryPage`、历史详情类型收窄、样式和现有测试。
- ERP：压机参数记录 JSON 的安全类型标记、历史详情参数投影及对应 Controller/Service 测试。
- API：历史参数行新增安全的 `valueKind` 展示标记；不暴露 `signalConfig`、完整 `registerType/dataType`、`signalId/signalCode` 或其他敏感字段。
- 数据：不执行数据库迁移或历史数据回填；既有记录在读取时按可信信号身份兼容识别。

```

## openspec/changes/refine-press-job-history-details/design.md

- Source: openspec/changes/refine-press-job-history-details/design.md
- Lines: 1-76
- SHA256: 40fed747dfeb5f088b773421f9e3c08c3c3872d745978758f447b476d5bd6c42

```md
## Context

历史参数由 ERP 在开始/完工时将设备信号值写入 `press_mould_job_info` 的 JSON 字段。现有记录保存了 `signalId`、`signalCode`、`signalName`、`signalValue`、`unit` 和时间，但没有保存线圈/位状态类型；历史详情又只投影名称、值、单位和时间，因此前端只能把原始数值 `0/1` 当普通数值显示。实时参数和启动仪表盘已经根据 `registerType`、`dataType` 将状态值显示为“否/是”，历史页面需要获得等价但脱敏的分类结果。

历史作业 Drawer（抽屉）面向 1280×720 工控机视口，现有筛选描述位于控件上方，参数缺失提示重复表达 Table（表格）内容，操作记录又重复展示“操作名称 + 结果”组成的 `content`，造成有效信息密度偏低。改动必须继续复用 Ant Design（蚂蚁设计）、现有主题变量和历史接口认证边界，不得暴露完整 `signalConfig` 或新增并行日志体系。

## Goals / Non-Goals

**Goals:**

- 开始参数和完工参数使用同一套可靠状态值显示规则。
- 已落库的旧参数记录在信号身份仍可匹配时立即获得“否/是”展示；后续记录不再依赖当前配置判断历史类型。
- 在不改变历史列表查询、Drawer 身份和日志关联语义的情况下，提高筛选区、参数区和操作时间线的信息密度。
- 保持旧后端、旧前端与新增字段之间的向后兼容，读取降级不得阻断历史详情。

**Non-Goals:**

- 不把所有数值 `0/1` 猜测为状态值。
- 不迁移或回填数据库中的历史 JSON，不新增数据库列、表或 ChangeSet。
- 不删除 `modbus_handle_log.handle_content`、不修改日志写入内容，也不要求历史接口立即移除 `content` 字段。
- 不新增服务端操作记录分页接口、时间轴组件、依赖、主题或视觉体系。
- 不改变历史列表固定每页 10 条、查询范围、认证、设备隔离和操作记录关联规则。

## Decisions

### 1. ERP 输出脱敏 `valueKind`，前端不接收原始信号配置

ERP 使用一个最小共享分类入口锁定与现有实时参数一致的识别口径：规范化后的 `registerType` 为 `1`、`coil`、`coils`，或 `dataType` 为 `bit`、`bool`、`boolean` 时，信号属于状态量。Qt 专用 `recordPressJobParametersForQt` 与旧 Vue 仍使用的 `recordStartParams/generateParameterRecords` 两条写入路径都为后续记录保存 `valueKind: "state"` 或 `valueKind: "scalar"`；历史详情只投影该安全分类，不输出 `signalId`、`signalCode`、`registerType`、`dataType` 或信号配置原文。

选择服务端分类而不是前端接收配置，原因是 ERP 已持有可信信号定义，且项目明确禁止为了展示传输完整 `signalConfig`。选择 `valueKind` 而不是 Boolean（布尔值）强制转换，原因是历史值仍需保留原始标量，前端只负责显示。

### 2. 既有记录按可信身份回退，无法识别时保持原值

历史详情每次只查询一次当前认证设备的全部现存信号定义，包括停用行；按 `signalId` 建立索引，并只为设备内唯一的 `signalCode` 建立回退索引。只有精确文本 `state`、`scalar` 是合法 `valueKind`：合法标记优先使用；缺失或非法时先按同设备 `signalId`、再按唯一 `signalCode` 匹配并派生分类。重复 code、畸形身份、匹配失败或配置查询失败时省略 `valueKind`，继续返回参数原值和其余详情。

非法分类或身份只取消当前参数行的分类，不得把整侧参数 JSON 标记为损坏。这样可以覆盖既有数据，同时避免按参数名称、单位或数值猜测。当前配置可能已变化是旧数据无法完全消除的限制；新记录保存分类后不再受此影响。

### 3. 两列共用一个状态格式化入口

`PressJobHistoryParameter` 接受可选的 `valueKind`。开始值和完工值都通过同一个格式化函数：仅当 `valueKind === "state"` 时，将 `0`、`"0"`、`false` 显示为“否”，将 `1`、`"1"`、`true` 显示为“是”；无法识别的状态值和所有非状态值沿用现有标量字符串化。缺失或无效记录继续显示“未记录”。

该方案复用既有语义但不抽取跨语言公共模块；为一个 Java 后端和 TypeScript 前端引入新的共享层没有收益。

### 4. 操作记录保留现有数据源，只收紧前端展示

Qt 前端停止收窄和展示 `content`，后端仍可返回该兼容字段。每条记录显示两行：第一行为操作名称和结果 Tag（标签），第二行为 `班组 / 作业人员：{班组} / {作业人员}`。`ol/li/time` 结构继续保留；删除 `border-bottom`，使用 `li:not(:last-child)::before` 绘制当前页相邻圆点间竖线，并确保圆点层级高于连接线。

操作记录在 Drawer 内执行前端分页，每页固定 5 条。切换 `mouldJobId` 或替换详情记录时页码恢复为 1；时间线列表占据剩余高度并局部滚动，Pagination 作为不可收缩底栏固定在操作面板底部。分页只切片已返回的可靠记录，不修改 ERP 查询、排序或关联语义。选择前端分页是因为详情接口已返回完整时间线，本次只控制固定视口展示密度。

### 5. 只删除重复缺失提示，保留异常提示

参数表中的单项“未记录”和“记录不完整”已经表达缺失情况，因此移除“未记录开始参数”“未记录完工参数”。当整侧 JSON 损坏时 Table 无法区分“没有数据”和“数据损坏”，所以继续保留“开始参数记录格式异常”“完工参数记录格式异常”。

### 6. 筛选项内部改为水平 Flex

筛选容器仍为不可换行的单行 Flex；每个字段从上下 Grid 改为水平 Flex，描述不换行，日期控件、Input（输入框）和 Select（选择器）占据剩余宽度。现有 44px 控件高度、校验提示绝对定位、查询按钮和键盘可访问名称保持不变。

## Risks / Trade-offs

- [旧记录使用当前配置，信号类型可能已发生变化] → 优先按稳定 `signalId` 匹配、限定认证设备，并只接受固定状态类型标记；无法匹配时保持原值，新记录保存快照分类消除后续漂移。
- [同设备 `signalCode` 可能重复] → 仅为唯一 code 建立回退索引；重复时不得任取一条，直接保持原值。
- [新增信号定义查询可能拖慢详情或查询失败] → 每次详情最多查询一次并建立内存索引；查询失败降级为原值，不让参数类型识别阻断详情。
- [前端分页只限制显示，不减少响应体] → 本次记录规模和目标是固定视口展示；只有实际响应体或查询耗时成为问题时再引入服务端分页。
- [保留后端 `content` 会留下未使用响应字段] → 这是兼容性优先的有意取舍；当前只删除多余 UI，待有独立契约清理需求时再收缩接口。
- [连接线在分页边界中断] → 每页时间线作为独立可见片段，连接线只连接当前页相邻记录，最后一条不向分页控件延伸。

## Migration Plan

1. 先部署 ERP：新记录开始保存 `valueKind`，历史接口为新旧记录投影可选分类；旧 Qt 前端会忽略新增字段。
2. 再部署 Qt App：消费 `valueKind` 并启用新布局、时间线和分页；如果 ERP 尚未升级，缺失分类会安全保持 `0/1` 原值。
3. 不执行数据库迁移、数据回填或生产批量更新。
4. 回滚时可独立回退 Qt 和 ERP 代码；旧代码会忽略已写入 JSON 的 `valueKind`，无需清理数据。

## Open Questions

无。开始/完工两列统一转换、既有数据兼容、操作记录每页 5 条及删除重复“内容”均已确认。

```

## openspec/changes/refine-press-job-history-details/tasks.md

- Source: openspec/changes/refine-press-job-history-details/tasks.md
- Lines: 1-23
- SHA256: 5529b87a22c50d6d37555f88ed4b9c734d99c97d7622d906e584b7d558d63a90

```md
## 1. ERP 参数分类与安全投影

- [ ] 1.1 在 `PressMouldJobInfoServiceImplQtTest` 增加失败测试，覆盖 `recordPressJobParametersForQt` 与 `recordStartParams/generateParameterRecords` 两条路径的开始/完工参数按现有 `registerType`、`dataType` 规则保存 `state` / `scalar`，且原始参数值保持不变
- [ ] 1.2 在 `QtPressWorkingControllerTest` 增加失败测试，覆盖新记录合法标记优先、旧记录按认证设备内 `signalId` / 唯一 `signalCode` 回退、停用定义、重复 code、非法标记、畸形身份、配置不可用时保留原值，以及响应不泄露信号身份和配置
- [ ] 1.3 用一个最小共享分类入口为两条参数写入路径保存 `valueKind`，并在历史详情中用一次当前设备全部信号定义查询完成旧记录回退；单行匹配失败安全降级，不新增数据库迁移或外部接口

## 2. QT App 响应收窄与统一格式化

- [ ] 2.1 在 `erpClient.test.ts` 增加失败测试，再让历史参数只接受可选的 `state` / `scalar`，丢弃未知 `valueKind`，并停止把操作记录 `content` 收窄到前端 View Model（视图模型）
- [ ] 2.2 在 `PressJobHistoryPage.test.tsx` 增加失败测试，覆盖开始/完工两列统一显示“否/是”、非状态 `0/1` 保持原值、删除参数缺失提示，以及保留格式异常提示
- [ ] 2.3 复用一个历史参数格式化入口处理两列，仅对 `valueKind === "state"` 的 `0/1/false/true` 转换“否/是”

## 3. 历史详情布局与操作分页

- [ ] 3.1 在 `PressJobHistoryPage.test.tsx` 增加失败测试，覆盖筛选描述与控件水平排列、操作内容不展示、班组/作业人员组合、每页 5 条、切换作业重置页码及分页固定底栏
- [ ] 3.2 将筛选项改为统一的水平 Flex（弹性布局），保留单行筛选、44px 控件高度、现有查询按钮和无障碍名称
- [ ] 3.3 收紧操作项为操作/结果与“班组 / 作业人员”两行，删除水平分割线，使用现有时间线结构补齐当前页相邻节点竖线；列表局部滚动，并复用 Ant Design Pagination（分页）作为固定底栏每页显示 5 条

## 4. 验证与范围保护

- [ ] 4.1 使用 Java 8 运行 ERP 的 `PressMouldJobInfoServiceImplQtTest`、`QtPressWorkingControllerTest` 及受影响模块构建，确认未改动现有未跟踪 SQL 文件、日志关联和敏感信息边界
- [ ] 4.2 运行 QT App 的 `erpClient.test.ts`、`PressJobHistoryPage.test.tsx`、TypeScript（类型检查）和 production build（生产构建）
- [ ] 4.3 在 1280×720 浅色/深色视口核对单行水平筛选、参数表可见区域、5 条操作时间线连接及 Drawer（抽屉）局部滚动，并执行 OpenSpec strict validation（严格校验）

```

## openspec/changes/refine-press-job-history-details/specs/press-job-history-query/spec.md

- Source: openspec/changes/refine-press-job-history-details/specs/press-job-history-query/spec.md
- Lines: 1-60
- SHA256: 1321e53e185856737b104bfa0af0b6199cdbb931047e8dbe91059660b9a03e96

```md
## MODIFIED Requirements

### Requirement: 历史作业一级入口与现有视觉体系一致
QT App MUST 在“压机作业”右侧提供第四个一级入口“历史作业”，MUST 复用现有 App Shell（应用外壳）、Ant Design（组件库）与 Design Token（设计变量），MUST 把筛选区调整为单行平铺，MUST 将每个筛选项的描述和控件水平排列，并不得改变“压机作业”既有四行布局。

#### Scenario: 在固定工控机视口打开历史作业
- **WHEN** 操作员在 1280×720 应用视口选择“历史作业”
- **THEN** 系统在同一行显示日期、模具号、作业人员和查询按钮，每个筛选项均为左侧描述、右侧控件，并显示占据剩余高度的八列历史表格，页面不产生页面级滚动条
- **AND** 各筛选项继续使用统一的描述列和控件高度，不因控件类型恢复为上下排布
- **AND** 一级导航顺序为“启动仪表盘、诊断日志、压机作业、历史作业”
- **AND** 查询按钮同时显示既有 `SearchOutlined` 和“查询”文字，保留键盘操作与可访问名称

#### Scenario: 浅色和深色主题显示历史页面
- **WHEN** 操作员切换现有浅色或深色主题
- **THEN** 历史页面的颜色、圆角、边框和状态反馈继续使用现有主题与 `--qt-app-control-blue*` 变量
- **AND** 系统不引入渐变、玻璃效果、宽阴影、独立主题 Provider（提供器）、新依赖或新视觉体系

### Requirement: 参数和操作记录只展示可靠白名单数据
系统 MUST 对开始参数和完工参数按参数名称对齐，MUST 保留仅一侧存在的有效值，MUST 对两列使用同一套安全状态值格式化规则，并 MUST 只展示可按作业身份可靠关联的白名单操作记录。后端 MUST 仅输出脱敏的参数值类型，不得向 QT App 输出信号标识或信号配置；QT App MUST 复用诊断日志 Timeline CSS（时间线样式）展示操作记录，并在 Drawer（抽屉）内按每页 5 条执行客户端分页，分页控件 MUST 固定在操作面板底部。

#### Scenario: 一侧参数缺失或损坏
- **WHEN** 开始或完工参数仅一侧存在，或者一侧 JSON 记录损坏
- **THEN** 系统继续展示另一侧有效记录，缺失值在 Table（表格）中显示“未记录”，损坏侧显示中文格式异常状态
- **AND** 参数区不再额外显示“未记录开始参数”或“未记录完工参数”提示
- **AND** 详情其他区域保持可用

#### Scenario: 作业发生操作 session 切换
- **WHEN** 目标父作业完全没有可信新日志，且同一作业的 `START`、`COMPLETE` 和无父作业 ID 的 `MACHINE_STATUS` 分布在多个、但至少有一条已绑定该作业的 `local_job_session_id`
- **THEN** 服务端按该作业任意已绑定记录的 session 汇集旧 Qt 生命周期操作，并始终限定当前认证 `device_id`
- **AND** 服务端不得按设备和时间窗口猜测操作归属

#### Scenario: 没有可靠操作记录
- **WHEN** 当前作业既没有可信新日志，也没有可可靠关联的旧 Qt 生命周期操作记录
- **THEN** Drawer 显示“该作业没有可查看的操作记录”
- **AND** 系统不得补造锁模、解锁或失败操作

#### Scenario: 新参数记录保存状态分类
- **WHEN** 开始或完工参数对应信号的规范化 `registerType` 为 `1`、`coil`、`coils`，或者 `dataType` 为 `bit`、`bool`、`boolean`
- **THEN** ERP 在参数 JSON 中保存 `valueKind: "state"`，其他信号保存 `valueKind: "scalar"`
- **AND** Qt 专用 `recordPressJobParametersForQt` 与旧 Vue 使用的 `recordStartParams/generateParameterRecords` 两条写入路径都使用同一分类规则
- **AND** 历史详情只返回可选的 `valueKind`，不得返回 `signalId`、`signalCode`、`registerType`、`dataType` 或 `signalConfig`

#### Scenario: 两列统一显示状态值
- **WHEN** 开始参数或完工参数的 `valueKind` 为 `state`，且原始值为数字或字符串 `0`、`1`，或者 Boolean（布尔值）`false`、`true`
- **THEN** 前端对两列分别显示“否”或“是”
- **AND** 无法识别的状态值和所有非状态值保持原有白名单格式，不得仅根据数值 `0/1` 猜测转换

#### Scenario: 既有参数记录缺少状态分类
- **WHEN** 既有参数 JSON 没有精确文本 `state` 或 `scalar`，或者携带空白、大小写变体、数字、对象等非法 `valueKind`
- **THEN** ERP 在当前认证设备全部现存定义中优先按记录中的 `signalId` 精确匹配，包括已经停用的信号；仅当同设备 `signalCode` 恰好存在一个候选时才允许按 code 回退，并以相同规则派生可选 `valueKind`
- **AND** 重复 code、畸形身份、信号定义查询失败或身份无法匹配时，ERP 继续返回原始参数值并省略 `valueKind`，不得阻断历史详情或按名称、单位和值猜测类型
- **AND** 非法分类或身份只影响当前参数行的分类，不得把同侧其他有效参数降级为格式异常

#### Scenario: 展示操作时间线
- **WHEN** 详情返回新日志或旧作业降级记录
- **THEN** Drawer 按时间正序逐条展示时间、操作、成功/失败和“班组 / 作业人员：{班组} / {作业人员}”，不再展示重复的内容字段
- **AND** 每页最多显示 5 条记录，切换作业时页码恢复为 1
- **AND** 当前页相邻时间点之间显示连续竖线，各记录之间不显示水平分割线
- **AND** 时间线列表在操作面板内局部滚动，Pagination 固定在面板底部且最后一个节点不向分页控件延伸
- **AND** 任一缺失的班组或作业人员统一显示“未记录”

```

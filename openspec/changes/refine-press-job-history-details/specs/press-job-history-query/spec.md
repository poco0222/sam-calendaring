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

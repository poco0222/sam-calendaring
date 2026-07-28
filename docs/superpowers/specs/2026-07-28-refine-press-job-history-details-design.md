---
comet_change: refine-press-job-history-details
role: technical-design
canonical_spec: openspec
---

<!--
@file 2026-07-28-refine-press-job-history-details-design.md
@author PopoY
@created 2026-07-28 16:32:50
@purpose 细化历史作业筛选、状态参数投影和操作时间线的跨端实现设计。
-->

# 历史作业详情紧凑化与状态参数设计

## 1. 设计边界

OpenSpec delta spec（增量规格）是需求与验收场景的唯一来源；本文只细化实现路径、数据流、失败降级和验证方式。

本次实现跨两个现有仓库：

- `sam-calendaring`：QT App frontend（前端）的历史详情类型、响应收窄、展示逻辑、分页与 CSS。
- `sam-erp/sam-erp-be`：参数 JSON 分类写入、历史信号定义读取和详情安全投影。

不修改 Driver Service（驱动服务）、数据库结构、历史数据、操作日志写入语义、历史列表分页或现有设备认证方式。ERP 后端工作树已有未跟踪文件 `docs/sql/2026-07-27-qt-press-job-operation-log.sql`，实施时必须保持原样。

## 2. 现有数据流

### 2.1 参数写入

同一组 `press_mould_job_info.start_parameter_records/end_parameter_records` JSON 字段当前存在两条活跃写入路径：

1. QT App：`PressJobInfoServiceImpl.recordPressJobParametersForQt` 校验认证设备和启用信号，再调用 `PressMouldJobInfoServiceImpl.recordPressJobParametersForQt` 写入在制作业。
2. 旧 ERP Vue：`PressMouldJobInfoController.recordStartParams` 调用 `PressMouldJobInfoServiceImpl.recordStartParams/generateParameterRecords` 写入开始或完工参数。

两条路径都已持有 `ModbusSignals`，因此分类必须在 ERP 根据服务端定义生成，不能接受客户端提交的 `valueKind`。

### 2.2 历史读取

`QtPressWorkingController.historyJobDetail` 先从登录上下文解析 `deviceId`，再通过 `selectQtPressJobHistoryDetail(deviceId, mouldJobId)` 限定已完成作业。当前 `toParameterProjection` 只输出 `parameterName/value/unit/recordedAt`，并把一侧损坏与另一侧正常数据隔离。

QT App 经 `erpClient.fetchPressJobHistoryDetail` 收窄响应，再由 `HistoryDetailContent` 使用 `alignHistoryParameters` 对齐两列。`alignHistoryParameters` 已让开始值和完工值共用 `formatHistoryParameterValue`，因此状态转换只需扩展这个入口。

## 3. ERP 实现设计

### 3.1 单一分类规则

在 `sam-erp` 的 Modbus domain（领域）包增加最小静态支持类 `ModbusSignalValueKind`，只提供：

- 常量 `STATE = "state"`、`SCALAR = "scalar"`。
- `classify(ModbusSignals)`：规范化 token（标记）后执行固定白名单判断。
- `isSupported(String)`：只接受精确文本 `state` 或 `scalar`，不执行 trim（去空格）或大小写兼容。

状态分类规则与现有实时参数一致：

- `registerType ∈ {"1", "coil", "coils"}`；或
- `dataType ∈ {"bit", "bool", "boolean"}`。

规范化只用于受信任的信号定义：去除空白并按 `Locale.ROOT` 转为小写。历史 JSON 自带的 `valueKind` 不规范化，避免把非法或被篡改的标记默认为合法。

该类没有配置、接口或实例状态；两条写入路径和历史回退共用它，防止 Java 侧规则分叉。现有 service/controller 测试即为它的可运行契约，不增加独立测试框架。

### 3.2 两条写入路径保存快照分类

在两个已有参数 record map（记录映射）中加入：

```text
valueKind = ModbusSignalValueKind.classify(signal)
```

具体落点：

- `PressMouldJobInfoServiceImpl.recordPressJobParametersForQt`。
- `PressMouldJobInfoServiceImpl.generateParameterRecords`。

字段与 `signalValue` 同层，原始值、单位、名称、时间、ID 和 code 均保持现状。旧代码反序列化 JSON 时会忽略未知字段，因此不需要 schema migration（结构迁移）或数据回填。

本次不修正旧 `recordStartParams` 的其他历史行为；只增加分类字段，避免扩大范围。

### 3.3 一次加载认证设备定义

`QtPressWorkingController` 注入已有 `IModbusSignalsService`。详情确认作业属于认证设备后，创建仅包含 `deviceId` 的 `ModbusSignals` 查询，一次调用 `selectSignalsList`，不设置 `isActive`，从而允许旧记录匹配后来停用但仍存在的定义。

读取结果必须再次过滤 `definition.deviceId == context.deviceId`，建立一个 controller-private（控制器私有）的只读索引：

- `byId`：有效正数 ID 对应唯一数据库定义。
- `byUniqueCode`：同设备 code 只出现一次时保留。
- `duplicateCodes`：第二次发现同 code 时从 `byUniqueCode` 删除并永久标记为重复，后续不得重新加入。

不得使用 Map 最后写入者覆盖重复 code，也不得按名称、单位、值或跨设备 code 匹配。

### 3.4 单行分类解析与回退

`toHistoryDetail` 将同一索引传给开始和完工两次 `toParameterProjection`，不逐行查询数据库。每条参数按以下顺序确定分类：

1. `valueKind` 是精确文本 `state` 或 `scalar`：直接使用快照标记。
2. 否则安全读取正数 `signalId`，命中 `byId` 时用共享分类规则派生。
3. ID 缺失、畸形或未命中时，安全读取非空文本 `signalCode`；只有命中 `byUniqueCode` 时派生。
4. 其余情况不输出 `valueKind`。

`valueKind`、`signalId`、`signalCode` 的缺失、类型错误或非法值只让当前行无法分类，不得抛出异常或把整侧状态改为 `invalid`。既有展示字段仍沿用现有严格规则：非标量 `signalValue` 或错误类型的名称、单位、时间继续使该侧显示格式异常。

投影响应最多增加：

```json
{
  "parameterName": "就绪",
  "value": 1,
  "unit": "",
  "recordedAt": "2026-07-28 08:00:00",
  "valueKind": "state"
}
```

不得输出或记录 `signalId`、`signalCode`、`registerType`、`dataType`、寄存器地址、完整配置或参数 JSON 原文。

### 3.5 配置读取失败降级

信号定义查询单独捕获 `RuntimeException`，使用空索引继续投影：

- 已保存合法 `valueKind` 的新记录仍正常展示。
- 旧记录保留原始值并省略分类。
- 详情概要、操作记录和另一侧参数不受影响。

如需记录降级事件，只复用现有中文 lifecycle log（生命周期日志）并携带 `correlationId`；不写异常正文、信号定义或参数内容。

## 4. QT App 实现设计

### 4.1 View Model 与响应收窄

`PressJobHistoryParameter` 增加可选 `valueKind?: "state" | "scalar"`。`narrowPressJobHistoryParameters` 使用一个精确白名单读取器：未知字符串、大小写变体、数字、对象和数组均丢弃，不影响该行已有标量值与 `status`。

`PressJobHistoryOperation` 删除 `content`，`narrowPressJobHistoryOperations` 不再读取后端兼容字段。后端继续返回 `content` 时，前端白名单自然剔除；旧 QT 版本仍可继续消费该字段。

### 4.2 两列统一格式化

`formatHistoryParameterValue` 保持为开始/完工两列唯一入口：

```text
status 不是 recorded 或 value 缺失 -> 未记录
valueKind == state 且 value 为 0 / "0" / false -> 否
valueKind == state 且 value 为 1 / "1" / true  -> 是
其他情况 -> String(value)
```

字符串 `"true"/"false"`、未知状态值以及所有 scalar（标量）值不猜测转换。这样普通数值 `0/1` 保持原样，开始和完工两列不会分叉。

参数状态区域删除两个 `missing` 文案分支，仅保留 `invalid` 分支。Table（表格）继续用“未记录”和“记录不完整”表达单侧缺失。

### 4.3 筛选区

现有每个 `<label>` 已按“描述 span + 控件”排列，不增加 DOM。CSS 调整如下：

- `.press-job-history-page__field` 从 Grid 改为水平 Flex。
- 描述 span 使用统一固定宽度且 `white-space: nowrap`。
- `RangePicker`、`Input`、`Select` 占据字段剩余宽度。
- 三个字段现有外层 flex 宽度、单行 `flex-wrap: nowrap`、44px 控件高度、校验提示、查询按钮和可访问名称不变。

日期错误提示从控件列起点显示，避免覆盖左侧描述。

### 4.4 操作记录与分页

`HistoryDetailContent` 增加局部 `operationPage`，固定常量 `OPERATION_PAGE_SIZE = 5`。可见记录使用标准数组 `slice`；`detail.moldJobId` 或 `detail.operationRecords` 变化时恢复第 1 页。

操作面板保持 Flex column（纵向弹性布局）：

- `<ol>` 占据剩余高度，`min-height: 0; overflow: auto`。
- 已安装的 Ant Design `Pagination` 作为不可收缩底栏，仅在记录数超过 5 时显示。
- `showSizeChanger={false}`，不允许操作员改变每页数量。

每项只保留两行：

1. 操作名称 + 成功/失败 Tag。
2. `班组 / 作业人员：{班组或未记录} / {作业人员或未记录}`。

删除 `border-bottom`，把 item（项目）最小高度和 padding 收紧到容纳两行文本。`li` 使用 `position: relative`，`li:not(:last-child)::before` 从当前圆点中心向下连接至下一项，覆盖列表 gap；圆点使用更高 `z-index`。最后一项和分页边界不绘制延伸线。

## 5. 并发、错误与兼容

- 历史详情既有 request version（请求版本）机制保持不变，过期响应不得覆盖当前 Drawer。
- 分页状态只属于已收窄的本地操作数组，不写入 URL，也不触发 ERP 请求。
- 后端先部署：旧前端忽略 `valueKind`。
- QT 后部署：遇到旧后端时缺少 `valueKind`，安全显示原值。
- 后端回滚：已写入 JSON 的未知字段被旧代码忽略。
- QT 回滚：ERP 继续保留 `content`，旧前端仍能展示。

## 6. 测试设计

### 6.1 ERP RED/GREEN（红灯/绿灯）

`PressMouldJobInfoServiceImplQtTest`：

- Qt 写入路径开始/完工的 coil/bit → `state`，普通寄存器 → `scalar`。
- 旧 `recordStartParams/generateParameterRecords` 路径同样保存分类。
- `signalValue` 的 String、Number、Boolean 原值不变。

`QtPressWorkingControllerTest`：

- 合法快照分类优先，不依赖当前配置。
- 旧记录按同设备 ID 命中，包括停用定义。
- ID 失败后按唯一 code 命中；重复 code 不命中。
- 非法 `valueKind`、畸形 ID/code 只丢失当前行分类。
- 跨设备相同 code 不命中。
- 定义只查询一次；查询异常时详情仍成功且保留原值。
- 响应不包含信号身份、配置、异常正文或其他敏感字段。

定向命令：

```bash
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
  /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
  -pl sam-erp,yr-admin -am \
  -Dtest=PressMouldJobInfoServiceImplQtTest,QtPressWorkingControllerTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

### 6.2 QT RED/GREEN

`erpClient.test.ts`：

- 只接收 `state/scalar`，未知分类丢弃。
- 标量安全规则保持不变。
- `content`、信号身份和嵌套字段不进入 View Model。

`PressJobHistoryPage.test.tsx`：

- 开始/完工 `state` 的 `0/1/false/true` 统一显示“否/是”。
- scalar `0/1`、字符串 `true/false` 和未知分类保持原值。
- 删除 missing 提示并保留 invalid 提示。
- 首屏最多渲染 5 条操作，组合文案不含“内容”。
- 切换作业或记录集恢复第一页。
- CSS 契约包含水平筛选、无横线、节点连接线、列表滚动和固定分页底栏。

定向命令：

```bash
cd qt-app/frontend
npm test -- src/services/erpClient.test.ts src/components/PressJobHistoryPage.test.tsx
./node_modules/.bin/tsc --noEmit
npm run build
```

### 6.3 视觉与范围验证

- 在 1280×720 浅色和深色主题下核对三个筛选项始终单行且描述/控件水平排列。
- 参数 Table 可用高度增加，缺失侧只在单元格内表达。
- 5 条操作、字体换行和长名称下 Pagination 始终位于面板底部。
- 当前页相邻节点连续、无横向分割线，最后节点不连向分页器。
- `git diff` 确认无 Driver Service、数据库 ChangeSet、依赖、主题或用户未跟踪 SQL 改动。

## 7. 实施顺序

1. ERP 先写失败测试，再实现共享分类、两条 JSON 写入和历史回退。
2. QT `erpClient` 先写失败测试，再扩展安全类型与删除 `content`。
3. 历史页面先写失败测试，再完成统一格式化、提示删除、筛选 CSS、分页和时间线。
4. 分别运行后端、前端定向验证与构建，再做 1280×720 视觉检查和 OpenSpec 严格校验。

该顺序允许 ERP 与 QT 独立部署和回滚，不需要数据迁移或停机窗口。

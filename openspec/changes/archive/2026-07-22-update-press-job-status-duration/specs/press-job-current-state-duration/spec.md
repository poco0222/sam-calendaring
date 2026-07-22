<!--
@file spec.md - 压机作业当前状态与预计时长规格
@author PopoY
@created 2026-07-21 16:43:19
@purpose 规定出线信号状态展示和预计时长持久化的可验收行为。
-->

## ADDED Requirements

### Requirement: 当前状态由是否出线信号统一展示

QT App（Qt 应用）压机作业页面 MUST（必须）从经过脱敏的 Driver Service（驱动服务）signal snapshot（信号快照）中定位 `是否出线` 信号，并在操作区和当前作业表中统一展示设备入线状态。系统 MUST 支持以 map key（映射键）直接命名的信号，以及以 `signalCode` 为 key、在值对象中通过 `signalName`、`name` 或 `semanticKey` 标识的信号。

#### Scenario: 信号表示已入线

- **WHEN** `是否出线` 的标量值或值对象中的 `value` 为 `false`、`0` 或字符串 `"0"`/`"false"`
- **THEN** 操作区和当前作业表 MUST 显示绿色 `已入线` Tag（标签）

#### Scenario: 信号表示已出线

- **WHEN** `是否出线` 的标量值或值对象中的 `value` 为 `true`、`1` 或字符串 `"1"`/`"true"`
- **THEN** 操作区和当前作业表 MUST 显示红色 `已出线` Tag（标签）

#### Scenario: 通过信号元数据定位出线状态

- **WHEN** signal snapshot 的 map key 是 `signalCode`，且对应值对象的 `signalName`、`name` 或 `semanticKey` 等于 `是否出线`
- **THEN** 页面 MUST 使用该对象的 `value` 决定入线或出线状态
- **AND** 页面 MUST NOT（不得）要求 map key 固定为中文 `是否出线`

#### Scenario: 出线信号缺失或值不可识别

- **WHEN** signal snapshot 中没有可定位的 `是否出线` 信号，或其值不是受支持的 boolean（布尔值）或 `0/1`
- **THEN** 操作区和当前作业表 MUST 显示中性 `未知` Tag
- **AND** 页面 MUST NOT 将未知状态误报为 `已入线` 或 `已出线`

#### Scenario: 作业生命周期判断保持不变

- **WHEN** 页面执行开始加工、完成加工、实际时长计算或其他依赖 ERP `status` 的业务判断
- **THEN** 页面 MUST 继续使用 ERP `status`
- **AND** `是否出线` 信号 MUST 仅替换“当前状态”的展示内容

### Requirement: 预计时长确认后按 ERP 作业 ID 持久化

QT App 压机作业页面 MUST 在数字键盘确认预计时长时，将输入规整并校验为大于零的整数或最多一位小数。有 ERP 作业 ID 的当前作业 MUST 调用 `PUT /modbus/pressjob`，JSON body（请求体）MUST 仅包含 `{ id, expectedDuration }`；页面 MUST NOT 接触或转发裸 `sessionToken`、`signalConfig`、`deviceId`、`ip` 或 `port`。

#### Scenario: 有 ERP 作业 ID 时保存有效预计时长

- **WHEN** 当前作业包含 ERP `id`，且操作员确认的预计时长为有效正数
- **THEN** ERP client（ERP 客户端）MUST 使用当前会话认证调用 `PUT /modbus/pressjob`
- **AND** JSON body MUST 仅包含该 `id` 和规整后的 `expectedDuration`
- **AND** 保存成功后页面 MUST 保留规整后的值并显示中文成功反馈

#### Scenario: 保存预计时长失败

- **WHEN** `PUT /modbus/pressjob` 返回 HTTP failure（HTTP 失败）、ERP 业务失败或发生网络异常
- **THEN** 页面 MUST 恢复该行保存前的预计时长
- **AND** 页面 MUST 显示中文失败反馈
- **AND** 失败 MUST NOT 阻断其他压机作业操作

#### Scenario: 预计时长格式无效

- **WHEN** 操作员确认空值、零、负数、前导零或超过一位小数的值
- **THEN** 页面 MUST 显示中文格式提示并保持编辑状态
- **AND** 页面 MUST NOT 调用预计时长更新接口

#### Scenario: 当前作业没有 ERP 作业 ID

- **WHEN** 当前作业没有 ERP `id`，且操作员确认有效预计时长
- **THEN** 页面 MUST NOT 调用 `PUT /modbus/pressjob`
- **AND** 页面 MUST 保留规整后的本地值并提示将在开始加工时提交
- **AND** 既有开始加工请求 MUST 继续提交该 `expectedDuration`

#### Scenario: 关闭键盘而不确认

- **WHEN** 操作员修改预计时长后点击数字键盘“关闭”而非“确认”
- **THEN** 页面 MUST 放弃未确认草稿并恢复保存前的值
- **AND** 页面 MUST NOT 调用预计时长更新接口

#### Scenario: 避免重复提交

- **WHEN** 某行预计时长更新请求仍在进行中
- **THEN** 页面 MUST 阻止该行再次提交预计时长

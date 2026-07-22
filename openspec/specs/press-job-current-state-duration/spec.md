# press-job-current-state-duration Specification

## Purpose
TBD - created by archiving change update-press-job-status-duration. Update Purpose after archive.
## Requirements
### Requirement: 当前状态由是否出线信号统一展示

The QT App press-job action area MUST locate the `是否出线` signal in the redacted Driver Service signal snapshot and render device line status. The current-job table MUST read each ERP row's `status` directly as `加工状态` and MUST NOT replace processing status with the `是否出线` signal. Signal lookup MUST support a directly named map key and a `signalCode` key whose value object identifies the signal through `signalName`, `name`, or `semanticKey`.

#### Scenario: 信号表示已入线

- **WHEN** the `是否出线` scalar or object `value` is `false`, `0`, `"0"`, or `"false"`
- **THEN** the action area MUST render a green `已入线` Tag

#### Scenario: 信号表示已出线

- **WHEN** the `是否出线` scalar or object `value` is `true`, `1`, `"1"`, or `"true"`
- **THEN** the action area MUST render a red `已出线` Tag

#### Scenario: 通过信号元数据定位出线状态

- **WHEN** the signal snapshot map key is `signalCode` and its value object's `signalName`, `name`, or `semanticKey` equals `是否出线`
- **THEN** the action area MUST use that object's `value` to determine line-in or line-out status
- **AND** the page MUST NOT require the map key itself to equal `是否出线`

#### Scenario: 出线信号缺失或值不可识别

- **WHEN** the signal snapshot has no identifiable `是否出线` signal or its value is not a supported boolean or `0/1`
- **THEN** the action area MUST render a neutral `未知` Tag
- **AND** the page MUST NOT report an unknown value as `已入线` or `已出线`

#### Scenario: Current job is pending

- **WHEN** a current-job row's ERP `status` is `0`
- **THEN** the table's `加工状态` column MUST render `待加工`
- **AND** every cell in that row MUST use a yellow background

#### Scenario: Current job is running

- **WHEN** a current-job row's ERP `status` is `1`
- **THEN** the table's `加工状态` column MUST render `进行中`
- **AND** every cell in that row MUST use a green background

#### Scenario: Current-job status is unrecognized

- **WHEN** a current-job row's ERP `status` is neither `0` nor `1`
- **THEN** the table MUST render a non-empty status unchanged and use the existing placeholder for an empty status
- **AND** the row MUST NOT receive the pending or running background

#### Scenario: 作业生命周期判断保持不变

- **WHEN** the page starts processing, completes processing, calculates actual duration, or makes another job lifecycle decision
- **THEN** the page MUST continue to use ERP `status`
- **AND** the action-area `是否出线` signal MUST NOT participate in job lifecycle decisions

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

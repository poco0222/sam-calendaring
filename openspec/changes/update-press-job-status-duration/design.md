<!--
@file design.md - 压机作业状态与预计时长更新技术设计
@author PopoY
@created 2026-07-21 16:40:47
@editor PopoY
@edited 2026-07-21 17:57:59
@purpose 说明出线信号解析、预计时长持久化和失败回滚的最小实现方案。
-->

## Context

`PressJobPage` 当前有两处“当前状态”展示：操作区固定显示“未启动”，当前作业表按 ERP `status` 显示作业生命周期。页面已经接收经过脱敏的 Driver Service（驱动服务）`signalValues`，但尚未用其中的 `是否出线` 信号展示设备入线状态。

Driver Service 首次快照可能以 `signalCode` 为 map key（映射键），并把 `signalName`、`name`、`semanticKey` 和 `value` 保留在值对象中；SSE（服务器发送事件）更新会保留该元数据并替换 `value`。因此不能只按中文 key 查找。

预计时长当前只保存在 `plannedDurationDrafts`。ERP 当前作业响应包含持久化 `id`，但 `narrowPressJobCurrentJobs` 没有将其带入页面模型。sam-erp 已提供 `PUT /modbus/pressjob`，请求 body（请求体）为 `{ id, expectedDuration }`。

## Goals / Non-Goals

**Goals:**

- 让页面两处“当前状态”统一展示 `是否出线` 的实时结果。
- `false`/`0` 显示绿色 `已入线`，`true`/`1` 显示红色 `已出线`。
- 数字键盘确认有效预计时长后，有 ERP 作业 ID 时立即持久化；失败恢复原值。
- 沿用现有认证、脱敏、中文提示、数字键盘和预计时长校验。

**Non-Goals:**

- 不修改 ERP 作业生命周期 `status` 的业务含义或开始/完成加工判断。
- 不修改 Driver Service、PLC 写入流程、ERP 后端或数据库 schema（数据库结构）。
- 不新增依赖、全局状态、日志体系或新的视觉组件。

## Decisions

### 1. 在页面内解析现有安全信号快照

新增一个纯函数扫描 `signalValues`：优先匹配值对象中的 `signalName`、`name` 或 `semanticKey` 等于 `是否出线`，同时兼容 map key 本身等于 `是否出线`。命中后读取对象的 `value` 或标量值，并只接受 boolean（布尔值）、`0/1` 及其字符串形式。

解析结果统一供操作区和当前作业表的状态 Tag（标签）使用：入线使用绿色、出线使用红色；信号缺失或值不可识别时显示中性 `未知`。ERP `status` 继续仅用于作业流程判断和实际时长计算。

不选择硬编码单一 map key，因为真实 key 可能是 `signalCode`；不修改 Driver Service 增加投影字段，因为现有快照已经携带足够元数据。

### 2. 将 ERP 作业 ID 纳入当前作业白名单模型

在 `PressJobCurrentJobRow` 增加可选 `pressJobId`，由 `narrowPressJobCurrentJobs` 从 ERP `Long id` 收窄为 number（数字）。`localJobSessionId` 继续只作为 React row key（行键）和页面动作身份，不冒充数据库主键。

不保留 sam-erp 的多字段主键兼容逻辑；当前接口响应契约已有明确 `id`，额外兼容字段会掩盖数据问题。

### 3. 复用现有页面确认交互执行保存

`NumericKeypad` 的“确认”回调先用现有 `commitPlannedDurationInput` 规整输入，再复用 `isValidExpectedDuration` 校验大于零的整数或最多一位小数。

- 无效值：显示中文警告并保持键盘打开。
- 有 `pressJobId`：调用页面注入的更新回调；成功后保留规整值并提示“预计时长已保存”，失败时删除该行草稿以恢复 ERP 原值，并提示“预计时长保存失败，已恢复原值”。
- 无 `pressJobId`：不发请求，保留本地草稿并提示“预计时长已记录，将在开始加工时提交”。
- 点击“关闭”只放弃未确认草稿并恢复原值。

保存期间按当前行设置 submitting（提交中）状态，避免重复确认；不增加表单库或新的缓存层。

### 4. 以最小 PUT 客户端连接既有 ERP 接口

在 `erpClient` 增加与 `postJson` 对称的原生 `fetch` PUT helper（PUT 辅助函数），继续使用 `buildErpJsonHeaders` 注入 bearer token（承载令牌）。新增的预计时长 client function（客户端函数）只发送 `{ id, expectedDuration }`，并通过现有 `unwrapErpAjaxResult` 拒绝 ERP 业务失败。

`App` 继续持有 `erpBaseUrl` 和 `sessionToken`，只向 `PressJobPage` 注入安全的更新回调；页面不接触会话令牌。没有必要把所有 HTTP method（HTTP 方法）重构为通用 transport（传输层）。

## Risks / Trade-offs

- [真实快照缺少可识别的信号名称元数据] → 显示 `未知`，不将缺失误判为 `已入线`；实时信号表仍可用于现场核对配置。
- [PLC 离散量以数字而非 boolean 返回] → 解析函数只兼容明确的 `0/1`，拒绝其他数字和值。
- [ERP 更新成功但响应数据不含预计时长] → 直接提交已验证的本地值，不额外发起刷新请求；后续现有刷新仍以数据库结果为准。
- [ERP 更新失败或网络中断] → 恢复原值并显示中文错误，不影响开始加工、信号刷新或其他作业动作。

## Migration Plan

1. 先补充纯函数、ERP client 和页面行为测试，再实现最小代码。
2. 运行 frontend tests（前端测试）、TypeScript check（类型检查）和 production build（生产构建）。
3. 部署不需要数据迁移；回滚前端提交即可恢复原行为。

## Open Questions

无。接口、字段和值语义均已从 sam-erp 和当前 Driver Service 代码路径确认。

## Implementation Divergence（实现差异）

审查发现“始终删除草稿以恢复 ERP 原值”会在连续编辑时丢失最近一次已确认值，因此实现改为在编辑开始时记录 baseline source（基线来源）：原值来自已确认本地草稿时，保存失败或关闭恢复该草稿；原值直接来自 ERP row（ERP 行）时删除草稿，继续接收后续 ERP 刷新值。该处理符合增量规格中“恢复保存前预计时长”的要求。

为避免同一 render（渲染周期）重复确认和跨行异步完成互相覆盖，页面使用一个同步 request ref（请求引用）串行化预计时长更新；保存期间暂时禁用其他预计时长编辑。实际反馈文案为“预计时长保存成功”“预计时长保存失败，请重试。”和“预计时长将在开始加工时提交。”，均保持增量规格要求的中文反馈语义。

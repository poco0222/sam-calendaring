<!--
@file design.md - 压机信号值投影修复设计
@author PopoY
@created 2026-07-23 11:04:15
@purpose 规定 QT App 在 ERP 参数请求边界执行标量投影和无效值阻断的最小方案。
-->

## Context

Driver Service（驱动服务）为 ERP 配置的信号返回 `{ value, name, unit, ... }` 元数据对象，QT App 的信号表格和状态判断需要保留该结构。`recordPressJobParameters` 当前仅过滤禁止提交的顶层键，随后把其余对象直接序列化到 `signalValues`；ERP 只接受 `String`、`Number` 或 `Boolean`，因此完工参数记录失败，后续完工请求按既有安全流程被阻止。

## Goals / Non-Goals

**Goals:**

- 在所有压机参数记录请求的共同客户端边界生成符合 ERP 契约的标量 `signalValues`。
- 兼容既有直接标量输入，并维持敏感字段过滤和参数失败阻止完工的行为。
- 在发起 HTTP 请求前拒绝不能安全投影的值，错误信息不包含原始信号值。

**Non-Goals:**

- 不改变 Driver 信号快照结构或页面展示数据。
- 不放宽 ERP 的参数校验，也不让 ERP 信任客户端提供的元数据。
- 不改变完工调用顺序、幂等键、认证头或 `correlationId`（关联 ID）处理。

## Decisions

1. 在 `erpClient.ts` 的 `narrowPressSignalValues` 统一投影。直接 `string`、有限 `number`、`boolean` 原样保留；非数组对象仅提取自身 `value`，且该值也必须是上述标量。这样开始参数、完工参数和后续复用该客户端的调用具有同一契约。
2. 先按现有禁止键集合过滤顶层敏感字段，再处理允许的信号项；Driver 元数据中的名称、单位和其他字段不会进入 ERP 请求体。
3. 对 `null`、数组、缺少 `value` 的对象、嵌套对象、`undefined`、非有限数字及其他类型抛出中文客户端错误，并在调用 `sendJson` 前终止。调用方继续沿用既有“参数记录失败则不发送完工请求、不清理本地状态”的流程。
4. 不在 Driver 端全局压平快照，因为信号展示和状态计算仍需要元数据；不放宽 ERP 接受任意对象，因为 ERP 应继续从可信配置读取信号定义；不只在完工页面临时解包，以免开始参数与其他调用路径出现契约分叉。

## Risks / Trade-offs

- [历史调用传入非标量但此前未被本地拒绝] → 在请求前显式失败，并保留参数失败阻止完工的安全策略，避免 JSON 序列化后变成 `null` 或由 ERP 模糊拒绝。
- [错误信息暴露信号内容] → 只指出信号键对应值无效，不拼接原始值或元数据。
- [投影误伤展示] → 仅修改 ERP 参数客户端的请求体构造，Driver session（驱动会话）和 UI 数据保持原样。

## Migration Plan

无需数据迁移。部署新的 QT App 前端资源后生效；回滚时恢复本变更提交即可，Driver 和 ERP 无需同步回滚。

## Open Questions

无。

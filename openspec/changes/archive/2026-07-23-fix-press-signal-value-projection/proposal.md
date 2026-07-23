<!--
@file proposal.md - 压机信号值投影修复提案
@author PopoY
@created 2026-07-23 11:04:15
@purpose 记录 QT App 向 ERP 提交压机参数时误传 Driver 元数据对象的根因与修复边界。
-->

## Why

Driver Service（驱动服务）的 ERP 信号快照会为每个信号返回包含 `value` 和展示元数据的对象，但 QT App（Qt 应用）当前把整个对象直接提交给 ERP。ERP 参数接口只接受标量信号值，因此有效的完工快照会被拒绝并阻止完工落库。

## What Changes

- 在 QT App 调用 ERP 压机参数接口的统一边界，将 Driver 元数据对象投影为其 `value` 标量。
- 保持已有标量值不变，并继续过滤禁止提交的敏感顶层字段。
- 对 `null`、数组、缺少有效 `value` 的对象及其他非标量值在发起 HTTP 请求前明确失败，继续维持“参数记录失败则阻止完工”的安全约束。
- 增加回归测试，覆盖元数据对象投影、标量兼容、敏感字段过滤和无效值阻断。

## Capabilities

### New Capabilities

无。本变更不引入新能力。

### Modified Capabilities

无。本变更恢复既有 QT App → ERP 参数契约，不改变现有规格要求或验收场景。

## Impact

- 影响 `qt-app/frontend/src/services/erpClient.ts` 的压机参数请求收窄逻辑及其单元测试。
- 不修改 Driver Service 快照结构、ERP 接口、数据库 Schema（模式）或公开 API（应用程序接口）。
- 信号展示仍使用完整元数据对象；只有提交 ERP 参数记录时执行标量投影。

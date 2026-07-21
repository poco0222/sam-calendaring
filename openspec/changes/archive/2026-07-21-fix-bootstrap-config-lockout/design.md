<!--
@file design.md - 启动失败配置锁死修复设计
@author PopoY
@created 2026-07-21 15:30:00
@purpose 规定启动失败时保留本机配置并提供受限恢复编辑的最小实现。
-->

## Context

当前 `loadValidatedBootstrapSession` 先读取并校验 native config（原生配置），再等待 ERP bootstrap session（启动会话）。只有整个调用成功时，Hook（钩子）才保存配置；ERP 登录或租约获取失败时，异常没有 `config`，最终页面得到 `config: null`、`data: null`。

配置编辑权限又只存在于成功会话的 `data.bootstrapConfigEditable`。登录失败无法取得 `sessionToken`，因此不可能读取 `approve.press.config`，页面便落入“配置可能错误，但配置不可修改”的锁死状态。

## Goals / Non-Goals

**Goals:**

- ERP 会话加载失败后仍回显已经成功读取且通过字段完整性校验的本机配置。
- 会话建立前的启动错误允许现场人员修正配置并重试。
- 成功会话继续遵守 ERP 审批结果；审批接口读取失败仍保持只读。

**Non-Goals:**

- 不修改 `approve.press.config` 的含义或 ERP API（接口）。
- 不放开成功登录后的未授权配置编辑。
- 不新增状态管理层、权限接口、依赖或配置字段。

## Decisions

1. `loadValidatedBootstrapSession` 捕获 ERP session loader（会话加载器）的 object error（对象错误），沿用现有 `error.config` 载荷保存 `nextConfig` 后原样抛出。这样现有错误码、中文错误映射和诊断链保持不变，Hook 可继续复用 `readBootstrapConfigFromError`。
2. `BootstrapDashboard` 的有效编辑条件为：ERP 明确允许编辑，或 `status === "error" && config !== null && data === null`。第二个条件只覆盖“本机配置已读取、成功会话尚未建立”的恢复窗口。
3. 不把所有 `bootstrapConfigApprovalState === "unavailable"` 全局改为可编辑。成功登录但审批接口临时失败时仍应 fail-closed（失败关闭），避免绕过 ERP 配置锁。
4. 使用现有 Hook 和 Dashboard 测试留下两个最小回归检查，不新增测试框架或辅助抽象。

## Risks / Trade-offs

- [启动失败期间本机操作者可以修改绑定配置] → 该路径与 FirstRunConfigPage（首次启动配置页）的恢复边界一致；一旦会话成功，立即恢复 ERP 审批控制。
- [非对象异常无法携带配置] → 当前 ERP 客户端统一抛出 Error/object error（错误对象）；不为未出现的 primitive throw（原始值异常）新增包装协议。
- [错误原因可能是 ERP 服务故障而非配置错误] → 仍允许修改但不自动改值，操作员可选择只重试；保存继续经过现有必填项和 URL 校验。

## Migration Plan

无需数据迁移。发布新的 QT App（Qt 应用）前端资源即可；回滚时恢复相关 Hook、Dashboard 及测试改动。

## Open Questions

无。

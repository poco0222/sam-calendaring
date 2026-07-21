<!--
@file spec.md - 启动配置恢复增量规格
@author PopoY
@created 2026-07-21 15:30:00
@purpose 规定启动会话失败时允许修正本机配置且不绕过成功会话审批。
-->

## ADDED Requirements

### Requirement: 启动会话失败时保留配置并允许恢复编辑

QT App（Qt 应用）在成功读取完整 native config（原生配置）后，如果 ERP bootstrap session（启动会话）建立失败，SHALL（必须）保留已读取配置并允许操作员在启动配置面板中修改、保存和重试。

#### Scenario: 完整配置导致 ERP 启动失败

- **WHEN** 本机六项启动配置均完整，但 ERP auto-login（ERP 免登录）或后续启动会话加载失败
- **THEN** 启动仪表盘回显该六项配置
- **AND** 启动配置输入项和保存操作可用
- **AND** 保存后复用现有 bootstrap retry（启动重试）流程

### Requirement: 成功会话继续遵守 ERP 配置审批

QT App（Qt 应用）在 ERP bootstrap session（启动会话）成功建立后，SHALL（必须）仅使用 `approve.press.config` 的有效结果决定启动配置是否可编辑，不得使用错误恢复规则覆盖成功会话的审批状态。

#### Scenario: 成功会话的审批状态不可用

- **WHEN** ERP 启动会话已成功建立，但 `approve.press.config` 读取失败或状态不可用
- **THEN** 启动配置保持只读
- **AND** 不展示保存配置操作

<!--
@file proposal.md - 启动失败配置锁死修复提案
@author PopoY
@created 2026-07-21 15:30:00
@purpose 记录 ERP 启动链路失败后无法修改本机启动配置的根因与修复边界。
-->

## Why

QT App（Qt 应用）读取到完整但错误的启动配置后，ERP auto-login（ERP 免登录）会失败；此时应用既丢失已读取配置，又因无法取得 `approve.press.config` 而把配置面板设为只读，操作员无法修正错误配置，只能反复重试并持续失败。

根因是 `useBootstrapSession` 仅在 ERP 会话成功或 `CONFIG_INVALID` 时保留 native config（原生配置），同时 `BootstrapDashboard` 只从成功会话数据读取编辑权限，没有为会话建立前的失败提供恢复路径。

## What Changes

- ERP 启动会话失败时保留已经成功读取的六项 native config，供配置面板回显。
- 仅在 bootstrap session（启动会话）尚未建立且启动状态为错误时，允许编辑并保存启动配置。
- 成功登录后继续严格遵守 ERP 返回的 `approve.press.config`，审批接口不可用时仍保持只读。
- 增加最小回归测试，覆盖配置保留和错误态恢复编辑。

## Capabilities

### New Capabilities

- `bootstrap-config-recovery`: 固化启动会话建立失败时的配置回显、恢复编辑及成功会话审批边界；这是对既有行为的修复规格，不引入新的外部接口。

### Modified Capabilities

无；当前仓库没有对应的 OpenSpec 主规格。

## Impact

- 修改 `qt-app/frontend/src/hooks/useBootstrapSession.ts` 和 `qt-app/frontend/src/components/BootstrapDashboard.tsx`。
- 调整对应 frontend tests（前端测试）。
- 不修改 ERP API（接口）、Driver Service（驱动服务）、QSettings（Qt 配置存储）白名单、数据库或依赖。

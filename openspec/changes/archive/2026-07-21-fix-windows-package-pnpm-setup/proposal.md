<!--
@file proposal.md - Windows 打包 pnpm 初始化修复提案
@author PopoY
@created 2026-07-21 14:47:25
@purpose 记录 GitHub Actions（自动化工作流）无法在缓存阶段定位 pnpm 的根因与修复边界。
-->

## Why

Windows 打包 workflow 在 `actions/setup-node@v6` 的 pnpm cache（缓存）初始化阶段失败，导致后续前端、Driver Service（驱动服务）和 Qt App（Qt 应用）均未执行。

根因是 `setup-node` 使用 `cache: pnpm` 时要求 `pnpm` 已在 `PATH` 中，但当前 workflow 将 `corepack` 启用 pnpm 的步骤放在 `setup-node` 之后。

## What Changes

- 在 `actions/setup-node` 前通过官方 `pnpm/action-setup` 安装既有 `PNPM_VERSION`。
- 删除后置且重复的 `corepack` pnpm 初始化步骤。
- 保留现有 pnpm store cache（存储缓存）和 lockfile（锁文件）路径配置。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无；本次仅修复 workflow 的工具初始化顺序，不改变产品行为或验收场景。

## Impact

- 修改 `.github/workflows/package-windows.yml`。
- 不修改应用代码、公开 API（接口）、数据结构或运行时日志。
- 使用官方 `pnpm/action-setup@v6` GitHub Action（动作）。

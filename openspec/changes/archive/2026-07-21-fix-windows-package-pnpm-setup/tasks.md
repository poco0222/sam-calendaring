<!--
@file tasks.md - Windows 打包 pnpm 初始化修复任务
@author PopoY
@created 2026-07-21 14:47:25
@purpose 跟踪最小修复及验证证据。
-->

## 1. 修复 workflow

- [x] 1.1 运行失败检查，确认 `pnpm/action-setup` 未先于 `actions/setup-node`。
- [x] 1.2 在 `setup-node` 前安装指定 pnpm，并删除重复的后置 Corepack（包管理器桥接工具）步骤。

## 2. 验证

- [x] 2.1 确认 OpenSpec/Comet 目录未被整体忽略，并运行 workflow 顺序、YAML 静态检查及前端依赖安装、测试和构建。

<!-- review skipped: review_mode=off，本次仅修正 workflow 初始化顺序与精确忽略规则，已通过静态检查、完整测试和生产构建验证。 -->

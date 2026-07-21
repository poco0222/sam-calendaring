<!--
@file design.md - Windows 打包 pnpm 初始化修复设计
@author PopoY
@created 2026-07-21 14:47:25
@purpose 规定 pnpm、Node.js 与依赖缓存的最小正确初始化顺序。
-->

## 修复方案

将 `pnpm/action-setup@v6` 放在 `actions/setup-node@v6` 前，并复用 `PNPM_VERSION` 安装 pnpm。这样 `setup-node` 初始化 `cache: pnpm` 时，`pnpm` 已位于 `PATH`。

删除原 `corepack enable` / `corepack prepare` 步骤，避免维护两套 pnpm 初始化路径。前端安装、测试和构建命令保持不变。

## 边界

- 不移除 pnpm cache（缓存）。
- 不调整 Node.js、pnpm、Qt 或 .NET 版本。
- 不引入自定义脚本或新的项目依赖。

## 验证

1. 修复前的顺序检查必须因缺少前置 `pnpm/action-setup` 而失败。
2. 修复后顺序检查通过，且 workflow YAML（工作流配置）通过静态校验。
3. 前端依赖安装、测试和构建通过。

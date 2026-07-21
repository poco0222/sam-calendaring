<!--
@file tasks.md - Windows Qt 原生应用打包修复任务
@author PopoY
@created 2026-07-21 15:42:36
@purpose 跟踪 workflow 最小修复、回归检查和验证证据。
-->

## 1. 修复 workflow

- [x] 1.1 运行失败检查，确认 runner、Qt 模块和 native fail-fast（快速失败）条件尚未满足。
- [x] 1.2 固定 Visual Studio 2022 runner，补充 `qtpositioning` 并让 native 命令失败时立即退出。

## 2. 验证

- [x] 2.1 运行相同回归检查、workflow YAML 静态解析和 OpenSpec/Comet 状态验证。

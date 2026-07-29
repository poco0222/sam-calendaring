<!--
@file tasks.md - 历史作业筛选栏整体高度修复任务
@author PopoY
@created 2026-07-29 10:10:51
@purpose 跟踪外层盒模型回归证据、最小 CSS 修复与验证。
-->

## 1. 回归证据与修复

- [x] 1.1 先补充历史筛选容器 `border-box` 样式契约并记录 RED（失败），再增加一条 CSS 声明并确认 GREEN（通过）。

## 2. 验证

- [x] 2.1 执行历史页聚焦 Vitest（测试框架）、完整前端测试、TypeScript（类型检查）、production build（生产构建）、Impeccable layout（布局）复扫、根因消除检查和 `git diff --check`。

<!-- review skipped: review_mode=off；本次 hotfix 仅补齐历史筛选容器已有的 `62px` 边框盒契约，已通过 RED/GREEN、完整前端测试、类型检查、生产构建和两路布局复扫。 -->

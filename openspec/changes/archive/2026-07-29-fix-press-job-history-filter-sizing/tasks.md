<!--
@file tasks.md - 历史作业筛选控件尺寸修复任务
@author PopoY
@created 2026-07-29 09:43:18
@purpose 跟踪选择器高度回归证据、最小 CSS 修复与验证。
-->

## 1. 回归证据与修复

- [x] 1.1 先将历史页样式契约测试改为要求 `.ant-select-selector` 的 `44px` 最小高度并记录 RED（失败），再复用压机作业页规则修复历史页 CSS 并确认 GREEN（通过）。

## 2. 验证

- [x] 2.1 执行历史页聚焦 Vitest（测试框架）、完整前端测试、TypeScript（类型检查）、production build（生产构建）、Impeccable layout（布局）复扫、根因消除检查和 `git diff --check`。

<!-- review skipped: review_mode=off；本次 hotfix 仅补齐已有 Ant Design 选择器触控高度契约，已通过 RED/GREEN、完整前端测试、类型检查、生产构建和布局复扫。 -->

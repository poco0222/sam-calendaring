<!--
@file tasks.md - 历史作业筛选栏尺寸修复任务
@author PopoY
@created 2026-07-29 10:10:51
@editor PopoY
@edited 2026-07-29 10:34:29
@purpose 跟踪压机作业表单栅格复用、横向尺寸回归证据与验证。
-->

## 1. 回归证据与修复

- [x] 1.1 保留已确认正确的 `border-box + 62px + 44px` 垂直尺寸契约。
- [x] 1.2 先补充历史筛选栏复用压机作业 `Form + Row + Col` 及 `360/220/220px` 列尺寸的契约并记录 RED（失败），再替换手工 flex 布局并确认 GREEN（通过）。

## 2. 验证

- [x] 2.1 执行历史页聚焦 Vitest（测试框架）、完整前端测试、TypeScript（类型检查）、production build（生产构建）、Impeccable layout（布局）复扫、1280×720 真实页面尺寸检查和 `git diff --check`。

<!-- review skipped: review_mode=off；本轮已通过 RED/GREEN、370 项完整测试、类型检查、生产构建、两路布局复扫和 1280×720 真实 bounding box（边界框）检查。 -->

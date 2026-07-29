<!--
@file tasks.md - 历史作业筛选栏尺寸修复任务
@author PopoY
@created 2026-07-29 10:10:51
@editor PopoY
@edited 2026-07-29 11:14:03
@purpose 跟踪压机作业与历史作业表单栅格、筛选控件高度、回归证据与验证。
-->

## 1. 回归证据与修复

- [x] 1.1 保留已确认正确的 `border-box + 62px` 外层尺寸契约。
- [x] 1.2 先补充历史筛选栏复用压机作业 `Form + Row + Col` 及 `360/220/220px` 列尺寸的契约并记录 RED（失败），再替换手工 flex 布局并确认 GREEN（通过）。
- [x] 1.3 先补充历史筛选控件不得单独锁定 `44px` 的契约并记录 RED（失败），再删除历史页两段强制高度并确认 GREEN（通过）。
- [x] 1.4 先补充压机指导按钮不得单独锁定 `44px` 的契约并记录 RED（失败），再删除该高度覆盖并确认 GREEN（通过）。
- [x] 1.5 补充 `press-job-history-query` delta spec（增量规格），明确两页顶部辅助控件同为 medium 高度、下方生产操作按钮保持独立触控高度，并通过 OpenSpec strict validation（严格校验）。

## 2. 验证

- [x] 2.1 执行聚焦 Vitest（测试框架）、完整前端测试、TypeScript（类型检查）、production build（生产构建）、Impeccable layout（布局）复扫、1280×720 真实页面尺寸检查和 `git diff --check`。

<!-- review skipped: review_mode=off；本轮已通过 RED/GREEN、370 项完整测试、类型检查、生产构建、两路布局复扫、1280×720 真实 bounding box（边界框）检查和 git diff --check。 -->

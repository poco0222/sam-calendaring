<!--
@file tasks.md - 历史作业详情布局与操作分页修复任务
@author PopoY
@created 2026-07-29 15:56:59
@editor PopoY
@edited 2026-07-29 16:20:50
@purpose 跟踪分页与布局回归证据、最小实现和验证结果。
-->

## 1. 回归证据与实现

- [x] 1.1 先将聚焦测试改为每页展示 9 条、隐藏第 10 条并锁定新的垂直间距，运行测试记录 RED（失败）。
- [x] 1.2 将 `OPERATION_PAGE_SIZE` 调整为 9，压缩 Drawer body、概要卡片及详情区块的垂直留白，并补齐参数表 `.ant-spin` 与 Grid 剩余高度约束，运行聚焦测试确认 GREEN（通过）。

## 2. 验证

- [x] 2.1 执行完整前端测试、TypeScript（类型检查）、production build（生产构建）、1280×720 视觉检查、OpenSpec strict validation（严格校验）和 `git diff --check`。

<!-- review skipped: review_mode=off；本轮已通过 RED/GREEN、377 项完整前端测试、TypeScript、production build、1280×720 真实边界与滚动检查、OpenSpec strict validation 和 git diff --check。 -->

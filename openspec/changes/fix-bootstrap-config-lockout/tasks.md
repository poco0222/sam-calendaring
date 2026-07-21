<!--
@file tasks.md - 启动失败配置锁死修复任务
@author PopoY
@created 2026-07-21 15:30:00
@purpose 跟踪配置保留、恢复编辑与验证证据。
-->

## 1. 保留启动配置

- [x] 1.1 先增加 ERP session loader（会话加载器）失败仍携带已读取配置的回归测试，再修改 `useBootstrapSession` 保留配置。

## 2. 开放恢复编辑

- [x] 2.1 先增加启动失败且无成功会话时配置面板可编辑的回归测试，再修改 `BootstrapDashboard` 的有效编辑条件。

## 3. 验证

- [x] 3.1 运行聚焦测试、frontend tests（前端测试）、production build（生产构建）和根因消除检查。

<!-- review skipped: review_mode=off；本次 hotfix 仅修改配置错误恢复状态链，已通过 TDD、完整前端测试、类型检查和生产构建。 -->

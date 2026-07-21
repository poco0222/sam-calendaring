<!--
@file 2026-07-21-fix-bootstrap-config-lockout-verify.md - 启动失败配置锁死修复验证报告
@author PopoY
@created 2026-07-21 15:40:24
@purpose 记录启动配置错误恢复、授权边界和本地合并的可追溯验证证据。
-->

# 启动失败配置锁死修复验证

- Change: `fix-bootstrap-config-lockout`
- Base ref: `ab0c9e0ac7d1a8239f98f8cf72a90bef449183d6`
- Verified ref: `7d4aa563b2e9da4ab883eb035d4baced7b8a6bb6`
- Verify mode: `full`

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 任务完成 | PASS | `tasks.md` 共 3 项，全部为 `[x]`。 |
| 规格完整性 | PASS | 2 项 Requirement（需求）和 2 个 Scenario（场景）均已实现并有测试证据。 |
| 错误恢复 | PASS | `useBootstrapSession` 在原生配置读取成功、ERP 启动会话失败时保留配置；`BootstrapDashboard` 仅在错误且无成功会话时开放编辑。 |
| 授权边界 | PASS | 成功会话仍只使用 `approve.press.config` 决定编辑权限；授权不可用时保持只读。 |
| Type check（类型检查） | PASS | `pnpm exec tsc --noEmit` 成功。 |
| Test（测试） | PASS | `pnpm test`：20 个测试文件、239 项测试全部通过。 |
| Build（构建） | PASS | `pnpm build`：Vite 生产构建成功。 |
| OpenSpec | PASS | `openspec validate fix-bootstrap-config-lockout` 成功。 |
| Diff check（差异检查） | PASS | `git diff --check` 无空白错误。 |
| Security（安全） | PASS | 未新增日志、网络协议、依赖或敏感信息输出。 |
| Code review（代码审查） | PASS | `review_mode=off`；本次根因修复范围小，跳过自动审查的原因已记录在 `tasks.md`。 |

## 回归覆盖

- 新增 Hook（钩子）测试，证明 ERP session loader（会话加载器）失败时错误对象仍携带已读取的启动配置。
- 新增 Dashboard（仪表盘）测试，证明错误恢复状态下输入项与“保存配置”操作可用。
- 既有只读测试继续覆盖成功会话且 ERP 配置审批不可用的场景。
- Vite 仅报告已有的大于 500 kB chunk size warning（分块体积警告），不影响本次结果。

## 分支处理

- 用户选择“本地合并回 `main`”。
- 修复开始及完成时均位于 `main`，因此无需额外 merge（合并）操作；提交 `7d4aa56` 已在本地 `main`。
- 本地 `main` 未推送。

## 验证结论

未发现 Critical（严重）、Warning（警告）或 Suggestion（建议）级问题；实现与 OpenSpec 增量规格一致，可以进入归档确认。

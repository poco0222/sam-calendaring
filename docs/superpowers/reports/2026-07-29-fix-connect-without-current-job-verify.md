<!--
@file 2026-07-29-fix-connect-without-current-job-verify.md - 无当前作业时建立通信修复验证报告
@author PopoY
@created 2026-07-29 16:14:39
@purpose 记录 Hotfix（热修复）的 RED/GREEN、构建、测试和安全复核证据。
-->

# fix-connect-without-current-job 验证报告

## 结论

**PASS**：`CONNECT` 在 ERP 仅返回无 `status` 的压机占位行时不再被“当前作业状态未确认”拦截；其他设备动作和既有筛选、Driver lease（驱动租约）校验保持不变。

## Lightweight verification（轻量验证）

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 1 | `tasks.md` 任务完成 | PASS | 3/3 任务均为 `[x]`。 |
| 2 | 改动与任务一致 | PASS | 产品代码只修改 `PressJobPage.tsx` 及其测试；其余 12 个文件为本 change 的 Comet/OpenSpec 产物。 |
| 3 | Production build（生产构建） | PASS | `cd qt-app/frontend && pnpm build`，退出码 0，1144 个模块完成转换。 |
| 4 | 相关测试与类型检查 | PASS | `PressJobPage.test.tsx` 157/157；完整测试 21/21 test files、377/377 tests；`pnpm exec tsc --noEmit` 退出码 0。 |
| 5 | 明显安全问题 | PASS | diff 未新增凭据、私钥、会话令牌、裸设备字段、网络请求或不安全 DOM 操作。 |
| 6 | Code review（代码审查）策略 | PASS | `review_mode=off`；按 Hotfix 预设跳过自动审查，未跳过测试、构建、安全或边界检查。 |

## 根因和回归证据

- RED（失败）：设备占位行仅含 `localJobSessionId` 和 `pressName` 时，目标断言期望 `null`，实际返回“当前作业状态未确认，请刷新后重试。”。
- GREEN（通过）：共享校验改为只对非 `CONNECT` 动作要求已知作业状态后，目标用例和整份 `PressJobPage` 测试均通过。
- 根因消除：旧的“`CONNECT` 仅在 `currentJobRows.length === 0` 时例外”条件已不存在；状态未知的 `moveIn` 回归断言仍保持失败关闭。

## 范围说明

- `verify_mode=light`：自动 scale（规模评估）将 12 个 Comet/OpenSpec 产物与 2 个产品文件合计为 14 个文件；实际产品改动为单模块、2 个文件、3 项任务、0 个 delta spec（增量规格），因此使用允许的 light override（轻量覆盖）。
- 无 delta spec：主规格已规定没有父作业时不得拒绝 `CONNECT`，本次只修复实现偏差。
- 工作区中的 `fix-press-job-history-detail-layout` 及其三个历史详情页文件属于另一变更，未纳入本 Hotfix 提交或验证范围。
- Vite 保留既有的大 chunk（分块）提示；本次未新增依赖或 bundle（包体）代码，不影响构建通过。

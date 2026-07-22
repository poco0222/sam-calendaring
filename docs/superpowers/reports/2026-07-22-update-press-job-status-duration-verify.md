<!--
@file 2026-07-22-update-press-job-status-duration-verify.md - 压机作业状态与预计时长更新验证报告
@author PopoY
@created 2026-07-22 08:08:58
@purpose 记录出线状态展示、预计时长持久化和本地合并的最终验证证据。
-->

# 压机作业状态与预计时长更新验证

- Change: `update-press-job-status-duration`
- Base ref: `5dc0e788a45a195fc77b59e7d2a241410737fccb`
- Implementation ref: `2313f450cedba8887d17cb93dae6a27d8a59276d`
- Verified ref: `ea9b1f3fc47ea0d59e9b1959331e8babedb15ea1`
- Verify mode: `full`

| 维度 | 结果 | 证据 |
| --- | --- | --- |
| Completeness（完整性） | PASS | `tasks.md` 共 5 项，全部为 `[x]`；2 项 Requirement（需求）和 11 个 Scenario（场景）均有实现与测试证据。 |
| Correctness（正确性） | PASS | `是否出线=false/0` 显示绿色“已入线”，`true/1` 显示红色“已出线”，缺失或非法值显示中性“未知”；操作区和当前作业表复用同一解析结果。 |
| ERP 持久化 | PASS | 有 ERP ID 时调用 `PUT /modbus/pressjob`，body 仅为 `{ id, expectedDuration }`；成功保留确认值，失败回滚，无 ID 时保留既有开始加工提交路径。 |
| Coherence（一致性） | PASS | 实现遵循 `design.md`；已记录稳定作业身份、草稿清理、GET/PUT 时序和 correlationId（关联 ID）等审查修复。Tweak（微调）流程未配置独立 Superpowers Design Doc，未跳过当前变更设计核验。 |
| Targeted test（目标测试） | PASS | 3 个测试文件，164/164 项通过。 |
| Full test（完整测试） | PASS | `pnpm test`：20 个测试文件，286/286 项通过；合并到 `main` 后再次运行仍为 286/286 通过。 |
| Type check（类型检查） | PASS | `pnpm exec tsc --noEmit` 退出码 0。 |
| Build（构建） | PASS | `pnpm build` 退出码 0；仅有既有的单 chunk（分块）超过 500 kB 警告。 |
| OpenSpec | PASS | `openspec validate update-press-job-status-duration --strict` 通过。 |
| Diff check（差异检查） | PASS | `git diff --check 5dc0e788...HEAD` 通过。 |
| Security（安全） | PASS | `Authorization` 与 `X-Correlation-Id` 仅位于 header（请求头）；页面、请求 body（请求体）和日志未暴露令牌、网络地址、设备 ID 或信号配置原文。 |
| Code review（代码审查） | PASS | 最终整分支审查结果为 Critical 0、Important 0、Ready=Yes。 |

## 已接受的 Minor（次要）偏差

- 未单独枚举直接 HTTP 500、network rejection（网络拒绝）、输入 `01` 和 App callback spread（回调展开）的专项测试；现有业务失败、回滚、格式校验和回调路径测试继续覆盖核心行为。
- `currentJobRows` 依赖数组替换触发 React effect（副作用）；当前数据流始终创建新数组。
- sam-erp 当前作业端点每次最多返回一行；若后端违反该契约并返回多条完全相同安全指纹的无 ID 行，前端无法在不引入易变或敏感字段的前提下区分。

## 分支处理

- 用户选择本地合并回 `main`。
- `main` 已从 `5dc0e78` fast-forward merge（快进合并）到 `ea9b1f3`，未产生冲突或额外合并提交。
- 合并后完整测试 286/286 通过；功能分支 `PopoY-WorkTree/update-press-job-status-duration` 已删除。
- 用户已有 `.vscode/start-driver-service.sh` 修改已原样恢复，未暂存、未提交；本地 `main` 未推送。

## 验证结论

未发现 Critical（严重）、Warning（警告）或 Suggestion（建议）级问题；实现与 OpenSpec 规格和设计一致，可以进入归档确认。

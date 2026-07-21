<!--
@file tasks.md - 压机作业状态与预计时长更新任务清单
@author PopoY
@created 2026-07-21 16:45:03
@purpose 以测试先行方式跟踪 ERP 契约、页面行为和最终验证。
-->

## 1. ERP 当前作业与预计时长更新契约

- [x] 1.1 先在 `erpClient.test.ts` 增加失败测试，覆盖当前作业 `id` 收窄、`PUT /modbus/pressjob`、仅 `{ id, expectedDuration }` 的 JSON body、认证 header（请求头）及 ERP 业务失败；再最小修改 `pressJob.ts`、`erpClient.ts` 和 `App.tsx`，向页面注入不暴露会话令牌的预计时长更新回调。

## 2. 压机作业页面状态与保存交互

- [x] 2.1 先在 `PressJobPage.test.tsx` 增加失败测试，覆盖通过 key/元数据定位 `是否出线`、`false/0` 绿色已入线、`true/1` 红色已出线、未知态、两处状态一致、有效保存、无 ID 本地提交、无效值、关闭放弃、防重复提交和失败回滚；再最小修改 `PressJobPage.tsx` 复用现有快照、校验、数字键盘和消息反馈完成实现。

## 3. 验证与规格一致性

- [x] 3.1 运行目标 Vitest（测试框架）用例、完整 `pnpm test`、`pnpm build` 和 `openspec validate update-press-job-status-duration --strict`，检查敏感字段边界、既有 `.vscode/start-driver-service.sh` 修改未被覆盖，并记录真实验证结果。

### 3.1 验证记录

> @author PopoY
> @created 2026-07-21 17:53:00

- 目标 Vitest：2 个文件、138/138 tests passed。
- 完整 `pnpm test`：20 个文件、272/272 tests passed。
- `pnpm exec tsc --noEmit`、`pnpm build`、`openspec validate update-press-job-status-duration --strict` 和 `git diff --check 5dc0e78..HEAD` 均 exit 0；构建仅保留既有的单 chunk（分块）超过 500 kB 警告。
- `5dc0e78..HEAD` 仅包含 6 个预期 frontend（前端）源文件与测试文件；未修改 Driver Service、ERP backend（ERP 后端）、CSS、依赖或 `.vscode`。
- `PUT /modbus/pressjob` 请求体仅包含 `{ id, expectedDuration }`；页面未暴露 `sessionToken`、`signalConfig`、`deviceId`、`ip` 或 `port`。
- 用户已有 `.vscode/start-driver-service.sh` 修改仍保持未提交，未被覆盖或暂存。

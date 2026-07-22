<!--
@file tasks.md - 压机作业状态与预计时长更新任务清单
@author PopoY
@created 2026-07-21 16:45:03
@editor PopoY
@edited 2026-07-22 08:02:23
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

## 4. 最终审查修复

- [x] 4.1 先补充失败测试，覆盖 ERP 作业草稿与 React row key（行键）均按 `pressJobId` 稳定隔离、无 ID 作业不再使用数组位置且离场后清理本地草稿、空安全指纹行不产生冲突身份、保存成功后的 ERP 刷新值重新生效、保存前已排队的 refresh effect（刷新副作用）不得消费保存后 marker（标记）、保存前启动的旧 GET 不得在 PUT 成功后覆盖预计时长、PUT 必须携带不进入 body（请求体）的 correlationId（关联 ID），以及请求期间同一数组位置替换为另一作业时旧请求结果不得污染新作业；再最小修改 `PressJobPage.tsx`、`App.tsx` 和 ERP client（ERP 客户端）修复 sticky draft（粘滞草稿）、refresh race（刷新竞态）、GET/PUT 乱序、输入框重排复用、stale completion（陈旧完成）与请求追踪缺口，并以组件实际复用的状态转换锁定并发与 UI 清理决策。
- [x] 4.2 重新运行目标测试、完整测试、TypeScript check（类型检查）、production build（生产构建）、OpenSpec strict validation（严格校验）和最终整分支审查；直接 HTTP 500 与 network rejection（网络拒绝）测试缺口按用户选择记录为已接受 Minor（次要）偏差。

### 4.2 最终验证记录

> @author PopoY
> @created 2026-07-21 20:02:18

- 最终 implementation HEAD（实现提交）为 `2313f450cedba8887d17cb93dae6a27d8a59276d`；Task 4 审查修复由 `f410e0e`、`caf7aa5`、`4ef1a36`、`088a623`、`754f7f0` 和 `2313f45` 六个独立提交组成。
- 目标 Vitest：`PressJobPage.test.tsx`、`App.test.tsx`、`erpClient.test.ts` 共 3 个文件、164/164 tests passed。
- 完整 `pnpm test`：20 个文件、286/286 tests passed。
- `pnpm exec tsc --noEmit`、`pnpm build`、`openspec validate update-press-job-status-duration --strict` 和 `git diff --check 5dc0e78..HEAD` 均 exit 0；构建仅保留既有的单 chunk（分块）超过 500 kB 警告。
- 最终整分支审查为 Critical 0、Important 0、Ready=Yes；2 个 Requirement（需求）和 11 个 Scenario（场景）均通过，无 ID 本地预计时长场景已由 Fail 修复为 Pass。
- 已接受 Minor（次要）包括：ERP client 对直接 HTTP 500/network rejection 的专项测试缺口、`currentJobRows` 原地 mutation（变异）不会触发 effect（副作用）、App callback spread（回调展开）的抗删除测试、前导零 `01` 的枚举直测，以及 sam-erp 违反单行基数契约时完全相同无 ID 安全指纹无法区分。
- `PUT /modbus/pressjob` body 仍精确为 `{ id, expectedDuration }`；`Authorization` 和 `X-Correlation-Id` 仅位于 header，页面未暴露 `sessionToken`、`signalConfig`、`deviceId`、`ip` 或 `port`。
- 用户已有 `.vscode/start-driver-service.sh` 修改仍保持未提交，未被覆盖或暂存。

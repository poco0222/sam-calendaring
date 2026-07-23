<!--
@file 2026-07-23-fix-press-signal-value-projection-verify.md - 压机信号值投影修复验证报告
@author PopoY
@created 2026-07-23 11:14:16
@purpose 记录 TDD、测试、构建、安全边界和 Comet 阶段守卫的可追溯验证证据。
-->

# 压机信号值投影修复验证报告

## 验证范围

- Change（变更）：`fix-press-signal-value-projection`
- Commit（提交）：`060b32c0c996ae94b520e4d9d5eed85dfe063dff`
- Base ref（基准提交）：`58b2b535262182a40bf1c0cbbe27f24c9db7c354`
- Verify mode（验证模式）：`light`
- 模式说明：自动 scale 将 9 个 `.comet` 运行文件及 OpenSpec 产物计入 14 个变更文件而判为 `full`；实际产品改动仅为 `erpClient.ts` 和 `erpClient.test.ts`，任务数为 3、无 delta spec（增量规格），因此按 override 规则使用轻量验证。

## TDD 证据

1. RED：元数据投影用例先失败，请求体中的 `pressure` 实际仍为 `{ value, name, unit, registerAddress }` 对象，证明复现了 ERP 拒绝的原始缺陷。
2. GREEN：最小对象解包后，元数据投影用例通过。
3. RED：`null`、数组、缺少 `value` 的对象、嵌套对象、`undefined` 和非有限数字共 6 个用例先失败，且旧逻辑实际调用了 HTTP helper（辅助函数）。
4. GREEN：增加统一标量校验后，上述 6 个用例均在 HTTP 调用前失败；`erpClient.test.ts` 44/44 通过。

## 轻量验证结果

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 1. Tasks（任务）全部完成 | PASS | `tasks.md`：`done=3 pending=0` |
| 2. 改动与任务范围一致 | PASS | 产品代码仅修改统一 ERP 参数投影函数及其回归测试；Driver、ERP、UI 和数据库均未修改 |
| 3. Build（构建）通过 | PASS | `cd qt-app/frontend && pnpm build`，Vite 构建退出码为 0 |
| 4. Related tests（相关测试）通过 | PASS | `cd qt-app/frontend && pnpm test`：20 个测试文件、298 个测试全部通过 |
| 5. Security（安全）检查 | PASS | 禁止键先过滤；元数据只保留标量 `value`；非法值错误不包含原始值；未新增日志、凭据、网络调用或依赖 |
| 6. Code review（代码审查） | SKIP | Hotfix 配置为 `review_mode: off`，按轻量验证规则不派发自动审查；测试、构建和安全检查未跳过 |

## 契约与流程检查

- 直接 `string`、有限 `number`、`boolean` 保持不变；Driver 元数据对象仅提交自身 `value`。
- `null`、数组、缺失或嵌套 `value`、`undefined`、非有限数字在 `sendJson` 前失败。
- 既有完工流程测试确认：参数记录失败时不调用 ERP 完工接口，也不执行设备 cleanup（收尾）。
- 开始参数事件测试确认：直接标量仍按既有结构记录一次。
- 本变更恢复既有实现契约，不修改验收场景，按 Hotfix 规则不创建 delta spec。当前 OpenSpec CLI 的 `--strict` 对无 delta change 固定报告“至少需要一个 delta”，因此不将该命令作为通过条件；Comet open/build guard（阶段守卫）均已通过。
- Vite 构建仍输出大于 500 kB 的 chunk size（分块体积）提示；本变更未修改依赖、import 或构建配置，构建成功且该提示不影响本次修复结论。

## 结论

六项轻量验证均满足通过条件，未发现 CRITICAL（严重）或 IMPORTANT（重要）问题，可以进入最终归档确认。

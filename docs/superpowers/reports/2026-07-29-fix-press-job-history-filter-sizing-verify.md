<!--
@file 2026-07-29-fix-press-job-history-filter-sizing-verify.md - 历史作业筛选控件尺寸修复验证报告
@author PopoY
@created 2026-07-29 09:52:00
@purpose 记录 Hotfix（热修复）的 RED/GREEN、构建、测试、布局和安全复核证据。
-->

# fix-press-job-history-filter-sizing 验证报告

## 结论

**PASS**：历史作业 `Select（选择器）` 的可见 `.ant-select-selector` 已与同栏其他控件及压机作业页统一为 `44px` 最小高度，报告的垂直尺寸和偏移根因已消除。

## Lightweight verification（轻量验证）

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 1 | `tasks.md` 任务完成 | PASS | 2/2 任务均为 `[x]`。 |
| 2 | 改动与任务一致 | PASS | 实现只修改 `PressJobHistoryPage.css` 和对应测试；其余 12 个文件是本 change 的 Comet/OpenSpec 产物。 |
| 3 | Production build（生产构建） | PASS | `cd qt-app/frontend && pnpm build`，退出码 0，1144 个模块完成转换。 |
| 4 | 相关测试与类型检查 | PASS | `pnpm test`：21/21 test files、369/369 tests；`pnpm exec tsc --noEmit`：退出码 0。 |
| 5 | 明显安全问题 | PASS | 仅增加局部 CSS 尺寸规则和样式契约断言；diff 未新增凭据、私钥、会话令牌、网络请求或不安全 DOM 操作。 |
| 6 | Code review（代码审查）策略 | PASS | `review_mode=off`；按 Hotfix 预设跳过自动审查，未跳过测试、构建、安全或布局检查。 |

## 根因和回归证据

- RED（失败）：先将测试改为要求 `.press-job-history-page__filters .ant-select-selector { min-height: 44px; }`；修复前完整 Vitest 运行为 368 通过、1 失败，唯一失败是目标 CSS 规则缺失。
- GREEN（通过）：增加一条与压机作业页同形的 CSS 规则后，聚焦测试 19/19 通过，完整测试 369/369 通过。
- 根因消除：源码和 Vite 构建后 CSS 均包含目标 `44px` 规则；原“禁止 `.ant-select-selector`”断言已移除。
- Impeccable layout（布局）：独立人工布局复评确认 Spacing（间距）、Visual hierarchy（视觉层级）、Grid & structure（栅格与结构）、Rhythm（节奏）和 Density（密度）不存在本次未解决项；机械 detector（检测器）输出 `[]`，未解决项为 0。

## 范围说明

- `verify_mode` 使用 `light`：自动 scale（规模评估）将 12 个 Comet/OpenSpec 自动产物与 2 个实现文件合计为 14 个文件；本次实际产品改动仍为单模块、2 个文件、2 项任务、0 个 delta spec（增量规格），因此按 override mechanism（覆盖机制）保持轻量验证。
- 无 delta spec：主规格 `press-job-history-query` 已明确要求筛选控件高度统一，本次只修复实现偏差。
- Vite 仍输出既有的大 chunk（分块）提示；本次只增加一条局部 CSS 规则，该提示与本次修复无关，不影响构建通过。

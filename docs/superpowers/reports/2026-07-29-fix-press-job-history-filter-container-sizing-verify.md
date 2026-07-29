<!--
@file 2026-07-29-fix-press-job-history-filter-container-sizing-verify.md - 历史作业筛选栏尺寸修复验证报告
@author PopoY
@created 2026-07-29 10:48:07
@editor PopoY
@edited 2026-07-29 11:16:47
@purpose 记录 Hotfix（热修复）的失败验证回退、控件高度根因、RED/GREEN、真实页面尺寸、构建、测试和安全证据。
-->

# fix-press-job-history-filter-container-sizing 验证报告

## 结论

**PASS**：历史作业筛选栏与压机作业筛选控件均使用 Ant Design medium（中号）默认高度。两页外框均为 `1256×62px`；压机作业三组 Select（选择器）、顶部两个加工指导按钮及历史作业日期、模具号、作业人员、查询按钮均为 `32px` 高。下方真实生产操作按钮继续保持 `44px`。

## 失败验证回退与根因

- 前两次实现分别只处理了外层盒模型和横向字段分配，仍保留历史页通用 `min-height:44px`，因此用户运行界面的控件高度没有变化。此前的 verify pass（验证通过）已撤销并回退到 build（构建）阶段。
- 本轮首次 full verification（完整验证）发现 change 缺少 OpenSpec delta spec（增量规格），`openspec validate --strict` 因无 delta 报错；流程自动回到 build，补齐 `press-job-history-query` 的最小 `MODIFIED Requirements` 后严格校验通过，OpenSpec 状态恢复为 `isComplete: true`。
- 两张用户截图及真实 DOM（文档对象模型）测量确认：两页外框都约 `62px`；压机筛选 Select 实际为 `32px`，历史筛选控件因专属通用选择器被强制到 `44px`。
- 最小根因修复先成对删除历史页对 `.ant-picker/.ant-input/.ant-select/.ant-btn` 和 `.ant-select-selector` 的 `44px` override（覆盖规则），再删除压机作业顶部指导按钮专属的 `min-height:44px`；两处均回归组件库同一 medium 默认尺寸来源。

## RED/GREEN 与真实页面证据

- RED（失败）：先把测试改为禁止历史筛选控件独立锁定 `44px`；修复前完整 Vitest（测试框架）为 `369/370` 通过，唯一失败是历史页仍存在通用 `44px` 规则。
- GREEN（通过）：删除两段 override 后，历史页聚焦 Vitest 为 `20/20` 通过。
- Playwright（浏览器自动化）在真实 `1280×720` 视口读取历史页：筛选栏 `1256×62px`、日期 `276×32px`、模具号 `136×32px`、作业人员 `136×32px`、查询按钮 `82×32px`。
- 同一运行环境读取压机页：筛选栏 `1256×62px`，三组 Select 均为 `32px` 高；“开始加工指导”和“完成加工指导”均为 `138×32px`，首个下方生产操作按钮为 `44px` 高。
- 指导按钮 TDD RED（失败）：修改契约但保留旧 CSS 时，`PressJobPage.test.tsx` 为 `156/157` 通过，唯一失败明确指出 guidance selector 仍含 `min-height:44px`。
- 指导按钮 TDD GREEN（通过）：删除该唯一高度声明后，`PressJobPage.test.tsx` 为 `157/157` 通过。
- 视觉证据：`qt-app/frontend/output/playwright/press-guidance-medium-1280x720.png` 与 `qt-app/frontend/output/playwright/history-query-medium-1280x720.png`；此前历史筛选对齐证据继续保留在同目录。

## Verification（验证）

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 1 | 任务完成 | PASS | `tasks.md` 6/6 为 `[x]`。 |
| 2 | 聚焦测试 | PASS | 历史页 20/20；压机页指导按钮 RED 156/157、GREEN 157/157。 |
| 3 | 完整测试 | PASS | `pnpm test`：21/21 test files、370/370 tests。 |
| 4 | TypeScript（类型检查） | PASS | `pnpm exec tsc --noEmit`：退出码 0。 |
| 5 | Production build（生产构建） | PASS | `pnpm build`：1144 个模块转换完成，退出码 0。 |
| 6 | Impeccable layout（布局） | PASS | 两路独立复核均确认 Spacing、Hierarchy、Grid、Rhythm、Density 对齐；detector 输出 `[]`。 |
| 7 | Diff 与安全 | PASS | `git diff --check` 退出码 0；未新增凭据、令牌、网络请求、不安全 DOM 操作或依赖。 |
| 8 | OpenSpec | PASS | change strict validation（严格校验）无 issue，`isComplete: true`。 |

## OpenSpec 完整验证

| Dimension（维度） | Status（状态） | Evidence（证据） |
|---|---|---|
| Completeness（完整性） | PASS | 6/6 tasks；1 个 modified requirement（修改需求）；delta spec 可定位且严格校验通过。 |
| Correctness（正确性） | PASS | 1/1 requirement 由历史页布局测试、压机指导按钮契约测试和真实 `1280×720` 尺寸测量覆盖；3/3 scenarios 与实现一致。 |
| Coherence（一致性） | PASS | proposal、OpenSpec design、technical Design Doc（技术设计文档）、delta spec 与产品 diff 均采用同一 medium 尺寸来源；未发现 drift（漂移）或矛盾。 |

CRITICAL、WARNING、SUGGESTION：均无。`review_mode: off`，按已确认的小范围 CSS hotfix（热修复）配置跳过自动代码审查；两路只读 Impeccable 布局复核仍已执行并通过。

## 范围与已知边界

- 本轮追加的产品改动只删除 `PressJobPage.css` 中指导按钮的一条 `min-height:44px`，并更新对应契约测试；`PressJobPage.tsx` 无 diff。
- 保留历史页已对齐的 `Form + Row + Col（表单栅格）`、`72px` 标签列、`12px` gutter、`360/220/220px` 列宽及 `62px` 外层筛选栏。
- 保留 RangePicker、Input、Select、查询行为、日期校验、ERP API（接口）和数据契约。
- 当前两页筛选控件和顶部指导按钮本体均为 `32px`；若未来要求这些辅助入口至少 `44px`，应作为两页共同的独立触控规范变更处理。
- Vite 仍输出既有的大 chunk（分块）提示；本次未新增依赖，该提示与尺寸修复无关。

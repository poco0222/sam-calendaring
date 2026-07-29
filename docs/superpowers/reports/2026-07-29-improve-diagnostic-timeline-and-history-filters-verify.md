<!--
@file 2026-07-29-improve-diagnostic-timeline-and-history-filters-verify.md - 诊断时间线与历史筛选验证报告
@author PopoY
@created 2026-07-29 12:27:58
@purpose 记录 Ant Design Timeline、模具远程候选、数字小键盘、班组人员级联、规格覆盖、构建、测试、视觉和安全边界证据。
-->

# improve-diagnostic-timeline-and-history-filters 验证报告

## 结论

**PASS**：诊断日志已使用 Ant Design `Timeline（时间轴）` 内建节点和连接线；历史作业模具号已复用远程候选与 `NumericKeypad（数字小键盘）`，班组只级联当前人员且不进入历史查询。10/10 tasks（任务）、3/3 requirements（需求）和 14/14 scenarios（场景）均有实现、测试或真实页面证据，未发现 CRITICAL、WARNING 或 SUGGESTION。

## OpenSpec 完整验证

| Dimension（维度） | Status（状态） | Evidence（证据） |
|---|---|---|
| Completeness（完整性） | PASS | `tasks.md` 10/10 为 `[x]`；2 个 delta spec（差量规格）包含 3 个 requirements，均可定位且严格校验通过。 |
| Correctness（正确性） | PASS | 3/3 requirements、14/14 scenarios 由组件实现、376 个前端测试、独立代码审查和 `1280×720` 真实页面核验共同覆盖。 |
| Coherence（一致性） | PASS | proposal、当前 OpenSpec design、delta specs 与产品 diff 一致；Tweak（轻量变更）的 `design_doc` 为 `null`，相关历史技术设计文档可定位，当前 delta 明确替代其中旧的模具自由输入和无班组筛选条款，其余 App Shell、查询快照、分页、主题和安全边界保持一致。 |

## Requirement 与 Scenario 映射

### 1. 诊断日志关联链使用标准时间线

- `DiagnosticLogsPage.tsx:256-261,371-417,599-611` 保留同一 `correlationId（关联 ID）` 的正序关联链，使用 `Timeline.items[].content` 渲染可点击条目，并通过 `aria-current` 表达当前选择。
- `DiagnosticLogsPage.css:164-230` 只控制 Drawer（抽屉）滚动、内容密度和 Focus Ring（聚焦环），未覆盖 `.ant-timeline-item-tail`，也未保留手写 marker（圆点）或连接线几何。
- `DiagnosticLogsPage.test.tsx:215-225` 锁定 Ant Design 6 的 `items[].content`、可访问选中状态和“不手写节点/rail（连接轨道）”契约；关联日志排序和敏感字段边界由同文件既有测试覆盖。
- Playwright（浏览器自动化）在浅色、深色 `1280×720` 视口确认三个节点之间存在连续内建连接线，且控制台不再产生已废弃 `items.children` 警告。

### 2. 历史作业一级入口与现有视觉体系一致

- `PressJobHistoryPage.tsx:948-1074` 使用既有 `Form + Row + Col（表单栅格）`、Ant Design `Select` 和 `SearchOutlined`，日期、模具号、班组、人员、查询按钮保持单行。
- `PressJobHistoryPage.test.tsx:341-374,406-420` 覆盖八列表格、班组/人员标签、三个 `220px` 筛选列和既有控件尺寸体系。
- 浅色、深色 `1280×720` 真实页面确认筛选区单行、候选 popup（浮层）和数字小键盘未产生页面级滚动；既有 `2026-07-29-compress-press-job-guidance-buttons-design.md` 中 medium（中号）辅助按钮与 `44px` 生产操作按钮边界未被修改。

### 3. 历史列表按已提交筛选条件服务端分页

- `PressJobHistoryPage.tsx:108-203` 保持本地当天、31 个自然日、快捷范围、半开区间、每页 10 条和 `draftFilters/appliedQuery（编辑中筛选/已提交查询）` 分离；`buildHistoryQuery` 明确只提交日期、`mouldCode`、`operator` 和分页字段，不读取 `teamId`。
- `PressJobHistoryPage.tsx:674-843` 切换班组立即清空人员，班组与模具请求分别使用版本号拒绝 stale response（过期响应）；模具空文本不请求，输入变更清空可提交值，只有候选选择写入 `draftFilters.mouldCode`，失败使用固定中文提示。
- `PressJobHistoryPage.tsx:977-1060,1077-1087` 复用模具锁定面板的候选 popup class、小键盘定位与 `specialKey="-"`；Select 和数字小键盘均能真正清除已选模具；人员在未选班组或当前班组加载期间禁用，候选只来自 `activeOperatorOptions`。
- `App.tsx:687-696` 只注入既有 `pressJobLookupData`、`loadPressJobTeamOptions` 和 `searchPressMoldCandidates`；全量 `operatorOptions` 继续只用于列表/详情名称映射。
- `PressJobHistoryPage.test.tsx:113-242,365-403` 覆盖默认班组但不默认人员、班组切换清人、31/32 日边界、快捷范围、半开查询、`teamId` 不入 query、迟到响应失效、全量字典与人员候选分离、模具远程 Select、小键盘、Select/小键盘清除和 stale loading（过期加载）复位。
- 真实页面使用数字小键盘输入 `1001-`、远程展示候选并选择 `1001-01`；切换到另一班组后，人员候选只显示该班组成员。

## Verification（验证）

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 1 | 任务与规格 | PASS | `openspec instructions apply`：10/10 complete；`openspec validate improve-diagnostic-timeline-and-history-filters --strict` 退出码 0。 |
| 2 | TDD（测试驱动开发） | PASS | 原始功能测试先出现 8 条预期失败；审查补充的 Select 清除、数字小键盘清除和人员加载禁用测试也分别先 RED 后 GREEN。 |
| 3 | 完整前端测试 | PASS | `pnpm test`：21/21 test files、376/376 tests。 |
| 4 | TypeScript（类型检查） | PASS | `pnpm exec tsc --noEmit` 退出码 0，无输出。 |
| 5 | Production build（生产构建） | PASS | `pnpm build`：Vite 转换 1144 个模块，退出码 0；仅保留既有的大 chunk（分块）优化提示。 |
| 6 | 真实页面视觉与交互 | PASS | 浅色/深色 `1280×720` 核验筛选单行、班组人员级联、模具候选、小键盘和诊断时间线连接线。 |
| 7 | 独立代码审查 | PASS | Reviewer（审查代理）复核最终 diff，未发现 CRITICAL 或 IMPORTANT finding（问题）。 |
| 8 | Diff 与安全 | PASS | `git diff --check` 退出码 0；产品改动仅 7 个 QT App 前端文件，无后端、数据库、设备请求、敏感字段、新依赖或 lockfile（锁文件）变化。 |

## Design 与范围核对

- 当前 OpenSpec design 的四项决策均落实：Ant Design Timeline、既有模具远程合同与小键盘、班组仅级联人员、已提交查询快照稳定。
- 相关技术设计文档 `docs/superpowers/specs/2026-07-24-press-job-history-page-design.md` 与 `docs/superpowers/specs/2026-07-29-compress-press-job-guidance-buttons-design.md` 均可定位；当前 delta 对历史筛选的产品演进有明确设计记录，没有未记录 drift（漂移）。
- 未修改 Driver Service（驱动服务）、ERP 后端、数据库、设备请求、日志写入、压机作业业务流程、项目依赖或主题体系。
- `review_mode: off` 仅表示 Comet 未自动派发 review；项目 `AGENTS.md` 要求的独立 Reviewer 已执行并最终 PASS。

## 已知非阻断提示

- Vite 继续报告单个生产 chunk 超过 `500 kB`；本次未新增依赖或构建入口，该提示不属于本次功能回归。

---
comet_change: include-running-press-jobs-in-history
verification_mode: full
result: pass
---

# 历史作业纳入进行中作业验证报告

> Author: PopoY
> Created: 2026-07-29 15:17:50
> Editor: PopoY
> Edited: 2026-07-29 15:29:53

## Summary（摘要）

| Dimension（维度） | Status（状态） | Evidence（证据） |
|---|---|---|
| Completeness（完整性） | PASS | OpenSpec 任务 7/7；Requirement（需求）3/3 已实现 |
| Correctness（正确性） | PASS | Scenario（场景）17/17 已映射到实现和现有回归覆盖 |
| Coherence（一致性） | PASS | OpenSpec design、Technical Design Doc（技术设计文档）与实现无矛盾 |
| Verification（验证） | PASS | ERP 310+42、QT 377、TypeScript、生产构建、strict validation 与双仓库 diff check 全部通过 |

## Completeness（完整性）

- `openspec instructions apply` 返回 `total=7`、`complete=7`、`remaining=0`；`tasks.md` 无未完成项。
- 历史列表分页、稳定作业身份与状态、脱敏详情抽屉三条修改需求均有实现证据。
- 主仓库变更与计划一致：技术设计、OpenSpec/Comet 产物和 `PressJobHistoryPage` 两个文件。
- ERP 仓库变更与计划一致：一个 Mapper XML 和两个既有测试文件。未修改 API、Service 签名、数据库结构或用户 SQL。

## Correctness（正确性）

### 1. 历史列表查询与分页

- `PressMouldJobInfoMapper.xml` 先限定认证 `deviceId`，再以完整外层括号仅允许 `status=1/3`；变异式契约测试证明缺少括号、增加状态 `4` 或打乱排序会失败。
- 进行中分支为 `start_time < endTime`，没有 `start_time >= startTime`，覆盖跨日仍未完成作业；完成态继续使用 `end_time >= startTime AND end_time < endTime`。
- 排序为进行中置顶、状态对应业务时间倒序、`id DESC` 兜底，符合稳定分页设计。
- 既有历史页测试继续覆盖当天范围、1/3/7/30 日快捷范围、31 日上限、固定 10 条分页、草稿与已提交查询分离、班组人员级联、远程模具选择和迟到响应隔离。

### 2. 列表身份与状态展示

- 列表仍使用真实 `press_mould_job_info.id` 作为 `mouldJobId`，接口字段与请求不变。
- `formatHistoryStatus` 固定映射 `1=进行中`、`3=已完成`、其他为“状态未知”，不回显未知枚举。
- 列表完成时间和时长分别调用共享 `formatHistoryCompletedAt`、`formatHistoryDuration`；进行中空值显示“未完成”和“进行中”。
- 状态列标题为“作业状态”，现有八列、通用空状态、错误与重试行为保持不变。

### 3. 详情与操作记录

- 详情查询同时保留真实 `mouldJobId`、认证 `deviceId`，状态仅放宽为 `IN ('1','3')`。
- Controller 继续用实体 `pressJobInfoId` 与认证设备查询操作记录，不按设备时间猜测父作业。
- Drawer 摘要复用列表相同的状态、完成时间和时长格式化；进行中完工参数仍按现有规则显示“未记录”。
- Controller 测试继续锁定固定响应白名单、跨设备 404、操作记录父键、未知操作枚举不回显，以及 `signalId/signalCode/extra` 等字段不返回。

## Coherence（一致性）

- OpenSpec design 的四项决策均被遵循：状态集合、跨日区间相交、稳定排序、前端最小状态呈现。
- Technical Design Doc 存在且与 delta spec、生产实现一致；未发现 Spec Drift（规格漂移）。
- delta MODIFIED block 保留主规格既有场景标识“展示历史记录”，并把进行中与未知状态作为新增场景，满足 OpenSpec 归档合并语义。
- 未新增接口、数据库迁移、日志路径、状态筛选、轮询、定时器、CSS、依赖或新组件。
- 最终代码审查无 Critical/Important。审查提出的列表 renderer（渲染器）直接接线测试属于额外防回归加固；当前共享纯函数测试、真实 Drawer 渲染、源码结构契约、377 个全量测试和生产构建已覆盖本次验收行为，不构成规格缺口。

## Fresh Verification Evidence（新鲜验证证据）

| Command（命令） | Result（结果） |
|---|---|
| `/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl sam-erp -am test` | PASS；310 tests，0 failures/errors，`BUILD SUCCESS` |
| `/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am -Dtest=QtPressWorkingControllerTest -Dsurefire.failIfNoSpecifiedTests=false test` | PASS；42 tests，0 failures/errors，`BUILD SUCCESS` |
| `pnpm test` | PASS；21/21 files，377/377 tests |
| `pnpm exec tsc --noEmit` | PASS；无诊断 |
| `pnpm build` | PASS；1144 modules transformed；仅既有 chunk-size warning |
| `git diff --check <base>...HEAD`（两个仓库） | PASS；无空白错误 |
| `openspec validate include-running-press-jobs-in-history --strict` | PASS；change valid |
| 主规格/delta `展示历史记录` 场景标识一致性检查 | PASS；两处均唯一命中，归档兼容修正提交为 `e6bb30c` |

## Archive Preflight Recovery（归档预检恢复）

- 首次归档因 delta 将主规格场景“展示历史记录”改名为“展示已完成历史记录”而被安全中止；未合并主规格、未移动变更目录。
- Comet 按 `archive-reopen → verify-fail → build` 返回修复流程，`verify_failures=1`。
- 修复仅恢复场景标识并记录设计原因；`git diff --name-only 3265440..HEAD` 证明没有业务源码或测试变化，因此上一轮同一业务提交范围的 ERP/QT 新鲜测试证据仍有效。
- 修复后 OpenSpec strict validation、场景标识一致性检查和完整提交范围 `git diff --check` 均通过。

## Issues（问题）

### CRITICAL

无。

### WARNING

无。

### SUGGESTION

无规格或实现层面的待处理项。最终审查的非阻塞列表 renderer 测试加固建议已记录在上文，不影响当前 Verify 结论。

## Final Assessment（最终评估）

所有完整性、正确性、一致性和新鲜命令验证均通过；首次归档阻塞已按最小规格修正关闭。变更已满足重新进入 Archive（归档）确认点的条件。

---
change: fix-legacy-pending-press-job-compatibility
phase: verify
verify-mode: full
calendaring-head: e8eba31871ccf03228d82bb3cc5944087aaf43ad
erp-head: 085c6f1576ac12b624b7cbec4c5ce2b94a8d81ff
---

# 旧版待开始压机作业兼容验证报告

- Author: PopoY
- Created: 2026-07-29 13:12:18 +0800
- Editor: PopoY
- Edited: 2026-07-29 13:28:26 +0800
- Result: PASS
- Scope: SAM ERP Service（服务）兼容修复及 sam-calendaring OpenSpec 产物
- Environment boundary: 未连接真实数据库、QT App（Qt 应用）、Driver Service（驱动服务）、PLC 或现场工控机

## Summary（摘要）

| Dimension（维度） | Result（结果） | Evidence（证据） |
| --- | --- | --- |
| Completeness（完整性） | PASS | OpenSpec `4/4` tasks 完成；`2/2` modified requirements 均有实现映射 |
| Correctness（正确性） | PASS | `14/14` scenarios 有现有实现与测试证据；目标测试 `126/126` 通过 |
| Coherence（一致性） | PASS | proposal、design、delta spec 与最小实现一致；无 API、schema、QT 或 Driver 变化 |
| Review（审查） | PASS | 独立正确性审查无 P0-P2 问题；Comet `review_mode=off` 未追加重复自动审查 |

## 1. Completeness（完整性）

- `openspec status --change fix-legacy-pending-press-job-compatibility --json`：schema 为 `spec-driven`，proposal、design、specs、tasks 全部 `done`。
- `openspec instructions apply --change fix-legacy-pending-press-job-compatibility --json`：`4/4` tasks 完成，remaining 为 `0`。
- `openspec validate fix-legacy-pending-press-job-compatibility --strict`：严格校验通过。
- OpenSpec `applySpecs(..., { dryRun: true })`：主规格重建通过，`modified=2`、`removed=0`、`renamed=0`。
- 本 hotfix 没有关联的 `docs/superpowers/specs/` 技术设计；OpenSpec `design.md` 是本次完整设计依据。

### Requirement / scenario mapping（需求与场景映射）

| Requirement（需求） | Scenarios | Implementation / test evidence（实现与测试证据） | Result |
| --- | ---: | --- | --- |
| 首次锁模持久化待开始父子作业 | 7 | `PressMouldJobInfoServiceImpl.normalizeLegacyPendingChildStatus`、`validateCurrentJobForLock`、`lockPressMouldCodeWithBoundDevice`；首次/继续/加工中锁模、旧版 ID 为空、旧版空状态、mixed identity 和 `craftCode` 冲突测试 | PASS |
| START 和待开始解锁复用既有作业记录 | 7 | `PressJobInfoServiceImpl.validateStartState`、`handleStartPressJob`、`startCurrentPressJob`，以及 `unlockPressMouldCodeWithBoundDevice`、`selectUnlockJobs`；START、部分/全部旧版解锁、stale/重复请求和加工中限制测试 | PASS |

## 2. Correctness（正确性）

| Area | Command / check | Result |
| --- | --- | --- |
| ERP Service tests | `mvn -f ../sam-erp/sam-erp-be/pom.xml -pl sam-erp -DskipITs -Dtest=PressMouldJobInfoServiceImplQtTest,PressJobInfoServiceImplQtTest test` | `126/126`，0 failures/errors/skips，BUILD SUCCESS |
| ERP package | `mvn -f ../sam-erp/sam-erp-be/pom.xml -pl sam-erp -am -DskipTests package` | 7-module reactor BUILD SUCCESS |
| OpenSpec | `openspec validate fix-legacy-pending-press-job-compatibility --strict` | valid |
| OpenSpec merge | `applySpecs(process.cwd(), change, { dryRun: true, silent: true })` | 2 modified，0 removed/renamed，主规格重建校验通过 |
| Comet archive | `comet archive fix-legacy-pending-press-job-compatibility --dry-run` | `4/4` 归档步骤预检通过 |
| Git / scope | 两仓 `git diff --check`，并扫描 ERP 提交中的凭据、令牌和 `Console.WriteLine` | exit `0`，无新增命中 |

Java 使用 `/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home`，Maven 使用 `/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn`。

### State and trust boundary（状态与信任边界）

- 仅当父作业满足 `id=null,status=0`，且子作业同时满足 `id=null,pressJobInfoId=null,status=null` 时，把子状态规范化为 `0`。
- 含真实 ID 的空状态、跨设备、跨授权主机、冲突父 ID、重复 ID、重复模具号和非待开始状态仍在任何业务写入前拒绝。
- 锁模和 START 复用既有懒持久化；直接解锁在同一 `@Transactional` 事务和设备行锁内先生成真实父子 ID，再按既有 `status=4` 规则处理部分或全部解锁。
- 部分解锁保留父 `status=0` 和未选子作业；全部解锁终止父子并清空设备当前作业 JSON；加工中最后一套模具限制保持不变。
- 失败解锁测试断言父、子和设备 JSON 均无写入；Mapper 影响行数和生成 ID 继续执行既有强校验。

## 3. Coherence（一致性）

- 实现遵循 OpenSpec 的三个决定：窄形状规范化、事务内复用既有懒持久化、保留安全反例。
- 生产改动只位于两个既有 Service；未新增公共接口、辅助模块、依赖、数据库脚本或并行迁移机制。
- 测试覆盖下一次锁模、Qt START、legacy START、部分解锁、全部解锁和持久化异常反例。
- 不需要 QT App、Driver Service、HTTP contract、数据库 schema 或批量数据迁移变更。
- 首次归档因 delta spec 未保留主规格原场景标题而原子失败，未产生归档文件；提交 `e8eba31` 已恢复原场景并以独立场景补充空子状态语义，合并 `dryRun` 已确认不会删除或重命名既有场景。

## 4. Issues（问题）

### CRITICAL

None.

### WARNING

None.

### SUGGESTION

None.

环境备注（不归因于本 change）：Maven 仍输出既有 Druid POM `systemPath`、Lombok、deprecated/unchecked warning，但目标测试和 7 模块构建均成功。未执行真实 MySQL 并发/回滚集成测试；事务、设备行锁和 Mapper 失败路径由现有代码与单元测试验证。

## Final Assessment（最终结论）

All checks passed. 本地实现满足 `4/4` tasks、`2/2` modified requirements 和 `14/14` scenarios，已达到 Archive(归档) 前的 Verify(验证) 通过条件。

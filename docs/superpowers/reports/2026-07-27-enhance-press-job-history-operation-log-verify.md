<!--
@file 2026-07-27-enhance-press-job-history-operation-log-verify.md - 压机历史作业操作日志 Comet Verify 报告
@author PopoY
@created 2026-07-27 13:43:49
@editor PopoY
@edited 2026-07-27 15:05:38
@purpose 记录跨 QT App 与 SAM ERP 的完整规格、测试、构建、安全边界和审查验证证据。
-->

# Verification Report：enhance-press-job-history-operation-log

## 结论

`PASS`。15/15 OpenSpec tasks（任务）、10/10 Requirements（需求）和 34/34 Scenarios（场景）均有当前实现与测试证据；Proposal（提案）、OpenSpec Design（设计）、两份 delta spec（增量规格）和技术 Design Doc（设计文档）一致。Fresh verification（新鲜验证）、两轮日志边界修正、双仓最终审查和安全边界检查均未发现剩余 CRITICAL、IMPORTANT、WARNING 或 SUGGESTION。

本报告允许运行 Verify guard（验证守卫）进入 Archive（归档）确认门，但不授权 archive、merge（合并）或 push（推送）。

## Summary Scorecard（汇总记分卡）

| Dimension（维度） | Status（状态） | Evidence（证据） |
| --- | --- | --- |
| Completeness（完整性） | PASS | OpenSpec `15/15` tasks；`10/10` requirements 均有实现落点 |
| Correctness（正确性） | PASS | `34/34` scenarios 由当前源码、定向测试或明确布局契约覆盖 |
| Coherence（一致性） | PASS | Proposal、OpenSpec Design、delta specs 和技术 Design Doc 无矛盾或 drift（漂移） |
| Security（安全性） | PASS | 认证设备/授权主机、严格六字段、未知字段固定拒绝、通用入口清空关联、日志脱敏均通过 |
| Build / Test（构建/测试） | PASS | 前端 `226/226`、TypeScript、Vite build；后端 `96/96`、Java 8 13-module compile、Liquibase XML 均通过 |
| Review（审查） | PASS | Task 1–5、两轮最终修正与 fresh 双仓 whole-branch review（整分支审查）均无剩余阻断项 |

## 验证范围

- QT App / 协调仓验证输入：`ad358ef4d2bd5f947bb688d4e4feab59e8164a03..6fc01e21deff9483154cd33b1ab4ea52ba2dede4`；本报告与 Verify 状态提交属于其后的验证产物，不改变实现或规格语义。
- SAM ERP 后端：`160a1e70c8ed3ee963d73eaad9f3ce3242dd8c7f..07a4957ece77afe9c74de4b382ccf27b534e2c9b`。
- 两个 worktree（工作树）均绑定分支 `PopoY-WorkTree/feature/20260725/enhance-press-job-history-operation-log`。
- 关联技术设计：`docs/superpowers/specs/2026-07-25-press-job-history-operation-log-design.md`，文件存在且 `comet_change` 指向当前 change。
- Recorded handoff hash（已记录交接哈希）`effe1df3...` 与当前 artifact hash（产物哈希）`f27b41aa...` 不同，故本轮已完整重读 proposal、design、tasks、两份 delta spec 和技术 Design Doc，未使用旧 handoff 代替当前规格。

## Requirement / Scenario Coverage（需求与场景覆盖）

### `press-job-history-query`：5 Requirements / 19 Scenarios

| Requirement | Scenarios | 主要实现与测试证据 |
| --- | --- | --- |
| 历史作业一级入口与现有视觉体系一致 | 固定 1280×720 视口单行筛选、`SearchOutlined` + “查询”；浅色/深色继续复用既有 token，无新主题/依赖 | `PressJobHistoryPage.tsx`、`PressJobHistoryPage.css`；筛选、按钮、触控尺寸、主题变量和 CSS 契约测试 |
| 历史列表按已提交筛选条件服务端分页 | 首次当天查询、提交筛选、未查询翻页、无效日期、1/3/7/30 个本地自然日与下一日排他上界 | `createHistoryRangePresets`、`buildHistoryQuery`、`appliedQuery`；日期边界、31/32 日、排他上界、分页快照测试 |
| 详情抽屉提供脱敏追溯信息 | 触控/鼠标/键盘按稳定 `mouldJobId` 打开 80% Drawer；关闭保持状态、取消旧响应并归还焦点；历史班组缺口显示明确 | `PressJobHistoryPage.tsx` 的 row activation、Drawer、focus return 与详情投影；页面契约测试 |
| 历史详情按父作业展示新操作日志 | 父作业有新日志；旧作业无新日志；通用入口伪造关联；班组/人员主数据查询 | `QtPressWorkingController`、`ModbusHandleLogMapper.xml`、`ModbusHandleLogController`；兄弟模具、整组 fallback、伪造字段清空和主数据缺失测试 |
| 参数和操作记录只展示可靠白名单数据 | 单侧参数缺失/损坏、旧 session 切换、无可靠记录、原始 JSON Boolean、六字段时间线 | `erpClient.ts` 六字段 projection（投影）、`HistoryDetailContent`、旧 session 降级查询与 Timeline CSS；Boolean、完整/全缺失记录、空数组真实 SSR 测试 |

### `press-job-operation-log`：5 Requirements / 15 Scenarios

| Requirement | Scenarios | 主要实现与测试证据 |
| --- | --- | --- |
| 压机操作日志复用既有 ERP 日志表 | 保存已关联日志；保存未关联 device-only log | Liquibase 两列一索引、Domain/Mapper、`recordPressJobOperationForQt`；Mapper contract 与 Service 定向测试 |
| QT 操作日志端点保持最薄可信边界 | 合法六字段请求；完成加工后解析父作业；敏感/自由文本未知字段拒绝 | `QtPressWorkingController` DTO/Controller、`resolveOperationLogPressJobId`；MockMvc、完成后关联、跨设备/主机测试 |
| 父作业关联只能由可信服务端路径建立 | 通用 POST 提交父作业 ID；QT 专用 Service 建立关联 | `ModbusHandleLogController#add` 清空字段、QT Service 直接构造 Mapper 写入；两条路径独立测试 |
| 操作码和中文内容由服务端固定映射 | 六码成功；六码失败；非法操作码/非 Boolean 拒绝 | `PressJobInfoServiceImpl` 固定 mapping（映射）；六操作码、成功/失败内容、非法输入测试 |
| QT 只在真实操作结束后尽力上报 | 主成功但日志失败；主失败且日志失败；ERP 结果码；入/出线整体状态；请求结果不确定 | `reportPressJobOperationBestEffort` 与 START/PARAMETER/COMPLETE/LINE_IN/LINE_OUT 调用边界；主结果隔离、`OK/IDEMPOTENCY_REPLAY/PARTIAL_OK/FAILED`、刷新/完成后身份、无 retry/queue 测试 |

## Design Coherence（设计一致性）

- 数据库扩展严格为 nullable `press_job_info_id`、nullable `team_id` 和 `(device_id, press_job_info_id, handle_time, id)` 索引；无新表、外键、回填或迁移。
- 请求和响应均采用明确六字段白名单；服务端只接受六个固定操作码和 JSON Boolean，中文名称/内容由服务端固定映射。
- DTO 未知字段只置内部 boolean flag（布尔标记），Controller 在认证解析与 Service 前返回固定“请求包含未知字段”，未进入 Jackson/Spring 通用异常栈。
- `/operation-logs` 对成功、校验、认证上下文和 Service/Mapper 异常均以同一清洗 `correlationId` 输出 `RequestReceived -> ActionStarted/Completed -> ResponseSent`；底层 `RuntimeException` 只返回固定中文错误，不记录异常对象、原文、请求正文或敏感值。
- Spring Security（安全链）在 Controller 前拒绝未认证 operation-log 请求时，`AuthenticationEntryPointImpl` 对精确路径返回真实 HTTP 401，并输出同事件、同关联 ID 的脱敏四阶段日志；近似路径不误匹配。
- `press-job-id-*` 与现有 Qt `START` 会话两条路径均重新校验认证 `deviceId + granteeHostId`，不要求作业仍在进行中；无法关联时写 device-only log。
- 通用 `POST /modbus/handleLog` 只在 HTTP Trust Boundary（信任边界）清空 `pressJobInfoId`；通用 update Mapper 不更新该列，QT 专用可信路径不受影响。
- 新日志非空时整组使用新时间线，仅为空时整组 legacy fallback（旧数据降级）；兄弟模具共享父作业时间线，未关联日志不混入。
- 六类上报均为 fire-and-forget（发后即忘），不等待、不重试、不排队、不补偿；日志失败不改变主操作结果或异常。
- UI 只复用现有 Ant Design、Design Token 和诊断 Timeline CSS；无新增依赖、主题、Writer、session、fingerprint、锁或事务传播。
- Proposal / Design Doc 中关于书面复核与暂停 Task 2 的文字记录的是当时阶段门和审查轨迹，不是当前执行禁令或 canonical requirement；当前 tasks、Comet phase 和实施证据已明确该门完成，因此不构成 spec drift（规格漂移）。

## Fresh Verification Evidence（本轮实际证据）

### QT Frontend（前端）

- `npm test -- --run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/components/PressJobHistoryPage.test.tsx src/App.test.tsx`
  - 4/4 files；`226/226` tests 通过；exit 0。
- `./node_modules/.bin/tsc --noEmit`
  - exit 0，无输出。
- `npm run build`
  - exit 0；Vite 8.1.0；1114 modules transformed；生产构建成功。
- 构建仅保留既有单 chunk 大于 500 kB warning；本 change 未修改依赖清单或 lockfile（锁文件）。

### SAM ERP Backend（后端）

- Java 8 Maven 定向测试：
  - `ModbusHandleLogMapperContractTest`：2/2。
  - `ModbusHandleLogControllerTest`：1/1。
  - `PressJobInfoServiceImplQtTest`：59/59。
  - `QtPressWorkingControllerTest`：31/31。
  - `AuthenticationEntryPointImplTest`：3/3。
  - `sam-erp` 三类测试为 `62/62`，`yr-admin` 两类测试为 `34/34`；合计 `96/96`，0 failures、0 errors、0 skipped，相关 Reactor modules 全部 `SUCCESS`。
- `JAVA_HOME=...zulu-8.0.492... mvn -pl yr-admin -am -DskipTests compile`
  - 13/13 Reactor modules `SUCCESS`；`BUILD SUCCESS`；exit 0。
- `/usr/bin/xmllint --noout master.xml changelog-2026-07-27-qt-press-job-operation-log.xml`
  - 2/2 XML 可解析；exit 0。
- Maven 仅保留仓库既有 Druid `systemPath` model、Lombok、unchecked/deprecation warnings；本 change 未修改 POM 或依赖。

### OpenSpec / Git / Security（规格、版本与安全）

- `openspec validate enhance-press-job-history-operation-log --strict`：PASS。
- `openspec status` 与 `instructions apply`：schema 为 `spec-driven`，artifacts 全部 `done`，tasks `15/15`。
- Fresh requirement/scenario mapping（新鲜需求/场景映射）：`press-job-history-query` 为 5 Requirements / 19 Scenarios，`press-job-operation-log` 为 5 / 15；合计 10 / 34，全部有实现与自动化测试落点。
- 双仓当前 diff 与固定 base ranges 均通过 `git diff --check`。
- 后端工作树无 tracked 差异；协调仓只包含 Verify 阶段 `.comet.yaml`、run-state、trajectory、state-events 和本报告的预期变更。
- 双仓变更文件中无 `package.json`、lockfile 或 `pom.xml`；未新增依赖。
- 网络请求、安全字段、日志和响应采用白名单；未执行真实 ERP、Driver、PLC 或数据库 I/O。

## Final Cumulative Review（最终累计审查）

- Task 1–5 均完成对应 RED/GREEN 或严格规格校验、提交范围核对和 Thorough per-task review（逐任务全面审查）。
- 首轮最终审查发现 `/operation-logs` 四阶段日志与异常脱敏缺口；TDD 修正 `e9b4b69b` 后 Controller 31/31。复审继续发现生产 Security EntryPoint 未认证路径缺口；TDD 修正 `07a4957e` 后 EntryPoint 3/3。两轮 fresh task review 均确认对应问题关闭。
- 最终双仓 whole-branch review（全分支审查）以协调仓 `ad358ef4...c8068bd`、后端 `160a1e70...07a4957e` 为固定实现范围；其后协调仓仅新增 Comet 状态与验证证据，无生产代码或规格语义变化。
- Final review：`Approved`。
- Critical：无。
- Important：无。
- Minor：无。

## Issues by Priority（按优先级的问题）

### CRITICAL

无。

### WARNING

无。

### SUGGESTION

无。通用 `PUT /modbus/handleLog` 虽仍接受既有 Domain JSON，但当前 update Mapper 明确不更新 `press_job_info_id`，不会建立或修改父作业关联；不构成本 change 的缺口。

## Remaining Non-blocking Environment Risks（剩余非阻塞环境风险）

- 本轮 Mapper / Liquibase 验证为 contract test（契约测试）、Java 编译和 XML 解析，没有连接真实数据库；这符合“不得产生真实数据库副作用”的明确边界，部署阶段仍需由受控环境执行数据库迁移验证。
- 前端既有单 chunk 大于 500 kB warning 和后端既有 Maven/Lombok warning 不属于本 change 引入的回归。
- best-effort 日志在断网、超时或进程退出时可能丢失，这是已批准设计取舍；系统明确不增加队列、重试或补偿。

## Final Assessment（最终判定）

Completeness、Correctness、Coherence、Security、Build/Test 和 Review 全部通过。15/15 tasks、10/10 requirements、34/34 scenarios 已按当前产物和 HEAD 重新验证。All checks passed. Ready for Archive confirmation（归档确认），但尚未授权执行 Archive、merge 或 push。

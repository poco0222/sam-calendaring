---
change: enhance-press-job-history-operation-log
design-doc: docs/superpowers/specs/2026-07-25-press-job-history-operation-log-design.md
base-ref: 9270d9a56bc914be9e0433c08d3586859796d38c
---

> @file 2026-07-25-press-job-history-operation-log.md
> @author PopoY
> @created 2026-07-25 11:04:52
> @purpose 复用 SAM ERP 既有压机业务操作日志，并完成 QT 历史作业筛选、详情及时间线增强。

# 压机历史作业操作日志 Implementation Plan（实施计划）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`（推荐）或 `executing-plans` 按任务实施；每个任务使用 checkbox（复选框）跟踪。

**Goal（目标）：** 以 `modbus_handle_log` 作为唯一压机业务操作日志，保留 `qt_press_job_operation` 的 Idempotency（幂等）/Replay（重放）职责，并在 QT 历史详情展示可追溯的班组、人员、结果和整段时间线。

**Architecture（架构）：** ERP 在已认证设备与已校验 actor（操作者）边界生成父/模具会话，通过既有 Mapper（映射器）把生命周期动作写入扩展后的 `modbus_handle_log`；Driver 参与动作走最薄的 QT 安全端点，使用设备行锁、既有幂等键和 SHA-256 请求指纹防止串作业与重复写。QT 只发送白名单 ID/结果，不发送设备网络字段或原始 Driver 数据；历史详情优先业务日志，无可靠业务日志时整组降级到现有 Qt 成功生命周期记录。

**Tech Stack（技术栈）：** Java 8、Spring MVC、Spring Transaction、MyBatis、FastJSON、Liquibase、JUnit 5、Mockito、React 19、TypeScript 6、Ant Design 6、Day.js、Vitest、CSS。

## Global Constraints（全局约束）

- Frontend repository（前端仓库）：`/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring`，实施基线 `main@9270d9a56bc914be9e0433c08d3586859796d38c`。
- Backend repository（后端仓库）：`/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be`，实施基线 `master@37829f28f5d40f36ac6c1379661fd239d95426b7`。
- 不修改 `sam-erp-fe` 的旧 Vue `logHandle`，不新增业务日志表、npm/Maven 依赖、单实现 interface（接口）或 factory（工厂）。
- 复用 `modbus_handle_log`、`ModbusHandleLogMapper`、FastJSON、现有设备行锁/指纹逻辑、Ant Design/Day.js 和诊断日志 CSS 视觉。
- `qt_press_job_operation` 只保留幂等、重放和旧作业降级；`sys_oper_log` 继续作为通用 AOP 审计，不作为历史详情数据源。
- 不记录或返回 `deviceId`、IP、端口、原始参数 JSON、信号配置、寄存器、第三方异常正文、credential、token、lease、signature 或原始 Driver 响应。
- 每个外部请求继续用 `correlationId` 串联；Qt 不额外发送裸设备标识或网络配置。
- 新增/修改文件按执行时实际时间补 `@author PopoY`，已有作者保留并追加 `Editor: PopoY` / `Edited: 实际时间`。
- 所有 PLC/Driver 验证使用 Mock（模拟）或安全测试数据，不向真实 PLC 发送探测或重复动作。

## File Map（文件职责）

Backend（后端，相对 `sam-erp-be`）：

- `yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-25-press-operation-log.xml`：nullable 字段、索引和 rollback。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusHandleLog.java`：业务日志关联、指纹和 actor 快照字段。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/PressJobInfo.java`：仅随设备当前 JSON 保存的 `pressOperationSessionId`。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/PressMouldJobInfo.java`：持久化 `mouldOperationSessionId`。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/ModbusHandleLogMapper.java` 与 `src/main/resources/mapper/smes/modbus/ModbusHandleLogMapper.xml`：兼容 CRUD、精确查询、回填、幂等查询。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoMapper.java` 与 XML：模具会话读写和历史查询字段。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressOperationLogWriter.java`：具体 Spring Bean，actor 校验、固定操作映射、成功/失败写入。
- `PressMouldJobInfoServiceImpl.java`：锁模/解锁、加工中追加模具、跨日会话继承。
- `PressJobInfoServiceImpl.java`：开始回填、参数/完成日志、Driver 安全上报；保留现有 Qt 幂等记录。
- `IPressJobInfoService.java` / `IPressMouldJobInfoService.java`：仅增加 Controller 和既有实现真实需要的参数/方法。
- `yr-admin/.../QtPressWorkingController.java`：actor DTO、`operation-logs` 端点和历史业务日志白名单投影。

Frontend（前端，相对 `sam-calendaring`）：

- `qt-app/frontend/src/domain/pressJob.ts`：actor、Driver 日志请求/响应及历史操作类型。
- `qt-app/frontend/src/services/erpClient.ts`：安全上报、父会话收窄和历史字段白名单。
- `qt-app/frontend/src/components/PressJobPage.tsx`：只在真实 Driver 动作边界及入线/出线汇总点上报。
- `PressJobHistoryPage.tsx` / `.css`：单行筛选、日期 presets、80% Drawer、Boolean 翻译和时间线。

---

### Task 1: 扩展既有日志与作业会话数据模型

**Files:**

- Create: `yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-25-press-operation-log.xml`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusHandleLog.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/PressJobInfo.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/PressMouldJobInfo.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/ModbusHandleLogMapper.java`
- Modify: `sam-erp/src/main/resources/mapper/smes/modbus/ModbusHandleLogMapper.xml`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoMapper.java`
- Modify: `sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml`
- Test: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java`

**Interfaces:**

- Produces: `PressJobInfo.pressOperationSessionId:String`（不映射数据库列）；`PressMouldJobInfo.mouldOperationSessionId:String`；`ModbusHandleLog` 新增 `pressJobInfoId`, `mouldJobId`, `mouldOperationSessionId`, `correlationId`, `idempotencyKey`, `requestFingerprint`, `operationCode`, `teamId`, `teamName`, `operatorName`。
- Produces: `selectByIdempotency(deviceId, operationCode, idempotencyKey)`、`backfillMouldJobIds(deviceId, mouldOperationSessionId, pressJobInfoId, mouldJobId)`、`selectHistoryByMouldSession(deviceId, mouldOperationSessionId)`、`selectHistoryByMouldJobId(deviceId, mouldJobId)`。

- [ ] **Step 1: 写失败的迁移与 Mapper 契约测试**

在现有 `PressMouldJobInfoHistoryMapperContractTest` 增加源码契约断言：迁移字段全部 nullable；存在 `(mould_job_id, handle_time, id)`、`mould_operation_session_id`、`(press_job_info_id, handle_time, id)`、`correlation_id`、`(device_id, operation_code, idempotency_key)` 索引；回填 SQL 同时限制 `device_id` 与 `mould_operation_session_id`；历史查询按 `handle_time ASC, id ASC`。

- [ ] **Step 2: 运行测试并确认失败**

```zsh
cd "$BACKEND_WORKTREE"
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl sam-erp \
  -Dtest=PressMouldJobInfoHistoryMapperContractTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）：FAIL，指出迁移文件、新列或 Mapper 方法尚不存在。

- [ ] **Step 3: 写最小迁移、Domain 和 Mapper 实现**

迁移只做 `addColumn` / `createIndex`，全部新列 nullable；`press_mould_job_info.mould_operation_session_id` 同样可空。`ModbusHandleLogMapper.xml` 保留旧 CRUD 列并追加新列，不能要求旧调用方提供新值。`PressJobInfo.pressOperationSessionId` 不加入 MyBatis resultMap；它仅由 FastJSON 随设备当前作业 JSON 保存。

- [ ] **Step 4: 运行契约测试并确认通过**

重复 Step 2 命令。Expected：PASS。

- [ ] **Step 5: 提交后端数据模型**

```zsh
git add yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-25-press-operation-log.xml \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper \
  sam-erp/src/main/resources/mapper/smes/modbus \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java
git commit -m "feat: 扩展压机业务操作日志关联模型"
```

### Task 2: 实现可信 actor 快照与最小日志 Writer

**Files:**

- Create: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressOperationLogWriter.java`
- Create: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressOperationLogWriterTest.java`

**Interfaces:**

- Consumes: `FmPlineMapper.selectPlnListByDept2("30")`、`FmPlineMapper.selectFmPlineByCode(teamId)`、`UserDeptService` 现有人员关系查询、`ModbusHandleLogMapper`。
- Produces: `resolveActorSnapshot(String teamId, String operatorId)`；`writeSuccess(WriteContext context)`；`@Transactional(propagation = Propagation.REQUIRES_NEW) writeFailureInNewTransaction(WriteContext context)`。
- Constraint: `WriteContext` 是 Writer 内部小型 static value type（值类型），不创建 interface/factory；只含可信设备/作业关联、固定操作码/结果、correlationId 和 actor 快照。

- [ ] **Step 1: 写失败的 Writer 单元测试**

覆盖：班组不属于压机范围时拒绝；人员不属于班组部门时拒绝；成功快照保存 `handleBy=operatorId`、`teamId/teamName/operatorName`；操作码映射为固定中文 `handleType/handleContent`；Writer 无法接收 IP、port、参数 JSON、信号配置或异常正文；失败写入异常不替换调用方原异常。

- [ ] **Step 2: 运行测试并确认类尚不存在**

```zsh
cd "$BACKEND_WORKTREE"
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl sam-erp \
  -Dtest=PressOperationLogWriterTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected：FAIL，`PressOperationLogWriter` 尚不存在。

- [ ] **Step 3: 实现一个具体 Writer Bean**

使用固定 operation code allowlist：`LOCK_MOLD`, `CONNECT`, `START_JOB`, `PARAMETER_START`, `PARAMETER_END`, `MOVE_IN`, `MOVE_OUT`, `LINE_IN`, `LINE_OUT`, `COMPLETE_JOB`, `DISCONNECT`, `UNLOCK_MOLD`。`OK` 写 `handleResult="true"`；`PARTIAL_OK` / `FAILED` 写 `"false"`；内容只能由 code + result 映射生成。成功方法加入调用方事务；失败方法仅接受已经构造好的脱敏上下文并使用 `REQUIRES_NEW`。

- [ ] **Step 4: 运行测试并确认通过**

重复 Step 2 命令。Expected：PASS。

- [ ] **Step 5: 提交 Writer**

```zsh
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressOperationLogWriter.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressOperationLogWriterTest.java
git commit -m "feat: 增加可信压机操作日志写入器"
```

### Task 3: 把 ERP 生命周期动作接入业务日志

**Files:**

- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java`
- Test: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java`
- Test: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java`

**Interfaces:**

- Consumes: Task 1 会话字段/回填方法，Task 2 `PressOperationLogWriter`。
- Produces: 锁模、开始、参数、完成、解锁的成功/失败业务日志；每个父作业稳定 `pressOperationSessionId`；每个模具稳定 `mouldOperationSessionId`。
- Preserves: 现有 `QtPressJobOperationMapper` 的 START/PARAMETER/COMPLETE 幂等记录与 replay 返回值。

- [ ] **Step 1: 先写生命周期失败测试**

在两个现有 Qt service test 中覆盖：

```text
首次待开始锁模 -> 父会话非空、各模具会话唯一、LOCK_MOLD 日志 ID 可空
读取设备当前 JSON -> 父/模具会话不变化
开始加工 -> 子作业继承会话，并按相同会话回填锁模日志真实父/子 ID
加工中追加锁模 -> 根据父作业 status 判定，插入后日志立即携带真实父/子 ID
参数/完成 -> 按当前实际子作业扇出，共享 correlationId，不给兄弟模具串独有日志
解锁/跨日 -> 分段行继承原模具会话
业务回滚 -> 成功日志一起回滚
已验证上下文后的业务失败 -> 固定失败日志通过 REQUIRES_NEW 保留
Qt replay -> 不重复写业务日志
```

- [ ] **Step 2: 运行测试并确认失败**

```zsh
cd "$BACKEND_WORKTREE"
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl sam-erp \
  -Dtest=PressMouldJobInfoServiceImplQtTest,PressJobInfoServiceImplQtTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected：FAIL，缺少会话生成、回填或日志调用。

- [ ] **Step 3: 实现最小生命周期接入**

锁模时按父作业真实 `status` 区分待开始与加工中，不能复用 `pressJobInfo != null` 作为 `isWorking`。首次锁模用 `UUID.randomUUID().toString()` 生成父/模具会话；已有会话不重置。开始流程插入父/子作业后按完全相同的模具会话回填。父级动作只对当次真实子作业列表写一条/模具，不在查询阶段扩散。成功日志放在业务落库成功边界且同事务；失败日志捕获后调用外部注入 Writer Bean 并重新抛出原异常。

- [ ] **Step 4: 运行测试并确认通过**

重复 Step 2 命令。Expected：PASS。

- [ ] **Step 5: 提交生命周期接入**

```zsh
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java
git commit -m "feat: 记录压机作业生命周期操作日志"
```

### Task 4: 增加 Driver 安全日志端点与历史详情投影

**Files:**

- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java`
- Modify: `yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java`
- Test: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java`
- Test: `yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java`

**Interfaces:**

- Produces endpoint: `POST /api/qt/press-working/operation-logs`。
- Request allowlist: `operationCode`, `resultCode`, `correlationId`, `idempotencyKey`, `localJobSessionId`, `operatorId`, `teamId`；不得出现 `deviceId`、IP、port、content、原始 Driver response 或安全材料。
- Response: `{ "result": "RECORDED" | "IDEMPOTENCY_REPLAY", "correlationId": "..." }`；同键异指纹沿用当前 Qt 冲突响应，不伪装 replay。
- Historical operation View Model: `operationTime`, `operationCode`, `operationName`, `result`, `content`, `teamName`, `operatorName`。

- [ ] **Step 1: 写安全端点和详情投影失败测试**

Service test 覆盖以下顺序和边界：设备认证/行锁 → allowlist → 规范 fingerprint → 同键查询；同指纹在当前 actor 重校验前返回 replay，异指纹拒绝且不写；首次执行才校验 actor。开始前仅当 `localJobSessionId == current.pressOperationSessionId` 才按当前模具会话扇出；开始后只接受 `press-job-id-*` 或既有 START 映射解析的真实父作业；旧请求延迟到下一作业时只写未归属设备日志。一次上报的多模具记录同事务提交。

Controller test 覆盖：请求/响应白名单；历史先认证 `deviceId + mouldJobId`；有可靠业务日志时只返回按 `handle_time,id` 正序的业务日志；完全没有时整组降级到现有 Qt 成功记录；兄弟模具、未归属记录、敏感字段均不返回。

- [ ] **Step 2: 运行测试并确认失败**

```zsh
cd "$BACKEND_WORKTREE"
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am \
  -Dtest=QtPressWorkingControllerTest,PressJobInfoServiceImplQtTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected：FAIL，端点、指纹冲突检查或业务日志投影尚不存在。

- [ ] **Step 3: 实现端点与历史投影**

Fingerprint 使用当前生命周期相同的 UTF-8 canonical 拼接与 SHA-256 工具，字段顺序固定为 `operationCode/resultCode/localJobSessionId/operatorId/teamId`。幂等查询必须位于设备行锁内；同一上报扇出的每条日志保存相同 `requestFingerprint` / `idempotencyKey`。Controller 从 bootstrap context 解析设备，DTO 不声明任何网络/设备字段。历史投影直接读取保存时的 actor 名称快照，缺失返回“未记录”，不得查询当前组织补历史名称。

- [ ] **Step 4: 运行测试并确认通过**

重复 Step 2 命令。Expected：PASS。

- [ ] **Step 5: 提交端点与投影**

```zsh
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java \
  yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java \
  yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java
git commit -m "feat: 提供压机安全操作日志与历史投影"
```

### Task 5: 在 QT 真实 Driver 边界上报业务结果

**Files:**

- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

**Interfaces:**

- Consumes: Task 4 `/operation-logs` 契约；ERP 当前作业返回的 `pressOperationSessionId`。
- Produces: `recordPressOperationLog(input)`；参数、完成、解锁请求补齐 `operatorId/teamId`；当前作业优先使用服务端父会话作为 `localJobSessionId`。
- Result mapping: Driver/ERP 两侧都成功 → `OK`；任一侧失败但另一侧成功 → `PARTIAL_OK`；均失败 → `FAILED`。

- [ ] **Step 1: 写失败的 client 与页面测试**

`erpClient.test.ts` 断言 `/operation-logs` URL、Authorization / `X-Correlation-Id`、精确 body 白名单和递归敏感字段拒绝；参数/完成/解锁包含真实 `operatorId/teamId`；current-job 收窄优先返回 `pressOperationSessionId`。

`PressJobPage.test.tsx` 覆盖：实际执行的 connect/disconnect/move-in/move-out 成功和失败都各上报一次；未执行的 cleanup 不上报；入线/出线等待 Driver 与 ERP `allSettled` 后只上报一次聚合结果；`machine-status` 不重复写业务日志；日志上报失败只重试日志请求，绝不重放 PLC 命令。

- [ ] **Step 2: 运行测试并确认失败**

```zsh
cd "$FRONTEND_WORKTREE"
pnpm --dir qt-app/frontend exec vitest run \
  src/services/erpClient.test.ts \
  src/components/PressJobPage.test.tsx
```

Expected：FAIL，安全日志 client、父会话收窄或上报调用尚不存在。

- [ ] **Step 3: 实现最小 QT 契约和执行边界调用**

在 `pressJob.ts` 只增加 API 需要的 ID/result 类型；不添加设备或网络字段。在 `erpClient.ts` 复用现有认证 header、correlation header、响应收窄和敏感字段检查。在 `PressJobPage.tsx` 把上报放到真实 Driver promise settled 之后；生成稳定 `idempotencyKey` 时复用现有动作键规则。若安全日志请求失败，记录脱敏诊断并允许界面报告业务动作真实结果，不回放 Driver。

- [ ] **Step 4: 运行测试并确认通过**

重复 Step 2 命令。Expected：PASS。

- [ ] **Step 5: 提交 QT 操作上报**

```zsh
git add qt-app/frontend/src/domain/pressJob.ts \
  qt-app/frontend/src/services/erpClient.ts \
  qt-app/frontend/src/services/erpClient.test.ts \
  qt-app/frontend/src/components/PressJobPage.tsx \
  qt-app/frontend/src/components/PressJobPage.test.tsx
git commit -m "feat: 上报压机 Driver 业务操作结果"
```

### Task 6: 调整历史筛选、详情和整段日志时间线

**Files:**

- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.css`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx`

**Interfaces:**

- Produces pure helper: `createHistoryDatePresets(now: Dayjs)`，值依次为 `[today,today]`、`[today-2d,today]`、`[today-6d,today]`、`[today-29d,today]`。
- Produces formatter: `formatHistoryParameterValue(value)` 仅在 `typeof value === "boolean"` 时返回“是/否”。
- Consumes history operation View Model: `operationTime/operationCode/operationName/result/content/teamName/operatorName`。

- [ ] **Step 1: 写失败的历史页面和收窄测试**

覆盖：筛选标签/控件同行且 `flex-wrap: nowrap`；按钮同时存在 `SearchOutlined` 和“查询”；四个 preset 的本地自然日精确值；选 preset 只改 `draftFilters`，点击查询后才更新 `appliedQuery`；排他结束上界和 31 日上限不变；Drawer `size="80%"`；Boolean `true/false` 为“是/否”，字符串 `"true"/"false"` 与数字 `1/0` 保持原值；时间线 `<ol>/<li>` 显示结果、内容、班组、人员和“未记录”；API 收窄拒绝额外敏感字段。

- [ ] **Step 2: 运行测试并确认失败**

```zsh
cd "$FRONTEND_WORKTREE"
pnpm --dir qt-app/frontend exec vitest run \
  src/services/erpClient.test.ts \
  src/components/PressJobHistoryPage.test.tsx
```

Expected：FAIL，当前仍为纵向 label、无 presets、70% Drawer、英文 Boolean 或旧列表样式。

- [ ] **Step 3: 实现原生 AntD/Day.js/CSS 调整**

`RangePicker` 直接使用 `presets={createHistoryDatePresets(dayjs())}`；Button 使用已安装 `SearchOutlined` 且保留文字。CSS 复用 `DiagnosticLogsPage` 的 marker/time/content 三列结构与现有 Design Token，不复制诊断页业务逻辑、不新增 Timeline 依赖。操作记录缺字段统一显示“未记录”，不关联当前班组/人员。

- [ ] **Step 4: 运行测试并确认通过**

重复 Step 2 命令。Expected：PASS。

- [ ] **Step 5: 提交历史页面**

```zsh
git add qt-app/frontend/src/domain/pressJob.ts \
  qt-app/frontend/src/services/erpClient.ts \
  qt-app/frontend/src/services/erpClient.test.ts \
  qt-app/frontend/src/components/PressJobHistoryPage.tsx \
  qt-app/frontend/src/components/PressJobHistoryPage.css \
  qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
git commit -m "feat: 优化历史作业筛选与操作时间线"
```

### Task 7: 联合验证、审查和 Comet 证据收口

**Files:**

- Modify only if a verification failure proves an in-scope defect; do not perform opportunistic refactors.
- Update: `openspec/changes/enhance-press-job-history-operation-log/tasks.md` checkboxes through `comet state task-checkoff` or the active execution Skill's verified checkoff flow.

**Interfaces:**

- Consumes: Tasks 1–6 committed output.
- Produces: backend/frontend build evidence, security scan evidence, final review findings resolved or durably recorded.

- [ ] **Step 1: 运行后端目标测试**

```zsh
cd "$BACKEND_WORKTREE"
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am \
  -Dtest=PressOperationLogWriterTest,PressMouldJobInfoHistoryMapperContractTest,PressMouldJobInfoServiceImplQtTest,PressJobInfoServiceImplQtTest,QtPressWorkingControllerTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected：全部目标测试 PASS。

- [ ] **Step 2: 运行 Java 8 后端构建**

```zsh
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am -DskipTests package
```

Expected：Reactor BUILD SUCCESS。

- [ ] **Step 3: 运行前端目标测试和生产构建**

```zsh
cd "$FRONTEND_WORKTREE"
pnpm --dir qt-app/frontend exec vitest run \
  src/services/erpClient.test.ts \
  src/components/PressJobPage.test.tsx \
  src/components/PressJobHistoryPage.test.tsx
pnpm --dir qt-app/frontend build
```

Expected：Vitest 全通过，TypeScript/Vite production build 成功。

- [ ] **Step 4: 运行规格、格式与敏感字段检查**

```zsh
cd "$FRONTEND_WORKTREE"
openspec validate enhance-press-job-history-operation-log --strict
git diff --check 9270d9a56bc914be9e0433c08d3586859796d38c...HEAD
rg -n "deviceId|ip|port|signalConfig|sessionToken|signedLease|signature|privateKey|credential" \
  qt-app/frontend/src/services/erpClient.ts \
  qt-app/frontend/src/components/PressJobPage.tsx

cd "$BACKEND_WORKTREE"
git diff --check 37829f28f5d40f36ac6c1379661fd239d95426b7...HEAD
```

Expected：OpenSpec valid、diff check 无输出；敏感词命中只能位于既有认证/拒绝逻辑，不得出现在新业务日志 DTO、Writer 内容或历史投影。

- [ ] **Step 5: 按已选择的 review_mode 完成代码审查**

`standard`：一次全量 correctness/security/edge-case review；`thorough`：按每 3 个任务分段审查并做一次最终全量审查。必须修复 CRITICAL，其他接受项要在持久产物记录理由。重点检查事务、设备隔离、同键异载荷、actor replay 顺序、作业切换延迟、加工中追加锁模、敏感字段和 PLC 不重放。

- [ ] **Step 6: 记录 Comet build evidence 并检查任务**

```zsh
comet state record-check enhance-press-job-history-operation-log build \
  --command "pnpm --dir qt-app/frontend build" --exit-code 0 \
  --cwd "$FRONTEND_WORKTREE"
comet status .
```

Expected：计划与 OpenSpec 任务均已完成，Build Guard 可进入 verify；本步骤不执行 archive 或 push。

## Requirements Traceability（需求追踪）

| OpenSpec task | Plan task |
| --- | --- |
| 1.1 日志表迁移 | Task 1 |
| 1.2 日志 Domain/Mapper | Task 1 |
| 1.3 父/模具会话 | Task 1、Task 3 |
| 2.1 actor/Writer | Task 2 |
| 2.2 锁模/解锁 | Task 3 |
| 2.3 开始/参数/完成 | Task 3 |
| 2.4 失败补写 | Task 2、Task 3 |
| 2.5 Driver 安全端点 | Task 4 |
| 3.1 业务日志查询 | Task 4 |
| 3.2 旧作业降级 | Task 4 |
| 3.3 后端自动化测试 | Task 1–4、Task 7 |
| 4.1 QT DTO/契约 | Task 5 |
| 4.2 真实 Driver 边界 | Task 5 |
| 4.3 敏感字段保护 | Task 5、Task 7 |
| 5.1 单行筛选/搜索图标 | Task 6 |
| 5.2 日期快捷项 | Task 6 |
| 5.3 Drawer/Boolean | Task 6 |
| 5.4 整段日志时间线 | Task 6 |
| 5.5 前端测试 | Task 6、Task 7 |
| 6.1 后端测试/构建 | Task 7 |
| 6.2 前端测试/构建 | Task 7 |
| 6.3 安全联合验证 | Task 7 |

## Deliberate Omissions（明确不做）

- 不接入或改造旧 Vue `logHandle`；复用的是其既有表/Domain/Mapper，而不是复制客户端函数。
- 不把 `sys_oper_log` 或 Driver `audit_log/diagnostic_log` 混入业务时间线。
- 不回填无法证明归属的旧 `modbus_handle_log`，不按设备+模具+时间猜测。
- 不新增公共日志 SDK、接口层、工厂、第三方 Timeline/日期/状态依赖。
- 不在本阶段 merge、archive 或 push；这些仍由后续 Comet gate 和用户授权决定。

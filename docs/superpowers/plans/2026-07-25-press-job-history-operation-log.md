---
change: enhance-press-job-history-operation-log
design-doc: docs/superpowers/specs/2026-07-25-press-job-history-operation-log-design.md
base-ref: ad358ef4d2bd5f947bb688d4e4feab59e8164a03
---

# 压机历史作业操作日志 Implementation Plan（实施计划）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> @file 2026-07-25-press-job-history-operation-log.md
> @author PopoY
> @created 2026-07-25 11:04:52
> Editor: PopoY
> Edited: 2026-07-27 09:17:15

**Goal:** 参考 `sam-erp-fe` 既有 `logHandle`，在六个压机真实操作结果确定后 best-effort（尽力而为）写入 `modbus_handle_log`，并在历史详情按父作业展示班组、作业人员和整段时间线，同时完成指定筛选与抽屉 UI 调整。

**Architecture:** ERP 只扩展现有日志表、现有压机作业 Service（服务）和现有 Qt Controller（控制器）；服务端从认证上下文取得设备与授权主机，复用两条已有父作业关联路径，不能可靠关联时只写 device-only log（仅设备日志）。QT App 在主操作结果已经确定后触发不等待的六字段日志请求；历史详情优先整组使用新日志，完全没有新日志时整组降级现有 `qt_press_job_operation` 投影。

**Tech Stack:** Java 8、Spring MVC、MyBatis、Liquibase、JUnit 5、React、TypeScript、Ant Design、dayjs、Vitest。

## Global Constraints

- 前端协调仓基准固定为 `ad358ef4d2bd5f947bb688d4e4feab59e8164a03`；后端仓基准固定为 `160a1e70c8ed3ee963d73eaad9f3ce3242dd8c7f`。
- 前端工作树：`/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/.worktrees/enhance-press-job-history-operation-log`；后端工作树：`/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log`。
- `modbus_handle_log` 只新增 nullable `press_job_info_id`、nullable `team_id` 和索引 `(device_id, press_job_info_id, handle_time, id)`；不新增表、外键、数据迁移或回填。
- 请求正文严格只有 `correlationId`、`localJobSessionId`、`operationCode`、`result`、`teamId`、`operatorId`；`result` 必须是 JSON Boolean（布尔值）。
- 只允许 `START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE`；操作中文名称和内容由服务端固定映射。
- 服务端只从认证上下文取得 `deviceId`、`granteeHostId`；请求不得包含设备、网络、原始参数、信号配置、异常正文、credential（凭据）、token（令牌）、lease（租约）或 signature（签名）。
- 父作业只复用 `press-job-id-*` 直连和现有 Qt `START` 会话映射；只校验父作业属于认证设备与授权主机，不要求仍在加工，不增加 actor-team（人员班组）二次关系校验。
- 无可靠父作业时保存 `press_job_info_id = null` 的 device-only log；它不进入历史详情，不回填、不按时间猜测。
- 日志上报必须发生在真实操作结果确定后，不等待、不重试、不排队、不补偿；日志失败不得改变主操作返回或异常。
- 历史详情按认证设备与父作业共享时间线；新日志存在任意一条即整组使用新日志，否则整组使用旧生命周期记录。
- 不恢复旧 `pressOperationSessionId`、`mouldOperationSessionId`、fingerprint（指纹）、新 idempotency（幂等）、`REQUIRES_NEW`、Writer（写入器）、锁模/解锁日志或锁内模具校验改动。
- 所有新增或修改文件头/关键逻辑注释遵守项目 `AGENTS.md`，使用 `@author PopoY` 和执行时本地真实时间；不得记录敏感原文。
- 测试只使用 Mock（模拟）或内存数据，不请求真实 Driver Service（驱动服务）、ERP 外部环境或 PLC（可编程逻辑控制器）。

---

## 文件结构与职责

| 工作树 | 文件 | 职责 |
| --- | --- | --- |
| 后端 | `yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-27-qt-press-job-operation-log.xml`、`yr-admin/src/main/resources/db/liquibase/master.xml` | 两列一索引及唯一 include（引入） |
| 后端 | `sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusHandleLog.java` | 复用既有日志领域对象，追加父作业、班组和查询展示名称 |
| 后端 | `sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/ModbusHandleLogMapper.java`、`sam-erp/src/main/resources/mapper/smes/modbus/ModbusHandleLogMapper.xml` | 写入新增 ID，并按设备与父作业稳定查询及关联主数据 |
| 后端 | `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java`、`sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java` | 复用现有父作业解析并保存固定日志，不新增 Service/Writer |
| 后端 | `yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java` | 六字段薄端点、请求白名单与历史整组 fallback |
| 前端 | `qt-app/frontend/src/domain/pressJob.ts`、`qt-app/frontend/src/services/erpClient.ts`、`qt-app/frontend/src/App.tsx` | 最小请求/历史类型、HTTP 调用与现有依赖注入 |
| 前端 | `qt-app/frontend/src/components/PressJobPage.tsx` | 六个既有 workflow（流程）的 post-action 上报 |
| 前端 | `qt-app/frontend/src/components/PressJobHistoryPage.tsx`、`qt-app/frontend/src/components/PressJobHistoryPage.css` | 单行筛选、快捷日期、80% Drawer、Boolean 翻译和 Timeline（时间线） |

### Task 1: 最小日志表与 Mapper（映射器）

**Files:**
- Create: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-27-qt-press-job-operation-log.xml`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/yr-admin/src/main/resources/db/liquibase/master.xml`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusHandleLog.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/ModbusHandleLogMapper.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/sam-erp/src/main/resources/mapper/smes/modbus/ModbusHandleLogMapper.xml`
- Create: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/ModbusHandleLogMapperContractTest.java`

**Interfaces:**
- Consumes: 既有 `insertModbusHandleLog(ModbusHandleLog log)` 与 `modbus_handle_log.handle_type/handle_content/handle_result/handle_by/handle_time/device_id`。
- Produces: `List<ModbusHandleLog> selectHistoryByPressJobInfoId(Long deviceId, Long pressJobInfoId)`；结果按 `handle_time ASC, id ASC`，对象可读 `pressJobInfoId`、`teamId`、`teamName`、`operatorName`。

- [ ] **Step 1: 写 Mapper/Liquibase 失败契约测试**

  在 `ModbusHandleLogMapperContractTest` 用 classpath 读取 changelog 与 Mapper XML，精确断言只出现下列 schema/query 契约，并断言没有 `mould_job_id`、`correlation_id`、session/fingerprint 列：

  ```java
  assertTrue(changelog.contains("press_job_info_id"));
  assertTrue(changelog.contains("team_id"));
  assertTrue(mapper.contains("selectHistoryByPressJobInfoId"));
  assertTrue(mapper.contains("handle_time ASC"));
  assertTrue(mapper.contains("id ASC"));
  assertFalse(mapper.contains("mould_job_id"));
  assertFalse(mapper.contains("correlation_id"));
  assertFalse(mapper.contains("request_fingerprint"));
  ```

- [ ] **Step 2: 运行测试并确认 RED（红）**

  Run（后端工作树）：

  ```bash
  JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl sam-erp -am -Dtest=ModbusHandleLogMapperContractTest -Dsurefire.failIfNoSpecifiedTests=false test
  ```

  Expected: FAIL，原因是 changelog 和 `selectHistoryByPressJobInfoId` 尚不存在。

- [ ] **Step 3: 实现两列一索引和最小 Mapper 扩展**

  changelog 只包含两个 `addColumn`、一个 `createIndex` 及对称 rollback；`master.xml` 只新增一次 include。Domain 追加 nullable ID 与查询展示字段；Mapper insert 只追加 `press_job_info_id/team_id`，查询签名固定为：

  ```java
  List<ModbusHandleLog> selectHistoryByPressJobInfoId(
          @Param("deviceId") Long deviceId,
          @Param("pressJobInfoId") Long pressJobInfoId);
  ```

  SQL 必须用 `WHERE log.device_id = #{deviceId} AND log.press_job_info_id = #{pressJobInfoId}`；班组名称精确复用 `sam_mes_fm_pline.code/name`，人员名称精确复用 `sys_user.user_name/nick_name`：

  ```sql
  LEFT JOIN sam_mes_fm_pline team ON team.code = log.team_id
  LEFT JOIN sys_user operator_user ON operator_user.user_name = log.handle_by
  ```

  使用 `LEFT JOIN` 保留主数据缺失日志，并以 `ORDER BY log.handle_time ASC, log.id ASC` 收尾。

- [ ] **Step 4: 运行测试并确认 GREEN（绿）**

  重复 Step 2 命令。Expected: `ModbusHandleLogMapperContractTest` PASS，且 Maven `BUILD SUCCESS`。

- [ ] **Step 5: 提交最小数据边界**

  ```bash
  git add yr-admin/src/main/resources/db/liquibase/master.xml yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-27-qt-press-job-operation-log.xml sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusHandleLog.java sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/ModbusHandleLogMapper.java sam-erp/src/main/resources/mapper/smes/modbus/ModbusHandleLogMapper.xml sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/ModbusHandleLogMapperContractTest.java
  git commit -m "feat: 扩展压机作业操作日志字段"
  ```

### Task 2: 六字段薄端点与历史整组 fallback

**Files:**
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/.worktrees/enhance-press-job-history-operation-log/yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java`

**Interfaces:**
- Consumes: Task 1 的 `insertModbusHandleLog`、`selectHistoryByPressJobInfoId`；现有 `resolveQtPressContext()`、`press-job-id-*` 和 Qt `START` 映射。
- Produces: `void recordPressJobOperationForQt(QtPressJobContext context, String correlationId, String localJobSessionId, String operationCode, boolean result, String teamId, String operatorId)`；`POST /api/qt/press-working/operation-logs`；历史 `operationRecords` 每条为 `operationTime/operationName/result/content/teamName/operatorName`。

- [ ] **Step 1: 写端点、关联和历史投影失败测试**

  Service 测试覆盖：`press-job-id-*` 直连、Qt `START` 会话、完成后仍关联、无法关联写 null、他设备/他授权主机不得关联、不校验 operator-team 关系、`handle_result` 只写字符串 `true/false`。Controller 测试覆盖六操作码固定映射、非 Boolean/未知码/额外敏感字段拒绝、认证设备不可由请求覆盖、新日志优先、零条新日志整组 fallback、兄弟模具共享同一父作业时间线、缺失主数据返回 null；“未记录”仅由 Task 4 的 UI 显示。

  ```java
  verify(pressJobInfoService).recordPressJobOperationForQt(
          context, "corr-1", "press-job-id-42", "COMPLETE", true, "team-1", "user-1");
  assertEquals("失败", operationRecords.get(0).get("result"));
  assertNull(operationRecords.get(0).get("teamName"));
  ```

- [ ] **Step 2: 运行测试并确认 RED（红）**

  ```bash
  JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am -Dtest=PressJobInfoServiceImplQtTest,QtPressWorkingControllerTest -Dsurefire.failIfNoSpecifiedTests=false test
  ```

  Expected: FAIL，原因是新 Service 方法、端点与六字段投影尚不存在。

- [ ] **Step 3: 实现最薄 Service 与 Controller**

  在现有 `IPressJobInfoService/PressJobInfoServiceImpl` 增加上方一个方法，不新增接口、Writer、事务传播或会话对象。父作业解析顺序固定为：

  ```text
  press-job-id-* -> 按 context.deviceId + context.granteeHostId 查父作业
  其他 localJobSessionId -> 按认证设备查现有 Qt START -> 再确认授权主机
  未命中或不属于上下文 -> pressJobInfoId = null
  ```

  Service 用 Java 8 `switch` 映射固定值：

  ```text
  START=开始加工；PARAMETER_START=开始参数记录；PARAMETER_END=完工参数记录
  LINE_IN=入线；LINE_OUT=出线；COMPLETE=完成加工
  handle_content = handle_type + (result ? "成功" : "失败")
  ```

  然后设置 `handle_result = String.valueOf(result)`、`handle_by = operatorId`、`team_id = teamId`、`device_id = context.deviceId`。不查询人员是否属于班组，不要求父作业 active/current。

  Controller 内新增只有六个属性的 `PressJobOperationLogRequest`，未知 JSON 属性在反序列化时拒绝；六字段都校验非空，`Boolean result` 非 null 后才拆箱。复用 `requireMatchingCorrelation` 与 `resolveQtPressContext()`，成功只返回现有 `AjaxResult.success()`，不得回显请求正文。

  历史详情先调用 Task 1 新查询；结果非空时投影六字段，空时才调用现有 `qtPressJobOperationMapper.selectHistoryByPressJobInfoId(...)`，禁止逐条混合两类日志。

- [ ] **Step 4: 运行测试并确认 GREEN（绿）**

  重复 Step 2 命令。Expected: 两个定向测试类 PASS，Maven `BUILD SUCCESS`。

- [ ] **Step 5: 提交后端业务边界**

  ```bash
  git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java
  git commit -m "feat: 记录压机作业操作日志"
  ```

### Task 3: QT post-action best-effort（操作后尽力上报）

**Files:**
- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `POST /api/qt/press-working/operation-logs`。
- Produces: `PressJobOperationCode` 六值 union、`PressJobOperationLogRequest` 六字段类型、`recordPressJobOperation(request): Promise<void>`；`PressJobPageProps.recordPressJobOperation?` 注入点。

- [ ] **Step 1: 写客户端白名单和 workflow 失败测试**

  `erpClient.test.ts` 精确断言 URL、`X-Correlation-Id` 和 JSON body 六个键，且 body 不含 `deviceId/ip/port/signalValues/error/signature/signedLease/sessionToken`。`PressJobPage.test.tsx` 覆盖 START、参数开始、参数结束、完成、入线、出线；断言 ERP `OK/IDEMPOTENCY_REPLAY=true`，其他 code/throw=false，入线/出线只有整体 `OK=true`，`PARTIAL_OK/FAILED=false`，日志 Promise reject 不改变 workflow 原结果，并专门覆盖完成加工清除 current job 后，出线仍使用保留的 `localJobSessionId/teamId/operatorId` 上报。

  ```ts
  expect(recordPressJobOperation).toHaveBeenCalledWith({
    correlationId, localJobSessionId, operationCode: "LINE_OUT",
    result: false, teamId: "team-1", operatorId: "user-1",
  });
  ```

- [ ] **Step 2: 运行测试并确认 RED（红）**

  Run（前端工作树 `qt-app/frontend`）：

  ```bash
  npm test -- --run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx
  ```

  Expected: FAIL，原因是日志请求类型、client（客户端）和 post-action 调用尚不存在。

- [ ] **Step 3: 实现一个最小上报函数并接入六个结果边界**

  `pressJob.ts` 只新增：

  ```ts
  export type PressJobOperationCode = "START" | "PARAMETER_START" | "PARAMETER_END" | "LINE_IN" | "LINE_OUT" | "COMPLETE";
  export type PressJobOperationLogRequest = {
    correlationId: string; localJobSessionId: string; operationCode: PressJobOperationCode;
    result: boolean; teamId: string; operatorId: string;
  };
  ```

  `erpClient.ts` 复用现有认证 request helper POST 原对象；`App.tsx` 只把方法注入 `PressJobPage`。在 `PressJobPage.tsx` 内保留一个局部 helper：调用 `void recordPressJobOperation?.(request).catch(...)`，catch 仅向现有诊断入口传 `correlationId`、operationCode 和固定中文摘要，不传 request/error 原文。

  START、PARAMETER_START、PARAMETER_END、COMPLETE 分别紧贴各自 ERP 调用结果/异常分支上报；LINE_IN/LINE_OUT 只在现有 Driver+ERP 聚合结果形成后上报。完成加工后保留父作业会话与班组/人员上下文供 LINE_OUT 上报，不再从已清除的 current job 推导。不得记录 connect、disconnect、moveIn、moveOut、lock、unlock；不得 await、retry 或改变返回值。

- [ ] **Step 4: 运行测试并确认 GREEN（绿）**

  重复 Step 2 命令。Expected: 两个定向测试文件 PASS；日志拒绝不影响主流程断言 PASS。

- [ ] **Step 5: 提交 QT 上报边界**

  ```bash
  git add qt-app/frontend/src/domain/pressJob.ts qt-app/frontend/src/services/erpClient.ts qt-app/frontend/src/services/erpClient.test.ts qt-app/frontend/src/App.tsx qt-app/frontend/src/components/PressJobPage.tsx qt-app/frontend/src/components/PressJobPage.test.tsx
  git commit -m "feat: 上报压机操作结果日志"
  ```

### Task 4: 历史类型、指定 UI 与联合验证

**Files:**
- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.css`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx`
- Reference only: `qt-app/frontend/src/components/DiagnosticLogsPage.css`

**Interfaces:**
- Consumes: Task 2 历史详情六字段 `operationRecords`，现有 dayjs、Ant Design `RangePicker/Button/Drawer` 和诊断日志 Timeline CSS。
- Produces: 历史页面单行筛选、1/3/7/30 日 preset（快捷选项）、80% Drawer、严格 Boolean“是/否”、六字段时间线。

- [ ] **Step 1: 写 UI 与解析失败测试**

  测试覆盖：快捷值分别生成 `[today-(n-1), today]`，提交仍为本地零点到下一日零点排他上界且最多 31 日；筛选容器不换行；查询按钮含 `SearchOutlined` 与“查询”可访问文字；Drawer 为 `80%`；参数只有原始 Boolean 转“是/否”；字符串 `"true"`、数字 `1` 原样显示；操作记录逐条显示时间、操作、成功/失败、内容、班组、作业人员，缺失显示“未记录”。

  ```ts
  expect(formatHistoryParameterValue({ status: "recorded", value: true })).toBe("是");
  expect(formatHistoryParameterValue({ status: "recorded", value: "true" })).toBe("true");
  expect(screen.getByText("班组：未记录")).toBeInTheDocument();
  ```

- [ ] **Step 2: 运行测试并确认 RED（红）**

  ```bash
  npm test -- --run src/services/erpClient.test.ts src/components/PressJobHistoryPage.test.tsx
  ```

  Expected: FAIL，原因是新 operation 字段、快捷日期、80% Drawer 与 Timeline 展示尚未实现。

- [ ] **Step 3: 实现指定历史 UI**

  在 `pressJob.ts/erpClient.ts` 把 operation record 固定为 `operationTime/operationName/result/content/teamName/operatorName`，解析缺失名称为 `undefined` 交给页面显示“未记录”。`PressJobHistoryPage.tsx`：

  ```ts
  const createHistoryRangePresets = (today = dayjs().startOf("day")) => [1, 3, 7, 30].map((days) => ({
    label: `最近${days === 1 ? "一天" : days === 3 ? "三天" : days === 7 ? "一周" : "一月"}`,
    value: [today.subtract(days - 1, "day"), today],
  }));
  ```

  每次渲染按当前本地自然日生成 presets 后交给现有 `RangePicker`，避免应用跨午夜后继续使用旧日期；查询按钮使用 `icon={<SearchOutlined aria-hidden="true" />}` 并保留文字；Drawer `size="80%"`。`formatHistoryParameterValue` 仅对 `typeof value === "boolean"` 翻译。操作列表沿用现有 `<ol>/<li>/<time>`，CSS 复用 `DiagnosticLogsPage.css` 的线、圆点、间距和值，不引入新组件、依赖、主题或视觉效果；筛选 CSS 使用单行 flex/grid 且按钮不另起行。

- [ ] **Step 4: 运行前后端最终验证**

  ```bash
  npm test -- --run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/components/PressJobHistoryPage.test.tsx
  npm run build
  ```

  Expected: Vitest 全 PASS；TypeScript 与生产构建成功。

  在后端工作树运行：

  ```bash
  JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am -Dtest=ModbusHandleLogMapperContractTest,PressJobInfoServiceImplQtTest,QtPressWorkingControllerTest -Dsurefire.failIfNoSpecifiedTests=false test
  JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am -DskipTests compile
  /usr/bin/xmllint --noout yr-admin/src/main/resources/db/liquibase/master.xml yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-27-qt-press-job-operation-log.xml
  ```

  Expected: 三个定向测试类 PASS，Java 8 compile（编译）`BUILD SUCCESS`，Liquibase XML 可解析。最后用 `git diff --check` 检查两个工作树，并人工核对网络请求仅六字段、无敏感正文、无真实设备请求、无旧 session/fingerprint/writer/锁解锁改动。

- [ ] **Step 5: 提交历史 UI 边界**

  ```bash
  git add qt-app/frontend/src/domain/pressJob.ts qt-app/frontend/src/services/erpClient.ts qt-app/frontend/src/services/erpClient.test.ts qt-app/frontend/src/components/PressJobHistoryPage.tsx qt-app/frontend/src/components/PressJobHistoryPage.css qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
  git commit -m "feat: 完善压机历史操作时间线"
  ```

## 完成判定

- 四个 Task（任务）全部通过各自 RED/GREEN（红/绿）证据并按最小边界提交。
- OpenSpec `tasks.md` 的 1.1–4.3 均可由上述 Task 1–4 的测试或人工安全核对直接对应。
- 两个工作树只包含本计划文件和明确列出的生产/测试文件；不修改、恢复或删除用户其他内容。
- 未执行 merge（合并）、push（推送）、数据库变更或真实 PLC/Driver 操作；这些仍需独立授权。

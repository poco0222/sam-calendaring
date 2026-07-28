---
change: refine-press-job-history-details
design-doc: docs/superpowers/specs/2026-07-28-refine-press-job-history-details-design.md
base-ref: 783994cecd9c6f043c2988c2e2c1b6fce7fcb77f
---

<!--
@file 2026-07-28-refine-press-job-history-details.md
@author PopoY
@created 2026-07-28 16:43:41
@purpose 将已确认的历史作业详情设计拆成可独立验证的跨仓 TDD 实施步骤。
-->

# 历史作业详情紧凑化与状态参数 Implementation Plan（实施计划）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让历史作业筛选项水平排列，开始/完工两列安全显示 Coil/Bit（线圈/位）状态，压缩操作时间线并固定每页 5 条，同时兼容既有参数 JSON 且不泄露信号配置。

**Architecture:** ERP 用一个无状态分类类为两条参数写入路径保存 `valueKind`，历史详情只查询一次认证设备的全部现存信号定义，并按合法快照、`signalId`、唯一 `signalCode` 的顺序安全回退。QT App 只接收 `state/scalar` 白名单，开始与完工参数共用既有格式化入口；操作记录继续使用现有 Ant Design（组件库）和 Timeline CSS（时间线样式），只做本地每页 5 条分页及紧凑布局。

**Tech Stack:** Java 8、Spring MVC、MyBatis、Jackson、Gson、JUnit 5、Mockito；React 19、TypeScript 6、Ant Design 6、Day.js、Vitest、CSS；OpenSpec、Comet。

## Global Constraints

- QT App 仓库固定基线为 `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring@783994cecd9c6f043c2988c2e2c1b6fce7fcb77f`；执行前按工作流创建隔离 worktree（工作树），不得在用户现有修改上强行覆盖。
- ERP 仓库为 `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be`；实施开始时重新记录 HEAD，两个仓库必须分别提交，不伪造跨仓单个 commit（提交）。
- ERP 已有未跟踪文件 `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/docs/sql/2026-07-27-qt-press-job-operation-log.sql` 必须保持原样、保持未跟踪且不得加入任何 `git add`。开始实施时先执行 `shasum -a 256 /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/docs/sql/2026-07-27-qt-press-job-operation-log.sql > /tmp/refine-press-job-history-details-sql.sha256`，完成时必须用 `shasum -a 256 -c /tmp/refine-press-job-history-details-sql.sha256` 得到 `OK`。
- 不修改 Driver Service（驱动服务）、数据库 schema（结构）、Liquibase、历史数据、历史列表服务端分页、操作日志写入语义或现有设备认证方式。
- 不新增依赖、主题 Provider（提供器）、自定义分页组件、服务端操作分页接口、配置项、数据回填任务或通用抽象层。
- ERP 只允许从服务端 `ModbusSignals` 定义生成 `valueKind`；不得接受 QT App 或旧 Vue 提交的分类值。
- `valueKind` 只允许精确文本 `state`、`scalar`；历史 JSON 中的空白、大小写变体、数字、对象和数组均视为非法，不执行修正。
- 状态分类规则固定为规范化后的 `registerType ∈ {"1", "coil", "coils"}` 或 `dataType ∈ {"bit", "bool", "boolean"}`；规范化仅用于受信任信号定义，使用 `trim().toLowerCase(Locale.ROOT)`。
- 历史详情不得输出或记录 `signalId`、`signalCode`、`registerType`、`dataType`、寄存器地址、完整 `signalConfig`、参数 JSON 原文、异常正文、凭据、Token（令牌）、Lease（租约）或 Signature（签名）。
- 参数定义查询失败、重复 code、畸形身份或单行无法匹配时，保留该行原始安全标量并省略 `valueKind`；不得中断详情，也不得把同侧其他行降级为 `invalid`。
- QT App 仅当 `valueKind === "state"` 且原值为 `0`、`"0"`、`false`、`1`、`"1"`、`true` 时显示“否/是”；所有 scalar（标量）和未知状态值保持原白名单文本。
- 操作日志后端 `content` 字段继续保留兼容性；只从新 QT View Model（视图模型）和页面展示删除，旧 QT 客户端不受影响。
- 所有新增或修改源码、样式和测试文件遵守项目 `AGENTS.md`：保留原作者，使用执行时本地真实时间追加 `Editor: PopoY` / `Edited: yyyy-MM-dd HH:mm:ss`，新增文件头包含 `@author PopoY`，关键说明使用中文或中英混合。
- 测试只使用 Mock（模拟）、内存对象和静态渲染，不请求真实 ERP 外部环境、Driver Service 或 PLC（可编程逻辑控制器）。

**Approved Design（已批准设计）：** [2026-07-28-refine-press-job-history-details-design.md](/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/docs/superpowers/specs/2026-07-28-refine-press-job-history-details-design.md)

---

## 文件结构与职责

| 仓库 | 文件 | 职责 |
| --- | --- | --- |
| ERP | `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusSignalValueKind.java` | 新增最小无状态分类入口，只提供 `STATE`、`SCALAR`、`classify`、`isSupported` |
| ERP | `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java` | 两条现有参数 JSON 写入路径保存同层 `valueKind` |
| ERP | `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java` | 锁定两条写入路径、开始/完工分类及原始值不变 |
| ERP | `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java` | 一次读取认证设备定义，建立 ID/唯一 code 索引并输出可选脱敏分类 |
| ERP | `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java` | 锁定快照优先、旧记录回退、失败降级、查询次数和敏感字段边界 |
| QT | `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/domain/pressJob.ts` | 历史参数增加可选联合类型，操作记录删除 `content` |
| QT | `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/services/erpClient.ts` | 精确收窄 `valueKind`，剔除后端兼容 `content` 与未知字段 |
| QT | `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/services/erpClient.test.ts` | 验证安全白名单、非法分类丢弃和响应脱敏 |
| QT | `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.tsx` | 两列统一格式化、删除缺失提示、操作每页 5 条和组合信息 |
| QT | `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.css` | 水平筛选、紧凑操作项、竖线、局部滚动和固定分页底栏 |
| QT | `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.test.tsx` | 锁定参数、分页、组合文案、提示和 CSS 契约 |

**OpenSpec 12 项覆盖：** `1.1 → Task 1 / Steps 1-3`，`1.2 → Task 2 / Steps 1-3`，`1.3 → Task 1 / Steps 4-6 + Task 2 / Steps 4-6`；`2.1 → Task 3`，`2.2 → Task 4 / Steps 1-3`，`2.3 → Task 4 / Step 4`；`3.1 → Task 4 / Steps 2-3`，`3.2 → Task 4 / Step 6`，`3.3 → Task 4 / Steps 5-7`；`4.1 → Task 5 / Steps 1、5`，`4.2 → Task 5 / Step 2`，`4.3 → Task 5 / Steps 3-5`。

### Task 1：ERP 两条参数写入路径保存统一分类

**Files:**
- Create: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusSignalValueKind.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java:19-40,1049-1212`
- Test: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java:183-220,1673-1875`

**Interfaces:**
- Consumes: `ModbusSignals#getRegisterType()`、`getDataType()` 以及既有 `recordPressJobParametersForQt(...)`、`recordStartParams(...)`。
- Produces: `ModbusSignalValueKind.STATE = "state"`、`SCALAR = "scalar"`、`classify(ModbusSignals): String`、`isSupported(String): boolean`；两种参数 JSON 每行新增同层 `valueKind`，其他字段和值保持不变。

- [ ] **Step 1：写 QT 参数写入路径的失败测试**

  在 `parameterSignals()` 给普通压力和状态信号补服务端类型定义，并把 `assertSafeParameterJson` 的固定字段和值断言改为：

  ```java
  pressure.setRegisterType("3");
  pressure.setDataType("float");
  ready.setRegisterType(" CoIl ");
  ready.setDataType("boolean");

  assertEquals(new LinkedHashSet<>(Arrays.asList(
          "signalId", "signalCode", "signalName", "signalValue",
          "unit", "time", "valueKind")),
          new LinkedHashSet<>(records.get(0).keySet()));
  assertEquals("scalar", records.get(0).get("valueKind"));
  assertEquals(12.5D, records.get(0).get("signalValue"));
  assertEquals("state", records.get(1).get("valueKind"));
  assertEquals(Boolean.TRUE, records.get(1).get("signalValue"));
  ```

  现有 `recordsSafeStartParametersForEveryExactCurrentChild` 和 `recordsSafeEndParametersWithoutWritingStartColumn` 会同时覆盖开始/完工列；不要新增重复测试类。

- [ ] **Step 2：写旧 Vue 参数写入路径的失败测试**

  在同一测试类新增 `legacyRecordStartParamsPersistsValueKindWithoutChangingValues`，用现有 JDK Proxy（代理）捕获 `updatePressMouldJobInfo`：

  ```java
  @Test
  void legacyRecordStartParamsPersistsValueKindWithoutChangingValues() {
      ModbusSignals ready = new ModbusSignals();
      ready.setId(2L);
      ready.setDeviceId(10L);
      ready.setSignalCode("ready");
      ready.setSignalName("Ready");
      ready.setIsActive(1);
      ready.setDataType("bit");
      ready.setBoolValue(true);
      PressMouldJobInfo active = parameterChild(101L, 42L, 10L, "1");
      AtomicReference<PressMouldJobInfo> update = new AtomicReference<>();
      PressMouldJobInfoServiceImpl service = service(
              modbusMapper((proxy, method, args) -> defaultValue(method.getReturnType())),
              pressMouldJobInfoMapper((proxy, method, args) -> {
                  if ("selectPressMouldJobInfoList".equals(method.getName())) {
                      return Collections.singletonList(active);
                  }
                  if ("updatePressMouldJobInfo".equals(method.getName())) {
                      update.set((PressMouldJobInfo) args[0]);
                      return 1;
                  }
                  return defaultValue(method.getReturnType());
              }));
      setField(service, "modbusSignalsMapper", modbusSignalsMapper((proxy, method, args) ->
              "selectSignalsList".equals(method.getName())
                      ? Collections.singletonList(ready)
                      : defaultValue(method.getReturnType())));

      assertEquals(1, service.recordStartParams("end", "10", "ignored"));

      List<Map<String, Object>> rows = new Gson().fromJson(
              update.get().getEndParameterRecords(), List.class);
      assertEquals("state", rows.get(0).get("valueKind"));
      assertEquals(Boolean.TRUE, rows.get(0).get("signalValue"));
  }

  private static ModbusSignalsMapper modbusSignalsMapper(InvocationHandler handler) {
      return proxy(ModbusSignalsMapper.class, handler);
  }
  ```

- [ ] **Step 3：运行聚焦测试并确认 RED（红灯）**

  Run（ERP 仓库）：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
  JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
    /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
    -pl sam-erp -am \
    -Dtest=PressMouldJobInfoServiceImplQtTest \
    -Dsurefire.failIfNoSpecifiedTests=false test
  ```

  Expected: FAIL；两条 JSON 尚无 `valueKind`，断言实际值为 `null`，其余既有参数安全断言仍通过。

- [ ] **Step 4：新增最小共享分类类**

  新建 `ModbusSignalValueKind.java`，执行时用本地真实时间填写文件头；类体固定为：

  ```java
  package com.yr.smes2.smes.modbus.domain;

  import java.util.Locale;

  public final class ModbusSignalValueKind {
      public static final String STATE = "state";
      public static final String SCALAR = "scalar";

      private ModbusSignalValueKind() {
      }

      public static String classify(ModbusSignals signal) {
          String registerType = normalize(signal == null ? null : signal.getRegisterType());
          String dataType = normalize(signal == null ? null : signal.getDataType());
          return "1".equals(registerType)
                  || "coil".equals(registerType)
                  || "coils".equals(registerType)
                  || "bit".equals(dataType)
                  || "bool".equals(dataType)
                  || "boolean".equals(dataType)
                  ? STATE : SCALAR;
      }

      public static boolean isSupported(String valueKind) {
          return STATE.equals(valueKind) || SCALAR.equals(valueKind);
      }

      private static String normalize(String value) {
          return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
      }
  }
  ```

  不增加 interface（接口）、enum（枚举）、Spring Bean、配置或独立依赖。

- [ ] **Step 5：在两个现有 record map 中保存分类**

  在 `PressMouldJobInfoServiceImpl` 导入共享类，并分别在 `recordPressJobParametersForQt` 和 `generateParameterRecords` 的 `signalValue` 同层加入同一行：

  ```java
  record.put("valueKind", ModbusSignalValueKind.classify(signal));
  ```

  ```java
  paramRecord.put("valueKind", ModbusSignalValueKind.classify(signal));
  ```

  不改变 `signalValue` 的来源、类型、写入列、事务或旧 `recordStartParams` 的其他行为。

- [ ] **Step 6：运行聚焦测试并确认 GREEN（绿灯）**

  Run: 使用 Step 3 的同一 Maven 命令。

  Expected: `PressMouldJobInfoServiceImplQtTest` PASS；开始/完工与旧 Vue 路径同时得到 `state/scalar`，String、Number、Boolean 原值不变。

- [ ] **Step 7：提交 ERP 分类写入改动**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
  git add \
    sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/ModbusSignalValueKind.java \
    sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java \
    sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java
  git commit -m "feat: 保存压机参数值类型"
  ```

  `docs/sql/2026-07-27-qt-press-job-operation-log.sql` 不得出现在 staged files（暂存文件）中。

### Task 2：ERP 历史详情安全回退并只投影脱敏分类

**Files:**
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java:20-120,382-415,821-901`
- Test: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java:20-95,667-980,1620-1737`

**Interfaces:**
- Consumes: Task 1 的 `ModbusSignalValueKind.isSupported(String)`、`classify(ModbusSignals)`，以及 `IModbusSignalsService#selectSignalsList(ModbusSignals)`。
- Produces: 历史参数每行可选 `valueKind`；controller-private `HistorySignalDefinitions` 仅保存认证设备的 `byId` 与 `byUniqueCode`，开始/完工两侧复用同一实例。

- [ ] **Step 1：扩展 Controller 测试夹具并写快照/ID/code 回退失败测试**

  给 `historyMockMvc` 增加 `IModbusSignalsService` 参数，原有重载统一传 `mock(IModbusSignalsService.class)`；所有直接 `new QtPressWorkingController(...)` 调用在 `ModbusHandleLogMapper` 后追加该 mock，避免遗漏构造器编译点。新增聚焦用例：

  ```java
  @Test
  void historyDetailUsesSnapshotThenDeviceIdThenUniqueCodeForValueKind() throws Exception {
      IPressMouldJobInfoService jobs = mock(IPressMouldJobInfoService.class);
      IModbusSignalsService signals = mock(IModbusSignalsService.class);
      PressMouldJobInfo entity = historyJob(123L, null);
      entity.setStartParameterRecords("["
              + "{\"signalName\":\"快照\",\"signalValue\":1,\"valueKind\":\"state\"},"
              + "{\"signalId\":2,\"signalName\":\"按ID\",\"signalValue\":0},"
              + "{\"signalCode\":\"unique\",\"signalName\":\"按Code\",\"signalValue\":1}"
              + "]");
      when(jobs.selectQtPressJobHistoryDetail(10L, 123L)).thenReturn(entity);
      ModbusSignals byId = historySignal(2L, 10L, "id-state", null, "bit", 0);
      ModbusSignals byCode = historySignal(3L, 10L, "unique", "3", "int", 1);
      when(signals.selectSignalsList(any(ModbusSignals.class)))
              .thenReturn(Arrays.asList(byId, byCode));

      MvcResult result = historyMockMvc(
              jobs, mock(QtPressJobOperationMapper.class),
              mock(ModbusHandleLogMapper.class), signals)
              .perform(get("/api/qt/press-working/history-jobs/123")
                      .header("X-Correlation-Id", "corr-history-kind"))
              .andExpect(status().isOk())
              .andReturn();

      List<Map<String, Object>> rows = JsonPath.read(
              result.getResponse().getContentAsString(), "$.data.startParameters");
      assertEquals("state", rows.get(0).get("valueKind"));
      assertEquals("state", rows.get(1).get("valueKind"));
      assertEquals("scalar", rows.get(2).get("valueKind"));
      ArgumentCaptor<ModbusSignals> query = ArgumentCaptor.forClass(ModbusSignals.class);
      verify(signals, times(1)).selectSignalsList(query.capture());
      assertEquals(10L, query.getValue().getDeviceId());
      assertNull(query.getValue().getIsActive());
  }
  ```

  在测试类增加 `historySignal(...)` helper（辅助方法），显式设置 `id/deviceId/signalCode/registerType/dataType/isActive`；停用定义使用 `isActive=0`，证明查询没有启用过滤。

- [ ] **Step 2：写歧义、非法值和查询异常失败测试**

  新增第二个聚焦测试，单一响应中覆盖非法快照后回退、重复 code、跨设备定义、畸形 ID 和非文本 code；再单独让查询抛出 `RuntimeException`：

  ```java
  entity.setStartParameterRecords("["
          + "{\"signalId\":2,\"signalName\":\"非法快照仍按ID\",\"signalValue\":1,\"valueKind\":\" STATE \"},"
          + "{\"signalCode\":\"dup\",\"signalName\":\"重复Code\",\"signalValue\":1},"
          + "{\"signalId\":{},\"signalCode\":[],\"signalName\":\"畸形身份\",\"signalValue\":0}"
          + "]");
  when(signals.selectSignalsList(any(ModbusSignals.class))).thenReturn(Arrays.asList(
          historySignal(2L, 10L, "id-state", "coil", null, 0),
          historySignal(3L, 10L, "dup", "coil", null, 1),
          historySignal(4L, 10L, "dup", "3", "int", 1),
          historySignal(5L, 11L, "cross-device", "coil", null, 1)));

  assertEquals("state", rows.get(0).get("valueKind"));
  assertFalse(rows.get(1).containsKey("valueKind"));
  assertFalse(rows.get(2).containsKey("valueKind"));
  assertEquals(1, rows.get(1).get("value"));
  assertEquals(0, rows.get(2).get("value"));

  when(signals.selectSignalsList(any(ModbusSignals.class)))
          .thenThrow(new RuntimeException("sensitive-definition-error"));
  historyMockMvc(jobs, operationMapper, handleLogMapper, signals)
          .perform(get("/api/qt/press-working/history-jobs/123")
                  .header("X-Correlation-Id", "corr-history-fallback"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.data.startParameters[0].value").value(1))
          .andExpect(jsonPath("$.data.startParameters[0].valueKind").doesNotExist());
  ```

  同时断言序列化响应不包含 `signalId`、`signalCode`、`registerType`、`dataType`、`sensitive-definition-error` 或完整配置文本；既有 `invalid` 参数侧测试保持原语义。

- [ ] **Step 3：运行 Controller 测试并确认 RED**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
  JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
    /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
    -pl yr-admin -am \
    -Dtest=QtPressWorkingControllerTest \
    -Dsurefire.failIfNoSpecifiedTests=false test
  ```

  Expected: FAIL；构造器尚未接收 `IModbusSignalsService`，历史投影也尚无 `valueKind`。失败不得来自既有操作日志或认证测试。

- [ ] **Step 4：注入信号服务并建立一次性认证设备索引**

  在 `QtPressWorkingController` 增加 final 字段和构造器参数：

  ```java
  private final IModbusSignalsService modbusSignalsService;

  public QtPressWorkingController(
          TokenService tokenService,
          IPressMouldJobInfoService pressMouldJobInfoService,
          SamMouldInfoMapper samMouldInfoMapper,
          IPressJobInfoService pressJobInfoService,
          QtPressJobOperationMapper qtPressJobOperationMapper,
          ModbusHandleLogMapper modbusHandleLogMapper,
          IModbusSignalsService modbusSignalsService) {
      this.tokenService = tokenService;
      this.pressMouldJobInfoService = pressMouldJobInfoService;
      this.samMouldInfoMapper = samMouldInfoMapper;
      this.pressJobInfoService = pressJobInfoService;
      this.qtPressJobOperationMapper = qtPressJobOperationMapper;
      this.modbusHandleLogMapper = modbusHandleLogMapper;
      this.modbusSignalsService = modbusSignalsService;
  }
  ```

  在确认 `entity != null` 后调用一次加载方法，并把同一索引传给开始/完工投影：

  ```java
  HistorySignalDefinitions definitions = loadHistorySignalDefinitions(context.getDeviceId());
  Map<String, Object> data = toHistoryDetail(entity, operationRecords, definitions);
  ```

  加载方法只设置 `deviceId`，不设置 `isActive`；再次过滤返回对象的设备，并以第二次 code 出现即永久删除的方式排除歧义：

  ```java
  private HistorySignalDefinitions loadHistorySignalDefinitions(Long deviceId) {
      try {
          ModbusSignals query = new ModbusSignals();
          query.setDeviceId(deviceId);
          List<ModbusSignals> definitions = modbusSignalsService.selectSignalsList(query);
          return HistorySignalDefinitions.from(deviceId, definitions);
      } catch (RuntimeException error) {
          return HistorySignalDefinitions.empty();
      }
  }

  private static final class HistorySignalDefinitions {
      private final Map<Long, ModbusSignals> byId;
      private final Map<String, ModbusSignals> byUniqueCode;

      private HistorySignalDefinitions(
              Map<Long, ModbusSignals> byId,
              Map<String, ModbusSignals> byUniqueCode) {
          this.byId = byId;
          this.byUniqueCode = byUniqueCode;
      }

      private static HistorySignalDefinitions empty() {
          return new HistorySignalDefinitions(Collections.emptyMap(), Collections.emptyMap());
      }

      private static HistorySignalDefinitions from(
              Long deviceId, List<ModbusSignals> definitions) {
          Map<Long, ModbusSignals> byId = new LinkedHashMap<>();
          Map<String, ModbusSignals> byCode = new LinkedHashMap<>();
          Set<String> duplicateCodes = new HashSet<>();
          if (definitions != null) {
              for (ModbusSignals definition : definitions) {
                  if (definition == null || !deviceId.equals(definition.getDeviceId())) {
                      continue;
                  }
                  Long id = definition.getId();
                  if (id != null && id > 0L) {
                      byId.putIfAbsent(id, definition);
                  }
                  String code = definition.getSignalCode();
                  if (StringUtils.isEmpty(code) || duplicateCodes.contains(code)) {
                      continue;
                  }
                  if (byCode.containsKey(code)) {
                      byCode.remove(code);
                      duplicateCodes.add(code);
                  } else {
                      byCode.put(code, definition);
                  }
              }
          }
          return new HistorySignalDefinitions(byId, byCode);
      }
  }
  ```

  查询异常不打印异常正文，不记录定义或参数内容；无需新增日志。

- [ ] **Step 5：按快照、ID、唯一 code 顺序投影可选分类**

  将 `toHistoryDetail` 和 `toParameterProjection` 签名改为接收同一索引。保留既有四个展示字段严格解析，分类单独安全读取：

  ```java
  private String historyValueKind(
          JsonNode record, HistorySignalDefinitions definitions) {
      JsonNode snapshot = record.get("valueKind");
      if (snapshot != null && snapshot.isTextual()
              && ModbusSignalValueKind.isSupported(snapshot.textValue())) {
          return snapshot.textValue();
      }
      JsonNode signalId = record.get("signalId");
      if (signalId != null && signalId.isIntegralNumber()
              && signalId.canConvertToLong() && signalId.longValue() > 0L) {
          ModbusSignals definition = definitions.byId.get(signalId.longValue());
          if (definition != null) {
              return ModbusSignalValueKind.classify(definition);
          }
      }
      JsonNode signalCode = record.get("signalCode");
      if (signalCode != null && signalCode.isTextual()
              && StringUtils.isNotEmpty(signalCode.textValue())) {
          ModbusSignals definition = definitions.byUniqueCode.get(signalCode.textValue());
          if (definition != null) {
              return ModbusSignalValueKind.classify(definition);
          }
      }
      return null;
  }
  ```

  在每行已有 `parameterName/value/unit/recordedAt` 之后，仅对非 null 分类执行：

  ```java
  String valueKind = historyValueKind(record, definitions);
  if (valueKind != null) {
      row.put("valueKind", valueKind);
  }
  ```

  不把 `signalId`、`signalCode` 或定义字段加入响应；分类字段错误不能进入现有 `optionalHistoryText`，因此不会导致整侧 `invalid`。

- [ ] **Step 6：运行 Controller 测试并确认 GREEN**

  Run: 使用 Step 3 的同一 Maven 命令。

  Expected: `QtPressWorkingControllerTest` PASS；定义只查询一次，合法快照优先，停用 ID 与唯一 code 可回退，重复/cross-device（跨设备）/畸形/查询异常只省略分类，响应仍无敏感字段。

- [ ] **Step 7：提交 ERP 历史投影改动**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
  git add \
    yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java \
    yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java
  git commit -m "feat: 投影历史参数值类型"
  ```

### Task 3：QT View Model 精确收窄分类并删除重复内容字段

**Files:**
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/domain/pressJob.ts:386-428`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/services/erpClient.ts:1490-1602`
- Test: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/services/erpClient.test.ts:1335-1468`

**Interfaces:**
- Consumes: ERP 可选 `valueKind` 与继续存在的兼容 `operationRecords[].content`。
- Produces: `PressJobHistoryParameter.valueKind?: "state" | "scalar"`；`PressJobHistoryOperation` 固定五字段，不再包含 `content`。

- [ ] **Step 1：更新历史详情收窄测试并确认新契约会失败**

  在 `fetches a narrowed press job history detail without nested parameter payloads` 的原始载荷中加入合法和非法分类：

  ```ts
  startParameters: [
    { parameterName: "压力", value: 135.5, valueKind: "scalar", ...forbiddenPayload },
    { parameterName: "自动模式", value: 1, valueKind: "state" },
    { parameterName: "非法空白", value: 1, valueKind: " state " },
    { parameterName: "非法大小写", value: 1, valueKind: "STATE" },
    { parameterName: "非法对象", value: 1, valueKind: { raw: "state" } },
  ]
  ```

  期望结果只保留前两项的分类；操作记录期望对象删除 `content`，并增加安全断言：

  ```ts
  expect(result.startParameters[0].valueKind).toBe("scalar");
  expect(result.startParameters[1].valueKind).toBe("state");
  expect(result.startParameters[2]).not.toHaveProperty("valueKind");
  expect(result.startParameters[3]).not.toHaveProperty("valueKind");
  expect(result.startParameters[4]).not.toHaveProperty("valueKind");
  expect(result.operationRecords[0]).toEqual({
    operationTime: "2026-07-24 09:00:00",
    operationName: "完成加工",
    result: "失败",
    teamName: "甲班",
    operatorName: "张三",
  });
  expect(JSON.stringify(result.operationRecords)).not.toContain("完成加工失败");
  ```

- [ ] **Step 2：运行服务测试并确认 RED**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  npm test -- src/services/erpClient.test.ts
  ```

  Expected: FAIL；合法 `valueKind` 尚被丢弃，`content` 仍进入 View Model。

- [ ] **Step 3：最小修改 Domain 类型和收窄函数**

  `pressJob.ts` 只做两处类型变化：

  ```ts
  export type PressJobHistoryParameter = {
    parameterName: string;
    value?: string | number | boolean;
    valueKind?: "state" | "scalar";
    unit?: string;
    recordedAt?: string;
    status: "recorded" | "missing" | "invalid";
  };

  export type PressJobHistoryOperation = {
    operationTime: string | undefined;
    operationName: string | undefined;
    result: string | undefined;
    teamName: string | undefined;
    operatorName: string | undefined;
  };
  ```

  `erpClient.ts` 在参数行读取精确联合类型，并删除操作 `content` 赋值：

  ```ts
  const valueKind = readHistoryValueKind(record.valueKind);
  if (valueKind) parameter.valueKind = valueKind;
  ```

  ```ts
  function readHistoryValueKind(
    value: unknown,
  ): PressJobHistoryParameter["valueKind"] {
    return value === "state" || value === "scalar" ? value : undefined;
  }
  ```

  ```ts
  return [{
    operationTime: readHistoryString(record.operationTime),
    operationName: readHistoryString(record.operationName),
    result: readHistoryString(record.result),
    teamName: readHistoryString(record.teamName),
    operatorName: readHistoryString(record.operatorName),
  }];
  ```

  不把 `signalId`、`signalCode`、嵌套结构或未知分类加入类型。

- [ ] **Step 4：运行服务测试并确认 GREEN**

  Run: 使用 Step 2 的同一 Vitest 命令。

  Expected: `erpClient.test.ts` PASS；仅 `state/scalar` 被保留，未知分类和后端 `content` 被白名单剔除，其他标量安全规则不变。

- [ ] **Step 5：提交 QT 响应契约改动**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  git add \
    qt-app/frontend/src/domain/pressJob.ts \
    qt-app/frontend/src/services/erpClient.ts \
    qt-app/frontend/src/services/erpClient.test.ts
  git commit -m "feat: 收窄历史参数值类型"
  ```

### Task 4：QT 历史详情统一状态显示、水平筛选和五条分页

**Files:**
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.tsx:10-43,628-681,750-906`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.css:19-69,172-274`
- Test: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.test.tsx:43-103,376-507`

**Interfaces:**
- Consumes: Task 3 的可选 `valueKind` 和五字段 `PressJobHistoryOperation`；复用现有 `formatHistoryParameterValue`、Ant Design `Pagination`、Design Token 与 Drawer 布局。
- Produces: 开始/完工两列唯一状态格式化入口；局部 `operationPage`，固定 `OPERATION_PAGE_SIZE = 5`；当前页相邻节点竖线和固定分页底栏。

- [ ] **Step 1：把参数格式化测试改为可靠状态分类并增加两列覆盖**

  用以下断言替换旧“所有 Boolean 都翻译”测试，并通过 `alignHistoryParameters` 再证明开始/完工共用相同入口：

  ```ts
  it("translates only values reliably classified as state", () => {
    for (const [value, expected] of [
      [0, "否"], ["0", "否"], [false, "否"],
      [1, "是"], ["1", "是"], [true, "是"],
    ] as const) {
      expect(formatHistoryParameterValue({
        parameterName: "状态",
        status: "recorded",
        value,
        valueKind: "state",
      })).toBe(expected);
    }
    expect(formatHistoryParameterValue({
      parameterName: "普通数值",
      status: "recorded",
      value: 1,
      valueKind: "scalar",
    })).toBe("1");
    expect(formatHistoryParameterValue({
      parameterName: "普通布尔",
      status: "recorded",
      value: true,
      valueKind: "scalar",
    })).toBe("true");
    expect(formatHistoryParameterValue({
      parameterName: "状态文本",
      status: "recorded",
      value: "true",
      valueKind: "state",
    })).toBe("true");
  });

  expect(alignHistoryParameters(
    [{ parameterName: "就绪", status: "recorded", value: 0, valueKind: "state" }],
    [{ parameterName: "就绪", status: "recorded", value: 1, valueKind: "state" }],
  )[0]).toMatchObject({ startValue: "否", endValue: "是" });
  ```

- [ ] **Step 2：写缺失提示、操作分页和组合文案失败测试**

  修改 `renderHistoryDetail` 的 fixture（夹具），不再提供 `content`。用 6 条命名操作做静态首屏断言：

  ```ts
  const html = renderHistoryDetail(Array.from({ length: 6 }, (_, index) => ({
    operationTime: `2026-07-27 12:0${index}:00`,
    operationName: `操作-${index + 1}`,
    result: index === 0 ? "失败" : "成功",
    teamName: index === 1 ? undefined : "夜班",
    operatorName: index === 1 ? undefined : "张三",
  })));
  const operations = html.slice(html.indexOf('aria-label="操作记录"'));
  expect(operations).toContain("操作-1");
  expect(operations).toContain("操作-5");
  expect(operations).not.toContain("操作-6");
  expect(operations).toContain("班组 / 作业人员：夜班 / 张三");
  expect(operations).toContain("班组 / 作业人员：未记录 / 未记录");
  expect(operations).not.toContain("内容：");
  expect(operations).toContain("press-job-history-detail__operation-pagination");
  expect(html).not.toContain("未记录开始参数");
  expect(html).not.toContain("未记录完工参数");
  ```

  再用 `startParameterState: "invalid"`、`endParameterState: "invalid"` 的详情确认“开始参数记录格式异常”和“完工参数记录格式异常”仍出现。用现有 `pageSource/pageCss` 断言页码重置和样式契约：

  ```ts
  expect(pageSource).toMatch(
    /useEffect\(\(\) => \{\s*setOperationPage\(1\);\s*\}, \[detail\.moldJobId, detail\.operationRecords\]\);/,
  );
  expect(pageCss).toMatch(
    /\.press-job-history-page__field\s*\{[^}]*display: flex;[^}]*align-items: center;/,
  );
  expect(pageCss).not.toContain("border-bottom: 1px solid var(--qt-app-control-blue-line)");
  expect(pageCss).toContain("li:not(:last-child)::before");
  expect(pageCss).toMatch(
    /\.press-job-history-detail__operation-list\s*\{[^}]*overflow: auto;/,
  );
  expect(pageCss).toMatch(
    /\.press-job-history-detail__operation-pagination\s*\{[^}]*flex: 0 0 auto;/,
  );
  ```

- [ ] **Step 3：运行页面测试并确认 RED**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  npm test -- src/components/PressJobHistoryPage.test.tsx
  ```

  Expected: FAIL；Boolean 仍被无条件翻译，missing 提示和内容字段仍存在，6 条操作全部渲染，CSS 仍为上下 Grid（网格）及水平分割线。

- [ ] **Step 4：最小实现两列状态格式化和提示删除**

  保留 `formatHistoryParameterValue` 为唯一入口，改为：

  ```ts
  export function formatHistoryParameterValue(
    parameter: PressJobHistoryParameter | undefined,
  ): string {
    if (parameter?.status !== "recorded" || parameter.value === undefined) {
      return "未记录";
    }
    if (parameter.valueKind === "state") {
      if (parameter.value === 0 || parameter.value === "0" || parameter.value === false) {
        return "否";
      }
      if (parameter.value === 1 || parameter.value === "1" || parameter.value === true) {
        return "是";
      }
    }
    return String(parameter.value);
  }
  ```

  从 `press-job-history-detail__parameter-states` 删除两个 `missing` JSX 分支，只保留 `invalid` 两个分支；Table（表格）现有“未记录”和“记录不完整”逻辑不改。

- [ ] **Step 5：用现有 Pagination 实现固定每页 5 条操作**

  从 `antd` 导入 `Pagination`，在文件常量区增加：

  ```ts
  const OPERATION_PAGE_SIZE = 5;
  ```

  在 `HistoryDetailContent` 内增加局部页码、重置和标准数组切片：

  ```ts
  const [operationPage, setOperationPage] = useState(1);
  useEffect(() => {
    setOperationPage(1);
  }, [detail.moldJobId, detail.operationRecords]);
  const visibleOperations = detail.operationRecords.slice(
    (operationPage - 1) * OPERATION_PAGE_SIZE,
    operationPage * OPERATION_PAGE_SIZE,
  );
  ```

  把 `.map` 数据源改为 `visibleOperations`，每项只保留操作/结果与组合字段：

  ```tsx
  <span className="press-job-history-detail__operation-main">
    <span className="press-job-history-detail__operation-name">
      {formatHistoryCell(operation.operationName)}
    </span>
    <Tag color={operation.result === "成功" ? "success" : operation.result === "失败" ? "error" : "default"}>
      {formatHistoryCell(operation.result)}
    </Tag>
  </span>
  <span>
    班组 / 作业人员：{formatHistoryCell(operation.teamName)} / {formatHistoryCell(operation.operatorName)}
  </span>
  ```

  `</ol>` 后仅在总数超过 5 时复用 Ant Design 分页器：

  ```tsx
  {detail.operationRecords.length > OPERATION_PAGE_SIZE ? (
    <Pagination
      className="press-job-history-detail__operation-pagination"
      current={operationPage}
      onChange={setOperationPage}
      pageSize={OPERATION_PAGE_SIZE}
      showSizeChanger={false}
      size="small"
      total={detail.operationRecords.length}
    />
  ) : null}
  ```

  不请求后端、不写 URL、不提供 page size（每页数量）切换。

- [ ] **Step 6：把筛选和时间线 CSS 改为最小水平/紧凑布局**

  保持现有 DOM 和 Design Token，只调整已有选择器并新增伪元素/分页底栏：

  ```css
  .press-job-history-page__filters {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
  }

  .press-job-history-page__field {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 12px;
  }

  .press-job-history-page__field > span:first-child {
    flex: 0 0 56px;
    white-space: nowrap;
  }

  .press-job-history-page__field > :where(.ant-picker, .ant-input, .ant-select) {
    flex: 1 1 auto;
    min-width: 0;
  }

  .press-job-history-page__validation {
    left: 64px;
  }

  .press-job-history-detail__operations {
    overflow: hidden;
  }

  .press-job-history-detail__operation-list {
    display: grid;
    align-content: start;
    flex: 1 1 auto;
    gap: 4px;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }

  .press-job-history-detail__operation-list li {
    position: relative;
    display: grid;
    grid-template-columns: 12px 96px minmax(0, 1fr);
    gap: 8px;
    min-height: 40px;
    padding: 4px;
  }

  .press-job-history-detail__operation-list li:not(:last-child)::before {
    position: absolute;
    top: 12px;
    bottom: -4px;
    left: 8px;
    width: 1px;
    background: var(--qt-app-control-blue-line);
    content: "";
  }

  .press-job-history-detail__operation-marker {
    position: relative;
    z-index: 1;
  }

  .press-job-history-detail__operation-pagination {
    flex: 0 0 auto;
    align-self: center;
    margin-top: 8px;
  }
  ```

  从 `.press-job-history-detail__operation-list li` 删除 `border-bottom`；把 `.press-job-history-detail__operations` 从现有 `overflow: auto` 组合选择器中移出，只有 `<ol>` 滚动。最后一个 `li` 不匹配伪元素，因此不会连向分页器。

- [ ] **Step 7：运行页面测试并确认 GREEN**

  Run: 使用 Step 3 的同一 Vitest 命令。

  Expected: `PressJobHistoryPage.test.tsx` PASS；两列只翻译可靠状态，missing 提示消失而 invalid 提示保留，首屏只有 5 条，组合文案无“内容”，CSS 无横线且有当前页竖线和固定底栏。

- [ ] **Step 8：提交 QT 页面改动**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  git add \
    qt-app/frontend/src/components/PressJobHistoryPage.tsx \
    qt-app/frontend/src/components/PressJobHistoryPage.css \
    qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
  git commit -m "feat: 紧凑展示历史作业详情"
  ```

### Task 5：跨仓验证、视觉检查和范围保护

**Files:**
- Verify only: Task 1-4 列出的源码和测试文件
- Must remain untouched: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/docs/sql/2026-07-27-qt-press-job-operation-log.sql`

**Interfaces:**
- Consumes: Task 1-4 的两个 ERP commit、两个 QT commit。
- Produces: Java 8 定向测试、前端定向测试、TypeScript（类型检查）、production build（生产构建）、1280×720 双主题视觉证据、OpenSpec strict validation（严格校验）和干净范围证明。

- [ ] **Step 1：运行 ERP 合并定向测试**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
  JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
    /Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
    -pl sam-erp,yr-admin -am \
    -Dtest=PressMouldJobInfoServiceImplQtTest,QtPressWorkingControllerTest \
    -Dsurefire.failIfNoSpecifiedTests=false test
  ```

  Expected: `BUILD SUCCESS`；两个指定测试类全部 PASS，未访问真实设备或数据库。

- [ ] **Step 2：运行 QT 定向测试、类型检查和生产构建**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  npm test -- src/services/erpClient.test.ts src/components/PressJobHistoryPage.test.tsx
  ./node_modules/.bin/tsc --noEmit
  npm run build
  ```

  Expected: 两个 Vitest 文件 PASS；`tsc --noEmit` exit 0；Vite 输出 production assets（生产资源）且 `build` exit 0。

- [ ] **Step 3：在 1280×720 浅色/深色视口做视觉检查**

  启动现有 QT frontend（前端）开发服务后，只使用本地 Mock/开发数据打开历史作业：

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
  npm run dev -- --host 127.0.0.1
  ```

  浅色和深色主题分别核对：三个筛选项及查询按钮同一行，每项左描述/右控件且控件高 44px；页面无页面级滚动；参数区不显示两个 missing 提示；5 条操作时分页器位于面板底部；长操作名/班组/人员下列表局部滚动；当前页节点竖线连续，无横线，末节点不连向分页器。检查完成后停止开发服务。

- [ ] **Step 4：运行 OpenSpec 严格校验**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  openspec validate refine-press-job-history-details --strict
  ```

  Expected: change `refine-press-job-history-details` validation PASS，无缺失 requirement（需求）或 scenario（场景）。

- [ ] **Step 5：核对 diff、敏感边界和用户未跟踪 SQL**

  ```bash
  cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
  shasum -a 256 -c /tmp/refine-press-job-history-details-sql.sha256
  git status --short
  git diff --check

  cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
  git status --short
  git diff --check
  ```

  Expected: checksum 输出 `docs/sql/2026-07-27-qt-press-job-operation-log.sql: OK`；ERP 状态仍只把该文件显示为原有 `??`，没有 staged（暂存）SQL、Driver Service、Liquibase、依赖或数据库文件；两个仓库 `git diff --check` 无空白错误。

- [ ] **Step 6：形成验证记录但不推送**

  在任务交付消息中逐项记录实际执行命令、退出状态、测试数量、视觉检查结果和两个仓库 commit hash；若任一验证未运行或失败，明确标记为未完成。Remote push（远程推送）、合并、OpenSpec archive（归档）均是独立授权门，不在本计划中自动执行。

---

## 实施完成判定

- 新参数 JSON 的两条活跃写入路径均保存 `state/scalar`，原值不变。
- 旧参数只按认证设备内 ID 或唯一 code 回退；任意歧义或查询失败均保留原值且不泄露身份/配置。
- QT 开始/完工列共用一个 formatter（格式化器），普通数值 `0/1` 不被猜测为“否/是”。
- 筛选项统一水平排列；操作记录无重复内容、无横线、有页内竖线、班组/人员组合显示且每页固定 5 条。
- missing 提示删除、invalid 提示保留；1280×720 双主题无页面级滚动回归。
- ERP 未跟踪 SQL checksum 不变，未新增依赖、迁移、接口或范围外改动。

---
change: add-qt-press-job-history
design-doc: docs/superpowers/specs/2026-07-24-press-job-history-page-design.md
base-ref: d518736a633e63c418e4ccee20b9f22b7fb3defd
---

> @file 2026-07-24-press-job-history-page.md
> @author PopoY
> @created 2026-07-24 16:31:39
> @editor PopoY
> @edited 2026-07-24 20:59:25
> @purpose 给出 QT App（Qt 应用）历史作业第四个一级入口、服务端分页列表和 70% 详情抽屉的端到端实施步骤。

# QT App 历史作业页面 Implementation Plan（实施计划）

> **For PopoY:** 实施时必须使用 `executing-plans` 或 `subagent-driven-development` 按任务逐项执行；开始产品代码前先按项目规则运行 Comet Intent routing（意图路由），不要跳过其确认门。

**Goal（目标）：** 在 QT App 顶部增加第四个一级入口“历史作业”，只读查询当前认证压机已完成的模具作业；列表按完工时间服务端分页，详情用 70% 宽右侧 Drawer（抽屉）展示概要、开始/完工参数与已有操作记录。

**Architecture（架构）：** ERP 继续以 token 中的 QT bootstrap context（启动上下文）解析当前 `deviceId`，不接收前端设备或网络字段。列表主记录使用 `press_mould_job_info.id` 作为稳定 `mouldJobId`；详情通过该子作业的 `press_job_info_id` 读取 `qt_press_job_operation` 中已有的成功生命周期记录。React 页面只接收 `erpClient` 白名单化后的 View Model（视图模型）；App Shell（应用外壳）将 `sessionToken` 留在请求回调闭包内。

**Tech Stack（技术栈）：** Java 8、Spring MVC、MyBatis、PageHelper、Liquibase（只复用已有表，不新增迁移）、JUnit 5、Mockito、React 19、TypeScript 6、Ant Design 6、Day.js、Vitest、CSS。

**Approved Design（已批准设计）：** [2026-07-24-press-job-history-page-design.md](/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/docs/superpowers/specs/2026-07-24-press-job-history-page-design.md)

---

## 0. 已核实基线与范围约束

实施前必须保留以下事实，不得在执行中改写成另一套模型：

- Frontend（前端）仓库：`/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring`，计划基线为 `main@7cad86161901e169f9bc94c4f4f197db0c6895d6`。
- Backend（后端）Git 仓库：`/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be`。实施功能分支必须直接从 `master@54a8c09e494212924cec01e5470029e4a9e7d10c` 建立隔离 worktree（工作树），完成后也只能合并回 `master`。`dev`、`dev-popo` 及其他长期分支不得作为基线、中间集成分支或合并目标；如果本地 `master` 哈希前进，只能在重新核对契约后采用新的 `master` HEAD。
- 列表是一行一个 `press_mould_job_info` 完工记录，不按 `press_job_info` 聚合。这样模具号、工艺、参数和 Drawer 标题都有唯一语义，稳定身份为 `mouldJobId = press_mould_job_info.id`。
- `mouldWorkingTime` 的真实单位是秒；`erpClient` 统一转换为一位小数小时文本。不得把 `pressDistributionTime` 当作“实际时长”。
- 历史班组没有持久化字段。首版概要显示 `未记录 / {作业人员}`，不得根据当前组织关系反推历史班组。只有业务确认需要精确历史班组时，才另立 schema change（结构变更）。
- `qt_press_job_operation` 已可靠记录 `START`、`PARAMETER_START`、`PARAMETER_END`、`COMPLETE`；`MACHINE_STATUS` 可通过同一 `local_job_session_id` 关联。锁模/解锁不在该表内，失败操作也不会持久化。首版只展示真实存在的成功记录，不按设备+时间猜测 `modbus_handle_log`，不补造缺失阶段。
- 不新增状态库、表格库、主题 Provider（提供器）、图表、导出、编辑、删除、无限滚动或自定义 Drawer 框架。
- Day.js 已是 Ant Design 的 transitive dependency（传递依赖），但 pnpm 根模块当前不可直接解析；页面实现时只把同一版本声明为 direct dependency（直接依赖），不引入第二套日期库。
- 所有新增/修改 Java、TypeScript、CSS 和测试文件按实际执行时间补 `@author PopoY`；修改已有文件保留原作者并追加 `Editor: PopoY` / `Edited: 实际时间`，不得复制本文时间作为未来执行时间。

### 固定 API contract（接口契约）

```text
GET /api/qt/press-working/history-jobs
Headers:
  Authorization: Bearer ...
  X-Correlation-Id: press-job-history-list-...
Query:
  startTime=2026-07-24T00:00:00+08:00 # 必填，工控机本地自然日半开区间起点，必须带 offset
  endTime=2026-07-25T00:00:00+08:00   # 必填，下一自然日排他上界，必须带 offset
  mouldCode=...                      # 可选，模糊匹配
  operator=...                       # 可选，账号精确匹配
  pageNum=1                          # 必填，>= 1
  pageSize=10                        # 必填，首版必须等于 10

AjaxResult.data:
{
  "rows": [{
    "mouldJobId": "123",
    "pressName": "1600T压机",
    "mouldCode": "M-001",
    "operator": "op-01",
    "craftCode": "C01",
    "startTime": "2026-07-24 08:00:00",
    "endTime": "2026-07-24 10:00:00",
    "mouldWorkingTime": "7200",
    "status": "3"
  }],
  "total": 1,
  "pageNum": 1,
  "pageSize": 10
}
```

```text
GET /api/qt/press-working/history-jobs/{mouldJobId}
Headers:
  Authorization: Bearer ...
  X-Correlation-Id: press-job-history-detail-...

AjaxResult.data:
{
  "mouldJobId": "123",
  "pressName": "1600T压机",
  "mouldCode": "M-001",
  "operator": "op-01",
  "endOperator": "op-02",
  "craftCode": "C01",
  "startTime": "2026-07-24 08:00:00",
  "endTime": "2026-07-24 10:00:00",
  "mouldWorkingTime": "7200",
  "status": "3",
  "startParameterState": "recorded",
  "endParameterState": "recorded",
  "startParameters": [{
    "parameterName": "压力",
    "value": 600,
    "unit": "kN",
    "recordedAt": "2026-07-24 08:00:02",
    "status": "recorded"
  }],
  "endParameters": [],
  "operationRecords": [{
    "operationTime": "2026-07-24 08:00:00",
    "operationName": "开始加工",
    "result": "成功"
  }]
}
```

Response（响应）中严禁加入 `deviceId`、`operationIp`、`granteeHostId`、`stationAccountId`、`localJobSessionId`、`idempotencyKey`、`requestFingerprint`、`signalId`、`signalCode`、原始参数 JSON 或任何项目禁用敏感字段。

---

## Task 1：创建隔离执行环境并确认 Comet 路由

**Files：** 无产品文件修改。

- [x] 在两个真实 Git 仓库分别确认工作树和基线，不能在 `/Users/popoy/WorkSpace/Projects/SAM/sam-erp` 父目录执行 Git：

```zsh
git -C /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring status --short --branch
git -C /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring rev-parse HEAD
git -C /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be status --short --branch
git -C /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be rev-parse master
```

Expected（预期）：前端基线包含已批准设计文档；后端 `master` 能找到 `QtPressJobOperation.java` 和 `changelog-2026-07-22-qt-press-job-operation.xml`。若 `master` 哈希前进，可以接受其新提交，但必须重新核对同名契约；不得读取 `dev`、`dev-popo` 或其他长期分支来替代、补齐或改写本功能基线。

- [x] 按 `using-git-worktrees` 为前端 `main` 和后端 `master` 各建一个隔离 worktree，分支前缀使用 `PopoY-WorkTree/`；两个写入代理不得修改同一路径。

- [x] 在前端主变更目录按项目规则执行 Comet Intent routing，记录其 preset（预设）和 change name（变更名）。这是跨前后端、有 API 契约和迁移基线依赖的功能，若 Comet 选择 `full`，不得手动降为 `tweak`。

- [x] 把两个 worktree 的绝对路径写入执行记录。以下任务中的仓库相对路径必须分别解析到对应 worktree，不能写回用户原工作树。

---

## Task 2：先锁定 ERP 历史 SQL 与操作记录关联

**Backend files：**

- Create: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoMapper.java`
- Modify: `sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/QtPressJobOperationMapper.java`

### Step 2.1：写失败的 mapper contract test（映射契约测试）

- [x] 新增最小 source contract test（源码契约测试），读取 Mapper XML/Java 源码并锁定以下不可回退条件：

```java
@Test
void historyListIsDeviceScopedCompletedHalfOpenAndStableOrdered() throws Exception {
    String xml = read(PRESS_MOULD_JOB_MAPPER_XML);
    String select = between(xml,
            "<select id=\"selectQtPressJobHistoryList\"",
            "</select>");

    assertTrue(select.contains("pmji.device_id = #{deviceId}"));
    assertTrue(select.contains("pmji.status = '3'"));
    assertTrue(select.contains("pmji.end_time &gt;= #{startTime}"));
    assertTrue(select.contains("pmji.end_time &lt; #{endTime}"));
    assertTrue(select.contains("pmji.mould_code like concat('%', #{mouldCode}, '%')"));
    assertTrue(select.contains("pmji.operator = #{operator}"));
    assertTrue(select.contains("order by pmji.end_time desc, pmji.id desc"));
}

@Test
void historyDetailAndOperationsCannotCrossDeviceOrGuessByTime() throws Exception {
    String xml = read(PRESS_MOULD_JOB_MAPPER_XML);
    String detail = between(xml,
            "<select id=\"selectQtPressJobHistoryDetail\"",
            "</select>");
    String operationMapper = read(QT_OPERATION_MAPPER_JAVA);

    assertTrue(detail.contains("pmji.id = #{mouldJobId}"));
    assertTrue(detail.contains("pmji.device_id = #{deviceId}"));
    assertTrue(detail.contains("pmji.status = '3'"));
    assertTrue(operationMapper.contains("press_job_info_id = #{pressJobInfoId}"));
    assertTrue(operationMapper.contains("local_job_session_id in"));
    assertTrue(operationMapper.contains("local_job_session_id is not null"));
    assertFalse(operationMapper.contains("handle_time between"));
}
```

- [x] 运行单测并确认因查询方法尚不存在而失败：

```zsh
cd "$BACKEND_WORKTREE"
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
  -pl sam-erp \
  -Dtest=PressMouldJobInfoHistoryMapperContractTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

### Step 2.2：增加两个模具作业查询

- [x] 在 `PressMouldJobInfoMapper.java` 增加精确签名；不创建一次性 query interface（查询接口）：

```java
List<PressMouldJobInfo> selectQtPressJobHistoryList(
        @Param("deviceId") Long deviceId,
        @Param("startTime") Date startTime,
        @Param("endTime") Date endTime,
        @Param("mouldCode") String mouldCode,
        @Param("operator") String operator);

PressMouldJobInfo selectQtPressJobHistoryDetail(
        @Param("deviceId") Long deviceId,
        @Param("mouldJobId") Long mouldJobId);
```

- [x] 在 `PressMouldJobInfoMapper.xml` 使用现有 `PressMouldJobInfoResult`，新增明确列清单，不使用 `select *`：

```xml
<select id="selectQtPressJobHistoryList" resultMap="PressMouldJobInfoResult">
    select pmji.id,
           pmji.device_id,
           md.device_name,
           pmji.press_job_info_id,
           pmji.operator,
           pmji.mould_code,
           pmji.craft_code,
           pmji.status,
           pmji.start_time,
           pmji.end_time,
           pmji.mould_working_time
    from press_mould_job_info pmji
    left join modbus_device md on md.device_id = pmji.device_id
    where pmji.device_id = #{deviceId}
      and pmji.status = '3'
      and pmji.end_time &gt;= #{startTime}
      and pmji.end_time &lt; #{endTime}
    <if test="mouldCode != null and mouldCode != ''">
        and pmji.mould_code like concat('%', #{mouldCode}, '%')
    </if>
    <if test="operator != null and operator != ''">
        and pmji.operator = #{operator}
    </if>
    order by pmji.end_time desc, pmji.id desc
</select>

<select id="selectQtPressJobHistoryDetail" resultMap="PressMouldJobInfoResult">
    select pmji.id,
           pmji.device_id,
           md.device_name,
           pmji.press_job_info_id,
           pmji.operator,
           pmji.end_operator,
           pmji.mould_code,
           pmji.craft_code,
           pmji.status,
           pmji.start_time,
           pmji.end_time,
           pmji.mould_working_time,
           pmji.start_parameter_records,
           pmji.end_parameter_records
    from press_mould_job_info pmji
    left join modbus_device md on md.device_id = pmji.device_id
    where pmji.id = #{mouldJobId}
      and pmji.device_id = #{deviceId}
      and pmji.status = '3'
    limit 1
</select>
```

同时在现有 `PressMouldJobInfoResult` 补齐明确映射，避免依赖全局 auto-mapping（自动映射）：

```xml
<result property="deviceName" column="device_name"/>
```

### Step 2.3：增加已有操作记录的安全关联查询

- [x] 在 `QtPressJobOperationMapper.java` 增加 `List` import 和以下查询。只选详情展示/关联所需列；不返回 idempotency key（幂等键）或 fingerprint（指纹）：

```java
@Select("select id, press_job_info_id, local_job_session_id, operation_type, create_time " +
        "from qt_press_job_operation " +
        "where device_id = #{deviceId} and (press_job_info_id = #{pressJobInfoId} " +
        "or local_job_session_id in (select distinct local_job_session_id from qt_press_job_operation " +
        "where device_id = #{deviceId} and press_job_info_id = #{pressJobInfoId} " +
        "and local_job_session_id is not null)) " +
        "order by create_time asc, id asc")
List<QtPressJobOperation> selectHistoryByPressJobInfoId(
        @Param("deviceId") Long deviceId,
        @Param("pressJobInfoId") Long pressJobInfoId);
```

`MACHINE_STATUS` 通过该作业任意已绑定操作的 `local_job_session_id` 纳入；不能只用 `START` 的 session，因为前端在 ERP 返回作业 ID 后会把临时 session 切换为 `press-job-id-{id}`。增加“session A 写 START，session B 写 COMPLETE 与无父 ID 的 MACHINE_STATUS，三者均归入同一作业”的 Mapper 测试。不得用时间窗口关联；锁模、解锁和失败操作保持缺失，不新增表或写入逻辑。

- [x] 重跑 mapper contract test 并确认通过。

- [x] Commit（提交）：

```zsh
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoMapper.java \
  sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/mapper/QtPressJobOperationMapper.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java
git commit -m "feat(qt): 增加压机历史作业查询"
```

---

## Task 3：通过现有 Service 暴露设备绑定的只读查询

**Backend files：**

- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java`
- Modify: `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java`
- Modify: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java`

### Step 3.1：先写 Service delegation（服务委派）失败测试

- [x] 在既有 `PressMouldJobInfoServiceImplQtTest` 增加两个测试，使用已有动态 proxy（代理）模式捕获参数：

```java
@Test
void qtHistoryListDelegatesOnlyAuthenticatedDeviceAndFilters() {
    Date startTime = new Date(1000L);
    Date endTime = new Date(2000L);
    AtomicReference<Object[]> arguments = new AtomicReference<>();
    PressMouldJobInfoMapper mapper = pressMouldJobInfoMapper((proxy, method, args) -> {
        if ("selectQtPressJobHistoryList".equals(method.getName())) {
            arguments.set(args);
            return Collections.emptyList();
        }
        return defaultValue(method.getReturnType());
    });
    PressMouldJobInfoServiceImpl service = service(
            modbusMapper((proxy, method, args) -> defaultValue(method.getReturnType())),
            mapper);

    service.selectQtPressJobHistoryList(10L, startTime, endTime, "M-01", "op-01");

    assertArrayEquals(
            new Object[]{10L, startTime, endTime, "M-01", "op-01"},
            arguments.get());
}

@Test
void qtHistoryDetailDelegatesStableMouldJobIdentityAndDevice() {
    AtomicReference<Object[]> arguments = new AtomicReference<>();
    PressMouldJobInfoMapper mapper = pressMouldJobInfoMapper((proxy, method, args) -> {
        if ("selectQtPressJobHistoryDetail".equals(method.getName())) {
            arguments.set(args);
            return new PressMouldJobInfo();
        }
        return defaultValue(method.getReturnType());
    });
    PressMouldJobInfoServiceImpl service = service(
            modbusMapper((proxy, method, args) -> defaultValue(method.getReturnType())),
            mapper);

    service.selectQtPressJobHistoryDetail(10L, 123L);

    assertArrayEquals(new Object[]{10L, 123L}, arguments.get());
}
```

- [x] 运行并确认编译失败，因为接口方法还不存在。

### Step 3.2：增加最薄 Service 方法

- [x] 在接口和实现中增加以下方法；不要创建新 Service、repository wrapper（仓储包装）或缓存：

```java
List<PressMouldJobInfo> selectQtPressJobHistoryList(
        Long deviceId,
        Date startTime,
        Date endTime,
        String mouldCode,
        String operator);

PressMouldJobInfo selectQtPressJobHistoryDetail(Long deviceId, Long mouldJobId);
```

```java
@Override
public List<PressMouldJobInfo> selectQtPressJobHistoryList(
        Long deviceId,
        Date startTime,
        Date endTime,
        String mouldCode,
        String operator) {
    return pressMouldJobInfoMapper.selectQtPressJobHistoryList(
            deviceId, startTime, endTime, mouldCode, operator);
}

@Override
public PressMouldJobInfo selectQtPressJobHistoryDetail(Long deviceId, Long mouldJobId) {
    return pressMouldJobInfoMapper.selectQtPressJobHistoryDetail(deviceId, mouldJobId);
}
```

校验登录上下文、日期、页码和输入长度属于 Controller trust boundary（控制器信任边界）；Service 保持只读委派，不重复校验。

- [x] 重跑 `PressMouldJobInfoServiceImplQtTest` 并确认通过。

- [x] 提交 Task 3：

```zsh
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java
git commit -m "feat(qt): 暴露历史作业只读服务"
```

---

## Task 4：增加 ERP 历史列表/详情 API 与白名单投影

**Backend files：**

- Modify: `yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java`
- Modify: `yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java`
- Modify: `yr-framework/src/main/java/com/yr/framework/security/handle/AuthenticationEntryPointImpl.java`
- Create: `yr-admin/src/test/java/com/yr/framework/security/handle/AuthenticationEntryPointImplTest.java`

### Step 4.1：先写 Controller contract（控制器契约）失败测试

- [x] 在现有测试构造器中加入 `QtPressJobOperationMapper` mock，并增加以下测试边界：

1. 列表必须要求 `X-Correlation-Id`，从 token context 取 `deviceId=10`，服务只收到该值。
2. 日期必须是完整的 ISO 8601 offset time（带偏移时间），例如 `2026-07-24T00:00:00+08:00`；拒绝缺失 offset、尾随字符、缺位数字和非法闰日。即使测试把 JVM 默认时区改为 UTC，解析得到的查询 `Date` 仍对应工控机传入的 `+08:00` 边界。
3. 校验 `startTime < endTime`、本地自然日跨度不超过 31 日、`pageNum >= 1`、`pageSize == 10`。
4. 列表响应只含固定字段和 `rows/total/pageNum/pageSize`；不含 `deviceId`、`operationIp` 或参数原文。`mouldJobId` 与 `mouldWorkingTime` 必须是 JSON string；时长覆盖 `null`、小数秒和超大值。
5. 详情以 `mouldJobId + context.deviceId` 查询；找不到时返回真实 HTTP 404，不能退化成仅按 ID 查询。
6. 参数 JSON 仅投影 `signalName → parameterName`、`signalValue → value`、`unit`、`time → recordedAt`；丢弃 `signalId`、`signalCode` 与任意额外字段。
7. 参数 JSON 损坏时对应 `startParameterState` 或 `endParameterState` 为 `invalid`，详情其余区域仍返回。
8. 操作记录只投影 `operationTime/operationName/result`，顺序保持 Mapper 返回顺序。
9. 测试注册真实 `GlobalExceptionHandler`；Mapper 抛出带敏感正文的 RuntimeException 时，端点必须在 Controller 内转换为固定中文 HTTP 500，响应、Controller 日志和全局异常日志均不出现原始消息或堆栈。
10. 日志 appender 能观察到 `RequestReceived → ActionStarted → ActionCompleted → ResponseSent`，日志中的 correlationId 经过既有 `logValue` 清洗，且没有敏感字段。

测试响应白名单使用固定 key set：

```java
assertEquals(
        new TreeSet<>(Arrays.asList(
                "mouldJobId", "pressName", "mouldCode", "operator", "craftCode",
                "startTime", "endTime", "mouldWorkingTime", "status")),
        new TreeSet<>(row.keySet()));

assertEquals(
        new TreeSet<>(Arrays.asList(
                "mouldJobId", "pressName", "mouldCode", "operator", "endOperator",
                "craftCode", "startTime", "endTime", "mouldWorkingTime", "status",
                "startParameterState", "endParameterState", "startParameters",
                "endParameters", "operationRecords")),
        new TreeSet<>(detail.keySet()));

assertTrue(JsonPath.read(responseJson, "$.data.rows[0].mouldJobId") instanceof String);
assertTrue(JsonPath.read(responseJson, "$.data.rows[0].mouldWorkingTime") instanceof String);
```

- [x] 用 MockMvc（模拟 MVC）新增两个 GET 路由测试：

```java
mockMvc.perform(get("/api/qt/press-working/history-jobs")
        .header("X-Correlation-Id", "corr-history-list")
        .param("startTime", "2026-07-24T00:00:00+08:00")
        .param("endTime", "2026-07-25T00:00:00+08:00")
        .param("pageNum", "1")
        .param("pageSize", "10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.pageSize").value(10));

mockMvc.perform(get("/api/qt/press-working/history-jobs/123")
        .header("X-Correlation-Id", "corr-history-detail"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.mouldJobId").value("123"));
```

另增加不存在详情的 `status().isNotFound()`、缺失 offset 的 `status().isBadRequest()`，以及 Mapper 抛出 `RuntimeException("SQL detail secret")` 后响应只含固定中文错误的测试。测试结束前必须恢复 JVM 原默认时区，避免污染其他用例。

- [x] 增加 `AuthenticationEntryPointImplTest`：直接调用真实 security entry point（安全入口），锁定无认证 history list/detail 的 HTTP 状态为 401、body code 为 401、四阶段日志完整且关联 ID 已清洗；非 history URI 继续保持既有 HTTP 200/body code 401。该项是任务级审查发现的真实 filter-chain（过滤链）集成缺口，只允许 history 路径采用新语义。

- [x] 补充审查回归测试：合法请求下 Service/Mapper 抛出 `IllegalArgumentException` 必须收口为固定 HTTP 500；缺失关联 ID 或非法输入等早期失败也必须产生完整 `RequestReceived → ActionStarted → ActionCompleted → ResponseSent` 日志。

- [x] 运行 `QtPressWorkingControllerTest` 并确认新增测试失败。

### Step 4.2：实现输入边界、分页和上下文限定

- [x] `AuthenticationEntryPointImpl` 仅精确识别 `/api/qt/press-working/history-jobs` 及其单段详情路径，直接写真实 HTTP 401 和固定中文 body，并记录 `RequestReceived → ActionStarted → ActionCompleted → ResponseSent`；不得调用会把状态重置为 200 的 `ServletUtils.renderString`，不得改变其他 URI 的既有行为，也不得记录 URI、异常、token 或原始 header。

- [x] 历史输入校验使用 Controller 私有专用异常，仅该异常映射 HTTP 400；Service/Mapper 的任意 `IllegalArgumentException` 必须进入固定 HTTP 500。`ActionStarted` 前移到所有 Controller 内请求共同经过的位置，并删除成功校验后的重复记录。

- [x] Controller 注入现有 `QtPressJobOperationMapper`，增加两个 GET endpoint。所有 header/query/path 输入先按可空 `String` 接收并在方法体内校验，避免 Spring 参数绑定异常先落入会回显 `e.getMessage()` 的全局异常处理器。列表核心流程固定为：

```java
@GetMapping("/history-jobs")
public ResponseEntity<AjaxResult> historyJobs(
        @RequestHeader(value = "X-Correlation-Id", required = false) String correlationHeader,
        @RequestParam(value = "startTime", required = false) String startTimeText,
        @RequestParam(value = "endTime", required = false) String endTimeText,
        @RequestParam(value = "mouldCode", required = false) String mouldCode,
        @RequestParam(value = "operator", required = false) String operator,
        @RequestParam(value = "pageNum", required = false) String pageNumText,
        @RequestParam(value = "pageSize", required = false) String pageSizeText) {
    String correlationId = historyCorrelationForLog(correlationHeader);
    logHistoryLifecycle("qt_press_job_history_list", correlationId,
            "RequestReceived", "RECEIVED", "收到历史作业列表请求");
    try {
        correlationId = requireHistoryCorrelationId(correlationHeader);
        QtPressJobContext context = resolveQtPressContext();
        HistoryRange range = parseHistoryRange(startTimeText, endTimeText);
        HistoryPageInput pageInput = parseHistoryPage(pageNumText, pageSizeText);
        logHistoryLifecycle("qt_press_job_history_list", correlationId,
                "ActionStarted", "RUNNING", "开始查询历史作业列表");

        List<PressMouldJobInfo> entities;
        PageInfo<PressMouldJobInfo> page;
        PageHelper.startPage(pageInput.getPageNum(), pageInput.getPageSize());
        try {
            entities = pressMouldJobInfoService.selectQtPressJobHistoryList(
                    context.getDeviceId(), range.getStartTime(), range.getEndTime(),
                    trim(mouldCode), trim(operator));
            page = new PageInfo<>(entities);
        } finally {
            PageHelper.clearPage();
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rows", toHistoryRows(entities));
        data.put("total", page.getTotal());
        data.put("pageNum", pageInput.getPageNum());
        data.put("pageSize", pageInput.getPageSize());
        logHistoryLifecycle("qt_press_job_history_list", correlationId,
                "ActionCompleted", "SUCCESS", "历史作业列表查询完成");
        logHistoryLifecycle("qt_press_job_history_list", correlationId,
                "ResponseSent", "SUCCESS", "历史作业列表响应已发送");
        return ResponseEntity.ok(AjaxResult.success(data));
    } catch (IllegalArgumentException error) {
        return historyError(HttpStatus.BAD_REQUEST, "历史作业查询条件无效",
                "qt_press_job_history_list", correlationId);
    } catch (ResponseStatusException error) {
        return historyError(error.getStatus(), safeHistoryStatusMessage(error.getStatus()),
                "qt_press_job_history_list", correlationId);
    } catch (RuntimeException error) {
        return historyError(HttpStatus.INTERNAL_SERVER_ERROR,
                "历史作业查询失败，请稍后重试",
                "qt_press_job_history_list", correlationId);
    }
}
```

`parseHistoryRange` 只使用 Java 8 标准库 `java.time`，按精确格式 `uuuu-MM-dd'T'HH:mm:ssXXX` 严格解析并完整消费输入：

```java
private static final DateTimeFormatter HISTORY_TIME_FORMATTER =
        new DateTimeFormatterBuilder()
                .parseStrict()
                .appendPattern("uuuu-MM-dd'T'HH:mm:ssXXX")
                .toFormatter(Locale.ROOT)
                .withResolverStyle(ResolverStyle.STRICT);

private HistoryRange parseHistoryRange(String startText, String endText) {
    OffsetDateTime start = OffsetDateTime.parse(requireText(startText), HISTORY_TIME_FORMATTER);
    OffsetDateTime end = OffsetDateTime.parse(requireText(endText), HISTORY_TIME_FORMATTER);
    long naturalDays = ChronoUnit.DAYS.between(start.toLocalDate(), end.toLocalDate());
    if (!LocalTime.MIDNIGHT.equals(start.toLocalTime())
            || !LocalTime.MIDNIGHT.equals(end.toLocalTime())
            || naturalDays < 1 || naturalDays > 31
            || !start.toInstant().isBefore(end.toInstant())) {
        throw new IllegalArgumentException("invalid history range");
    }
    return new HistoryRange(Date.from(start.toInstant()), Date.from(end.toInstant()));
}
```

前端发送工控机本地午夜及当时 offset（偏移量），因此 ERP JVM 即使使用 UTC 也得到同一 instant（时间点）；不读取或假设服务端默认时区。`DateTimeParseException` 必须在 `parseHistoryRange` 内转换为不带原输入的 `IllegalArgumentException`。

`historyError` 仅接收固定中文消息，不接收 Exception（异常）对象；它补齐 `ActionCompleted/ResponseSent` 日志后返回 `ResponseEntity.status(status).body(AjaxResult.error(status.value(), message))`。`safeHistoryStatusMessage` 只按 400/401/403/404/500 映射固定中文消息，绝不能读取 `ResponseStatusException.getReason()` 或其他异常正文。这样异常不会进入现有 `GlobalExceptionHandler`，也不会由其记录堆栈或把原始消息返回客户端。

### Step 4.3：实现详情、参数和操作白名单

- [x] 详情先按 `context.deviceId + mouldJobId` 查询子作业；`pressJobInfoId` 为空时返回空操作记录，而不是猜测：

```java
@GetMapping("/history-jobs/{mouldJobId}")
public ResponseEntity<AjaxResult> historyJobDetail(
        @RequestHeader(value = "X-Correlation-Id", required = false) String correlationHeader,
        @PathVariable("mouldJobId") String mouldJobIdText) {
    String correlationId = historyCorrelationForLog(correlationHeader);
    logHistoryLifecycle("qt_press_job_history_detail", correlationId,
            "RequestReceived", "RECEIVED", "收到历史作业详情请求");
    try {
        correlationId = requireHistoryCorrelationId(correlationHeader);
        QtPressJobContext context = resolveQtPressContext();
        logHistoryLifecycle("qt_press_job_history_detail", correlationId,
                "ActionStarted", "RUNNING", "开始查询历史作业详情");
        PressMouldJobInfo entity =
                pressMouldJobInfoService.selectQtPressJobHistoryDetail(
                        context.getDeviceId(), parsePositiveId(mouldJobIdText));
        if (entity == null) {
            return historyError(HttpStatus.NOT_FOUND, "历史作业不存在",
                    "qt_press_job_history_detail", correlationId);
        }
        List<QtPressJobOperation> operations = entity.getPressJobInfoId() == null
                ? Collections.emptyList()
                : qtPressJobOperationMapper.selectHistoryByPressJobInfoId(
                        context.getDeviceId(), entity.getPressJobInfoId());
        Map<String, Object> data = toHistoryDetail(entity, operations);
        logHistoryLifecycle("qt_press_job_history_detail", correlationId,
                "ActionCompleted", "SUCCESS", "历史作业详情查询完成");
        logHistoryLifecycle("qt_press_job_history_detail", correlationId,
                "ResponseSent", "SUCCESS", "历史作业详情响应已发送");
        return ResponseEntity.ok(AjaxResult.success(data));
    } catch (IllegalArgumentException error) {
        return historyError(HttpStatus.BAD_REQUEST, "历史作业编号无效",
                "qt_press_job_history_detail", correlationId);
    } catch (ResponseStatusException error) {
        return historyError(error.getStatus(), safeHistoryStatusMessage(error.getStatus()),
                "qt_press_job_history_detail", correlationId);
    } catch (RuntimeException error) {
        return historyError(HttpStatus.INTERNAL_SERVER_ERROR,
                "历史作业详情查询失败，请稍后重试",
                "qt_press_job_history_detail", correlationId);
    }
}
```

- [x] `toParameterProjection` 返回 `recorded | missing | invalid` 和白名单 rows；只接受 String、Boolean 或有限 Number scalar（标量）。不记录原始 JSON，也不把异常对象传给 Logger。

- [x] `toHistoryRows/toHistoryDetail` 对 `mouldJobId` 使用 `String.valueOf(id)`，对非空 `BigDecimal mouldWorkingTime` 使用 `toPlainString()`；空值保持 `null`。不得把这两个字段作为 JSON number 返回。

- [x] 操作类型使用固定中文映射，未知值显示“其他操作”，不能回显原始枚举：

```java
private String historyOperationName(String operationType) {
    if ("START".equals(operationType)) return "开始加工";
    if ("PARAMETER_START".equals(operationType)) return "记录开始参数";
    if ("PARAMETER_END".equals(operationType)) return "记录完工参数";
    if ("COMPLETE".equals(operationType)) return "完成加工";
    if ("MACHINE_STATUS".equals(operationType)) return "设备状态更新";
    return "其他操作";
}
```

- [x] `logHistoryLifecycle` 使用稳定 English identifier（英文标识）`event/correlationId/stage/resultCode` 和固定中文摘要；复用现有 `logValue` 防止日志注入。不得输出 request params、异常消息、堆栈或实体。

### Step 4.4：运行后端测试和构建

- [x] 运行 targeted tests（定向测试）：

```zsh
cd "$BACKEND_WORKTREE"
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
  -pl yr-admin -am \
  -Dtest=QtPressWorkingControllerTest,AuthenticationEntryPointImplTest,PressMouldJobInfoServiceImplQtTest,PressMouldJobInfoHistoryMapperContractTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

- [x] 运行模块构建：

```zsh
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
  -pl yr-admin -am -DskipTests package
```

- [x] 提交 Task 4 初始实现与审查修复：

```zsh
git add yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java \
  yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java \
  yr-framework/src/main/java/com/yr/framework/security/handle/AuthenticationEntryPointImpl.java \
  yr-admin/src/test/java/com/yr/framework/security/handle/AuthenticationEntryPointImplTest.java
git commit -m "feat(qt): 提供历史作业只读接口"
```

---

## Task 5：定义前端 View Model 并收窄 ERP 响应

**Frontend files：**

- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`

### Step 5.1：先写 `erpClient` 失败测试

- [x] 增加列表 URL/header（请求头）测试，固定 query 字段和独立 correlationId：

```ts
expect(getJson).toHaveBeenCalledWith(
  "http://127.0.0.1:8080/api/qt/press-working/history-jobs?startTime=2026-07-24T00%3A00%3A00%2B08%3A00&endTime=2026-07-25T00%3A00%3A00%2B08%3A00&mouldCode=M-01&operator=op-01&pageNum=1&pageSize=10",
  "erp-token",
  { headers: { "X-Correlation-Id": "corr-list-1" } },
);
```

- [x] 增加列表/详情白名单测试。Raw payload（原始载荷）故意包含以下字段，断言返回对象全文不含这些 key/value：

```ts
const forbiddenPayload = {
  deviceId: 10,
  ip: "192.0.2.10",
  port: 502,
  signedLease: "secret-lease",
  signature: "secret-signature",
  signalConfig: { raw: true },
  sessionToken: "secret-token",
  idempotencyKey: "secret-idempotency",
  requestFingerprint: "secret-fingerprint",
};

expect(JSON.stringify(result)).not.toMatch(
  /deviceId|192\.0\.2\.10|signedLease|secret-signature|signalConfig|secret-token|idempotencyKey|requestFingerprint/,
);
```

- [x] 固定字段映射：`mouldJobId → moldJobId`、`deviceName/pressName → pressName`、`mouldCode → moldNo`、`operator → operatorId`、`startTime → startedAt`、`endTime → completedAt`、`mouldWorkingTime / 3600 → actualDurationHours.toFixed(1)`；未知状态仍保留安全 status code，由页面统一显示“状态未知”。`mouldWorkingTime` 只接受后端 string/null，`null` 返回未记录，小数秒正常换算，超过 `Number.MAX_SAFE_INTEGER` 或非有限/负值返回未记录，避免精度丢失或 `Infinity`。

- [x] 运行失败测试：

```zsh
pnpm --dir qt-app/frontend exec vitest run src/services/erpClient.test.ts
```

### Step 5.2：增加最小 domain types（领域类型）

- [x] 在现有 `domain/pressJob.ts` 追加类型，不拆新文件：

```ts
export type PressJobHistoryQuery = {
  startTime: string;
  endTime: string;
  mouldCode?: string;
  operator?: string;
  pageNum: number;
  pageSize: 10;
  correlationId: string;
};

export type PressJobHistoryRow = {
  moldJobId: string;
  pressName?: string;
  moldNo: string;
  operatorId?: string;
  craftCode?: string;
  startedAt?: string;
  completedAt?: string;
  actualDurationHours?: string;
  status?: string;
};

export type PressJobHistoryParameterState = "recorded" | "missing" | "invalid";

export type PressJobHistoryParameter = {
  parameterName: string;
  value?: string | number | boolean;
  unit?: string;
  recordedAt?: string;
  status: "recorded" | "missing" | "invalid";
};

export type PressJobHistoryOperation = {
  operationTime?: string;
  operationName: string;
  result: string;
};

export type PressJobHistoryDetail = PressJobHistoryRow & {
  endOperatorId?: string;
  startParameterState: PressJobHistoryParameterState;
  endParameterState: PressJobHistoryParameterState;
  startParameters: PressJobHistoryParameter[];
  endParameters: PressJobHistoryParameter[];
  operationRecords: PressJobHistoryOperation[];
};

export type PressJobHistoryPageResult = {
  rows: PressJobHistoryRow[];
  total: number;
  pageNum: number;
  pageSize: 10;
};
```

### Step 5.3：实现两个只读 client 方法

- [x] 在 `erpClient.ts` 增加 endpoint constants（端点常量）与 request input（请求输入）：

```ts
const PRESS_JOB_HISTORY_PATH = "/api/qt/press-working/history-jobs";

export type FetchPressJobHistoryInput = FetchPressJobLookupDataInput & {
  query: PressJobHistoryQuery;
};

export type FetchPressJobHistoryDetailInput = FetchPressJobLookupDataInput & {
  moldJobId: string;
  correlationId: string;
};
```

- [x] 列表 URL 必须用 `URL`/`searchParams` 生成，不手拼未转义 query：

```ts
export async function fetchPressJobHistory(
  readJson: GetJson,
  input: FetchPressJobHistoryInput,
): Promise<PressJobHistoryPageResult> {
  const url = new URL(PRESS_JOB_HISTORY_PATH, input.erpBaseUrl);
  url.searchParams.set("startTime", input.query.startTime);
  url.searchParams.set("endTime", input.query.endTime);
  if (input.query.mouldCode) url.searchParams.set("mouldCode", input.query.mouldCode);
  if (input.query.operator) url.searchParams.set("operator", input.query.operator);
  url.searchParams.set("pageNum", String(input.query.pageNum));
  url.searchParams.set("pageSize", String(input.query.pageSize));

  const payload = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(url.toString(), input.sessionToken, {
      headers: { "X-Correlation-Id": input.query.correlationId },
    }),
  );
  return narrowPressJobHistoryPage(payload);
}
```

- [x] 详情只接受十进制正整数 string（字符串）`moldJobId`，在请求边界拒绝 dot segment（点路径段）等非法 ID 并确保 `getJson` 未被调用；列表收窄器同步丢弃非法 ID 行。校验通过后仍使用 `encodeURIComponent`，并传独立 header；两个 narrower（收窄器）都从 `unknown` 开始，逐字段白名单化。参数 `value` 只接受 String/Boolean/有限 Number；嵌套 object/array 直接标记 invalid 或丢弃，不能传到页面。回归测试必须保留 64-bit Long（长整型）上限 ID 的原始 string 精度。

- [x] 重跑 `erpClient.test.ts` 并确认通过。

- [x] 提交 Task 5 前端契约初始实现与审查修复：

```zsh
git add qt-app/frontend/src/domain/pressJob.ts \
  qt-app/frontend/src/services/erpClient.ts \
  qt-app/frontend/src/services/erpClient.test.ts
git commit -m "feat(qt): 接入历史作业查询契约"
```

---

## Task 6：实现历史作业页面状态、列表和 70% 详情抽屉

**Frontend files：**

- Modify: `qt-app/frontend/package.json`
- Modify: `qt-app/frontend/pnpm-lock.yaml`
- Create: `qt-app/frontend/src/components/PressJobHistoryPage.tsx`
- Create: `qt-app/frontend/src/components/PressJobHistoryPage.css`
- Create: `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx`

### Step 6.1：声明 Ant Design 已使用的 Day.js 直接依赖

- [x] 先核对 lockfile 中 Ant Design 实际解析的同版本 Day.js 版本，再声明同一版本；当前核实值为 `1.11.21`：

```zsh
pnpm --dir qt-app/frontend add dayjs@1.11.21
```

不要新增 date-fns、Moment、Luxon 或日期工具 wrapper（包装器）。

### Step 6.2：先写页面逻辑与结构失败测试

- [x] 新测试使用项目现有 Vitest + `renderToStaticMarkup`/source contract 风格，不新增 Testing Library 或 DOM runtime。至少覆盖：

1. `createInitialHistoryFilters(now)` 返回当天 RangePicker 范围。
2. `validateHistoryDateRange` 接受 31 个自然日、拒绝 32 个自然日。
3. `buildHistoryQuery` 把起点和结束日期的下一日零点格式化为 `YYYY-MM-DDTHH:mm:ssZ`，保留工控机当时的 offset（例如 `+08:00`），并固定 `pageSize: 10`；不得使用 `toISOString()` 转成 UTC 日期字符串后再截断。
4. 修改 `draftFilters` 不改变 `appliedQuery`；点击查询复制 snapshot 并回到第 1 页。
5. `shouldApplyHistoryListResponse` 同时要求当前 list request version（列表请求版本）、loader identity（加载器身份）和 `appliedQuery` identity（查询身份）。
6. `shouldApplyHistoryDetailResponse` 同时要求当前 detail version、相同 `moldJobId` 和 loader identity；Drawer 关闭后版本失效。
7. 静态结构包含八列、`allowClear={false}`、`size="70%"`、row `tabIndex=0`、`Enter`/`Space`、固定中文空/错状态。
8. 状态映射对未知 code 返回“状态未知”，不能回显原值。
9. 参数对齐 helper（辅助函数）保留仅一侧存在的参数，并显示“未记录”。

请求竞态判断保持最小纯函数，便于不用 DOM runtime 执行真实断言：

```ts
export function shouldApplyHistoryDetailResponse(
  requestedVersion: number,
  currentVersion: number,
  requestedMoldJobId: string,
  selectedMoldJobId: string | undefined,
): boolean {
  return (
    requestedVersion === currentVersion &&
    requestedMoldJobId === selectedMoldJobId
  );
}
```

- [x] 运行 Task 6 页面测试并确认 RED（红灯）：

```zsh
pnpm --dir qt-app/frontend exec vitest run src/components/PressJobHistoryPage.test.tsx
```

### Step 6.3：实现 props、安全边界和状态机

- [x] 页面 props 只接收脱敏 options（选项）和两个只读回调：

```ts
export type PressJobHistoryPageProps = {
  operatorOptions: ErpDictOption[];
  craftOptions: ErpDictOption[];
  loadHistoryList: (
    query: PressJobHistoryQuery,
  ) => Promise<PressJobHistoryPageResult>;
  loadHistoryDetail: (input: {
    moldJobId: string;
    correlationId: string;
  }) => Promise<PressJobHistoryDetail>;
};
```

禁止 props 出现 `sessionToken`、`erpBaseUrl`、`deviceId`、driver session（驱动会话）、`signedLease` 或 `signalConfig`。

- [x] 页面持有两套筛选状态和两套独立版本：

```ts
const [draftFilters, setDraftFilters] = useState(() => createInitialHistoryFilters(dayjs()));
const [appliedQuery, setAppliedQuery] = useState(() =>
  buildHistoryQuery(createInitialHistoryFilters(dayjs()), 1, createHistoryCorrelationId("list")),
);
const listRequestVersionRef = useRef(0);
const detailRequestVersionRef = useRef(0);
const [selectedMoldJobId, setSelectedMoldJobId] = useState<string>();
```

初始查询由 `useEffect` 调一次 `appliedQuery`；列表 query/retry/翻页每次生成新的 `correlationId`。详情打开/retry 每次也生成新 ID。

- [x] 请求 `.then/.catch/.finally` 三处都检查 scope（作用域）：list 检查版本、loader 和当前 `appliedQuery` identity；detail 检查版本、loader 与 `selectedMoldJobId`。loader 换代时重取当前列表快照或已打开详情。关闭 Drawer 时执行：

```ts
detailRequestVersionRef.current += 1;
setSelectedMoldJobId(undefined);
setDetail(undefined);
setDetailStatus("idle");
```

关闭后通过保存的触发行 `HTMLElement` 恢复 focus（焦点）。

### Step 6.4：实现筛选、八列表格和局部状态

- [x] `RangePicker` 固定：

```tsx
<RangePicker
  allowClear={false}
  format="YYYY-MM-DD"
  value={draftFilters.dateRange}
  onChange={handleDraftDateRangeChange}
/>
```

查询按钮在日期非法或超过 31 日时 disabled，并在字段附近显示中文校验文字。翻页只复制 `appliedQuery` 的筛选字段、替换 `pageNum/correlationId`，绝不能读取当前 draft。

- [x] 八列顺序固定为 `压机 / 模具号 / 作业人员 / 工艺 / 开始时间 / 完成时间 / 实际时长 / 完工状态`。人员和工艺用 bootstrap 已有 `ErpDictOption` 翻译；找不到 label 时显示安全 code 或“未记录”。

- [x] Table 使用 server pagination（服务端分页）：

```tsx
pagination={{
  current: appliedQuery.pageNum,
  pageSize: 10,
  total: listResult.total,
  showSizeChanger: false,
  showTotal: (total) => `共 ${total} 条`,
  onChange: handlePageChange,
}}
```

- [x] `onRow` 让整行支持触控、点击、Enter 和 Space；选中 class 只比较稳定 `moldJobId`。Drawer 打开时标准 mask（遮罩）阻止底层交互，不实现“直接切换另一条”。

- [x] Table 内容区状态固定：loading 显示 Skeleton rows（骨架行），error 显示 Alert + “重试”，empty 显示已批准中文文案。失败只重试对应 request，不清空上一次成功的筛选快照。

### Step 6.5：实现 70% Drawer 与详情区域

- [x] 使用 Ant Design 默认 body Portal 和标准 mask；通过 `rootStyle` 把当前 AntD semantic token 转发为详情 CSS 已复用的三个 `--qt-app-control-blue*` 变量：

```tsx
<Drawer
  destroyOnHidden={false}
  onClose={handleCloseDetail}
  open={selectedMoldJobId !== undefined}
  rootStyle={drawerRootStyle}
  title={`作业详情 · ${selectedRow?.moldNo ?? "未记录"}`}
  size="70%"
>
  {detailContent}
</Drawer>
```

- [x] 概要使用 `Descriptions column={4}` 两行；“班组 / 作业人员”的 value 为 `未记录 / {operator label}`。不要新增卡片。

- [x] 参数区用一个对齐 Table：`参数名称 / 开始参数 / 完工参数 / 单位 / 状态`。合并键使用 `parameterName`，只存在一侧时另一侧显示“未记录”；section state 为 invalid 时显示“参数记录格式异常”，但不隐藏另一侧有效记录。

- [x] 操作记录按 response 顺序显示时间、中文操作名和“成功”；空数组显示“该作业没有可查看的操作记录”。不展示操作内部 ID。

### Step 6.6：只使用现有 Design Token（设计变量）完成 CSS

- [x] 新 CSS 固定复用 `--qt-app-control-blue`、`--qt-app-control-blue-soft`、`--qt-app-control-blue-line` 与 AntD semantic token（语义令牌），不硬编码第二套 light/dark palette（明暗色板）。默认 body Portal 内由 Drawer `rootStyle` 提供同名变量。核心布局：

```css
.press-job-history-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.press-job-history-page__filters {
  display: flex;
  align-items: end;
  gap: 12px;
  min-height: 62px;
  padding: 8px 12px;
  border: 1px solid var(--qt-app-control-blue-line);
  border-radius: 6px;
}

.press-job-history-page__filters :where(.ant-picker, .ant-input, .ant-select-selector, .ant-btn) {
  min-height: 44px;
}

.press-job-history-page__table,
.press-job-history-page__table .ant-spin-nested-loading,
.press-job-history-page__table .ant-spin-container {
  min-height: 0;
  height: 100%;
}

.press-job-history-page__table .ant-spin-container {
  display: flex;
  flex-direction: column;
}

.press-job-history-page__table .ant-table,
.press-job-history-page__table .ant-table-container {
  height: 100%;
  min-height: 0;
}

.press-job-history-page__table .ant-table-container {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.press-job-history-page__table .ant-table-body {
  min-height: 0;
}

.press-job-history-page__table.ant-table-wrapper .ant-table-pagination.ant-pagination {
  margin: 0 !important;
  margin-top: auto !important;
  padding-top: 6px;
}

.press-job-history-page__row--selected > td {
  background: var(--qt-app-control-blue-soft) !important;
}

.press-job-history-detail__body {
  display: grid;
  grid-template-columns: minmax(0, 64fr) minmax(260px, 36fr);
  gap: 16px;
  min-height: 0;
}
```

补齐 `:focus-visible`、44px row/close target、详情内部滚动和 `@media (prefers-reduced-motion: reduce)`；不增加阴影、渐变、玻璃、宽圆角或装饰动画。

- [x] 重跑页面测试并确认通过；review-fix round 2 最终为 `14/14`，`tsc --noEmit` 与 production build 均通过。

- [x] 提交 Task 6 页面初始实现与两轮审查修复：

```zsh
git add qt-app/frontend/package.json qt-app/frontend/pnpm-lock.yaml \
  qt-app/frontend/src/components/PressJobHistoryPage.tsx \
  qt-app/frontend/src/components/PressJobHistoryPage.css \
  qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
git commit -m "feat(qt): 实现历史作业页面"
```

Review-fix commits（审查修复提交）：

- `d236c70bccc1cff69fc86b45fd8c5f37a380f96d`：绑定 loader scope、转发 Portal token，并改用 `size="70%"`。
- `facd876b125742397435d086a7909d39a614ffed`：绑定列表响应的当前 query identity，关闭 render/effect 窗口竞态。

---

## Task 7：接入 App Shell 第四入口并隔离 token

**Frontend files：**

- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`

### Step 7.1：先写 App integration（应用集成）失败测试

- [x] 在 `App.test.tsx` 固定以下契约：

```ts
expect(appSource).toContain(
  'type AppView = "dashboard" | "diagnostics" | "pressJob" | "pressJobHistory"',
);
expect(appSource.indexOf('{ label: "历史作业", value: "pressJobHistory" }')).toBeGreaterThan(
  appSource.indexOf('{ label: "压机作业", value: "pressJob" }'),
);
expect(appSource).toContain('currentView === "pressJobHistory"');
expect(appSource).toContain("fetchPressJobHistory(getJson");
expect(appSource).toContain("fetchPressJobHistoryDetail(getJson");
```

- [x] 增加安全断言：`PressJobHistoryPage` JSX props 不包含 `sessionToken`、`erpBaseUrl`、`bootstrapSession` 或 `driverSession`，只包含安全 options 和 callbacks。

- [x] 运行 Task 7 App 集成测试并确认 RED（红灯）：

```zsh
pnpm --dir qt-app/frontend exec vitest run src/App.test.tsx
```

### Step 7.2：实现 App callbacks 与显式渲染分支

- [x] 扩展 `AppView`，在“压机作业”右侧增加第四项。

- [x] 在 App 内增加两个 `useCallback`。Token 只出现在闭包调用 `erpClient` 的 input 中：

```ts
const loadPressJobHistory = useCallback(
  async (query: PressJobHistoryQuery) => {
    if (!bootstrapSession.config || !bootstrapSession.data) {
      throw new Error("ERP 会话尚未就绪。");
    }
    return fetchPressJobHistory(getJson, {
      erpBaseUrl: bootstrapSession.config.erpBaseUrl,
      sessionToken: bootstrapSession.data.sessionToken,
      query,
    });
  },
  [bootstrapSession.config, bootstrapSession.data],
);
```

详情 callback 同理，只接受 `moldJobId/correlationId`。

- [x] 把原先最终 `else` 的 `PressJobPage` 分支改为显式 `currentView === "pressJob"`，再增加历史页分支：

```tsx
<PressJobHistoryPage
  craftOptions={bootstrapSession.data?.pressMoldCraftOptions ?? []}
  loadHistoryDetail={loadPressJobHistoryDetail}
  loadHistoryList={loadPressJobHistory}
  operatorOptions={bootstrapSession.data?.pressMoldOperatorOptions ?? []}
/>
```

不得修改 `PressJobPage` 现有四行布局和 props。

- [x] 重跑 App test 和历史页 test；最终 `31/31` 通过，`tsc --noEmit` 与 production build 均通过。

- [x] 提交 Task 7 App Shell 集成：

```zsh
git add qt-app/frontend/src/App.tsx qt-app/frontend/src/App.test.tsx
git commit -m "feat(qt): 增加历史作业一级入口"
```

---

## Task 8：端到端验证、视觉核对和安全扫描

**Files：** 只修复验证发现且属于本功能的问题；不做顺手重构。

### Step 8.1：后端完整目标验证

- [ ] 在后端 worktree 运行：

```zsh
JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
  -pl yr-admin -am \
  -Dtest=QtPressWorkingControllerTest,PressMouldJobInfoServiceImplQtTest,PressMouldJobInfoHistoryMapperContractTest \
  -Dsurefire.failIfNoSpecifiedTests=false test

JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home \
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn \
  -pl yr-admin -am -DskipTests package
```

- [ ] 检查 Liquibase includeAll 能包含既有 operation changelog，且本变更没有新增 migration：

```zsh
rg -n "includeAll path=\"classpath:db/liquibase/changelog\"" \
  yr-admin/src/main/resources/db/liquibase/master.xml
rg -n "qt_press_job_operation" \
  yr-admin/src/main/resources/db/liquibase/changelog/smes/changelog-2026-07-22-qt-press-job-operation.xml
test -z "$(git diff --name-only master...HEAD | rg 'liquibase' || true)"
```

### Step 8.2：前端完整目标验证

- [ ] 运行所有相关测试和 production build（生产构建）：

```zsh
pnpm --dir qt-app/frontend exec vitest run \
  src/services/erpClient.test.ts \
  src/components/PressJobHistoryPage.test.tsx \
  src/App.test.tsx
pnpm --dir qt-app/frontend build
```

- [ ] 在可用的本地 ERP/Qt bootstrap 环境中启动 Vite；若环境不可用，不发送伪造真实设备请求，只用静态 mock 数据进行 UI 核对：

```zsh
pnpm --dir qt-app/frontend dev --host 127.0.0.1
```

- [ ] 使用 in-app browser（应用内浏览器）在 1280×720 核对 light/dark 两种主题：

1. 四个一级入口完整显示，“历史作业”紧邻“压机作业”。
2. 页面无页面级滚动条，筛选控件、行、关闭按钮至少 44px。
3. 八列不发生非预期换行；表头固定、分页在底部。
4. Drawer 实测宽度为应用 viewport 的 70%，1280px 基线即 896px；mask 阻止底层交互。
5. 概要四列两行；下部 64% 参数区与 36% 操作区；长内容只在 Drawer 内容区滚动。
6. token、颜色、圆角和间距来自既有变量/AntD theme，无新渐变、宽阴影或主题硬编码。
7. 点击、Enter、Space 能打开；Escape/关闭按钮关闭后焦点返回原行。

### Step 8.3：安全与范围扫描

- [ ] 确认新页面 props 和历史 response mapper（响应映射）没有禁用字段：

```zsh
rg -n "signedLease|signaturePayload|signalConfig|privateKey|credential|sessionToken|deviceId|operationIp|granteeHostId|idempotencyKey|requestFingerprint" \
  qt-app/frontend/src/components/PressJobHistoryPage.tsx \
  yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java
```

Expected：页面文件零命中；Controller 允许在认证上下文内部出现 `deviceId`，但 `toHistoryRows/toHistoryDetail/toHistoryOperationRows` 的 response key 不得命中。

- [ ] 检查新增日志只含稳定字段和中文摘要，不含 request body（请求体）、异常堆栈、参数 JSON 或网络字段。

- [ ] 分别检查两个 worktree：

```zsh
git status --short
git diff --check
git log --oneline --decorate -5
```

- [ ] 按 `requesting-code-review` 进行 correctness/security/regression（正确性/安全性/回归）审查；修复 P0/P1/P2 后重跑受影响的最小测试和最终构建。

- [ ] 使用 `verification-before-completion` 复核实际输出，再更新 Comet verify/handoff（验证/交接）状态。Archive（归档）、合并和 push（推送）均是独立授权门，不在本计划自动执行。

---

## 9. Requirements traceability（需求追踪）

| 已批准要求 | 实施落点 | 自动验证 |
| --- | --- | --- |
| 第四一级入口位于压机作业右侧 | Task 7 `App.tsx` | `App.test.tsx` 顺序断言 |
| 默认当天、最多 31 日、工控机本地半开完工区间 | Task 4 + Task 6 | 带 offset 的 Controller/JVM-UTC 测试 + 日期 helper 测试 |
| draft 与 applied 分离，翻页不隐式查询 | Task 6 | 页面纯逻辑测试 |
| 服务端分页 10 条、完工倒序 | Task 2 + Task 4 | Mapper contract + Controller test |
| 稳定作业身份 | `press_mould_job_info.id → mouldJobId → moldJobId` | Mapper/erpClient/page tests |
| 八列表格、中文状态、固定空/错状态 | Task 6 | 页面结构与 formatter 测试 |
| 默认 body Portal、70% Drawer、标准 mask | Task 6 | 源码契约 + 1280×720 视觉核对 |
| 概要 4×2、参数 64%、操作 36% | Task 6 | CSS contract + 视觉核对 |
| 参数两侧对齐并保留单侧有效值 | Task 4 + Task 6 | JSON 投影测试 + 对齐 helper 测试 |
| 操作记录不替代主记录、不猜测关联 | Task 2 + Task 4 | 多 session Mapper contract + response test |
| list/detail latest-request-wins | Task 6 | 独立 version helper 测试 |
| 每次 list/detail/retry 独立 correlationId | Task 4 + Task 5 + Task 6 | Header、日志、页面逻辑测试 |
| 不泄露敏感/设备网络字段 | Task 4 + Task 5 + Task 8 | 白名单 key set + forbidden payload test + `rg` |
| 404/500 保持真实 HTTP 状态且不泄露异常 | Task 4 | 注册真实全局 Advice 的 MockMvc + 日志 appender |
| 不改变压机作业四行布局 | Task 7 | App 分支测试；不修改 `PressJobPage.*` |
| 不脱离既有设计变量 | Task 6 + Task 8 | CSS source contract + light/dark 视觉核对 |

## 10. 明确延后项

- 不持久化历史班组；已有表没有该事实，首版显示“未记录”。
- 不补录锁模/解锁/失败操作；已有 operation table 不具备这些可靠记录。
- 不为每天少于 50 条、单次最多 31 日的数据量增加缓存、虚拟列表、搜索索引或汇总表。若生产 explain plan（执行计划）证明查询慢，再按实际 SQL 和索引证据处理。
- 不复用旧 `/modbus/pressjob/getHistoryPressJobList/{deviceId}`；它由客户端选择设备、只取一条 parent job（父作业），不满足当前安全和分页契约。
- 不写入当前后端 `dev`、`dev-popo` 或其他长期分支工作树；ERP 功能分支直接从 `master` 建立，完成后只允许合并回 `master`。

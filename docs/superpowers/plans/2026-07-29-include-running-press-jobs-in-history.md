---
change: include-running-press-jobs-in-history
design-doc: docs/superpowers/specs/2026-07-29-include-running-press-jobs-in-history-design.md
base-ref: 4c5d0464d63ae6dece30d2a2fb5617d7181f3c32
---

# 历史作业纳入进行中作业 Implementation Plan（实施计划）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Author: PopoY
> Created: 2026-07-29 14:07:12

**Goal:** 让当前认证设备的 `status=1` 进行中模具作业与 `status=3` 已完成作业共享现有“历史作业”列表、详情和操作记录入口。

**Architecture:** ERP 只修改现有 MyBatis Mapper（映射器）的状态、时间和排序条件，Controller（控制器）继续使用认证设备及既有白名单响应。QT App 只在现有 `PressJobHistoryPage` 中补齐状态感知文案和格式化，复用现有 Table、Drawer、参数对照和 Timeline（时间轴）。

**Tech Stack:** Java 8、Spring MVC、MyBatis、JUnit 5、React 19、TypeScript 6、Ant Design 6、Vitest 4、pnpm 11。

## Global Constraints（全局约束）

- 主仓库基线：`/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring` @ `4c5d0464d63ae6dece30d2a2fb5617d7181f3c32`。
- ERP 仓库基线：`/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be` @ `085c6f1576ac12b624b7cbec4c5ce2b94a8d81ff`。
- ERP 原有未跟踪文件 `docs/sql/2026-07-27-qt-press-job-operation-log.sql` 属于用户，所有步骤禁止修改、暂存或删除。
- 只允许 `status IN ('1','3')`；不得展示 `0/2/4`。
- 已完成作业继续按 `end_time` 落入 `[startTime,endTime)`；进行中作业按开放区间相交，即 `start_time < endTime`。
- 进行中置顶，组内使用对应业务时间倒序，最终以 `id DESC` 稳定分页。
- 保留认证 `deviceId`、真实 `mouldJobId`、父作业可靠关联、白名单字段和敏感信息边界。
- 不新增接口、数据库结构、迁移、依赖、状态筛选、日志页面、轮询或实时计时器。
- 修改代码和测试文件时保留原作者，更新 `Editor: PopoY` / `Edited: <执行时本地时间>`（或项目既有 `@editor` / `@edited` 形式），所有新增注释包含 `@author PopoY` 且说明使用中文或中英混合。

## File Map（文件映射）

- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml` — 列表和详情 SQL 的唯一生产端改动。
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java` — 锁定状态、时间、排序与设备边界。
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java` — 锁定进行中记录的白名单及空完工字段响应。
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.tsx` — 状态、完成时间、时长、列名和空态展示。
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobHistoryPage.test.tsx` — 锁定进行中和已完成展示契约。

---

### Task 1: ERP 历史查询 RED/GREEN

**Files:**

- Modify: `sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java`
- Modify: `yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java`
- Modify: `sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml`

**Interfaces:**

- Consumes: `selectQtPressJobHistoryList(deviceId,startTime,endTime,mouldCode,operator)` 与 `selectQtPressJobHistoryDetail(deviceId,mouldJobId)` 的现有签名。
- Produces: 列表只返回同设备 `status=1/3`；详情只允许同设备 `status=1/3`；Controller 路由和 DTO 不变。

- [x] **Step 1: 先把 Mapper contract（映射契约）测试改为新规则**

将列表测试改名为 `historyListIsDeviceScopedRunningCompletedHalfOpenAndStableOrdered`，用以下断言替换旧完成态断言；详情测试保留 ID、设备和操作日志断言，只把状态断言改为 `in ('1', '3')`：

```java
assertTrue(select.contains("pmji.device_id = #{deviceId}"));
assertTrue(select.contains("pmji.status = '1' and pmji.start_time &lt; #{endTime}"));
assertTrue(select.contains("pmji.status = '3'"));
assertTrue(select.contains("pmji.end_time &gt;= #{startTime}"));
assertTrue(select.contains("pmji.end_time &lt; #{endTime}"));
assertFalse(select.contains("pmji.start_time &gt;= #{startTime}"));
assertTrue(select.contains("case when pmji.status = '1' then 0 else 1 end"));
assertTrue(select.contains(
        "case when pmji.status = '1' then pmji.start_time else pmji.end_time end desc"));
assertTrue(select.contains("pmji.id desc"));

assertTrue(detail.contains("pmji.id = #{mouldJobId}"));
assertTrue(detail.contains("pmji.device_id = #{deviceId}"));
assertTrue(detail.contains("pmji.status in ('1', '3')"));
```

同时保留现有模具号、人员、显式投影、Mapper 签名、操作日志父作业关联与敏感字段断言。更新该测试文件头的 `Editor/Edited` 元数据。

- [x] **Step 2: 在 Controller 聚焦测试中锁定进行中字段**

新增一个测试，复用 `historyJob` 与 `historyMockMvc`，不要增加 Controller 生产逻辑：

```java
/**
 * @author PopoY
 * @purpose 进行中作业必须保留真实状态和空完工字段，且继续使用认证设备查询。
 */
@Test
void historyListProjectsRunningStatusWithoutInventingCompletionFields() throws Exception {
    IPressMouldJobInfoService service = mock(IPressMouldJobInfoService.class);
    PressMouldJobInfo running = historyJob(123L, null);
    running.setStatus("1");
    running.setEndTime(null);
    when(service.selectQtPressJobHistoryList(any(), any(), any(), any(), any()))
            .thenReturn(Collections.singletonList(running));

    MvcResult result = historyMockMvc(service, mock(QtPressJobOperationMapper.class))
            .perform(get("/api/qt/press-working/history-jobs")
                    .header("X-Correlation-Id", "corr-running-history")
                    .param("startTime", "2026-07-24T00:00:00+08:00")
                    .param("endTime", "2026-07-25T00:00:00+08:00")
                    .param("pageNum", "1")
                    .param("pageSize", "10"))
            .andExpect(status().isOk())
            .andReturn();

    String response = result.getResponse().getContentAsString();
    assertEquals("1", JsonPath.read(response, "$.data.rows[0].status"));
    assertNull(JsonPath.read(response, "$.data.rows[0].endTime"));
    assertNull(JsonPath.read(response, "$.data.rows[0].mouldWorkingTime"));
    verify(service).selectQtPressJobHistoryList(eq(10L), any(), any(), isNull(), isNull());
}
```

再把现有详情白名单测试中的实体设为 `status="1"`、`endTime=null`、`mouldWorkingTime=null`，并增加 `status/endTime/mouldWorkingTime` 的同类断言；原操作记录、参数、认证设备和敏感字段断言全部保留。更新测试文件头的 `@edited` 为执行时本地时间。

- [x] **Step 3: 运行聚焦测试，取得 RED 证据**

Run:

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl sam-erp -am \
  -Dtest=PressMouldJobInfoHistoryMapperContractTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: `PressMouldJobInfoHistoryMapperContractTest` FAIL，旧 SQL 缺少 `status='1'`、新排序和详情 `IN ('1','3')`；失败原因必须来自新契约而非编译或环境错误。

Run:

```bash
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am \
  -Dtest=QtPressWorkingControllerTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: Controller 进行中投影断言 PASS；这证明响应适配无需新生产代码。若失败，只修复真实白名单投影问题，不改变接口。

- [x] **Step 4: 最小修改 Mapper SQL**

把列表 `where` 和 `order by` 改为：

```xml
where pmji.device_id = #{deviceId}
  and (
    (pmji.status = '1' and pmji.start_time &lt; #{endTime})
    or
    (pmji.status = '3'
      and pmji.end_time &gt;= #{startTime}
      and pmji.end_time &lt; #{endTime})
  )
```

现有可选 `mouldCode` 与 `operator` 条件保持在状态分支之后，并把排序替换为：

```xml
order by case when pmji.status = '1' then 0 else 1 end,
         case when pmji.status = '1' then pmji.start_time else pmji.end_time end desc,
         pmji.id desc
```

详情仅替换状态条件：

```xml
and pmji.status in ('1', '3')
```

更新 Mapper 文件头 `Edited` 为执行时本地时间。不要改 Service、Controller、Mapper Java 签名或数据库文件。

- [x] **Step 5: 运行聚焦测试，取得 GREEN 证据**

重复 Step 3 两条 Maven 命令。

Expected: 两组测试均 PASS；Mapper 测试确认状态/时间/排序/详情合同，Controller 测试确认进行中空完工字段、认证设备和白名单响应。

- [x] **Step 6: 检查 ERP 改动并提交**

```bash
git diff --check
git status --short
git diff -- sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java \
  yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java
git add sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/mapper/PressMouldJobInfoHistoryMapperContractTest.java \
  yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java
git commit -m "feat: 历史作业查询纳入进行中作业"
```

Expected: `docs/sql/2026-07-27-qt-press-job-operation-log.sql` 仍为未跟踪且未进入 staged diff（暂存差异）。

---

### Task 2: QT App 展示 RED/GREEN

**Files:**

- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx`
- Modify: `qt-app/frontend/src/components/PressJobHistoryPage.tsx`

**Interfaces:**

- Consumes: 现有 `PressJobHistoryRow.status/completedAt/actualDurationHours` 与 `PressJobHistoryDetail` 同名字段。
- Produces: `formatHistoryStatus`、`formatHistoryCompletedAt`、`formatHistoryDuration` 三个共享纯函数；接口类型和请求不变。

- [x] **Step 1: 先补进行中展示测试**

保留现有具名导入，并增加 `import * as historyPage from "./PressJobHistoryPage"`。通过 `Reflect.get` 描述期望导出，使旧实现先产生 assertion failure（断言失败），而不是因为具名导出不存在产生编译错误：

```ts
it("formats running, completed and unknown job states", () => {
  const formatHistoryCompletedAt = Reflect.get(
    historyPage,
    "formatHistoryCompletedAt",
  ) as (status: string | undefined, value: string | undefined) => string;
  const formatHistoryDuration = Reflect.get(
    historyPage,
    "formatHistoryDuration",
  ) as (status: string | undefined, value: string | undefined) => string;

  expect(formatHistoryStatus("1")).toBe("进行中");
  expect(formatHistoryStatus("3")).toBe("已完成");
  expect(formatHistoryStatus("UNRECOGNIZED")).toBe("状态未知");
  expect(formatHistoryStatus(undefined)).toBe("状态未知");

  expect(typeof formatHistoryCompletedAt).toBe("function");
  expect(typeof formatHistoryDuration).toBe("function");
  expect(formatHistoryCompletedAt("1", undefined)).toBe("未完成");
  expect(formatHistoryCompletedAt("3", "2026-07-27 12:34:56")).toBe(
    "2026-07-27 12:34:56",
  );
  expect(formatHistoryDuration("1", undefined)).toBe("进行中");
  expect(formatHistoryDuration("3", "1.5")).toBe("1.5 小时");
});
```

将结构测试改为断言通用空态和“作业状态”：

```ts
expect(pageSource).toContain(
  "当前查询范围暂无作业，请调整日期范围后查询。",
);
expect(pageSource).not.toContain("暂无已完成作业");
for (const title of [
  "压机", "模具号", "作业人员", "工艺",
  "开始时间", "完成时间", "实际时长", "作业状态",
]) {
  expect(html).toContain(title);
}
expect(pageSource).not.toContain('label: "完工状态"');
```

新增详情静态渲染用例：构造 `status: "1"`、`completedAt: undefined`、`actualDurationHours: undefined` 的 `PressJobHistoryDetail`，断言 HTML 同时包含“作业状态”“进行中”“未完成”，且仍包含“完工参数”和“未记录”。复用现有 `renderHistoryDetail`，只给它增加可选 detail overrides（详情覆盖值），不要新建渲染框架。更新两个文件头 `@edited` 为执行时本地时间。

- [x] **Step 2: 运行历史页测试，取得 RED 证据**

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
pnpm test -- src/components/PressJobHistoryPage.test.tsx
```

Expected: FAIL，原因是 `status="1"` 仍为“状态未知”、旧“完工状态”与旧空态文案仍存在，且共享格式化函数尚未导出。

- [x] **Step 3: 实现最小共享格式化**

在现有状态格式化附近增加两个纯函数：

```ts
/**
 * @brief 把 ERP 作业状态映射为固定中文，未知值不得回显。
 * @author PopoY
 */
export function formatHistoryStatus(status: string | undefined): string {
  if (status === "1") return "进行中";
  return status === "3" ? "已完成" : "状态未知";
}

/**
 * @brief 进行中作业没有完成时间，不得显示为普通缺失记录。
 * @author PopoY
 */
export function formatHistoryCompletedAt(
  status: string | undefined,
  completedAt: string | undefined,
): string {
  return status === "1" && !completedAt?.trim()
    ? "未完成"
    : formatHistoryCell(completedAt);
}

/**
 * @brief 进行中作业不在前端推算实时时长，只显示固定状态。
 * @author PopoY
 */
export function formatHistoryDuration(
  status: string | undefined,
  duration: string | undefined,
): string {
  return status === "1" && !duration?.trim()
    ? "进行中"
    : duration?.trim()
      ? `${duration} 小时`
      : "未记录";
}
```

列表和详情都调用这两个函数；把状态列及详情标签改为“作业状态”。状态 Tag 颜色只在现有表达式上补齐 `processing`：

```tsx
<Tag
  color={value === "1" ? "processing" : value === "3" ? "success" : "warning"}
>
  {formatHistoryStatus(value)}
</Tag>
```

空态常量改为：

```ts
const EMPTY_HISTORY_TEXT = "当前查询范围暂无作业，请调整日期范围后查询。";
```

不要新增组件、hook（钩子）、定时器、状态筛选或 CSS。

- [x] **Step 4: 运行历史页测试，取得 GREEN 证据**

```bash
pnpm test -- src/components/PressJobHistoryPage.test.tsx
```

Expected: `PressJobHistoryPage.test.tsx` PASS，已完成、未知状态、参数对照、操作时间线和抽屉契约仍通过。

- [x] **Step 5: 检查 QT App 改动并提交**

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
git diff --check
git diff -- qt-app/frontend/src/components/PressJobHistoryPage.tsx \
  qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
git add qt-app/frontend/src/components/PressJobHistoryPage.tsx \
  qt-app/frontend/src/components/PressJobHistoryPage.test.tsx
git commit -m "feat: 历史作业展示进行中状态"
```

---

### Task 3: 双仓库回归与规格一致性

**Files:**

- Verify only: 上述 5 个业务/测试文件、OpenSpec change、Comet state。

**Interfaces:**

- Consumes: Task 1 和 Task 2 的已通过聚焦测试。
- Produces: 可审计的测试、构建、diff 和 strict validation（严格校验）证据。

- [x] **Step 1: 运行 ERP 相关模块验证**

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl sam-erp -am test
/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn -pl yr-admin -am \
  -Dtest=QtPressWorkingControllerTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
git diff --check
git status --short
```

Expected: Maven commands `BUILD SUCCESS`，`git diff --check` 无输出；用户的 SQL 文件仍未跟踪且未暂存。

- [x] **Step 2: 运行 QT App 完整验证**

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Expected: Vitest 全部 PASS；TypeScript 无诊断；Vite production build（生产构建）成功。

- [x] **Step 3: 运行交付检查**

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
git diff --check
openspec validate include-running-press-jobs-in-history --strict
comet state check include-running-press-jobs-in-history build
git status --short
git -C /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be status --short
```

Expected: diff check 无输出；OpenSpec strict validation（严格校验）与 Comet build entry check（构建入口检查）通过；两个仓库只出现本变更的预期文件和 ERP 原有未跟踪 SQL。最终 `comet guard ... build --apply` 由协调器在代码审查通过且任务全部勾选后执行，避免提前进入 Verify(验证)阶段。

- [x] **Step 4: 请求代码审查并处理结论**

Review 必须检查：状态集合仅为 `1/3`、跨日相交语义、稳定排序、详情设备隔离、未知状态不回显、进行中空字段不伪造、旧操作日志关联和脱敏无回归。若 Review 发现问题，先补失败测试再作最小修复，并重跑受影响验证。

- [x] **Step 5: 更新 OpenSpec task 状态**

只有对应命令取得真实证据后，才在 `openspec/changes/include-running-press-jobs-in-history/tasks.md` 勾选 1.1–3.2。不得因代码已写或单个聚焦测试通过而提前标记完整验证完成。

## Self-Review（自检）

- Spec coverage: 状态集合、跨日相交、完成态半开区间、稳定排序、进行中列表/详情文案、设备与父作业边界、全量回归均有对应步骤。
- Placeholder scan: 无 `TBD/TODO/implement later`；动态时间由执行步骤按 AGENTS.md 规则读取本地实际时间。
- Type consistency: 仅复用现有 `status/completedAt/actualDurationHours` 可选字符串；不修改 API、domain type（领域类型）或 Service/Mapper Java 签名。

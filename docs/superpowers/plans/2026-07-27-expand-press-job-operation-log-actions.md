---
change: expand-press-job-operation-log-actions
design-doc: docs/superpowers/specs/2026-07-27-expand-press-job-operation-log-actions-design.md
base-ref: f37590a4a1a70565b5c27a65bb9ab8d6ad3e80e4
---

# 扩展压机作业操作日志动作实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `test-driven-development` for each business task and `verification-before-completion` before claiming completion. Execute tasks in order; do not advance past a requested review checkpoint.

- Author: PopoY
- Created: 2026-07-27 17:01:09
- Backend base: `8c15f2b9b9cd3a229e5159d391bf282ddcdadc7c`

**Goal（目标）:** 让锁模时立即产生真实待开始父子作业 ID，并完整记录十一类压机真实操作；不新增 session（会话）、数据库结构或日志基础设施。

**Architecture（架构）:** ERP 复用现有 `press_job_info`、`press_mould_job_info`、`modbus_handle_log`、Mapper（映射器）和事务边界。锁模/解锁日志由对应 ERP Controller（控制器）在业务事务返回后记录；QT App 只通过现有严格六字段端点上报其实际执行的九类操作。父作业关联仅来自认证上下文、已校验会话或 Service（服务）返回的真实 ID。

**Tech Stack（技术栈）:** Java 8、Spring Boot、MyBatis、JUnit/Mockito；React 19、TypeScript 6、Vitest、pnpm 11；OpenSpec/Comet。

## Global Constraints（全局约束）

- 两仓范围：
  - QT App：`/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring`
  - ERP Backend：`/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be`
- 所有新增或修改代码注释保留文件头并包含 `@author PopoY`；说明使用中文或中英混合。
- 不新增 Liquibase ChangeSet、表、列、索引、session、Writer、队列、重试、补偿、指纹或来源字段。
- 不修改 Driver Service（驱动服务）协议，不传裸 `deviceId`、IP、port（端口）或敏感内容。
- 先运行聚焦 RED test（失败测试），确认失败原因与本任务一致；再写最小实现并运行 GREEN test（通过测试）。
- 每个任务只提交列出的文件；两个仓库分别提交，不跨仓伪造单个 commit（提交）。
- Java 命令统一使用：

```bash
export JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home
export MVN=/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn
```

- 前端命令在 `qt-app/frontend` 下使用当前 PATH 中的 `pnpm@11.9.0`。

---

## Task 1：锁模持久化待开始父子作业并修复二次锁模状态判断

- [x] Task 1：锁模持久化待开始父子作业并修复二次锁模状态判断

**OpenSpec coverage（覆盖）:** `1.1`、`1.2`；首次锁模、待开始继续锁模、加工中继续锁模、存量空 ID JSON。

**Files（文件）:**

- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java`

### Step 1：写失败测试

在现有 `PressMouldJobInfoServiceImplQtTest` fixture（测试夹具）内新增以下聚焦用例，沿用已有 Mapper mock（模拟）和 `ModbusEntity` 构造方式：

- `lockForQtPersistsPendingParentAndChildrenWithSameIds`: 断言父、子均为 `status=0`，子和 JSON 使用 Mapper 回填后的相同父 ID。
- `lockForQtReusesPendingParentWhenLockingAnotherMould`: 断言不再插父记录，只插一条 `status=0` 新子记录。
- `lockForQtKeepsRunningLockRuleForStatusOneParent`: 断言运行中新增子仍为 `status=1` 并设置 `startTime`。
- `lockForQtLazilyPersistsLegacyPendingJsonOnlyOnce`: 断言 `id=null,status=0` 的父和仍锁定子各插入一次，已带 ID 的子不重复插入。
- `lockForQtRollsBackBeforeJsonUpdateWhenChildInsertFails`: 模拟子插入失败，断言 `updateModbusJob` 未被调用并向上抛出原业务错误。

关键断言：

```java
verify(pressJobInfoMapper, times(1)).insertPressJobInfo(parentCaptor.capture());
assertEquals("0", parentCaptor.getValue().getStatus());
verify(pressMouldJobInfoMapper).insertPressMouldJobInfo(childCaptor.capture());
assertEquals(parentCaptor.getValue().getId(), childCaptor.getValue().getPressJobInfoId());
assertEquals("0", childCaptor.getValue().getStatus());
assertEquals(parentCaptor.getValue().getId(), updatedDevice.getPressJobInfo().getId());
```

### Step 2：运行 RED

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl sam-erp -am -Dtest=PressMouldJobInfoServiceImplQtTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: 新测试因首次锁模未调用父/子 Mapper、二次锁模被误判为加工中、Qt 方法仍返回 `void` 而失败；已有测试保持通过。

### Step 3：写最小实现

只把 QT 专用锁模方法和共享业务主体改为返回真实父 ID；非 QT 公共接口仍为 `void`。状态判断只看 `status`，ID 只表达是否已持久化：

```java
@Override
@Transactional(rollbackFor = Exception.class)
public Long lockPressMouldCodeForQt(
        List<PressMouldJobInfo> rows,
        String userName,
        String granteeHostId,
        Long deviceId) {
    ModbusEntity device = validateQtPressBinding(granteeHostId, deviceId);
    return lockPressMouldCodeWithBoundDevice(
            rows, userName, deviceId, granteeHostId, device, userName);
}
```

共享主体按下列顺序处理，继续复用现有 Mapper generated key（生成键）：

```java
PressJobInfo parent = modbusEntity.getPressJobInfo();
boolean running = parent != null && "1".equals(parent.getStatus());

if (parent == null) {
    parent = new PressJobInfo();
    parent.setDeviceId(deviceId);
    parent.setOperator(userName);
    parent.setOperationIp(operationIp);
    parent.setCreateBy(createBy);
    parent.setCreateTime(now);
    parent.setStatus("0");
    if (pressJobInfoMapper.insertPressJobInfo(parent) != 1) {
        throw new CustomException("待开始压机作业创建失败");
    }
    modbusEntity.setPressJobInfo(parent);
} else if ("0".equals(parent.getStatus()) && parent.getId() == null) {
    if (pressJobInfoMapper.insertPressJobInfo(parent) != 1) {
        throw new CustomException("待开始压机作业创建失败");
    }
}

for (PressMouldJobInfo existing : existingJobList) {
    if (!running && existing.getId() == null) {
        existing.setPressJobInfoId(parent.getId());
        existing.setStatus("0");
        if (pressMouldJobInfoMapper.insertPressMouldJobInfo(existing) != 1) {
            throw new CustomException("待开始模具作业创建失败");
        }
    }
}

for (PressMouldJobInfo added : pressMouldJobInfoList) {
    added.setPressJobInfoId(parent.getId());
    added.setStatus(running ? "1" : "0");
    if (running) added.setStartTime(now);
    if (pressMouldJobInfoMapper.insertPressMouldJobInfo(added) != 1) {
        throw new CustomException("模具作业创建失败");
    }
    existingJobList.add(added);
}

modbusMapper.updateModbusJob(modbusEntity);
return parent.getId();
```

直接保留当前类中的对象赋值和单行返回值判断，不新增 factory（工厂）、Writer 或通用持久化 helper。

### Step 4：运行 GREEN

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl sam-erp -am -Dtest=PressMouldJobInfoServiceImplQtTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: `PressMouldJobInfoServiceImplQtTest` 全部通过；首次锁模和存量懒持久化只各插入一次，待开始二次锁模不产生 `status=1` 子记录。

### Step 5：提交 ERP Task 1

```bash
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java
git commit -m "fix(press-job): 锁模时持久化待开始作业"
```

---

## Task 2：START 和待开始解锁复用同一批数据库记录

- [x] Task 2：START 和待开始解锁复用同一批数据库记录

**OpenSpec coverage（覆盖）:** `1.3`、`1.4`；START、待开始部分/全部解锁、加工中解锁不回归。

**Files（文件）:**

- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java`

### Step 1：写失败测试

新增用例并断言原 ID 不变：

- `startForQtUpdatesPersistedPendingParentAndChildrenWithoutInsert`: 断言父、子 `0 → 1`，原 ID 不变，父、子 insert 均未调用。
- `startForQtLazilyPersistsLegacyPendingJsonBeforeStarting`: 断言空 ID 存量父、子先各持久化一次，再以同一 ID 更新到 `1`。
- `pendingPartialUnlockMarksSelectedChildTerminated`: 断言选中子 `0 → 4`、父仍为 `0`、其他子仍在 JSON。
- `pendingFullUnlockTerminatesParentAndRemainingChildren`: 断言剩余子和父均更新为 `4`，设备父、子 JSON 清空。
- `runningUnlockStillRejectsLastMould`: 复用现有加工中 fixture，断言最后一套模具仍被拒绝且 Mapper 无更新。

核心 Mockito 断言：

```java
verify(pressJobInfoMapper, never()).insertPressJobInfo(any(PressJobInfo.class));
verify(pressJobInfoMapper).updatePressJobInfo(parentCaptor.capture());
assertEquals(originalParentId, parentCaptor.getValue().getId());
assertEquals("1", parentCaptor.getValue().getStatus());

verify(pressMouldJobInfoMapper).updatePressMouldJobInfo(childCaptor.capture());
assertEquals(originalChildId, childCaptor.getValue().getId());
assertEquals("4", childCaptor.getValue().getStatus());
```

### Step 2：运行 RED

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl sam-erp -am -Dtest=PressJobInfoServiceImplQtTest,PressMouldJobInfoServiceImplQtTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: START 仍尝试插入父/子或拒绝非空 ID；待开始解锁未更新数据库状态，新增断言失败。

### Step 3：写最小实现

`START` 校验改为“待开始状态 + 真实归属”，随后更新现有行；仅存量 `id=null,status=0` 分支先懒持久化：

```java
if (!"0".equals(currentJob.getStatus())) {
    throw new CustomException("只有待加工作业可以开始加工");
}
if (currentJob.getId() == null) {
    if (pressJobInfoMapper.insertPressJobInfo(currentJob) != 1) {
        throw new CustomException("待开始压机作业创建失败");
    }
    for (PressMouldJobInfo child : currentChildren) {
        child.setPressJobInfoId(currentJob.getId());
        if (child.getId() == null
                && pressMouldJobInfoMapper.insertPressMouldJobInfo(child) != 1) {
            throw new CustomException("待开始模具作业创建失败");
        }
    }
    lockedDevice.setPressJobInfo(currentJob);
    lockedDevice.setPressMouldJobInfoList(currentChildren);
    modbusMapper.updateModbusJob(lockedDevice);
}

currentJob.setStatus("1");
currentJob.setStartTime(now);
currentJob.setOperator(operatorId);
pressJobInfoMapper.updatePressJobInfo(currentJob);

for (PressMouldJobInfo child : currentChildren) {
    child.setStatus("1");
    child.setStartTime(now);
    child.setPressJobInfoId(currentJob.getId());
    pressMouldJobInfoMapper.updatePressMouldJobInfo(child);
}
```

若现有 `handleStartPressMouldJob` 是唯一子记录入口，直接把其中 `insertPressMouldJobInfo` 改为按真实 ID 调用 `updatePressMouldJobInfo`，不要并行维护第二套 START 路径。

待开始解锁先保存操作前父 ID，再更新数据库并同步 JSON：

```java
Long parentId = pressJobInfo.getId();
if ("0".equals(pressJobInfo.getStatus())) {
    for (PressMouldJobInfo selected : selectedJobs) {
        selected.setStatus("4");
        pressMouldJobInfoMapper.updatePressMouldJobInfo(selected);
        existingJobs.remove(selected);
    }
    if (existingJobs.isEmpty()) {
        pressJobInfo.setStatus("4");
        pressJobInfoMapper.updatePressJobInfo(pressJobInfo);
        modbusEntity.setPressJobInfo(null);
    }
    modbusEntity.setPressMouldJobInfoList(existingJobs);
    modbusMapper.updateModbusJob(modbusEntity);
    return parentId;
}
```

加工中分支保留现有“最后一套不可解锁”和 `status=3` 行为，只让共享主体返回捕获到的父 ID。

### Step 4：运行 GREEN

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl sam-erp -am -Dtest=PressJobInfoServiceImplQtTest,PressMouldJobInfoServiceImplQtTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: 两个测试类全部通过；START 前后父子 ID 相同，待开始部分/全部解锁分别正确写 `status=4`，加工中规则不变。

### Step 5：提交 ERP Task 2

```bash
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImplQtTest.java
git commit -m "fix(press-job): 复用待开始父子作业记录"
```

---

## Task 3：在现有 ERP 日志 Service 中固定十一类映射和可信关联

- [x] Task 3：在现有 ERP 日志 Service 中固定十一类映射和可信关联

**OpenSpec coverage（覆盖）:** `2.1`、`2.2`、`2.4`；十一类映射、QT 九类、设备当前作业 fallback、通用入口隔离。

**Files（文件）:**

- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java`
- Verify only: 既有通用 `POST /modbus/handleLog` 对客户端 `pressJobInfoId` 的清空逻辑；本任务不修改该通用入口。

### Step 1：写失败测试

在 `PressJobInfoServiceImplQtTest` 增加 table-driven（表驱动）十一类断言：

```java
private static final Object[][] OPERATION_CASES = {
    {"LOCK_MOLD", "锁定模具"},
    {"UNLOCK_MOLD", "解锁模具"},
    {"CONNECT", "建立通信"},
    {"MOVE_IN", "移入"},
    {"MOVE_OUT", "移出"},
    {"START", "开始加工"},
    {"PARAMETER_START", "开始参数记录"},
    {"PARAMETER_END", "完工参数记录"},
    {"LINE_IN", "入线"},
    {"LINE_OUT", "出线"},
    {"COMPLETE", "完成加工"}
};
```

覆盖以下测试：

- `mapsAllElevenOperationCodesToFixedChineseText`: 遍历 `OPERATION_CASES`，分别断言 `true/false` 对应固定名称、`{名称}成功/失败` 和字符串结果。
- `resolvesCurrentPersistedJobFromAuthenticatedDeviceJson`: 直连 ID和 START 映射都未命中时，断言使用认证设备 JSON 的真实父 ID。
- `rejectsCurrentJsonJobOwnedByAnotherDeviceOrHost`: 父作业归属不匹配时，断言 `pressJobInfoId=null`。
- `recordsDeviceOnlyLogWhenNoCurrentJobExists`: CONNECT 无当前父作业时仍插入一条设备级日志。
- `recordsMouldOperationOnlyWithTrustedParentId`: ERP 内部模具日志方法只接受通过设备和授权主机归属校验的父 ID。

运行既有通用 `/modbus/handleLog` 回归测试，确认客户端提交 `pressJobInfoId` 最终仍被清空；该行为不是本变更的修改范围。

### Step 2：运行 RED

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl sam-erp -am -Dtest=PressJobInfoServiceImplQtTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: `LOCK_MOLD`、`UNLOCK_MOLD`、`CONNECT`、`MOVE_IN`、`MOVE_OUT` 尚无固定映射，当前 JSON fallback 尚不存在，新测试失败。

### Step 3：写最小实现

在已有 Service 内新增一个私有映射方法；公共 QT 日志方法仍由 Controller 白名单限制为九类，内部模具日志方法只供 ERP Controller 调用：

```java
private String operationHandleType(String operationCode) {
    switch (operationCode) {
        case "LOCK_MOLD": return "锁定模具";
        case "UNLOCK_MOLD": return "解锁模具";
        case "CONNECT": return "建立通信";
        case "MOVE_IN": return "移入";
        case "MOVE_OUT": return "移出";
        case "START": return "开始加工";
        case "PARAMETER_START": return "开始参数记录";
        case "PARAMETER_END": return "完工参数记录";
        case "LINE_IN": return "入线";
        case "LINE_OUT": return "出线";
        case "COMPLETE": return "完成加工";
        default: throw new CustomException("operationCode 不受支持");
    }
}
```

两个可信入口共用现有 `ModbusHandleLog` 组装代码，不创建 Writer：

```java
String handleType = operationHandleType(operationCode);
handleLog.setHandleType(handleType);
handleLog.setHandleContent(handleType + (result ? "成功" : "失败"));
handleLog.setHandleResult(String.valueOf(result));
```

向 `IPressJobInfoService` 增加最窄的 ERP 内部方法：

```java
void recordPressMouldOperationForQt(
        QtPressJobContext context,
        String correlationId,
        Long pressJobInfoId,
        String operationCode,
        boolean result,
        String teamId,
        String operatorId);
```

`resolveOperationLogPressJobId` 保持现有直连 ID、START 映射顺序；两者都失败时读取认证设备当前 JSON 的非空真实 ID，并继续调用现有父作业归属校验：

```java
ModbusEntity currentDevice = modbusMapper.getPressJobByHandleIp2(
        context.getGranteeHostId(), context.getDeviceId());
if (pressJobInfoId == null && currentDevice != null
        && currentDevice.getPressJobInfo() != null) {
    pressJobInfoId = currentDevice.getPressJobInfo().getId();
}
return validateOperationLogParent(context, pressJobInfoId);
```

`validateOperationLogParent` 若提取，只包含当前已经重复使用的 `deviceId`、`operationIp/granteeHostId` 校验；不按模具、人员或时间猜测。

### Step 4：运行 GREEN

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl sam-erp -am -Dtest=PressJobInfoServiceImplQtTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: 十一类中文名称和成功/失败内容全部通过；可信当前 JSON 可关联，没有作业时保存 device-only log（仅设备日志），跨设备/主机不关联。

### Step 5：提交 ERP Task 3

```bash
git add sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java \
  sam-erp/src/test/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImplQtTest.java
git commit -m "feat(press-job): 扩展十一类操作日志映射"
```

---

## Task 4：由 ERP 锁模/解锁端点记录可信日志并扩展 QT 九类白名单

- [x] Task 4：由 ERP 锁模/解锁端点记录可信日志并扩展 QT 九类白名单

**OpenSpec coverage（覆盖）:** `2.1`、`2.3`、`2.4`；锁模/解锁成功关联、失败隔离、严格六字段、Boolean（布尔值）、未知字段和九类白名单。

**Files（文件）:**

- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java`

### Step 1：写失败测试

在现有 MockMvc/直接 Controller 测试结构中新增：

- `operationLogAcceptsNineQtOwnedCodes`: 遍历三类新增码和原六类，断言 Service 收到同一固定码。
- `operationLogRejectsLockAndUnlockCodes`: 分别提交两个模具码，断言固定中文错误且 Service 未调用。
- `operationLogRejectsNonBooleanAndUnknownFieldsBeforeService`: 延续现有 Boolean 与未知字段边界，断言认证解析和 Service 都未调用。
- `moldLockRecordsSuccessWithReturnedParentId`: 锁模 Service 返回父 ID 后，断言日志调用使用同一 ID和 `result=true`。
- `moldUnlockRecordsSuccessWithPreClearParentIdAndTeamId`: 全部解锁返回清理前父 ID，断言日志保留父 ID、班组和人员。
- `moldBusinessSuccessSurvivesLogFailure`: 日志 Service 抛错，Controller 仍返回主业务成功。
- `moldBusinessFailureSurvivesFailedBestEffortLog`: 主 Service 抛业务异常且日志也失败，断言最终仍抛原业务异常。

成功路径关键顺序断言：

```java
InOrder order = inOrder(pressMouldJobInfoService, pressJobInfoService);
order.verify(pressMouldJobInfoService).lockPressMouldCodeForQt(
        anyList(), eq(operatorId), eq(granteeHostId), eq(deviceId));
order.verify(pressJobInfoService).recordPressMouldOperationForQt(
        any(QtPressJobContext.class), eq(correlationId), eq(parentId),
        eq("LOCK_MOLD"), eq(true), eq(teamId), eq(operatorId));
```

### Step 2：运行 RED

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl yr-admin -am -Dtest=QtPressWorkingControllerTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: Controller 仍只接受六类操作，锁模/解锁方法不返回父 ID且没有事务后日志调用，解锁 DTO（数据传输对象）没有 `teamId`，新增测试失败。

### Step 3：写最小实现

QT 日志端点白名单只增加三类，不开放 `LOCK_MOLD` / `UNLOCK_MOLD`：

```java
private String requiredOperationCode(String operationCode) {
    String code = required(operationCode, "operationCode");
    switch (code) {
        case "CONNECT":
        case "MOVE_IN":
        case "MOVE_OUT":
        case "START":
        case "PARAMETER_START":
        case "PARAMETER_END":
        case "LINE_IN":
        case "LINE_OUT":
        case "COMPLETE":
            return code;
        default:
            throw new CustomException("operationCode 不受支持");
    }
}
```

Qt 专用锁模/解锁接口返回 `Long pressJobInfoId`；Controller 复用一次解析出的 `QtPressJobContext`，主 Service 返回后再尽力写日志：

```java
Long pressJobInfoId = pressMouldJobInfoService.lockPressMouldCodeForQt(
        rows, operatorId, context.getGranteeHostId(), context.getDeviceId());
recordMouldOperationBestEffort(
        context, correlationId, pressJobInfoId,
        "LOCK_MOLD", true, teamId, operatorId);
return AjaxResult.success();
```

业务失败时保留原异常，日志失败时只写固定中文生命周期摘要：

```java
try {
    Long parentId = pressMouldJobInfoService.unlockPressMouldCodeForQt(
            moldCodes, operatorId, context.getGranteeHostId(), context.getDeviceId());
    recordMouldOperationBestEffort(
            context, correlationId, parentId,
            "UNLOCK_MOLD", true, teamId, operatorId);
    return AjaxResult.success();
} catch (RuntimeException businessError) {
    recordMouldOperationBestEffort(
            context, correlationId, null,
            "UNLOCK_MOLD", false, teamId, operatorId);
    throw businessError;
}
```

`recordMouldOperationBestEffort` 必须是 Controller 内一个窄私有 helper（辅助方法），只捕获日志异常并调用现有 `logHistoryLifecycle`；不得记录异常对象、请求正文或连接信息。为解锁请求 DTO 增加并校验已有页面上下文的 `teamId`，其他未知字段防护保持不变。

### Step 4：运行 GREEN

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
$MVN -pl yr-admin -am -Dtest=QtPressWorkingControllerTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected（预期）: 九类 QT 操作通过；锁模/解锁不能从通用日志端点提交；成功日志关联 Service 返回的父 ID；日志异常不改变主业务成功或原业务错误。

### Step 5：提交 ERP Task 4

```bash
git add yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java \
  yr-admin/src/test/java/com/yr/web/controller/system/QtPressWorkingControllerTest.java \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java \
  sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java
git commit -m "feat(press-job): 记录可信模具操作日志"
```

---

## Task 5：扩展 QT App 九类操作码和解锁班组字段

- [x] Task 5：扩展 QT App 九类操作码和解锁班组字段

**OpenSpec coverage（覆盖）:** `3.1`、`3.3`；九类固定操作码、严格六字段日志请求、解锁 `teamId`、锁模/解锁不重复上报。

**Files（文件）:**

- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/domain/pressJob.ts`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/services/erpClient.ts`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobPage.test.tsx`

### Step 1：写失败测试

扩展现有客户端白名单测试：

- `sends CONNECT/MOVE_IN/MOVE_OUT through the strict six-field operation-log request`: 用 `it.each` 调用现有 `recordPressJobOperation`，逐项断言 header、URL 和 exact body keys（精确请求键）。
- `sends teamId in the mold unlock request without raw device fields`: 断言 body 只含 `operatorId`、`teamId`、`moldNos`、`correlationId`。
- `creates a mold unlock request from the current team and operator`: 断言 `createPressMoldUnlockRequest` 保留当前 `filters.teamId` 和 `filters.operatorId`。

继续断言 operation-log body 的键严格等于：

```ts
[
  "correlationId",
  "localJobSessionId",
  "operationCode",
  "result",
  "teamId",
  "operatorId",
]
```

### Step 2：运行 RED

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
pnpm exec vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx
```

Expected（预期）: TypeScript 尚不接受三个新码，解锁请求收窄会删除 `teamId`，新增测试失败。

### Step 3：写最小实现

只扩展现有类型和收窄函数：

```ts
export type PressJobOperationCode =
  | "CONNECT"
  | "MOVE_IN"
  | "MOVE_OUT"
  | "START"
  | "PARAMETER_START"
  | "PARAMETER_END"
  | "LINE_IN"
  | "LINE_OUT"
  | "COMPLETE";

export type PressMoldUnlockRequest = {
  operatorId: string;
  teamId: string;
  moldNos: string[];
  correlationId: string;
};
```

```ts
return {
  operatorId: filters.operatorId ?? "",
  teamId: filters.teamId ?? "",
  moldNos: uniqueMoldNos,
  correlationId,
};
```

`narrowPressMoldUnlockRequest` 同步保留 `teamId`。`recordPressJobOperation` 继续只构造六字段 body；不得向 QT 类型加入 `LOCK_MOLD` / `UNLOCK_MOLD`，页面锁模/解锁流程不得调用日志客户端。

### Step 4：运行 GREEN

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
pnpm exec vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx
```

Expected（预期）: 客户端三类新码通过类型和严格 body 断言；解锁只新增 `teamId`，无设备连接字段；锁模/解锁没有额外日志请求。

### Step 5：提交 QT Task 5

```bash
git add qt-app/frontend/src/domain/pressJob.ts \
  qt-app/frontend/src/services/erpClient.ts \
  qt-app/frontend/src/services/erpClient.test.ts \
  qt-app/frontend/src/components/PressJobPage.tsx \
  qt-app/frontend/src/components/PressJobPage.test.tsx
git commit -m "feat(qt): 扩展压机操作日志契约"
```

---

## Task 6：在真实 Driver 结果边界上报建立通信、移入、移出

- [x] Task 6：在真实 Driver 结果边界上报建立通信、移入、移出

**OpenSpec coverage（覆盖）:** `3.2`、`3.3`、`3.4`；真实结果、无前置日志、设备级关联、移出组合流程、日志失败隔离。

**Files（文件）:**

- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend/src/components/PressJobPage.test.tsx`

### Step 1：写失败测试

在现有 simple action（简单动作）和 move-out workflow（移出流程）测试附近增加：

- `reports connect/moveIn/moveOut from the actual Driver result`: 用 `it.each` 映射 `connect→CONNECT`、`moveIn→MOVE_IN`、`moveOut→MOVE_OUT`；每类分别覆盖成功结果码、失败结果码和 Driver 抛错，对应 `true/false/false`。
- `does not report a Driver operation when preflight blocks the command`: 断言 `executePressDeviceCommand` 和 `recordPressJobOperation` 都未调用。
- `does not downgrade a successful Driver log when refresh fails`: Driver 返回成功、刷新拒绝，断言恰好一条 `result=true` 的对应操作日志。
- `keeps PARAMETER_END, COMPLETE and MOVE_OUT as three logs for running move-out`: 断言三条 `operationCode` 的调用顺序和各自动作结果。

日志客户端拒绝测试继续断言主动作返回原 Driver 结果，诊断只含 `correlationId`、固定操作码和中文摘要。

### Step 2：运行 RED

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
pnpm exec vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）: 三个 Driver-only 动作当前没有调用 `reportPressWorkflowOperation`，新增日志断言失败；原六类和入/出线测试仍通过。

### Step 3：写最小实现

在现有 `executePressDriverOnlyDeviceAction` 内、真实 Driver 调用之后复用 `reportPressWorkflowOperation`。只需一个窄映射，禁止新建 reporter 类：

```ts
const operationCode =
  input.buttonKey === "connect"
    ? "CONNECT"
    : input.buttonKey === "moveIn"
      ? "MOVE_IN"
      : input.buttonKey === "moveOut"
        ? "MOVE_OUT"
        : undefined;
let operationReported = false;
```

成功/失败结果码确定后立即上报，刷新异常不能产生第二条相反日志：

```ts
const isSuccess = isPressDriverCommandSuccessful(resultCode);
if (operationCode) {
  reportPressWorkflowOperation(input, identity, operationCode, isSuccess);
  operationReported = true;
}

if (isSuccess) {
  await input.refreshSignalSnapshot?.();
}
```

```ts
} catch {
  if (operationCode && !operationReported) {
    reportPressWorkflowOperation(input, identity, operationCode, false);
  }
  // 保留现有固定中文反馈和诊断行为。
}
```

没有 `executePressDeviceCommand`、preflight（前置校验）失败、用户取消或 Driver precheck（驱动预检）失败时都在进入此真实调用边界前返回，因此不得上报。加工中移出继续复用同一个 `executePressDriverOnlyDeviceAction`，不要在 `executePressJobMoveOutWorkflow` 再加重复上报。

### Step 4：运行 GREEN

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
pnpm exec vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）: 三类动作按真实 Driver 结果各记录一次；前置失败/取消不记录；running move-out（加工中移出）保留 `PARAMETER_END`、`COMPLETE`、`MOVE_OUT` 三条日志；日志失败不改变主结果。

### Step 5：提交 QT Task 6

```bash
git add qt-app/frontend/src/components/PressJobPage.tsx \
  qt-app/frontend/src/components/PressJobPage.test.tsx
git commit -m "feat(qt): 上报三类驱动操作结果"
```

---

## Task 7：两仓集成验证、规格核对与收口

- [x] Task 7：两仓集成验证、规格核对与收口

**OpenSpec coverage（覆盖）:** `1.5`、`1.6`、`4.1`、`4.2`、`4.3`；全部需求、non-goals（非目标）和发布边界。

**2026-07-28 用户确认的收口口径：** 解锁 `moldNos` 保留既有 trim、去空、去重语义，不把 blank/duplicate 视为失败；Task 7 只新增 mixed legacy `START` 的父子 ID 状态矩阵修复，复用现有可信 child 行锁查询，不扩展 Controller、schema 或日志体系。

**Files（文件）:**

- Modify after evidence: `/Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/openspec/changes/expand-press-job-operation-log-actions/tasks.md`
- Verify only: all files changed since the two recorded base commits.

### Step 1：运行 ERP 聚焦测试

在集成命令前，先以 TDD 补齐 `PressJobInfoServiceImplQtTest`：覆盖父 ID 为空、部分子作业已有 ID 的直接 `START`，证明已有子作业来自行锁后的数据库实体、全部子作业绑定同一新父 ID、设备 JSON 使用可信字段；冲突父 ID、重复子 ID/模具号、跨设备/主机或非待开始状态必须在任何写入前失败。mixed Qt 路径还必须证明可信数据库 child 的 `craftCode` 与已校验缓存 child 一致时才可继续；cache/DB 工艺不一致时 legacy 与 Qt 都必须零业务写入，Qt 一致时仍沿用所选 `processId` 成功启动。

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
export JAVA_HOME=/Users/popoy/WorkSpace/DevTools/Java/zulu-8.0.492.jdk/Contents/Home
export MVN=/Users/popoy/WorkSpace/DevTools/Maven/bin/mvn
$MVN -pl sam-erp -am \
  -Dtest=PressMouldJobInfoServiceImplQtTest,PressJobInfoServiceImplQtTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
$MVN -pl yr-admin -am \
  -Dtest=QtPressWorkingControllerTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
$MVN -pl yr-admin -am -DskipTests compile
git diff --check
```

Expected（预期）: 三个聚焦测试类通过，`yr-admin` 及其依赖编译通过，`git diff --check` 无输出。

### Step 2：运行 QT 全量静态与构建验证

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring/qt-app/frontend
pnpm exec vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx
pnpm exec tsc --noEmit
pnpm run build
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
git diff --check
```

Expected（预期）: 聚焦测试、TypeScript 检查和 production build（生产构建）全部退出 0；`git diff --check` 无输出。

### Step 3：证明没有 schema（模式）和敏感边界扩张

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-erp/sam-erp-be
git diff --name-only 8c15f2b9b9cd3a229e5159d391bf282ddcdadc7c -- \
  '**/db/liquibase/**' '**/*changelog*' '**/*ChangeSet*'

cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
git diff --name-only f37590a4a1a70565b5c27a65bb9ab8d6ad3e80e4 -- \
  'driver-service/**'
rg -n "mould_operation_session_id|PressOperationLogWriter|REQUIRES_NEW|retry|queue|signature|signedLease|signalConfig" \
  qt-app/frontend/src/domain/pressJob.ts \
  qt-app/frontend/src/services/erpClient.ts \
  qt-app/frontend/src/components/PressJobPage.tsx
```

Expected（预期）: 两个 `git diff --name-only` 命令无输出；`rg` 不出现本变更新增的 session/Writer/事务/重试/敏感字段实现。若 `retry` 等词是文件原有连接恢复代码，必须用 `git diff` 确认本变更未新增相关机制，不能机械删除既有行为。

### Step 4：核对 OpenSpec 并更新任务证据

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
openspec validate expand-press-job-operation-log-actions --strict
```

逐项核对：

- 十一类固定映射与 QT 九类白名单；
- 首次锁模、待开始二次锁模、START、部分/全部待开始解锁状态迁移；
- 成功锁模/解锁关联真实父 ID，无父作业的 CONNECT 可保存设备级日志；
- 真实动作完成后才记录，移出组合不折叠；
- 无 session、Liquibase、Writer、队列、重试、补偿或猜测关联。

只有对应命令和测试已有通过证据时，才把 `tasks.md` 的相应 checkbox（复选框）改为 `[x]`；不得用计划本身替代验证证据。

### Step 5：按已选择的 review mode（审查模式）执行代码审查

审查必须至少检查：

- 事务回滚时父、子、设备 JSON 是否一致；
- 状态判断是否只看 `status`，ID 是否只用于持久化身份；
- 全部待开始解锁清理 JSON 后是否仍保留日志父 ID；
- QT 是否可能重复上报锁模/解锁或在 preflight/取消时上报；
- 日志失败是否覆盖主业务结果；
- 日志和诊断是否泄露连接、签名、租约、信号配置或第三方异常正文。

发现问题先补最小回归测试，再修复并重跑受影响命令。

### Step 6：提交 OpenSpec 任务状态

```bash
cd /Users/popoy/WorkSpace/Projects/SAM/sam-calendaring
git add openspec/changes/expand-press-job-operation-log-actions/tasks.md
git commit -m "docs(openspec): 更新压机操作日志验证状态"
```

Expected（预期）: 两仓工作树只包含已知的本变更文件；所有完成声明都有本轮命令输出或审查证据。

---

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: OpenSpec `1.1`–`4.3` 全部映射到 Task 1–7，没有未归属 requirement（需求）。
- Type consistency（类型一致）: ERP 内部支持十一类；QT 公共类型和端点只支持九类；`LOCK_MOLD` / `UNLOCK_MOLD` 只走 ERP 内部方法。
- State consistency（状态一致）: `status=0` 持久化待开始，`START` 原 ID 更新为 `1`，待开始解锁收口为 `4`；加工中既有规则保持。
- Trust boundary（可信边界）: 客户端不提交父作业 ID或设备连接字段；关联来自服务端认证上下文和真实数据库 ID。
- Minimality（最小性）: 只改现有 Service、Controller、类型、客户端和测试；没有新表、新接口实现类、新基础设施或 Driver 协议。
- Placeholder check（占位检查）: 计划不含 TBD、TODO、`implement later`、`fill in details` 或未决实现分支。

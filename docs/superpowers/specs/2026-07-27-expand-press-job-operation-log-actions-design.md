---
comet_change: expand-press-job-operation-log-actions
role: technical-design
canonical_spec: openspec
---

# 扩展压机作业操作日志动作技术设计

- Author: PopoY
- Created: 2026-07-27 16:44:04
- Editor: PopoY
- Edited: 2026-07-28 15:05:44
- Change: `expand-press-job-operation-log-actions`
- Canonical requirements: `openspec/changes/expand-press-job-operation-log-actions/specs/`

## 1. 结论

锁模不需要新增 session（会话）。首次锁模成功时，直接把当前已经构造的待开始 `PressJobInfo` 和 `PressMouldJobInfo` 持久化为 `status=0`，取得真实 `press_job_info_id` 后写回设备当前作业 JSON；`LOCK_MOLD` 直接使用该 ID。`START` 只把同一批记录从 `status=0` 更新为 `status=1`。

本变更固定记录十一类操作，其中 `LOCK_MOLD` / `UNLOCK_MOLD` 由 ERP 可信业务端点记录，其余九类由 QT App 通过现有严格六字段日志端点记录。全程复用既有表、状态、Mapper（映射器）和日志 Service（服务），不新增数据库 schema（模式）、Writer（写入器）、队列或回填机制。

## 2. 当前实现事实与根因

当前代码链路已经具备所需数据，只是落库时机不合适：

- `PressMouldJobInfoServiceImpl.lockPressMouldCodeWithBoundDevice` 在首次锁模时创建 `PressJobInfo(status=0)` 和模具子对象，但只调用 `ModbusEntity.setPressJobInfo/List` 写设备 JSON，没有插入数据库。
- `PressJobInfoServiceImpl` 在 `START` 时才插入父作业，随后由 `PressMouldJobInfoServiceImpl` 插入子作业。
- `START` 现有前置校验要求待开始父、子 ID 都为空，说明当前流程把“未落库”当成待开始特征。
- 锁模当前使用 `pressJobInfo != null` 判断是否加工中。待开始父对象同样非空，因此第二次锁模可能错误创建 `status=1` 且父 ID 为空的子记录，之后 `START` 再因状态/ID 不一致拒绝。
- `modbus_handle_log` 已有 `press_job_info_id`、`team_id` 和历史详情查询索引；没有必要再建一套模具 session 关联。

根因修复点因此是：让 `status` 表达业务状态，让 ID 表达持久化身份；不要继续让“ID 是否为空”兼任业务状态。

## 3. 作业状态模型

本设计只复用既有状态：

| 对象 | `status=0` | `status=1` | `status=3` | `status=4` |
| --- | --- | --- | --- | --- |
| `press_job_info` | 已锁模、待开始 | 加工中 | 既有完成语义 | 待开始作业已终止 |
| `press_mould_job_info` | 已锁模、待开始 | 加工中 | 既有完成/加工中解锁收口语义 | 开始前已解锁、未参与加工 |

状态迁移如下：

| 动作 | 父作业 | 子作业 | 设备当前 JSON |
| --- | --- | --- | --- |
| 首次锁模成功 | 插入 `0` | 插入选中模具为 `0` | 写入相同父、子 ID |
| 待开始继续锁模 | 复用 `0` | 只插入新增模具为 `0` | 追加新子 ID |
| `START` 成功 | 同 ID：`0 → 1` | 当前同 ID：`0 → 1` | 保持 ID，更新状态 |
| 待开始部分解锁 | 保持 `0` | 选中子：`0 → 4` | 移除选中子 |
| 待开始全部解锁 | `0 → 4` | 剩余子：`0 → 4` | 清空父、子 |
| 加工中锁模/解锁 | 复用 `1` | 沿用现有规则 | 沿用现有规则 |

历史列表当前只展示既有完成态模具记录，因此新产生的 `status=0` 和 `status=4` 不会伪装成已完成加工历史。

## 4. 锁模持久化流程

### 4.1 首次锁模

`lockPressMouldCodeForQt` 继续调用同一事务 Service，最小调整为：

1. 完成现有认证设备、授权主机、模具选择和业务校验。
2. 创建 `PressJobInfo(status=0)` 并通过现有 Mapper 插入，取得父 ID。
3. 为本次选中模具设置同一父 ID 和 `status=0`，通过现有 Mapper 插入。
4. 将已取得 ID 的父、子对象写回 `modbus_device` JSON。
5. 事务成功返回父 ID；任一步失败时全部回滚。

不增加临时表、session ID 或第二次关联查询。

### 4.2 待开始继续锁模

以当前父作业的 `status=0` 判断待开始状态，复用其真实 ID，仅插入新增子记录。不得继续使用 `pressJobInfo != null` 作为加工中判断。

### 4.3 存量空 ID JSON

部署时不扫描设备、不批量迁移。若下一次锁模或 `START` 发现当前可信 JSON 为 `id=null,status=0`：

1. 在当前业务事务内插入该父作业。
2. 给仍锁定且 ID 为空的子作业设置父 ID并插入。
3. 回写设备 JSON 后继续本次动作。

已拥有 ID 的记录不重复插入；该兼容分支在存量状态自然消失后不再触发。

## 5. START 与解锁流程

### 5.1 START

`START` 的待开始校验由“ID 必须为空”改为“父、子 ID 必须真实存在且状态为 `0`”。成功后更新原父、子记录为 `1`，不插入新行、不改变 ID。Qt 原本从返回作业映射构造 `press-job-id-{id}` 的逻辑继续有效，只是 ID 在锁模刷新后即可提前获得。

### 5.2 待开始解锁

- 部分解锁：先以服务端当前 JSON 定位选中子 ID，数据库更新为 `4`，再从 JSON 移除；父作业仍为 `0`。
- 全部解锁：先保留本次父 ID 供日志使用，把剩余子记录和父记录更新为 `4`，再清空设备当前 JSON。
- 后续再次锁模：已终止父记录不复用，创建新的待开始父记录。

### 5.3 加工中解锁

现有加工中解锁最后一套/全部模具限制和子作业 `status=3` 收口行为保持不变。本变更不借机重写该规则。

## 6. 十一类日志的所有权与关联

| 动作 | 记录方 | 父作业关联 |
| --- | --- | --- |
| `LOCK_MOLD` | ERP 锁模 Controller | Service 成功返回的真实父 ID |
| `UNLOCK_MOLD` | ERP 解锁 Controller | Service 在变更前捕获并返回的真实父 ID |
| `CONNECT` | QT App | 当前作业 ID；没有则设备级 |
| `MOVE_IN` | QT App | 当前作业 ID；没有则设备级 |
| `MOVE_OUT` | QT App | 当前作业 ID；没有则设备级 |
| `START` | QT App | `press-job-id-*` 或既有 START 映射 |
| `PARAMETER_START` | QT App | 同上 |
| `PARAMETER_END` | QT App | 同上 |
| `LINE_IN` | QT App | 同上 |
| `LINE_OUT` | QT App | 同上 |
| `COMPLETE` | QT App | 当前 JSON 清除后仍用 `press-job-id-*` 或 START 映射 |

ERP 日志 Service 内部复用一个私有固定映射处理十一类 `handle_type`、成功/失败中文内容和字符串 Boolean 结果。QT `/api/qt/press-working/operation-logs` 仍只接收六个字段，但白名单只扩展为 QT 所有的九类；客户端提交 `LOCK_MOLD` / `UNLOCK_MOLD` 必须拒绝，防止重复或伪造。

普通 QT 动作的父 ID 解析顺序为：

1. `press-job-id-*` 直连并校验设备、授权主机归属。
2. 既有 Qt `START` 会话映射并校验归属。
3. 认证设备当前 JSON 中非空的真实父 ID并校验归属。
4. 仍无父 ID时保存设备级日志。

第 3 步只解决“锁模已落库但 QT 当前 identity 尚未刷新”的短窗口，不按时间、模具号或操作员猜测。

## 7. 事务和失败边界

锁模/解锁业务 Service 保持现有 `@Transactional` 边界，并让 QT 专用方法返回 `Long pressJobInfoId`。Controller 在 Service 返回后调用现有日志 Service，因此日志写入不参与主业务事务：

- 主业务成功、日志失败：返回原成功结果，只记录脱敏中文摘要。
- 主业务失败：保留原异常；尽力记录失败日志。
- 首次锁模回滚后无稳定父 ID：失败日志允许设备级。
- 成功锁模/解锁：必须使用 Service 返回的真实父 ID。
- 主业务成功后的 current jobs（当前作业）刷新失败：日志仍为成功。

日志诊断只允许 `correlationId`、固定操作码、异常类型/hash（哈希）和中文摘要；不得写请求原文、设备连接信息、信号配置、凭据、令牌、租约、签名或第三方异常正文。

QT 的日志调用继续 fire-and-forget style（不阻塞主流程）：不重试、不排队、不补偿。ERP 锁模/解锁日志同步尝试一次并捕获异常；不新增 `REQUIRES_NEW` 或异步基础设施。

## 8. 最小代码范围

### ERP Backend（ERP 后端）

- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java`：锁模持久化、待开始/加工中状态判断、空 ID 懒兼容、待开始解锁状态迁移和返回父 ID。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressMouldJobInfoService.java`：仅调整 QT 锁模/解锁方法返回值；非 QT 接口不扩大。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressJobInfoServiceImpl.java`：`START` 更新同一记录、九类 QT 白名单、十一类私有映射和可信当前父 ID fallback。
- `sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/IPressJobInfoService.java`：为 ERP Controller 暴露最窄的模具动作日志方法，不创建新接口或实现类。
- `yr-admin/src/main/java/com/yr/web/controller/system/QtPressWorkingController.java`：锁模/解锁事务后日志调用、解锁 `teamId` 白名单传递和失败隔离。
- 对应既有 Service/Controller 测试文件：扩展聚焦场景，不新建测试框架。

现有 Mapper 方法足够时直接复用；只有确认缺少单条状态更新能力时才在现有 Mapper 中补最小 SQL。不得为本变更新建 Liquibase ChangeSet。

### QT App（Qt 应用）

- `qt-app/frontend/src/services/erpClient.ts`：客户端九类操作码、解锁请求携带已有 `teamId`，继续严格六字段日志请求。
- `qt-app/frontend/src/components/PressJobPage.tsx`：只在 `CONNECT`、`MOVE_IN`、`MOVE_OUT` 真实 Driver 结果边界调用现有 best-effort helper；锁模/解锁不重复上报。
- 对应既有测试文件：覆盖成功码、失败码、异常、preflight/取消不记录、刷新失败不改变模具动作结果和移出组合日志。

## 9. OpenSpec 增量归档模型

两个全新作业生命周期需求使用 `ADDED Requirements`；三个既有需求标题的扩展通过 `RENAMED Requirements` 声明 `FROM/TO`，其完整新内容在 `MODIFIED Requirements` 中引用新标题。其余既有需求继续使用 `MODIFIED Requirements`。归档必须按 OpenSpec 的 `RENAMED → MODIFIED → ADDED` 顺序合并，不直接编辑主规格，也不使用 `--skip-specs` 跳过规格同步。

## 10. 验证策略

### ERP 聚焦验证

- 首次锁模后父、所有选中子和设备 JSON 使用相同非空 ID。
- 待开始第二次锁模复用父 ID，新增子为 `0`，不产生父 ID 为空的 `1` 状态子记录。
- `START` 前后父、子 ID 不变且状态 `0 → 1`。
- 部分/全部待开始解锁分别正确落为 `4`；加工中既有规则不回归。
- 存量空 ID JSON 在下一次锁模和 `START` 各自路径只持久化一次。
- 十一类中文映射正确；QT 只接受九类；锁模/解锁成功关联、失败隔离、跨设备和跨授权主机拒绝。
- 日志异常不覆盖锁模、解锁成功或原业务异常。

### QT 聚焦验证

- `CONNECT` / `MOVE_IN` / `MOVE_OUT` 的成功码、失败码和抛错分别上报正确 Boolean。
- 面板、选择、取消、本地前置校验不产生操作日志。
- 锁模/解锁不从 QT 重复上报，current jobs 刷新失败不反向改写业务结果。
- 加工中移出仍分别保留 `PARAMETER_END`、`COMPLETE`、`MOVE_OUT`。
- 原六类日志、严格六字段 DTO（数据传输对象）和敏感信息边界不回归。

最后执行 ERP 聚焦测试和相关模块编译、QT 聚焦测试/typecheck/build、两仓 `git diff --check`、`openspec validate --strict` 及代码审查。没有实际执行证据时不得标记对应任务完成。

## 11. 发布与回滚

先部署 ERP，再部署 QT App。ERP 部署后旧 QT 客户端的锁模/解锁也会由服务端记录；三类 Driver 新日志在 QT 更新后开始产生。

本变更没有数据库迁移。代码回滚不会要求 schema rollback，但旧版本仍假设待开始 ID 为空，因此回滚前应先让设备上的 `status=0` 作业完成、终止或人工确认清理，避免旧代码重新处理已持久化待开始状态。

## 12. 明确不做

- 不新增 `mould_operation_session_id`、索引、Liquibase、日志回填或批量迁移。
- 不新增 `PressOperationLogWriter`、通用 Writer、队列、重试、补偿、请求指纹、来源列或权限体系。
- 不修改 Driver Service 协议、设备连接字段、信号配置或 QT 视觉体系。
- 不按模具号、设备时间窗口或操作员猜测父作业。
- 不重写加工中锁模/解锁、历史详情 legacy fallback 或既有 UI 行为。

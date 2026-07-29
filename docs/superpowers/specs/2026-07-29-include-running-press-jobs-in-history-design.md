---
comet_change: include-running-press-jobs-in-history
role: technical-design
canonical_spec: openspec
---

# 历史作业纳入进行中作业技术设计

## 1. 目标与边界

“历史作业”继续作为按稳定作业身份查看参数和操作记录的唯一入口，同时展示当前认证设备的 `status=1` 进行中模具作业和 `status=3` 已完成模具作业。变更只调整既有 ERP 查询条件和 QT App 展示语义，不新增接口、数据库结构、日志页面、状态筛选、轮询或实时计时器。

以下边界保持不变：

- ERP 仅从现有 QT bootstrap context（启动上下文）取得认证 `deviceId`，前端不得提交裸设备或网络字段。
- 列表行和详情继续使用真实 `press_mould_job_info.id` 作为 `mouldJobId`。
- 操作记录继续按认证 `deviceId + pressJobInfoId` 可靠关联，不按设备和时间窗口猜测父作业。
- 列表和详情仍只返回既有白名单字段，不扩大信号配置、凭据、租约或第三方异常边界。
- `status=0/2/4` 的待开始、暂停和终止作业不进入本次查询。

## 2. 当前数据流与根因

```text
PressJobHistoryPage
  → fetchPressJobHistory
  → GET /api/qt/press-working/history-jobs
  → QtPressWorkingController.historyJobs
  → PressMouldJobInfoServiceImpl.selectQtPressJobHistoryList
  → PressMouldJobInfoMapper.selectQtPressJobHistoryList
```

当前列表 Mapper 固定 `pmji.status = '3'` 并只按 `end_time` 查询，详情 Mapper 同样固定 `status='3'`。前端 `formatHistoryStatus` 也只识别 `3`，因此进行中作业既无法进入列表，也无法通过详情读取已有操作记录。

根因位于共享查询合同，而不是前端隐藏筛选。修复必须同时覆盖列表、详情和前端状态呈现；只改列表会使进行中行点击详情后返回 404。

## 3. ERP 查询设计

### 3.1 列表状态与日期条件

列表继续先限定认证设备，再使用两个互斥状态分支：

```sql
where pmji.device_id = #{deviceId}
  and (
    (pmji.status = '1' and pmji.start_time < #{endTime})
    or
    (pmji.status = '3'
      and pmji.end_time >= #{startTime}
      and pmji.end_time < #{endTime})
  )
```

业务语义：

- 已完成作业保留原行为，只按完成时间落入 `[startTime, endTime)` 返回。
- 进行中作业没有结束边界；只要 `start_time < endTime`，其开放作业区间就与查询区间相交。这样昨天启动、今天仍在运行的作业仍会出现在当天查询中。
- `status=1` 但 `start_time` 为空的异常记录不会匹配，不使用 `create_time` 或设备时间猜测业务起点。
- 模具号和人员条件继续追加在状态分支之后，不改变模糊/精确匹配语义。

### 3.2 稳定排序与分页

进行中作业作为操作记录入口，必须排在已完成作业之前：

```sql
order by case when pmji.status = '1' then 0 else 1 end,
         case when pmji.status = '1' then pmji.start_time else pmji.end_time end desc,
         pmji.id desc
```

PageHelper（分页组件）继续包裹同一 Mapper 查询。状态分组、对应业务时间和主键形成完整稳定顺序，避免同秒记录在翻页时漂移。

不采用 `UNION ALL`：两个分支的投影、筛选和后续维护会重复；当前单查询已经受认证设备和最多 31 个自然日边界约束。若后续真实 Query Plan（查询计划）证明 `OR` 分支成为瓶颈，再单独评估索引或 `UNION ALL`，本次不提前增加数据库变更。

### 3.3 详情边界

详情查询仅将状态条件调整为：

```sql
and pmji.status in ('1', '3')
```

`pmji.id = #{mouldJobId}` 与 `pmji.device_id = #{deviceId}` 必须保留。Service（服务）签名、Controller（控制器）路由、请求参数和响应字段不变。进行中详情可以缺少 `end_time`、`mould_working_time` 和完工参数，Controller 继续输出 `null` 或现有缺失状态，不能伪造完成数据。

## 4. QT App 展示设计

### 4.1 状态映射

`formatHistoryStatus` 使用固定白名单：

- `1` → `进行中`
- `3` → `已完成`
- 其他 → `状态未知`

Tag（标签）颜色使用现有 Ant Design 语义：进行中为 `processing`，已完成为 `success`，未知为 `warning`。不得直接回显原始状态值。

### 4.2 列表字段

八列结构和宽度保持不变，只调整语义：

- “完工状态”改为“作业状态”。
- `status=1` 且无 `completedAt` 时显示“未完成”。
- `status=1` 且无 `actualDurationHours` 时显示“进行中”，不在前端启动定时器计算实时耗时。
- 已完成作业继续使用原完成时间和一位小数小时文本。
- 空状态改为不限定完成态的通用中文文案。

完成时间和实际时长的状态感知格式化应由列表与详情共用，避免两处判断漂移；不新增抽象层或组件。

### 4.3 详情摘要与内容

详情摘要中的“完工状态”改为“作业状态”，复用同一状态及字段格式化。进行中作业的完工参数缺失继续由现有参数对照表显示“未记录”；开始参数、已有操作记录、客户端五条分页和 Timeline（时间轴）保持原样。

详情是请求时快照。若作业在 Drawer 打开后完成，操作员重新打开记录或重新查询即可取得新状态；本次不增加轮询和竞态管理。

## 5. 错误与安全边界

- 输入日期、分页和 `X-Correlation-Id` 的现有校验不变。
- 跨设备详情继续返回固定 404，不因进行中状态放宽设备条件。
- Mapper 或 Service 未知异常继续由 Controller 转换为固定中文错误，不输出第三方异常正文。
- 操作日志仍只展示按父作业可靠关联的白名单记录；无可靠记录时继续显示现有空状态。

## 6. TDD 与验证策略

### 6.1 ERP RED/GREEN

先修改现有 `PressMouldJobInfoHistoryMapperContractTest`，使其要求：

- 列表包含互斥的 `status=1` 和 `status=3` 分支。
- 进行中分支使用 `start_time < endTime`，不要求 `start_time >= startTime`，不伪造 `end_time`。
- 已完成分支保留原半开完成时间条件。
- 排序为进行中置顶、对应业务时间倒序和 `id DESC`。
- 详情允许 `status IN ('1','3')`，仍限定作业 ID 和设备 ID。

测试在生产 SQL 修改前必须因旧 `status='3'` 合同失败，再以最小 Mapper 修改转绿。

Controller 聚焦测试使用 `status=1`、空结束时间和空时长实体，验证列表与详情仍输出稳定 ID、进行中状态和 `null` 完工字段，并继续覆盖跨设备 404 与操作日志关联。

### 6.2 QT RED/GREEN

先修改 `PressJobHistoryPage.test.tsx`，锁定：

- `1/3/未知` 三种状态文本。
- 状态列和详情摘要使用“作业状态”。
- 进行中完成时间为“未完成”、时长为“进行中”。
- 通用空状态不再声称“暂无已完成作业”。
- 已完成行和现有详情参数/时间线行为不变。

测试在页面实现修改前必须因旧文本或旧状态映射失败，再以最小页面修改转绿。

### 6.3 回归验证

- ERP：Mapper/Controller 聚焦测试及相关 Maven 模块测试。
- QT App：历史页聚焦 Vitest、完整 Vitest、`tsc --noEmit` 和生产构建。
- 交付检查：`openspec validate --strict`、Comet guard 和两个仓库的 `git diff --check`。

不得在缺少实际命令输出时声称验证通过。

## 7. 发布与回滚

ERP 和 QT App 应同步发布，避免新前端文案先上线但后端仍不返回进行中作业。无需数据库迁移、数据回填或 Driver Service（驱动服务）变更。

回滚只需恢复 Mapper 完成态条件和前端完成态文案；本变更不写入新数据，也不改变既有作业或操作日志记录。

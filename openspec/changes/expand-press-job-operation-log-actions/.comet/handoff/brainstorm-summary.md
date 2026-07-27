# Brainstorm Summary

- Change: expand-press-job-operation-log-actions
- Date: 2026-07-27
- Author: PopoY

## Confirmed Technical Approach

- 固定支持十一类操作码，所有日志只在真实 ERP、Driver 或 workflow（工作流）操作已经提交并得到结果后记录。
- 首次锁模事务直接插入 `status=0` 的 `press_job_info` 和已选 `press_mould_job_info`，把真实 ID 写回设备当前作业 JSON；成功 `LOCK_MOLD` 直接关联该 `press_job_info_id`。
- 待开始阶段再次锁模复用同一父作业并插入新的 `status=0` 子记录；`START` 只把同一父、子记录从 `status=0` 更新为 `status=1`，不再重复插入。
- 待开始阶段部分解锁把选中子记录更新为 `status=4`；全部解锁把剩余子记录和父作业更新为 `status=4` 并清理设备当前 JSON。
- `CONNECT`、`MOVE_IN`、`MOVE_OUT` 在存在可信父作业时关联，否则记录为 device-only log；不得按模具号、操作员或时间窗口猜测归属。
- `LOCK_MOLD` / `UNLOCK_MOLD` 由 ERP 可信业务端点在主事务结束后记录；QT App 不提交父作业或模具关联字段，也不重复上报这两类日志。
- 旧设备 JSON 中 `id=null,status=0` 的待开始作业只在下一次锁模或 `START` 时按可信当前状态懒持久化一次，不做批量迁移。
- 复用 `PressJobInfoServiceImpl`、现有 Controller、Mapper 和 `reportPressJobOperationBestEffort`；不引入 mould operation session、索引、Liquibase、历史回填、`PressOperationLogWriter`、请求指纹、队列、重试或新事务日志框架。

## Key Trade-offs and Risks

- 父、子作业由 `START` 时首次插入改为锁模成功时插入，但只使用既有 `status=0` 待开始和 `status=4` 终止语义，不增加 schema 或新状态。
- 首次锁模事务失败时，待开始父、子插入随事务回滚，失败日志可以是设备级；成功锁模必须关联真实父作业 ID。
- 后端在主业务事务结束后同步尝试一次锁模/解锁日志写入；日志异常使用安全中文摘要记录，不改变主业务结果。
- 当前待开始对象非空会被误判为加工中；实现必须改用持久化状态判断，避免二次锁模生成父 ID 为空的运行中子记录。

## Testing Strategy

- ERP 生命周期：首次锁模、待开始二次锁模、`START` 同 ID 状态迁移、部分/全部待开始解锁、运行中行为不回归、存量空 ID JSON 懒持久化。
- ERP 日志：十一类固定映射、QT 九类白名单、锁模/解锁服务端可信关联、无稳定父 ID 的失败日志、当前设备父 ID fallback、跨设备/跨授权主机拒绝。
- QT App：`CONNECT` / `MOVE_IN` / `MOVE_OUT` 成功码、失败码和异常上报；preflight、取消和面板操作不记录；锁模/解锁无重复日志；移出自动完工保留三条独立动作。
- 集成：历史详情仍只按 `device_id + press_job_info_id` 查询；原六类日志、legacy fallback（旧日志降级）、敏感信息边界和现有 UI 不回归。

## Spec Patches

- 已删除 `mould_operation_session_id`、对应索引和 `START` 回填要求，改为首次锁模成功即插入 `status=0` 的真实父、子作业并直接关联日志。
- 已明确 `START` 更新既有待开始父、子作业而不是再次插入，待开始全部解锁使用既有 `status=4` 收口。
- 已明确 `LOCK_MOLD` / `UNLOCK_MOLD` 由 ERP 可信业务端点记录，QT App 只负责 Driver 类新增动作的 post-action（操作后）上报。
- 已明确首次锁模事务失败且父作业插入已回滚时允许设备级失败日志；成功锁模必须直接关联 `press_job_info_id`。

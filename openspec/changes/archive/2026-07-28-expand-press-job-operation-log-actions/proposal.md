## Why

现有 QT press working（压机作业）操作日志只记录 `START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE` 六类操作，锁定模具、解锁模具、建立通信、移入和移出五类真实业务动作没有进入 `modbus_handle_log`。同时，锁模阶段已存在完整的待开始作业和模具信息，却仅保存在设备 JSON 中、没有 `press_job_info_id`，使成功锁模无法直接进入对应作业历史，并造成待开始阶段再次锁模与 `START` 校验不一致。

## What Changes

- 固定支持十一类操作码：`LOCK_MOLD`、`UNLOCK_MOLD`、`CONNECT`、`MOVE_IN`、`MOVE_OUT`、`START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE`，继续由 ERP 映射固定中文操作名称、内容和 Boolean（布尔值）结果。
- 只在真实 ERP、Driver 或 workflow（工作流）操作已经提交且结果确定后记录成功或失败；打开面板、普通按钮点击、本地校验失败和用户取消不记录。
- 首次锁模成功时直接插入 `status=0` 的 `press_job_info` 和已选 `press_mould_job_info`，把真实 ID 同步写回设备当前作业 JSON，并让 `LOCK_MOLD` 直接关联该 `press_job_info_id`。
- 待开始阶段继续锁模时复用同一父作业并新增 `status=0` 子记录；`START` 只把同一父、子记录从 `status=0` 更新为 `status=1`，不再重复插入。
- 待开始阶段部分解锁时把选中子记录更新为 `status=4`；全部解锁时把剩余子记录和父作业更新为 `status=4` 并清理设备当前作业 JSON。
- `LOCK_MOLD` / `UNLOCK_MOLD` 由 ERP 可信业务端点在主事务结束后尽力记录；QT App 不提交模具关联字段。`CONNECT`、`MOVE_IN`、`MOVE_OUT` 继续通过现有严格六字段 operation-log endpoint（操作日志端点）上报。
- 有可信当前父作业时建立关联，没有时保存 device-only log（仅设备日志）；不按模具号、操作员或时间窗口猜测归属。
- 兼容存量设备 JSON 中 `id=null,status=0` 的待开始数据：在下一次锁模或 `START` 时按当前可信 JSON 懒持久化一次，不做批量迁移。
- 保留 best-effort（尽力而为）、敏感信息边界、历史详情投影和整组 legacy fallback（旧日志降级）语义。
- 不新增字段、索引、日志表、队列、重试、补偿、自由文本、通用 Writer（写入器）框架、请求指纹或新的视觉体系。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `press-job-operation-log`: 从六类操作扩展到九类真实业务动作及两类参数记录，并让锁模阶段直接复用现有父作业 ID 建立可信关联。

## Impact

- QT App（Qt 应用）：扩展客户端负责的 operation code（操作码）类型，在建立通信、移入和移出的真实 Driver 结果边界复用现有 best-effort 上报；锁模和解锁不新增客户端日志请求。
- SAM ERP：调整待开始作业的持久化时机和 `status` 状态迁移；在锁模/解锁业务端点记录可信日志；扩展固定中文映射和 QT endpoint 白名单。
- 数据库：不变更 schema（模式），只复用现有 `press_job_info`、`press_mould_job_info`、`modbus_handle_log` 及其已有字段和索引。
- 验证：更新 QT action flow（动作流程）、ERP Controller/Service/Mapper 聚焦测试、相关模块构建和 OpenSpec 严格校验；无需 Liquibase 变更。

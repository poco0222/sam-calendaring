## Why

旧版 QT 锁模会生成父作业 `id=null,status=0`、子作业 `id=null,pressJobInfoId=null,status=null` 的合法待开始 JSON；新版在懒持久化前要求父子状态完全一致，导致存量待开始作业无法继续锁模、开始加工或解锁。该回归会迫使现场在部署前清空工控机作业，必须在上线前恢复事务内兼容。

## What Changes

- 仅识别旧版真实生成的严格待开始形状，把无 ID、无父 ID 子作业的空状态规范化为 `status=0`，随后继续现有身份校验。
- 下一次锁模或 `START` 继续复用现有懒持久化路径；存量待开始作业直接解锁时，先在同一事务懒持久化父子记录，再按既有 `status=4` 规则收口。
- 跨设备、跨授权主机、重复模具、冲突 ID、非待开始状态和其他不完整形状继续失败关闭。
- 不要求工控机清场，不执行批量数据库迁移，不修改 QT App、Driver Service、HTTP contract 或数据库 schema。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `press-job-operation-log`：明确旧版空子状态待开始 JSON 在锁模、`START` 和解锁入口的事务内兼容及失败关闭边界。

## Impact

- SAM ERP：`PressMouldJobInfoServiceImpl`、`PressJobInfoServiceImpl` 及对应 Qt Service 测试。
- sam-calendaring：仅新增本 hotfix 的 OpenSpec 产物和验证证据。
- 无 API、协议、依赖、数据库结构、Driver Service 或 QT 前端产品代码变化。

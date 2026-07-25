# Brainstorm Summary

- Change: enhance-press-job-history-operation-log
- Date: 2026-07-25
- Author: PopoY
- Status: confirmed by user

## Confirmed Technical Approach

1. 继续以 SAM ERP 既有 `modbus_handle_log` 作为唯一压机业务操作日志；`qt_press_job_operation` 只承担 Idempotency（幂等）与 Replay（重放），Driver Service（驱动服务）的 `audit_log` / `diagnostic_log` 只承担技术审计与诊断。
2. 不直接复用会接收客户端 `deviceId` 并记录 IP 的旧 `/modbus/handle/log` 接口；复用其表、Domain（领域模型）和 Mapper（映射器），新增最薄的 Qt 安全适配入口，由认证上下文解析设备并只接收白名单操作码、结果、关联 ID、幂等键及人员/班组 ID。
3. 为每条锁模模具生成服务端 `mouldOperationSessionId`。锁模阶段先用会话键关联日志，开始加工落库后精确回填 `mouldJobId`；跨日拆分行继承同一会话，历史详情按目标模具会话查询，禁止按设备和时间窗口猜测。
4. ERP 使用现有班组和人员主数据校验 `teamId` / `operatorId`，写入操作时的班组名称、人员姓名历史快照；未授权 actor（操作者）不写业务日志，旧记录缺失快照时显示“未记录”。
5. ERP 原子动作在业务事务边界写日志；通过校验后发生的业务失败使用独立 `REQUIRES_NEW` 写固定中文失败摘要，日志写入失败不得覆盖原业务异常。建立/断开通信、移入/移出等 Driver 参与动作在真实命令结束边界上报；入线/出线只在 Driver 与 ERP 两侧结果汇总后写一条整体结果。
6. 历史详情存在可靠 `modbus_handle_log` 时只展示业务日志；完全不存在时整组降级到现有 Qt 成功生命周期投影，避免混合后重复。界面复用现有 Ant Design（组件库）、`dayjs` 和诊断日志 Timeline（时间线）样式完成单行筛选、搜索图标、1/3/7/30 个自然日快捷项、80% Drawer（抽屉）和 Boolean（布尔值）“是/否”。
7. 第一次锁模由 ERP 生成并持久化父作业 `pressOperationSessionId`，QT 将它作为待开始阶段的稳定 `localJobSessionId`。Driver 日志只能匹配当前父作业会话或通过 START 幂等记录解析到真实旧作业；无法证明归属时只写未归属设备日志，禁止落到请求到达时的新作业。
8. Driver 日志复用现有 canonical SHA-256 fingerprint（规范指纹）模式，指纹覆盖操作码、结果码、本地会话和 actor ID；同键同指纹才 replay，同键不同指纹拒绝。
9. Driver 安全适配先完成设备认证、允许列表、指纹及 replay 检查；同指纹 replay 保留首次 actor 快照并直接返回，只有首次执行才校验当前 actor 主数据。
10. 锁模按作业状态分支：待开始锁模先写模具会话并允许空子作业 ID，开始加工时回填；加工中追加锁模在新子作业插入后直接写真实父/子作业 ID 和模具会话。

## Alternatives Considered

- 方案 A（推荐）：扩展 `modbus_handle_log` + 稳定模具会话 + Qt 安全适配。改动集中在既有日志模型，能够记录真实成功/失败并精确归属具体模具。
- 方案 B：继续扩展 `qt_press_job_operation`，再组合 `sys_oper_log` 展示。改动表面较小，但会把幂等记录、通用接口审计和业务追溯混为一体，仍缺少锁模、Driver 失败及人员快照。
- 方案 C：新增 Qt 专用日志表，或按设备/模具/时间窗口关联旧日志。前者重复造业务日志体系，后者在重复锁模、多模具和跨日场景不可可靠归属，均不采用。

## Key Trade-offs and Risks

- `modbus_handle_log` 与 `press_mould_job_info` 需要 nullable（可空）增量字段及索引，但不迁移、不回填、不改写既有记录。
- 锁模先于子作业主键产生，需要稳定模具会话贯穿当前 JSON、开始加工回填和跨日拆分；这是避免兄弟模具日志串线的必要成本。
- 成功日志必须与业务事务一致，失败日志又必须独立提交；实现时需要明确 Spring 代理边界，并保证失败日志异常不改变原响应。
- Driver 重试可能重复或延迟到下一作业；安全适配入口在认证设备行锁内校验父作业会话，并按 `device_id + operation_code + idempotency_key` 查找后比较请求指纹，同键同指纹才 replay。
- 不保存原始参数、信号配置、寄存器、IP、端口、令牌、租约、签名或第三方异常正文；业务日志只保存固定中文摘要和必要标识。

## Testing Strategy

- ERP：覆盖 Liquibase（数据库迁移）、Mapper 兼容读写、父/模具会话生成与精确解析、待开始回填、加工中追加锁模真实 ID、跨日继承、首次 actor 校验、actor 失效后的同指纹 replay、事务回滚与失败补写、Driver 指纹冲突与延迟上报隔离、兄弟模具隔离及旧作业整组降级。
- QT frontend（前端）：覆盖请求白名单、真实 Driver 命令边界上报、入线/出线部分成功、单行筛选、四个自然日快捷项、80% 抽屉、Boolean 翻译和完整时间线字段。
- 联合验证：运行 SAM ERP Java 8 Maven（构建工具）相关测试/编译与 QT 定向测试、TypeScript（类型检查）及生产构建；只使用安全测试数据，不向真实 PLC（可编程逻辑控制器）发送探测命令。

## Spec Patches

- 补充父作业 `pressOperationSessionId` 的服务端生成、当前 JSON 持久化和 QT 稳定使用场景。
- 补充 Driver 日志作业切换延迟隔离，以及同幂等键同指纹 replay / 不同指纹拒绝场景。
- 补充同指纹 replay 先于当前 actor 主数据重新校验并保留首次快照的场景。
- 补充加工中追加锁模必须直接保存真实父/子作业 ID 的场景。

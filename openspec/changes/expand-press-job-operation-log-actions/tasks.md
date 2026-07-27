## 1. ERP 待开始作业生命周期

- [ ] 1.1 先补充聚焦测试：首次锁模插入 `status=0` 父、子记录并回写真实 ID；待开始二次锁模复用父 ID；存量 `id=null,status=0` JSON 只懒持久化一次
- [ ] 1.2 调整锁模 Service（服务），复用现有 Domain（领域对象）和 Mapper（映射器）在同一事务持久化待开始父、子记录，修正以对象非空误判加工中的逻辑
- [ ] 1.3 调整 `START`，将同一父作业和当前 `status=0` 子记录更新为 `status=1`，不得再次插入或改变父 ID
- [ ] 1.4 调整待开始解锁：部分解锁把选中子记录更新为 `status=4`；全部解锁把剩余子记录和父作业更新为 `status=4` 并清理设备 JSON

## 2. ERP 十一类操作日志契约

- [ ] 2.1 先补充聚焦测试：十一类固定中文映射、QT 九类白名单、Boolean（布尔值）校验、客户端关联字段防护和当前设备作业可信 fallback（降级）
- [ ] 2.2 复用现有日志 Service 的最小私有映射，扩展 `CONNECT` / `MOVE_IN` / `MOVE_OUT`，保持 QT operation-log endpoint（操作日志端点）严格六字段请求
- [ ] 2.3 让锁模/解锁 Service 返回可信父 ID，并由 ERP Controller（控制器）在主事务结束后尽力记录 `LOCK_MOLD` / `UNLOCK_MOLD`；成功必须关联，失败无稳定 ID 时允许设备级
- [ ] 2.4 保持通用 `/modbus/handleLog` 无法提交父作业关联，并覆盖跨设备、跨授权主机、未知字段和日志异常不覆盖主业务响应的回归测试

## 3. QT App 新增 Driver 动作上报

- [ ] 3.1 先扩展 `PressJobOperationCode`、ERP client（客户端）收窄和契约测试，使客户端负责的九类固定操作码继续使用同一六字段请求
- [ ] 3.2 为建立通信、移入和移出的真实 Driver result（驱动结果）接入现有 best-effort（尽力而为）上报，有父作业时关联、无父作业时允许设备级日志
- [ ] 3.3 保持锁模/解锁不从 QT 重复调用日志端点，为解锁请求传递页面已有 `teamId`，并证明面板、选择/取消、本地前置校验和 current jobs（当前作业）刷新不会产生错误日志
- [ ] 3.4 覆盖移出自动完成加工组合流程，分别保留 `PARAMETER_END`、`COMPLETE`、`MOVE_OUT`，并保持入线/出线整体结果与原六类日志行为不回归

## 4. 集成验证与审查

- [ ] 4.1 运行 QT App 聚焦测试、TypeScript（类型脚本）检查和 production build（生产构建），确认日志失败不改变主操作结果且不泄露敏感字段
- [ ] 4.2 使用项目 Java 8 和 Maven 工具链运行 ERP 聚焦测试、相关模块编译及 `git diff --check`，确认本变更没有 Liquibase 或 schema 改动
- [ ] 4.3 运行 `openspec validate --strict`，核对十一类操作、待开始状态迁移、设备级边界、历史投影和 non-goals（非目标），再完成规定的代码审查

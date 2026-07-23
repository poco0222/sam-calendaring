<!--
@file 2026-07-23-recover-snapshot-read-failures-verify.md - 信号快照读取失败恢复验证报告
@author PopoY
@created 2026-07-23 14:53:09
@purpose 记录连接失效恢复、错误文案、TDD、构建、测试、安全边界和 Comet 阶段门禁证据。
-->

# 信号快照读取失败恢复验证报告

## 验证范围

- Change（变更）：`recover-snapshot-read-failures`
- Commit（提交）：`c7f6613`
- Base ref（基准提交）：`ded772b5e971974c9f286834f7442948e1544659`
- Verify mode（验证模式）：`full`
- 模式说明：Comet Scale Assessment（规模评估）统计 5 个任务、0 个 Delta Spec（增量规格）能力和 16 个变更文件，自动选择完整验证；文件数包含 OpenSpec 产物与 Comet 运行状态快照。
- Review mode（审查模式）：`off`，按 Hotfix 配置不派发自动代码审查；设计一致性、测试、构建和安全边界仍在本报告中逐项检查。

## TDD 证据

1. RED：`ReadFailureForcesReconnectBeforeNextSnapshot` 首次执行失败；第二次快照期望 `OK`，实际仍为 `DEVICE_REJECTED`，证明读取异常后复用了已损坏连接。
2. RED：`errorMapper.test.ts` 的 `DEVICE_REJECTED` 用例期望“设备信号读取失败”，实际仍为“设备拒绝执行”，证明错误面板继续展示设备写入语义。
3. GREEN：最小修复后，后端新增回归测试 `1/1` 通过，前端错误映射测试 `15/15` 通过。

## Summary（汇总）

| Dimension（维度） | Status（状态） | Evidence（证据） |
| --- | --- | --- |
| Completeness（完整性） | PASS | `tasks.md`：5/5 完成；Hotfix 不修改现有验收能力，按流程无需 Delta Spec |
| Correctness（正确性） | PASS | 3 个快照异常出口失效连接复用标记；下一次调用进入既有重连逻辑；回归测试验证首次失败、第二次成功及连接次数为 2 |
| Coherence（一致性） | PASS | 4 项设计决策全部落实；未新增接口、依赖、数据库迁移、设备命令或日志体系 |

## 完整验证结果

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 1. Tasks（任务）全部完成 | PASS | `openspec instructions apply`：`complete=5 remaining=0` |
| 2. Design（设计）一致性 | PASS | `DriverSessionManager.cs:313-337` 在取消、设备超时和其他读取异常出口清空 `_connectedLeaseKey`；`DriverSessionManager.cs:519-542` 证明下一次调用因 key（键）不匹配执行既有 `ConnectAsync` |
| 3. Design Doc（技术设计文档） | N/A | Hotfix 未创建独立 `docs/superpowers/specs/` Design Doc，技术决策集中在本 change 的 `design.md`，无关联文档缺失 |
| 4. Scenario（场景）覆盖 | PASS | 本变更恢复既有快照行为且不修改验收场景，因此无 Delta Spec；`SignalSnapshotTests.cs:196-230` 覆盖读取失败后重连恢复，`errorMapper.test.ts:31-35` 覆盖错误文案 |
| 5. Proposal（提案）目标 | PASS | 失败后连接复用标记失效；首次真实失败仍保留 `DEVICE_REJECTED`/`DEVICE_TIMEOUT`；刷新快照不再展示写入回读确认文案 |
| 6. Drift（漂移）检查 | PASS | 无 Delta Spec、无独立 Design Doc，未发现提案、设计、任务、实现之间的矛盾 |
| 7. Build（构建） | PASS | `dotnet build driver-service/DriverService.sln --no-restore`：0 warning、0 error；`pnpm build`：1020 modules，exit code 0 |
| 8. Related tests（相关测试） | PASS | `dotnet test driver-service/DriverService.sln --no-restore`：177/177；`pnpm test`：20 个测试文件、298/298 |
| 9. Security（安全） | PASS | 未新增日志、网络请求、设备写入、裸设备标识或敏感信息；异常继续返回稳定结果码，未暴露第三方异常正文 |
| 10. Diff（差异）检查 | PASS | `git diff --check` exit code 0；产品改动限定为 Driver Session、回归测试和错误映射 |

## 设计决策映射

1. 失败出口失效 `_connectedLeaseKey`：实现位于 `DriverSessionManager.cs:313-337`。
2. 不改写有效 lease（租约）或持久化授权状态：产品 Diff（差异）只修改进程内连接复用标记。
3. `DEVICE_REJECTED` 使用快照读取场景文案：实现位于 `errorMapper.ts:60-63`；生产调用仍限定为 `ErrorPanel`。
4. 不修改 Press Job（压机作业）写入回读链路：该命令执行器、设备写入代码及其错误处理均不在变更范围。

## Issues（问题）

- CRITICAL（严重）：无。
- WARNING（警告）：无。
- SUGGESTION（建议）：无。

## 已知边界

- 本次按用户要求只修改代码侧，未重启 Driver Service、未部署 QT App，也未对真实 PLC（可编程逻辑控制器）发起请求。
- 修复消除了“首次读取异常后继续复用损坏连接”的代码根因；首次真实设备通信失败仍会如实返回失败，需要结合现场网络、PLC 状态和诊断日志继续判断外部原因。
- Vite 构建仍有单个 chunk（分块）大于 500 kB 的既有优化提示；本变更未修改依赖或构建配置，构建成功且该提示不影响本次修复结论。
- OpenSpec 通用严格校验要求至少一个 Delta Spec，但 Comet Hotfix 对不改变验收场景的修复明确允许无 Delta Spec；OpenSpec apply instructions 已确认 5/5 任务完成，Comet Build Guard 已通过。

## 最终结论

完整性、正确性和一致性检查全部通过，未发现 CRITICAL 或 IMPORTANT（重要）问题。代码侧 Hotfix 已满足进入最终归档确认的条件。

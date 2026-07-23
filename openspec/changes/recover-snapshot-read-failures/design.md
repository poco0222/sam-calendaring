<!--
@file design.md - 信号快照读取失败恢复修复设计
@author PopoY
@created 2026-07-23 14:41:15
@purpose 规定快照读取失败后的最小重连恢复和场景化错误文案方案。
-->

## Context

`DriverSessionManager` 使用 `_connectedLeaseKey` 记录当前进程已经连接的 lease（租约），并与持久化的 `Connected` 状态共同决定是否跳过 `ConnectAsync`。现场日志显示首次 Modbus read（Modbus 读取）发生 `IOException` 后，该标记没有失效；前端的两次有界重试继续复用已损坏连接，随即产生 `InvalidOperationException`。

QT App 启动面板是 `errorMapper` 的唯一生产调用方，其中 `DEVICE_REJECTED` 仅来自 Driver Session（驱动会话）的授权或快照链路；真正的设备写入和回读确认由 Press Job（压机作业）命令链单独处理。

## Goals / Non-Goals

**Goals:**

- 任何快照读取异常返回后，下一次快照请求必须重新连接设备。
- 继续保留现有三次有界前端重试和稳定 Driver resultCode（驱动结果码）。
- 启动错误面板准确说明信号读取失败，不暗示执行过设备写入。

**Non-Goals:**

- 不自动吞掉首次读取异常或把失败伪装为成功。
- 不改变 PLC（可编程逻辑控制器）点位、Unit ID、超时、重试次数或 `signalConfig`。
- 不修改设备写命令的回读确认和错误处理。
- 不增加连接健康检查接口、后台恢复器或新依赖。

## Decisions

1. 在 `GetSignalSnapshotAsync` 的失败出口清空 `_connectedLeaseKey`。下一次调用仍复用现有 `ConnectActiveLeaseCoreAsync`，其连接复用条件因 key（键）失配而重新执行 `ConnectAsync`。不新增 `IModbusAdapter.IsConnected`，避免扩大接口和所有适配器实现。
2. 不改写持久化 lease（租约）或授权状态。进程内连接复用标记才是跳过重连的直接条件；授权仍然有效，下一次请求只需重建 transport connection（传输连接）。
3. 将 `errorMapper` 中 `DEVICE_REJECTED` 的启动面板文案改为“设备信号读取失败”，正文引导检查设备通信与诊断日志。Press Job 的设备写命令不使用该映射，因此写入回读语义保持原样。
4. 后端使用一个先失败、重连后成功的 test adapter（测试适配器）锁定恢复行为；前端沿用现有 table-driven test（表驱动测试）锁定中文文案，不新增测试框架或抽象层。

## Risks / Trade-offs

- [无效点位或不受支持的设备响应会在每次重试时重新建连] → 重试仍严格限制为三次，不引入无限循环；最终继续返回原始稳定错误码。
- [重新连接不能修复现场 PLC 或点位配置问题] → 本变更只修复失败后的错误连接复用，首次真实失败继续写入安全诊断日志并展示失败。
- [连接复用标记未持久化为 Disconnected] → 该标记只在当前进程有效且是实际复用判定的必要条件；避免为 transport recovery（传输恢复）改写有效租约状态。

## Migration Plan

无需数据迁移。发布新的 Driver Service 与 QT App 前端资源后生效；回滚对应提交即可恢复原行为。

## Open Questions

无。

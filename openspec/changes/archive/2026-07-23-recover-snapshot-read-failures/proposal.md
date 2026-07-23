<!--
@file proposal.md - 信号快照读取失败恢复修复提案
@author PopoY
@created 2026-07-23 14:41:15
@purpose 记录 Modbus 快照读取异常后连接复用状态未失效及错误文案误导的根因与修复边界。
-->

## Why

Driver Service（驱动服务）完成设备连接后若 signal snapshot（信号快照）读取发生 `IOException`，仍会保留进程内连接复用标记；后续自动重试因此跳过重连，并立即以 `InvalidOperationException` 再次失败。

同时，QT App（Qt 应用）把快照读取返回的 `DEVICE_REJECTED` 显示成“设备回读确认失败或拒绝执行”，误导现场人员按设备写命令排查，实际刷新快照没有执行写入或回读确认。

## What Changes

- 信号快照读取失败时失效 Driver Session（驱动会话）的进程内连接复用标记，使下一次读取重新建立设备连接。
- 保留首次真实读取失败的稳定 `DEVICE_REJECTED`/`DEVICE_TIMEOUT` 契约，不掩盖现场设备或点位配置问题。
- 将启动面板中的 `DEVICE_REJECTED` 文案改为信号读取场景说明，不再描述设备写入回读确认。
- 增加最小回归测试，覆盖读取异常后的重新连接和快照错误文案。

## Capabilities

### New Capabilities

无。本变更不引入新能力。

### Modified Capabilities

无。本变更恢复既有快照刷新和错误展示行为，不改变现有 OpenSpec 验收场景。

## Impact

- 影响 `DriverSessionManager` 的失败恢复逻辑及其信号快照测试。
- 影响 QT App 启动面板的 Driver error mapping（驱动错误映射）及其测试。
- 不修改 Driver Service API（接口）、`signalConfig`（信号配置）、数据库 Schema（模式）、设备命令或依赖。

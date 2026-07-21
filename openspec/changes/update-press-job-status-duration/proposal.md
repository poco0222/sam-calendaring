<!--
@file proposal.md - 压机作业状态与预计时长更新提案
@author PopoY
@created 2026-07-21 16:38:00
@purpose 记录当前作业状态展示改用出线信号，以及预计时长编辑后持久化到 ERP 的行为边界。
-->

## Why

压机作业页面当前把 ERP 作业状态作为“当前状态”展示，不能准确表达设备是否已经出线；同时预计时长编辑仅更新本地草稿，页面刷新后会丢失修改。

本次变更让操作员直接看到由 `是否出线` PLC signal（PLC 信号）决定的入线状态，并复用 sam-erp 既有接口把有效的预计时长写回数据库。

## What Changes

- 使用 `是否出线` 信号的布尔值展示当前状态：`false` 显示绿色 `已入线` Tag（标签），`true` 显示红色 `已出线` Tag。
- 预计时长确认后，在当前作业具有 ERP 作业 ID 时调用 `PUT /modbus/pressjob`，仅提交 `{ id, expectedDuration }`。
- 保持预计时长为大于零的整数或最多一位小数；保存成功后提交本地值，保存失败时恢复原值并显示中文反馈。
- 当前作业没有 ERP 作业 ID 时不调用更新接口，继续保留开始加工时提交预计时长的既有路径。

## Capabilities

### New Capabilities

- `press-job-current-state-duration`: 规定压机作业页面由 `是否出线` 信号展示入线/出线状态，以及预计时长编辑后的 ERP 持久化和失败回滚行为。

### Modified Capabilities

无；当前主规格没有覆盖压机作业页面。

## Impact

- 调整 QT App（Qt 应用）压机作业页面、当前作业数据模型、ERP client（ERP 客户端）及对应前端测试。
- 复用现有 Driver Service（驱动服务）signal snapshot（信号快照）和 sam-erp `PUT /modbus/pressjob` 接口，不修改 Driver Service、ERP 后端、数据库 schema（数据库结构）或依赖。
- 不记录或额外传递完整 `signalConfig`、裸 `ip`、`port`、`deviceId`、凭据或会话令牌。

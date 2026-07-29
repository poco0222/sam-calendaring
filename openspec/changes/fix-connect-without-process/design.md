## Context

`validateSharedPressDeviceActionPreflight` 服务于多种设备动作，当前在动作分支之前统一校验 `processId`。`CONNECT` 的 `PressDeviceCommandRequest` 不包含工艺字段，操作日志请求也只有既有六个字段，因此该共享校验把加工前置条件错误扩散到了通信动作。

## Goals / Non-Goals

**Goals:**

- `CONNECT` 在未选择预选工艺时继续执行。
- 保留班组、人员、Driver lease（驱动租约）以及其他动作的既有校验。

**Non-Goals:**

- 不改变预选工艺控件、Driver/ERP 请求、操作日志或加工动作流程。

## Decisions

- 在共享前置校验中，仅对非 `CONNECT` 动作要求 `processId`。
- 不为 `CONNECT` 生成默认工艺，也不改变诊断字段；现有可选 `processId` 继续按实际筛选值记录。
- 复用既有 Vitest（测试框架）前置校验测试，增加一个直接覆盖该边界的断言。

## Risks / Trade-offs

- [放宽错误动作] → 条件只豁免 `CONNECT`；现有 `moveIn` 缺少工艺时返回原提示的断言继续保留。

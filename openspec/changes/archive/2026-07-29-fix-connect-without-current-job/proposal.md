## Why

ERP 在压机已绑定但没有当前作业时会返回仅含设备名称的占位行。QT App（Qt 应用）将该占位行误判为“存在作业但状态未知”，导致用户已选择班组、人员和预选工艺后仍无法建立通信。

## What Changes

- `CONNECT` 不再依赖当前作业状态；班组、人员、预选工艺和 Driver lease（驱动租约）校验保持不变。
- 其他设备动作仍对缺失作业状态执行 fail closed（失败关闭）。
- 增加“设备占位行无作业状态时允许建立通信”的回归测试。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- 无。现有 `press-job-operation-log` 已规定无父作业时不得拒绝 `CONNECT`，本变更仅修复实现偏差。

## Impact

- 影响 `qt-app/frontend/src/components/PressJobPage.tsx` 的共享设备动作前置校验及其测试。
- 不修改 ERP API（接口）、Driver Service（驱动服务）、日志协议、数据库或依赖。

## Reproduction

- 命令：`pnpm exec vitest run src/components/PressJobPage.test.tsx -t "validates shared press device action preflight before command calls"`。
- 输入：`CONNECT`、有效班组/人员/预选工艺、有效 Driver lease，以及仅含 `pressName` 且无 `status` 的当前作业占位行。
- 修复前结果：断言期望 `null`，实际返回“当前作业状态未确认，请刷新后重试。”，目标用例失败且 Driver 命令未调用。
- 期望结果：共享前置校验通过，继续建立通信流程。

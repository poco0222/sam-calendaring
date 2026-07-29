## Why

QT App（Qt 应用）的共享设备动作前置校验无条件要求 `processId`，导致建立通信也被“请先选择预选工艺”拦截。`CONNECT` 的 Driver command（驱动命令）和六字段操作日志均不使用预选工艺，因此该前置条件没有业务或接口依据。

## What Changes

- `CONNECT` 不再要求预选工艺，仍要求班组、人员和有效 Driver lease（驱动租约）。
- 其他设备动作继续要求预选工艺，既有作业状态和 Driver session（驱动会话）校验保持不变。
- 增加未选择预选工艺时允许建立通信的回归测试。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `press-job-operation-log`：明确 `CONNECT` 在班组、人员和 Driver lease 有效时不得因缺少 `processId` 被本地前置校验拒绝。

## Impact

- 修改 `qt-app/frontend/src/components/PressJobPage.tsx` 的共享设备动作前置校验及其测试。
- 不修改 Driver Service（驱动服务）、ERP API（接口）、操作日志六字段协议、数据库或依赖。

## Reproduction

- 命令：`pnpm exec vitest run src/components/PressJobPage.test.tsx -t "reports CONNECT without a process or current job using a generated local session"`。
- 输入：`CONNECT`、已选班组和人员、未选预选工艺、有效 Driver lease。
- 修复前结果：目标用例期望 Driver `PARTIAL_OK`，实际返回 `PREFLIGHT_FAILED`，Driver 命令未调用。
- 期望结果：共享前置校验通过并继续建立通信。

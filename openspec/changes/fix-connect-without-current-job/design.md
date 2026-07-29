## Context

`narrowPressJobCurrentJobs` 会保留 ERP 返回的设备占位行，因此“无当前作业”可能表现为 `currentJobRows` 非空但所有行都没有 `status`。共享前置校验当前仅在数组为空时为 `CONNECT` 放行，与既有无父作业通信契约不一致。

## Goals / Non-Goals

**Goals:**

- 让 `CONNECT` 在没有当前作业状态时继续执行。
- 保留其他动作、筛选条件和 Driver lease（驱动租约）的既有校验。

**Non-Goals:**

- 不改变 ERP 占位行映射、Driver 命令、日志关联或其他作业动作。

## Decisions

- 在所有简单设备动作共用的 `validateSharedPressDeviceActionPreflight` 中，让当前作业状态校验仅适用于非 `CONNECT` 动作。
- 不删除或重写 ERP 占位行；该数据仍用于显示压机名称，且改动会扩大到其他页面行为。
- 复用既有 Vitest（测试框架）测试文件，增加一个直接覆盖共享校验边界的回归用例，不引入新 helper（辅助函数）或依赖。

## Risks / Trade-offs

- [无作业状态时允许通信] → `CONNECT` 仍必须通过班组、人员、预选工艺和有效 Driver lease 校验；其他动作保持 fail closed（失败关闭）。

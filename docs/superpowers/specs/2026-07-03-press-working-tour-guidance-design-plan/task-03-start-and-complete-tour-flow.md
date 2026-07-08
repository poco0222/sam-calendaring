# Task 03: Start And Complete Tour Flow

> @file QT App 压机作业开始/完成加工 Tour flow（漫游流程）任务
> @author PopoY
> @created 2026-07-03
> @purpose 在 PressJobPage（压机作业页）中实现开始加工指导和完成加工指导的 steps（步骤）与 condition check（条件检查）。

## Goal（目标）

Implement two independent Tour guidance（漫游式指导） flows for start processing（开始加工） and complete processing（完成加工）. Each flow highlights existing controls, blocks Next（下一步） with Chinese warning（中文警告） when required conditions are missing, and never triggers real production actions（真实生产动作） automatically.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/8`。
- `2026-07-03`: Step 1 complete（完成），已新增 start/complete Tour guard（开始/完成漫游条件）RED tests（失败测试），当前进度 `1/8`。
- `2026-07-03`: Step 2 complete（完成），已新增 start/complete Tour steps（开始/完成漫游步骤）source contract（源码契约）RED test（失败测试），当前进度 `2/8`。
- `2026-07-03`: Step 3 complete（完成），运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx`，结果 `1 failed file, 3 failed / 61 passed / 64 tests`，失败原因符合预期：缺少 `validateStartPressJobTourStep`、`validateCompletePressJobTourStep` exports（导出）和 Tour step copy（漫游步骤文案），当前进度 `3/8`。
- `2026-07-03`: Step 4 complete（完成），已新增 `validateStartPressJobTourStep` start guidance guard（开始加工指导条件检查），当前进度 `4/8`。
- `2026-07-03`: Step 5 complete（完成），已新增 `validateCompletePressJobTourStep` complete guidance guard（完成加工指导条件检查），当前进度 `5/8`。
- `2026-07-03`: Step 6 complete（完成），已填充 start Tour steps（开始加工漫游步骤）并将 primary row（主作业行）预计时长输入框绑定到 `plannedDurationTourTargetRef`，当前进度 `6/8`。
- `2026-07-03`: Step 7 complete（完成），已填充 complete Tour steps（完成加工漫游步骤）并绑定 current job table（当前作业表）与 signal snapshot（实时信号）target refs（目标引用），当前进度 `7/8`。
- `2026-07-03`: Step 8 complete（完成），运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx`，结果 `1 passed file, 64 passed / 64 tests`，当前进度 `8/8`。
- `2026-07-03`: Review fix（复核修复）完成：新增 source contract（源码契约）RED test（失败测试）确认 Ant Design `Tour（漫游式引导）` 的 `Finish（完成）` 不能绕过最后一步 guard（条件检查）；实现 `finishPressJobTour` 后 focused test（聚焦测试）通过，当前进度仍为 `8/8`。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write RED guard tests（编写失败的条件检查测试）**

Modify imports in `PressJobPage.test.tsx` to include:

```tsx
validateCompletePressJobTourStep,
validateStartPressJobTourStep,
```

Add tests:

```tsx
/**
 * @brief 断言开始加工 guidance（指导）按班组、人员、工艺、锁模、预计时长顺序阻止推进。
 * @author PopoY
 */
it("guards start processing tour steps", () => {
  const filters = { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" };
  const pendingJob = {
    localJobSessionId: "job-01",
    moldNo: "MOLD-01",
    status: "0",
  };

  expect(validateStartPressJobTourStep({
    currentJobRows: [pendingJob],
    driverSession: createDriverSession("Connected"),
    expectedDuration: "1",
    filters: {},
    stepIndex: 0,
  })).toBe("请先确认本次作业班组。");
  expect(validateStartPressJobTourStep({
    currentJobRows: [pendingJob],
    driverSession: createDriverSession("Connected"),
    expectedDuration: "1",
    filters: { teamId: "team-01" },
    stepIndex: 1,
  })).toBe("请选择当前操作员。");
  expect(validateStartPressJobTourStep({
    currentJobRows: [pendingJob],
    driverSession: createDriverSession("Connected"),
    expectedDuration: "1",
    filters: { teamId: "team-01", operatorId: "op-01" },
    stepIndex: 2,
  })).toBe("请选择本次加工工艺。");
  expect(validateStartPressJobTourStep({
    currentJobRows: [{ ...pendingJob, moldNo: "" }],
    driverSession: createDriverSession("Connected"),
    expectedDuration: "1",
    filters,
    stepIndex: 3,
  })).toBe("开始加工前请确认模具已锁定。");
  expect(validateStartPressJobTourStep({
    currentJobRows: [pendingJob],
    driverSession: createDriverSession("Connected"),
    expectedDuration: "",
    filters,
    stepIndex: 4,
  })).toBe("请确认预计加工时长。");
  expect(validateStartPressJobTourStep({
    currentJobRows: [pendingJob],
    driverSession: createDriverSession("Connected"),
    expectedDuration: "1",
    filters,
    stepIndex: 5,
  })).toBeNull();
});

/**
 * @brief 断言完成加工 guidance（指导）按加工中作业和 Driver Session（驱动会话）状态阻止推进。
 * @author PopoY
 */
it("guards complete processing tour steps", () => {
  const filters = { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" };
  const runningJob = {
    localJobSessionId: "job-01",
    moldNo: "MOLD-01",
    status: "1",
  };

  expect(validateCompletePressJobTourStep({
    currentJobRows: [{ ...runningJob, status: "0" }],
    driverSession: createDriverSession("Connected"),
    filters,
    stepIndex: 0,
  })).toBe("请先确认当前作业处于加工中。");
  expect(validateCompletePressJobTourStep({
    currentJobRows: [runningJob],
    driverSession: createDriverSession("Disconnected"),
    filters,
    stepIndex: 1,
  })).toBe("Driver Session（驱动会话）未连接，请先恢复驱动连接。");
  expect(validateCompletePressJobTourStep({
    currentJobRows: [runningJob],
    driverSession: createDriverSession("Connected"),
    filters,
    stepIndex: 2,
  })).toBeNull();
});
```

- [x] **Step 2: Write RED source contract tests（编写失败的源码契约测试）**

Add:

```tsx
/**
 * @brief 断言开始/完成加工 guidance（指导）各自有独立 Tour steps（漫游步骤）。
 * @author PopoY
 */
it("defines independent start and complete tour step copy", () => {
  expect(pageSource).toContain("startTourSteps");
  expect(pageSource).toContain("completeTourSteps");
  expect(pageSource).toContain('title: "确认班组"');
  expect(pageSource).toContain('title: "确认人员"');
  expect(pageSource).toContain('title: "确认预选工艺"');
  expect(pageSource).toContain('title: "确认模具锁定"');
  expect(pageSource).toContain('title: "确认预计加工时长"');
  expect(pageSource).toContain('title: "执行开始加工"');
  expect(pageSource).toContain('title: "确认加工中作业"');
  expect(pageSource).toContain('title: "确认实时信号"');
  expect(pageSource).toContain('title: "执行完成加工"');
  expect(pageSource).not.toContain('openPressJobTour("start"); handleStartProcessing');
  expect(pageSource).not.toContain('openPressJobTour("complete"); handleCompleteProcessing');
});
```

Expected RED（预期失败）:

```text
FAIL because tour guard functions（漫游条件函数） and step copy（步骤文案） do not exist yet.
```

- [x] **Step 3: Run focused test and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） with missing guard exports and Tour steps.
```

- [x] **Step 4: Add start guidance guard（新增开始加工指导条件检查）**

Add below existing preflight helpers:

```tsx
/**
 * @brief 校验 start guidance（开始加工指导）当前步骤能否进入下一步。
 * @author PopoY
 * @param input 当前 Tour（漫游）步骤和页面业务状态。
 * @returns 中文 warning（警告）文案；允许推进时返回 null。
 */
export function validateStartPressJobTourStep(input: {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  expectedDuration: string;
  filters: PressJobFilterState;
  stepIndex: number;
}): string | null {
  if (input.stepIndex === 0 && !input.filters.teamId?.trim()) {
    return "请先确认本次作业班组。";
  }

  if (input.stepIndex === 1 && !input.filters.operatorId?.trim()) {
    return "请选择当前操作员。";
  }

  if (input.stepIndex === 2 && !input.filters.processId?.trim()) {
    return "请选择本次加工工艺。";
  }

  if (input.stepIndex === 3) {
    const currentJob = readPrimaryCurrentJob(input.currentJobRows);
    if (!isPendingPressJob(currentJob)) {
      return "当前没有可开始的作业。";
    }

    if (!hasLockedPressMold(input.currentJobRows)) {
      return "开始加工前请确认模具已锁定。";
    }
  }

  if (input.stepIndex === 4 && !isValidExpectedDuration(input.expectedDuration)) {
    return "请确认预计加工时长。";
  }

  if (input.stepIndex === 5) {
    return validateStartPressJobPreflight(input);
  }

  return null;
}
```

- [x] **Step 5: Add complete guidance guard（新增完成加工指导条件检查）**

Add:

```tsx
/**
 * @brief 校验 complete guidance（完成加工指导）当前步骤能否进入下一步。
 * @author PopoY
 * @param input 当前 Tour（漫游）步骤和页面业务状态。
 * @returns 中文 warning（警告）文案；允许推进时返回 null。
 */
export function validateCompletePressJobTourStep(input: {
  currentJobRows: PressJobCurrentJobRow[];
  driverSession?: PressJobPageDriverSession;
  filters: PressJobFilterState;
  stepIndex: number;
}): string | null {
  if (input.stepIndex === 0 && !isRunningPressJob(readPrimaryCurrentJob(input.currentJobRows))) {
    return "请先确认当前作业处于加工中。";
  }

  if (input.stepIndex === 1 && !isDriverSessionConnected(input.driverSession)) {
    return "Driver Session（驱动会话）未连接，请先恢复驱动连接。";
  }

  if (input.stepIndex === 2) {
    return validateCompletePressJobPreflight(input);
  }

  return null;
}
```

- [x] **Step 6: Fill start Tour steps（填充开始加工漫游步骤）**

Replace the placeholder `startTourSteps` with:

```tsx
const primaryCurrentJob = readPrimaryCurrentJob(currentJobRows);
const primaryPlannedDuration = primaryCurrentJob
  ? getPlannedDurationValue(primaryCurrentJob)
  : "";

const startTourSteps = useMemo<PressJobTourStep[]>(
  () => [
    {
      title: "确认班组",
      description: "请先确认本次作业班组。",
      target: createTourTarget(teamTourTargetRef),
      guard: () =>
        validateStartPressJobTourStep({
          currentJobRows,
          driverSession,
          expectedDuration: primaryPlannedDuration,
          filters,
          stepIndex: 0,
        }),
    },
    {
      title: "确认人员",
      description: "请选择当前操作员。",
      target: createTourTarget(operatorTourTargetRef),
      guard: () =>
        validateStartPressJobTourStep({
          currentJobRows,
          driverSession,
          expectedDuration: primaryPlannedDuration,
          filters,
          stepIndex: 1,
        }),
    },
    {
      title: "确认预选工艺",
      description: "请选择本次加工工艺。",
      target: createTourTarget(processTourTargetRef),
      guard: () =>
        validateStartPressJobTourStep({
          currentJobRows,
          driverSession,
          expectedDuration: primaryPlannedDuration,
          filters,
          stepIndex: 2,
        }),
    },
    {
      title: "确认模具锁定",
      description: "开始加工前请确认模具已锁定。",
      target: createTourTarget(currentJobTableTourTargetRef),
      guard: () =>
        validateStartPressJobTourStep({
          currentJobRows,
          driverSession,
          expectedDuration: primaryPlannedDuration,
          filters,
          stepIndex: 3,
        }),
    },
    {
      title: "确认预计加工时长",
      description: "请确认预计加工时长，系统会用于开始加工记录。",
      target: createTourTarget(plannedDurationTourTargetRef),
      guard: () =>
        validateStartPressJobTourStep({
          currentJobRows,
          driverSession,
          expectedDuration: primaryPlannedDuration,
          filters,
          stepIndex: 4,
        }),
    },
    {
      title: "执行开始加工",
      description: "确认无误后点击真实的开始加工按钮。",
      target: createTourTarget(startButtonTourTargetRef),
      guard: () =>
        validateStartPressJobTourStep({
          currentJobRows,
          driverSession,
          expectedDuration: primaryPlannedDuration,
          filters,
          stepIndex: 5,
        }),
    },
  ],
  [currentJobRows, driverSession, filters, primaryPlannedDuration],
);
```

Wrap the planned duration `Input（输入框）` with `ref={plannedDurationTourTargetRef}` in the current job column render. If there are multiple rows, target only the primary row（主作业行）.

- [x] **Step 7: Fill complete Tour steps（填充完成加工漫游步骤）**

Replace the placeholder `completeTourSteps` with:

```tsx
const completeTourSteps = useMemo<PressJobTourStep[]>(
  () => [
    {
      title: "确认加工中作业",
      description: "请确认当前作业处于加工中。",
      target: createTourTarget(currentJobTableTourTargetRef),
      guard: () =>
        validateCompletePressJobTourStep({
          currentJobRows,
          driverSession,
          filters,
          stepIndex: 0,
        }),
    },
    {
      title: "确认实时信号",
      description: "完成加工会读取最终信号并记录参数。",
      target: createTourTarget(signalSnapshotTourTargetRef),
      guard: () =>
        validateCompletePressJobTourStep({
          currentJobRows,
          driverSession,
          filters,
          stepIndex: 1,
        }),
    },
    {
      title: "执行完成加工",
      description: "确认后点击真实的完成加工按钮，系统会执行 ERP complete（ERP 完工）和 Driver cleanup（驱动清理）。",
      target: createTourTarget(completeButtonTourTargetRef),
      guard: () =>
        validateCompletePressJobTourStep({
          currentJobRows,
          driverSession,
          filters,
          stepIndex: 2,
        }),
    },
  ],
  [currentJobRows, driverSession, filters],
);
```

Add target wrappers:

```tsx
<div className="press-job-page__table-body" ref={currentJobTableTourTargetRef}>
```

and:

```tsx
<div className="press-job-page__signals-body" ref={signalSnapshotTourTargetRef}>
```

- [x] **Step 8: Run focused test and record result（运行聚焦测试并记录结果）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
PASS（通过） start/complete Tour flow（漫游流程） tests.
```

Update this task `Progress（进度）` with the exact command result.

## Acceptance Criteria（验收标准）

1. Start guidance（开始指导） has 6 steps and independent guards（独立条件检查）.
2. Complete guidance（完成指导） has 3 steps and independent guards（独立条件检查）.
3. Missing team/operator/process blocks Next（下一步） with Chinese warning（中文警告）.
4. Missing locked mold/current job/duration blocks start guidance（开始指导）.
5. Missing running job or disconnected Driver Session（驱动会话） blocks complete guidance（完成指导）.
6. Guidance steps never trigger `handleStartProcessing` or `handleCompleteProcessing`.

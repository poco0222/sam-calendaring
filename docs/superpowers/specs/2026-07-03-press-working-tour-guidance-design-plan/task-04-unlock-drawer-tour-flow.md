# Task 04: Unlock Drawer Tour Flow

> @file QT App 解锁抽屉 Tour flow（漫游流程）任务
> @author PopoY
> @created 2026-07-03
> @purpose 在 Unlock Drawer（解锁抽屉）内新增“解锁模具指导”入口、状态目标和解锁 guidance（指导）条件检查。

## Goal（目标）

Add the `解锁模具指导` launcher only inside the open Unlock Drawer（解锁抽屉） and guide operators through locked count（已锁定数量）, keep-one rule（保留一套规则）, selected count（已选数量）, table selection（表格选择）, and the real confirm button（真实确认按钮）.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/7`。
- `2026-07-03`: Step 1 in progress（进行中），开始编写 unlock guidance（解锁指导）RED tests（失败测试），当前进度 `0/7`。
- `2026-07-03`: Step 1 complete（完成），已新增 unlock guidance launcher/targets（解锁指导入口/目标）源码契约测试和 guard（条件检查）RED test（失败测试），当前进度 `1/7`。
- `2026-07-03`: Step 2 in progress（进行中），运行 focused test（聚焦测试）确认 RED（失败），当前进度 `1/7`。
- `2026-07-03`: Step 2 complete（完成），运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx`，结果 `1 failed file, 2 failed / 64 passed / 66 tests`，失败原因符合预期：缺少 unlock guidance launcher/targets（解锁指导入口/目标）和 `validateUnlockMoldTourStep`，当前进度 `2/7`。
- `2026-07-03`: Step 3 in progress（进行中），开始新增 unlock guidance guard（解锁指导条件检查），当前进度 `2/7`。
- `2026-07-03`: Step 3 complete（完成），已新增 `validateUnlockMoldTourStep` 并复用 `validatePressMoldUnlockSelection` keep-one rule（保留一套规则），当前进度 `3/7`。
- `2026-07-03`: Step 4 in progress（进行中），开始填充 unlock Tour steps（解锁漫游步骤），当前进度 `3/7`。
- `2026-07-03`: Step 4 complete（完成），已填充 5-step unlock Tour flow（五步解锁漫游流程）并绑定 guard（条件检查），当前进度 `4/7`。
- `2026-07-03`: Step 5 in progress（进行中），开始新增 Drawer launcher（抽屉内指导入口）和 tag targets（标签目标），当前进度 `4/7`。
- `2026-07-03`: Step 5 complete（完成），已在 Unlock Drawer（解锁抽屉）内新增“解锁模具指导”并绑定三个 tag targets（标签目标）和 status-row（状态行）样式，当前进度 `5/7`。
- `2026-07-03`: Step 6 in progress（进行中），开始绑定 table/confirm button targets（表格/确认按钮目标），当前进度 `5/7`。
- `2026-07-03`: Step 6 complete（完成），已绑定 unlock table target（解锁表格目标）和 confirm button target（确认按钮目标），并保持 `confirmMoldUnlock` 真实路径不变，当前进度 `6/7`。
- `2026-07-03`: Step 7 in progress（进行中），运行 focused test（聚焦测试）验证 unlock Tour flow（解锁漫游流程），当前进度 `6/7`。
- `2026-07-03`: Step 7 complete（完成），运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx`，结果 `1 passed file, 66 passed / 66 tests`，当前进度 `7/7`。
- `2026-07-03`: Regression check（回归检查）完成：运行 `pnpm test`，结果 `18 passed files / 203 passed tests`；运行 `pnpm build`，结果通过，保留既有 Vite chunk size warning（分包大小警告）。
- `2026-07-03`: Review fix（复核修复）完成：新增 source contract（源码契约）RED test（失败测试）确认关闭 Unlock Drawer（解锁抽屉）必须同步关闭 unlock `Tour（解锁漫游）`；`cancelMoldUnlockDrawer` 和提交成功路径已走同一关闭逻辑，focused test（聚焦测试）通过，当前进度仍为 `7/7`。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write RED unlock guidance tests（编写失败的解锁指导测试）**

Modify imports in `PressJobPage.test.tsx` to include:

```tsx
validateUnlockMoldTourStep,
```

Add tests:

```tsx
/**
 * @brief 断言 Unlock Drawer（解锁抽屉）内才出现解锁模具 guidance launcher（指导入口）。
 * @author PopoY
 */
it("defines unlock drawer guidance launcher and targets", () => {
  const unlockDrawerSource = extractSourceBetween(
    pageSource,
    'className="press-job-page__mold-unlock-drawer"',
    "</Drawer>",
  );

  expect(unlockDrawerSource).toContain("解锁模具指导");
  expect(unlockDrawerSource).toContain('onClick={() => openPressJobTour("unlock")}');
  expect(unlockDrawerSource).toContain("unlockLockedTagTourTargetRef");
  expect(unlockDrawerSource).toContain("unlockKeepTagTourTargetRef");
  expect(unlockDrawerSource).toContain("unlockSelectedTagTourTargetRef");
  expect(unlockDrawerSource).toContain("unlockTableTourTargetRef");
  expect(unlockDrawerSource).toContain("unlockConfirmButtonTourTargetRef");
  expect(pageCss).toContain(".press-job-page__mold-unlock-status-row");
  expect(pageCss).toContain("justify-content: space-between");
});

/**
 * @brief 断言解锁 guidance（指导）按 Drawer（抽屉）、数据、选择和保留规则阻止推进。
 * @author PopoY
 */
it("guards unlock mold tour steps", () => {
  const lockedMolds = [{ moldNo: "P123-MOLD-01" }, { moldNo: "P123-MOLD-02" }];

  expect(validateUnlockMoldTourStep({
    currentJobRows: [],
    isDrawerOpen: false,
    lockedMolds,
    operatorId: "op-01",
    selectedMoldNos: [],
    stepIndex: 0,
  })).toBe("请先打开解锁抽屉。");
  expect(validateUnlockMoldTourStep({
    currentJobRows: [],
    isDrawerOpen: true,
    lockedMolds: [],
    operatorId: "op-01",
    selectedMoldNos: [],
    stepIndex: 0,
  })).toBe("当前没有可解锁模具。");
  expect(validateUnlockMoldTourStep({
    currentJobRows: [],
    isDrawerOpen: true,
    lockedMolds,
    operatorId: "op-01",
    selectedMoldNos: [],
    stepIndex: 3,
  })).toBe("请先选择需要解锁的模具。");
  expect(validateUnlockMoldTourStep({
    currentJobRows: [{ localJobSessionId: "job-01", status: "1" }],
    isDrawerOpen: true,
    lockedMolds: [{ moldNo: "P123-MOLD-01" }],
    operatorId: "op-01",
    selectedMoldNos: ["P123-MOLD-01"],
    stepIndex: 4,
  })).toBe("当前正在加工不可全部解锁，如需全部解锁请使用完成加工功能。");
});
```

Expected RED（预期失败）:

```text
FAIL because unlock guidance（解锁指导） launcher, targets, and guard function do not exist yet.
```

- [x] **Step 2: Run focused test and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） with missing unlock guidance assertions.
```

- [x] **Step 3: Add unlock guidance guard（新增解锁指导条件检查）**

Add below existing unlock validation helpers:

```tsx
/**
 * @brief 校验 unlock guidance（解锁指导）当前步骤能否进入下一步。
 * @author PopoY
 * @param input 当前 Unlock Drawer（解锁抽屉）状态和选择状态。
 * @returns 中文 warning（警告）文案；允许推进时返回 null。
 */
export function validateUnlockMoldTourStep(input: {
  currentJobRows: PressJobCurrentJobRow[];
  isDrawerOpen: boolean;
  lockedMolds: Pick<PressLockedMoldRow, "moldNo">[];
  operatorId?: string;
  selectedMoldNos: string[];
  stepIndex: number;
}): string | null {
  if (!input.isDrawerOpen) {
    return "请先打开解锁抽屉。";
  }

  if (input.stepIndex === 0 && input.lockedMolds.length === 0) {
    return "当前没有可解锁模具。";
  }

  if (input.stepIndex === 3 && input.selectedMoldNos.length === 0) {
    return "请先选择需要解锁的模具。";
  }

  if (input.stepIndex === 4) {
    return validatePressMoldUnlockSelection({
      currentJobRows: input.currentJobRows,
      lockedMolds: input.lockedMolds,
      operatorId: input.operatorId,
      selectedMoldNos: input.selectedMoldNos,
    });
  }

  return null;
}
```

- [x] **Step 4: Fill unlock Tour steps（填充解锁漫游步骤）**

Replace the placeholder `unlockTourSteps`:

```tsx
const unlockTourSteps = useMemo<PressJobTourStep[]>(
  () => [
    {
      title: "查看已锁定数量",
      description: "这里显示当前可查看的已锁定模具数量。",
      target: createTourTarget(unlockLockedTagTourTargetRef),
      guard: () =>
        validateUnlockMoldTourStep({
          currentJobRows,
          isDrawerOpen: isMoldUnlockDrawerOpen,
          lockedMolds: lockedMoldRows,
          operatorId: filters.operatorId,
          selectedMoldNos: selectedUnlockMoldNos,
          stepIndex: 0,
        }),
    },
    {
      title: "确认保留规则",
      description: "加工中不能解锁最后一套，请先完成加工。",
      target: createTourTarget(unlockKeepTagTourTargetRef),
    },
    {
      title: "查看已选数量",
      description: "勾选模具后这里会同步显示已选数量。",
      target: createTourTarget(unlockSelectedTagTourTargetRef),
    },
    {
      title: "选择需解锁模具",
      description: "请选择需要解锁的模具。",
      target: createTourTarget(unlockTableTourTargetRef),
      guard: () =>
        validateUnlockMoldTourStep({
          currentJobRows,
          isDrawerOpen: isMoldUnlockDrawerOpen,
          lockedMolds: lockedMoldRows,
          operatorId: filters.operatorId,
          selectedMoldNos: selectedUnlockMoldNos,
          stepIndex: 3,
        }),
    },
    {
      title: "执行确认解锁",
      description: "确认选择后再点击真实的确认解锁按钮。",
      target: createTourTarget(unlockConfirmButtonTourTargetRef),
      guard: () =>
        validateUnlockMoldTourStep({
          currentJobRows,
          isDrawerOpen: isMoldUnlockDrawerOpen,
          lockedMolds: lockedMoldRows,
          operatorId: filters.operatorId,
          selectedMoldNos: selectedUnlockMoldNos,
          stepIndex: 4,
        }),
    },
  ],
  [
    currentJobRows,
    filters.operatorId,
    isMoldUnlockDrawerOpen,
    lockedMoldRows,
    selectedUnlockMoldNos,
  ],
);
```

- [x] **Step 5: Add Drawer launcher and tag targets（新增抽屉入口与标签目标）**

Replace the existing unlock status bar:

```tsx
<div className="press-job-page__mold-unlock-status-row">
  <div className="press-job-page__mold-unlock-status">
    <span ref={unlockLockedTagTourTargetRef}>
      <Tag>已锁定 {lockedMoldRows.length} 套</Tag>
    </span>
    <span ref={unlockKeepTagTourTargetRef}>
      <Tag>加工中需保留 1 套</Tag>
    </span>
    <span ref={unlockSelectedTagTourTargetRef}>
      <Tag color="processing">已选 {selectedUnlockMoldNos.length} 套</Tag>
    </span>
  </div>
  <Button onClick={() => openPressJobTour("unlock")}>解锁模具指导</Button>
</div>
```

Rules（规则）:

1. Button only appears inside Drawer（抽屉） markup.
2. It calls only `openPressJobTour("unlock")`.
3. It does not move the external “解锁模具” production entry（生产入口）.

- [x] **Step 6: Add table and confirm targets（新增表格与确认目标）**

Wrap the Drawer Table（抽屉表格） and confirm button target:

```tsx
<div ref={unlockTableTourTargetRef}>
  <Table<PressLockedMoldRow>
    className="press-job-page__mold-unlock-table"
    columns={lockedMoldColumns}
    dataSource={lockedMoldRows}
    loading={lockedMoldsLoading}
    locale={{ emptyText: "暂无已锁定模具" }}
    onRow={(row) => ({
      onClick: () => toggleUnlockMoldRow(row.moldNo),
    })}
    pagination={false}
    rowKey="moldNo"
    rowSelection={lockedMoldRowSelection}
    size="small"
  />
</div>

<div ref={unlockConfirmButtonTourTargetRef}>
  <Button
    danger
    disabled={selectedUnlockMoldNos.length === 0 || moldUnlockSubmitting}
    icon={createMoldUnlockConfirmIcon()}
    loading={moldUnlockSubmitting}
    onClick={() => confirmMoldUnlock(selectedUnlockMoldNos)}
    type="primary"
  >
    确认解锁 {selectedUnlockMoldNos.length} 套
  </Button>
</div>
```

Keep the existing `confirmMoldUnlock（确认解锁）` path unchanged.

Modify CSS:

```css
.press-job-page__mold-unlock-status-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.press-job-page__mold-unlock-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.press-job-page__mold-unlock-status-row .ant-btn {
  min-height: 32px;
  white-space: nowrap;
}
```

- [x] **Step 7: Run focused test and record result（运行聚焦测试并记录结果）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
PASS（通过） unlock Tour flow（解锁漫游流程） tests.
```

Update this task `Progress（进度）` with the exact command result.

## Acceptance Criteria（验收标准）

1. `解锁模具指导` appears only inside Unlock Drawer（解锁抽屉）.
2. Drawer status row（抽屉状态行） keeps tags（标签） left and launcher（启动按钮） right.
3. Empty locked molds（已锁定模具为空） blocks the flow.
4. Empty selection（未选择） blocks advancing to confirm.
5. Existing keep-one validation（保留一套校验） blocks unsafe unlock.
6. Guidance button（指导按钮） never submits unlock（解锁）.

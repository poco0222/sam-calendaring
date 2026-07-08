# Task 02: Top Filter Guidance Launchers

> @file QT App 压机作业顶部筛选区指导入口任务
> @author PopoY
> @created 2026-07-03
> @purpose 调整 PressJobPage（压机作业页）顶部筛选区布局，并新增开始加工/完成加工 guidance launcher（指导启动按钮）。

## Goal（目标）

Keep the top filter row（顶部筛选行） compact for the `1280x720 touch IPC（触控工控机）` baseline（基线）, shrink team/operator selectors（班组/人员选择器）, keep process selector（预选工艺选择器） readable, and add right-aligned guidance launcher（指导启动按钮） entries.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/7`。
- `2026-07-03`: Step 1 Completed（步骤一已完成）- 已新增 RED layout and launcher tests（失败优先布局与入口测试），当前进度 `1/7`。
- `2026-07-03`: Step 2 Completed（步骤二已完成）- `cd qt-app/frontend && ./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 结果为 FAIL（失败），`61 tests | 2 failed`，失败点为缺少 “开始加工指导/完成加工指导” 和 `.press-job-page__filter-row`，符合 RED（失败优先）预期；当前进度 `2/7`。
- `2026-07-03`: Step 3 Completed（步骤三已完成）- 顶部 filter Row（筛选行）已改为 fixed flex（固定弹性）布局，班组/人员 `220px`、预选工艺 `360px`，新增两个 guidance launcher（指导启动按钮）且仅调用 `openPressJobTour`；当前进度 `3/7`。
- `2026-07-03`: Step 4 Completed（步骤四已完成）- 已新增 compact top row CSS（紧凑顶部行样式），包含 nowrap（不换行）、右对齐和 `44px` touch target（触控目标）；当前进度 `4/7`。
- `2026-07-03`: Step 5 Completed（步骤五已完成）- 已为真实开始/完成 action button（动作按钮）增加 target wrapper（目标包装）并绑定 Tour target refs（漫游目标引用），未移动真实生产按钮；当前进度 `5/7`。
- `2026-07-03`: Step 6 Completed（步骤六已完成）- 已新增 `.press-job-page__action-button-target` wrapper CSS（目标包装样式），保持 inline-flex（行内弹性）布局；当前进度 `6/7`。
- `2026-07-03`: Step 7 Completed（步骤七已完成）- `cd qt-app/frontend && ./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 结果为 PASS（通过），`1 passed | 61 tests passed`；Task 02 Completed（任务二已完成），当前进度 `7/7`。
- `2026-07-03`: Regression Verified（回归已验证）- `cd qt-app/frontend && pnpm test` 结果为 PASS（通过），`18 passed | 198 tests passed`；`cd qt-app/frontend && pnpm build` 结果为 PASS（通过），Vite build（构建）成功，存在既有 chunk size warning（分块体积警告）。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write RED layout and launcher tests（编写失败的布局与入口测试）**

Modify `qt-app/frontend/src/components/PressJobPage.test.tsx`.

Add:

```tsx
/**
 * @brief 断言顶部筛选区新增 guidance launcher（指导启动入口）且不使用 Form inline（内联表单）。
 * @author PopoY
 */
it("renders top guidance launchers beside compact filters", () => {
  const html = renderPage();

  expect(html).toContain("开始加工指导");
  expect(html).toContain("完成加工指导");
  expect(html).toContain("press-job-page__guidance-launchers");
  expect(pageSource).toContain('onClick={() => openPressJobTour("start")}');
  expect(pageSource).toContain('onClick={() => openPressJobTour("complete")}');
  expect(pageSource).toContain('flex="0 0 220px"');
  expect(pageSource).toContain('flex="0 0 360px"');
  expect(pageSource).not.toContain("inline");
});

/**
 * @brief 断言顶部 guidance launcher（指导启动入口）在 1280x720 下右对齐且保持 touch target（触控目标）。
 * @author PopoY
 */
it("keeps top guidance launchers right aligned and touch ready", () => {
  expect(pageCss).toContain(".press-job-page__filter-row");
  expect(pageCss).toContain("flex-wrap: nowrap");
  expect(pageCss).toContain(".press-job-page__guidance-launchers");
  expect(pageCss).toContain("justify-content: flex-end");
  expect(pageCss).toContain(".press-job-page__guidance-launchers .ant-btn");
  expect(pageCss).toContain("min-height: 44px");
});
```

Expected RED（预期失败）:

```text
FAIL because top guidance launcher（指导启动入口） buttons and compact filter CSS（样式） do not exist yet.
```

- [x] **Step 2: Run focused test and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） with missing launcher/layout assertions.
```

- [x] **Step 3: Replace equal `Col span={8}` layout（替换均分列布局）**

Modify the filter `Row（行）` in `PressJobPage.tsx`:

```tsx
<Row className="press-job-page__filter-row" gutter={12} wrap={false}>
  <Col flex="0 0 220px">
    <div className="press-job-page__filter-target" ref={teamTourTargetRef}>
      {/*
        @author PopoY: 将当前班组 Form.Item（表单项）和 Select（选择器）
        原样移动到这个 target（目标）容器内。
      */}
    </div>
  </Col>
  <Col flex="0 0 220px">
    <div className="press-job-page__filter-target" ref={operatorTourTargetRef}>
      {/*
        @author PopoY: 将当前人员 Form.Item（表单项）和 Select（选择器）
        原样移动到这个 target（目标）容器内。
      */}
    </div>
  </Col>
  <Col flex="0 0 360px">
    <div className="press-job-page__filter-target" ref={processTourTargetRef}>
      {/*
        @author PopoY: 将当前预选工艺 Form.Item（表单项）和 Select（选择器）
        原样移动到这个 target（目标）容器内。
      */}
    </div>
  </Col>
  <Col className="press-job-page__guidance-launchers" flex="auto">
    <Button onClick={() => openPressJobTour("start")}>开始加工指导</Button>
    <Button onClick={() => openPressJobTour("complete")}>完成加工指导</Button>
  </Col>
</Row>
```

Rules（规则）:

1. Preserve all existing `Select（选择器）` props and handlers.
2. Do not use `Form inline（内联表单）`.
3. Do not move real “开始加工/完成加工” action buttons（真实动作按钮） out of the action row（操作区）.

- [x] **Step 4: Add compact top row CSS（新增紧凑顶部行样式）**

Modify `PressJobPage.css`:

```css
.press-job-page__filter-row {
  height: 100%;
  align-items: center;
  flex-wrap: nowrap;
}

.press-job-page__filter-target {
  min-width: 0;
}

.press-job-page__guidance-launchers {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.press-job-page__guidance-launchers .ant-btn {
  min-height: 44px;
  white-space: nowrap;
}
```

Keep existing `#0078c8 control blue（控制蓝）` variables and no decorative effects（装饰效果）.

- [x] **Step 5: Add real action button target wrappers（新增真实动作按钮目标包装）**

Modify the `actionButtons.map` rendering so the Tour（漫游式引导） can target real buttons:

```tsx
const actionButtonTourTargets: Partial<
  Record<PressDeviceActionButtonKey, PressJobTourTargetRef>
> = {
  startProcessing: startButtonTourTargetRef,
  completeProcessing: completeButtonTourTargetRef,
};
```

Wrap each mapped button:

```tsx
const actionButtonTargetRef = actionButtonTourTargets[actionButton.key];

return (
  <div
    className="press-job-page__action-button-target"
    key={actionButton.key}
    ref={actionButtonTargetRef as React.RefObject<HTMLDivElement>}
  >
    <Button
      autoInsertSpace={false}
      className={createActionButtonClassName(actionButton)}
      color={actionButton.color}
      disabled={isPressDeviceActionPending(actionButton.key)}
      icon={createActionIcon(actionButton.iconSymbol)}
      loading={isPressDeviceActionPending(actionButton.key)}
      onClick={actionButton.onClick}
      type={actionButton.type}
      variant={actionButton.variant}
    >
      {actionButton.label}
    </Button>
  </div>
);
```

If TypeScript（类型系统） complains about the cast, import `RefObject` as a type from React and use it explicitly.

- [x] **Step 6: Add target wrapper CSS（新增目标包装样式）**

Modify `PressJobPage.css`:

```css
.press-job-page__action-button-target {
  display: inline-flex;
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
PASS（通过） top launcher and layout tests.
```

Update this task `Progress（进度）` with the exact command result.

## Acceptance Criteria（验收标准）

1. “开始加工指导” and “完成加工指导” render in the top filter row（顶部筛选行）.
2. Guidance buttons（指导按钮） call only `openPressJobTour`, not production handlers（生产处理函数）.
3. Team/operator selectors（班组/人员选择器） use compact fixed width.
4. Process selector（预选工艺选择器） stays wider.
5. Buttons are right-aligned and touch-ready.
6. No new visual system（视觉体系）, gradients（渐变）, or nested cards（嵌套卡片） are added.

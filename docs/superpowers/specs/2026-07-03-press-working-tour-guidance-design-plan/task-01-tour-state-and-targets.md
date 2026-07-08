# Task 01: Tour State And Targets

> @file QT App 压机作业 Tour state（漫游状态）与 target refs（目标引用）任务
> @author PopoY
> @created 2026-07-03
> @purpose 在 PressJobPage（压机作业页）内接入 Ant Design Tour（漫游式引导）基础状态、关闭逻辑和目标引用。

## Goal（目标）

Introduce the smallest reusable foundation for three Tour guidance（漫游式指导） flows inside `PressJobPage（压机作业页）`: local state（本地状态）, target refs（目标引用）, guarded navigation（受条件保护的切换）, and one controlled `Tour（漫游式引导）` component.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/7`。
- `2026-07-03`: Step 1 已完成，新增 RED foundation contract test（失败的基础契约测试），当前进度 `1/7`。
- `2026-07-03`: Step 2 已完成，运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx`，结果 `FAIL（失败）`: `1 failed | 58 passed (59)`，失败原因是缺少 `Tour,` foundation assertion（基础断言），当前进度 `2/7`。
- `2026-07-03`: Step 3 已完成，`PressJobPage.tsx` 已导入 Ant Design `Tour（漫游式引导）` 和 `TourStepProps`，当前进度 `3/7`。
- `2026-07-03`: Step 4 已完成，新增 `PressJobTourKey/PressJobTourStep/PressJobTourTargetRef` 类型，当前进度 `4/7`。
- `2026-07-03`: Step 5 已完成，新增 `activeTour/currentTourStep` 本地状态、Tour target refs（目标引用）和 `createTourTarget` helper（辅助函数），当前进度 `5/7`。
- `2026-07-03`: Step 6 已完成，新增 placeholder steps（占位步骤）、受控 open/close/advance navigation（打开/关闭/推进导航）和单一 `<Tour />` 渲染，当前进度 `6/7`。
- `2026-07-03`: Step 7 已完成，运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx`，结果 `PASS（通过）`: `1 passed (1) / 59 passed (59)`；补充运行 `pnpm test`，结果 `18 passed (18) / 196 passed (196)`；补充运行 `pnpm build`，结果 `built in 580ms` 且仅保留既有 chunk size warning（分块体积提示），当前进度 `7/7`。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write RED foundation contract tests（编写失败的基础契约测试）**

Modify `qt-app/frontend/src/components/PressJobPage.test.tsx`.

Add this test inside `describe("PressJobPage", () => { ... })`:

```tsx
/**
 * @brief 断言 Tour guidance（漫游式指导）使用 Ant Design Tour（组件库漫游）和本地受控状态。
 * @author PopoY
 */
it("defines controlled tour state and target refs", () => {
  expect(pageSource).toContain("Tour,");
  expect(pageSource).toContain("TourStepProps");
  expect(pageSource).toContain('type PressJobTourKey = "start" | "complete" | "unlock"');
  expect(pageSource).toContain("const [activeTour, setActiveTour] = useState<PressJobTourKey | null>(null)");
  expect(pageSource).toContain("const [currentTourStep, setCurrentTourStep] = useState(0)");
  expect(pageSource).toContain("closePressJobTour");
  expect(pageSource).toContain("openPressJobTour");
  expect(pageSource).toContain("advancePressJobTour");
  expect(pageSource).toContain("teamTourTargetRef");
  expect(pageSource).toContain("unlockConfirmButtonTourTargetRef");
  expect(pageSource).toContain("<Tour");
  expect(pageSource).not.toContain("usePressJobTourStore");
  expect(pageSource).not.toContain("createTourOverlay");
});
```

Expected RED（预期失败）:

```text
FAIL because Tour（漫游式引导） state and refs do not exist yet.
```

- [x] **Step 2: Run focused test and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） with missing Tour foundation assertions.
```

- [x] **Step 3: Import Ant Design Tour（导入组件库漫游）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Change the Ant Design import:

```tsx
import {
  App as AntdApp,
  Button,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tour,
  Typography,
} from "antd";
```

Change the type import:

```tsx
import type { ButtonProps, TableProps, TourStepProps } from "antd";
```

- [x] **Step 4: Add Tour types（新增漫游类型）**

Add near the existing type aliases above `PressJobPage`:

```tsx
type PressJobTourKey = "start" | "complete" | "unlock";
type PressJobTourStepGuard = () => string | null;
type PressJobTourStep = TourStepProps & {
  guard?: PressJobTourStepGuard;
};

type PressJobTourTargetRef = {
  current: HTMLElement | null;
};
```

- [x] **Step 5: Add local state and target refs（新增本地状态与目标引用）**

Add inside `PressJobPage` after existing `moldNoKeypadPosition` state:

```tsx
const [activeTour, setActiveTour] = useState<PressJobTourKey | null>(null);
const [currentTourStep, setCurrentTourStep] = useState(0);
const teamTourTargetRef = useRef<HTMLDivElement | null>(null);
const operatorTourTargetRef = useRef<HTMLDivElement | null>(null);
const processTourTargetRef = useRef<HTMLDivElement | null>(null);
const currentJobTableTourTargetRef = useRef<HTMLDivElement | null>(null);
const plannedDurationTourTargetRef = useRef<HTMLDivElement | null>(null);
const startButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
const completeButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
const signalSnapshotTourTargetRef = useRef<HTMLDivElement | null>(null);
const unlockLockedTagTourTargetRef = useRef<HTMLSpanElement | null>(null);
const unlockKeepTagTourTargetRef = useRef<HTMLSpanElement | null>(null);
const unlockSelectedTagTourTargetRef = useRef<HTMLSpanElement | null>(null);
const unlockTableTourTargetRef = useRef<HTMLDivElement | null>(null);
const unlockConfirmButtonTourTargetRef = useRef<HTMLDivElement | null>(null);
```

Add helper（辅助函数） near other local helpers:

```tsx
/**
 * @brief 将 ref（引用）转换为 Ant Design Tour（漫游式引导）target（目标）。
 * @author PopoY
 * @param ref 需要高亮的 DOM ref（文档对象模型引用）。
 * @returns Tour（漫游式引导）可识别的 target getter（目标获取器）。
 */
const createTourTarget = (ref: PressJobTourTargetRef) => () => ref.current;
```

- [x] **Step 6: Add controlled Tour navigation（新增受控漫游切换）**

Add placeholder step arrays first; later tasks will fill them.

```tsx
const startTourSteps = useMemo<PressJobTourStep[]>(() => [], []);
const completeTourSteps = useMemo<PressJobTourStep[]>(() => [], []);
const unlockTourSteps = useMemo<PressJobTourStep[]>(() => [], []);
const activeTourSteps =
  activeTour === "start"
    ? startTourSteps
    : activeTour === "complete"
      ? completeTourSteps
      : activeTour === "unlock"
        ? unlockTourSteps
        : [];

/**
 * @brief 关闭 Tour guidance（漫游式指导）并重置步骤。
 * @author PopoY
 */
const closePressJobTour = () => {
  setActiveTour(null);
  setCurrentTourStep(0);
};

/**
 * @brief 打开指定 Tour guidance（漫游式指导），不触发真实生产动作。
 * @author PopoY
 * @param tourKey 需要打开的 guidance（指导）类型。
 */
const openPressJobTour = (tourKey: PressJobTourKey) => {
  if (tourKey === "unlock" && !isMoldUnlockDrawerOpen) {
    messageApi.warning("请先打开解锁抽屉。");
    return;
  }

  setActiveTour(tourKey);
  setCurrentTourStep(0);
};

/**
 * @brief 切换 Tour（漫游式引导）步骤，向前推进前先执行当前步骤 condition check（条件检查）。
 * @author PopoY
 * @param nextStep 目标步骤下标。
 */
const advancePressJobTour = (nextStep: number) => {
  if (nextStep > currentTourStep) {
    const warningMessage = activeTourSteps[currentTourStep]?.guard?.();

    if (warningMessage) {
      messageApi.warning(warningMessage);
      return;
    }
  }

  setCurrentTourStep(nextStep);
};
```

Render one controlled `Tour（漫游式引导）` near the end of the component:

```tsx
<Tour
  current={currentTourStep}
  onChange={advancePressJobTour}
  onClose={closePressJobTour}
  onFinish={closePressJobTour}
  open={activeTour !== null}
  steps={activeTourSteps}
/>
```

- [x] **Step 7: Run focused test and record result（运行聚焦测试并记录结果）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
PASS（通过） foundation tests.
```

Update this task `Progress（进度）` with the exact command result.

## Acceptance Criteria（验收标准）

1. `PressJobPage（压机作业页）` imports Ant Design `Tour（漫游式引导）`.
2. Component state（组件状态） contains only `activeTour/currentTourStep`; no store（状态仓库） is added.
3. Close and finish both clear active Tour（当前漫游） and reset step index（步骤下标）.
4. Next step（下一步） path checks the current step guard（条件检查） before advancing.
5. Guidance foundation（指导基础） does not call real production handlers（真实生产处理函数）.

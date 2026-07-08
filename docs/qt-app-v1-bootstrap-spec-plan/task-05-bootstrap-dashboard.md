# Task 05: Bootstrap Dashboard

> @file QT App V1 启动仪表盘任务
> @author PopoY
> @created 2026-06-25
> @purpose 用 Ant Design 展示启动链路状态、租约、驱动状态和信号快照。

## Goal（目标）

实现一个 `Bootstrap Dashboard（启动仪表盘）` 页面，只覆盖启动链路，不做完整业务 UI（用户界面）。页面必须按现场 `1280x720` fixed viewport（固定视口）克制布局，并保证用户可见文案为中文。

## Files（文件）

- Create: `qt-app/frontend/src/components/BootstrapDashboard.tsx`
- Create: `qt-app/frontend/src/components/StatusBlock.tsx`
- Create: `qt-app/frontend/src/components/ErrorPanel.tsx`
- Create: `qt-app/frontend/src/components/SignalSnapshotTable.tsx`
- Modify: `qt-app/frontend/src/App.tsx`
- Create: `qt-app/frontend/src/components/BootstrapDashboard.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write the failing render test**

```tsx
// PopoY: dashboard must show all bootstrap sections without landing-page chrome.
import { render, screen } from "@testing-library/react";
import { BootstrapDashboard } from "./BootstrapDashboard";

it("renders all bootstrap sections", () => {
  render(<BootstrapDashboard />);
  expect(screen.getByText("Station Context")).toBeInTheDocument();
});
```

- [x] **Step 2: Run the test and confirm it fails**

```bash
cd qt-app/frontend && pnpm test BootstrapDashboard
```

Expected: failure because `BootstrapDashboard` is missing.

- [x] **Step 3: Build the dashboard sections**

Sections required: `Station Context（工位上下文）`、`ERP Login Status（ERP 登录状态）`、`Lease Package Status（租约授权包状态）`、`Driver Status（驱动状态）`、`Signal Snapshot（信号快照）`、`Error Panel（错误面板）`.
All user-facing titles, summaries, placeholders, empty states, status tags, and error text must render in Chinese.

- [x] **Step 4: Add only bootstrap action buttons**

Buttons required: `Retry Login（重试登录）`、`Renew Authorization（重获授权）`、`Refresh Snapshot（刷新快照）`; visible button text must be Chinese.

- [x] **Step 5: Verify layout**

```bash
cd qt-app/frontend && pnpm test BootstrapDashboard
```

Expected: all sections and only the three required buttons render; `1280x720` viewport remains usable, and ERP failure text does not leak raw English runtime messages.

## Progress（进度）

- Status（状态）: Completed（已完成）
- Current Step（当前步骤）: Done
- Notes（备注）:
  - Step 1 completed: added `qt-app/frontend/src/components/BootstrapDashboard.test.tsx` as the first failing contract test for all required sections and only the three allowed action buttons.
  - Step 2 completed: `pnpm test BootstrapDashboard` was blocked by local `pnpm` build-script approval, so the equivalent direct command `./node_modules/.bin/vitest run src/components/BootstrapDashboard.test.tsx` was used to confirm the expected failure: missing `./BootstrapDashboard`.
  - Step 3 completed: implemented the six required dashboard sections in `BootstrapDashboard.tsx` plus supporting `StatusBlock.tsx`, `SignalSnapshotTable.tsx`, and `ErrorPanel.tsx`; `./node_modules/.bin/tsc --noEmit` passed, and the dashboard test now fails only because the Step 4 action buttons have not been added yet.
  - Step 4 completed: added only the three required action buttons in `BootstrapDashboard.tsx` and strengthened `BootstrapDashboard.test.tsx` to assert the three labels plus an exact button count of `3`; later wording changed from retry apply lease（重试应用租约）to renew authorization（重获授权）.
  - Step 5 completed: `./node_modules/.bin/vitest run src/components/BootstrapDashboard.test.tsx` passed and `./node_modules/.bin/tsc --noEmit` passed.
  - 2026-06-25 Field Device Follow-up: converted dashboard section titles, action buttons, status tags, empty states, and error panel text to Chinese; reduced page padding for the `1280x720` Qt WebEngine viewport; added regression coverage so ERP runtime failure text falls back to Chinese and does not show raw English messages.

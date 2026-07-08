# Task 05: Dashboard Config Panel

> @file BootstrapConfigPanel（启动配置面板）与 BootstrapDashboard（启动仪表盘）布局任务
> @author PopoY
> @created 2026-07-08
> @purpose 在启动仪表盘右侧新增配置面板，并按 `approve.press.config` 控制编辑和保存。

## Goal（目标）

Split the BootstrapDashboard（启动仪表盘） right column（右侧列） into ErrorPanel（错误面板） and BootstrapConfigPanel（启动配置面板）. The panel always displays six bootstrap config（启动配置） fields, allows editing only when ERP approval（ERP 审批开关） is true, and saves through native QSettings（原生 Qt 配置存储）.

## Status（状态）

- `Completed（已完成）`: Task 05（任务五）focused tests（聚焦测试）和 dashboard 1280x720 visual smoke（视觉冒烟）已通过；BootstrapConfigPanel（启动配置面板）readonly/editable（只读/可编辑）状态均在首屏可见。

## Progress（进度）

- `2026-07-08`: Step 1（步骤一）完成，已新增 BootstrapConfigPanel（启动配置面板）RED test（失败测试）。RED evidence（失败证据）: `./node_modules/.bin/vitest run src/components/BootstrapConfigPanel.test.tsx` 失败于 `Cannot find module './BootstrapConfigPanel'`，符合组件尚未实现的预期，当前进度 `1/7`。
- `2026-07-08`: Step 2（步骤二）完成，已新增 BootstrapDashboard（启动仪表盘）右侧布局 RED test（失败测试）。RED evidence（失败证据）: `./node_modules/.bin/vitest run src/components/BootstrapDashboard.test.tsx` 失败于缺少 `启动配置`，符合 dashboard（仪表盘）右侧尚未接入配置面板的预期，当前进度 `2/7`。
- `2026-07-08`: Step 3（步骤三）完成，已实现 BootstrapConfigPanel（启动配置面板）与保存 helper（辅助函数）。GREEN evidence（通过证据）: `./node_modules/.bin/vitest run src/components/BootstrapConfigPanel.test.tsx` 通过 `2/2`，当前进度 `3/7`。
- `2026-07-08`: Step 4（步骤四）完成，已新增 BootstrapConfigPanel.css（启动配置面板样式）并接入组件。Verification（验证）: `./node_modules/.bin/vitest run src/components/BootstrapConfigPanel.test.tsx` 通过 `2/2`，当前进度 `4/7`。
- `2026-07-08`: Step 5（步骤五）完成，BootstrapDashboard（启动仪表盘）右侧列已堆叠 ErrorPanel（错误面板）和 BootstrapConfigPanel（启动配置面板），并只传入六字段 config（配置）。Verification（验证）: `./node_modules/.bin/vitest run src/components/BootstrapDashboard.test.tsx` 通过 `14/14`，当前进度 `5/7`。
- `2026-07-08`: Step 6（步骤六）完成，BootstrapDashboard.css（启动仪表盘样式）已将右侧列改为 stacked flex column（堆叠弹性列），避免 ErrorPanel（错误面板）和 BootstrapConfigPanel（启动配置面板）重叠。Verification（验证）: `./node_modules/.bin/vitest run src/components/BootstrapDashboard.test.tsx` 通过 `14/14`，当前进度 `6/7`。
- `2026-07-08`: Step 7（步骤七）完成，focused verification（聚焦验证）通过：`./node_modules/.bin/vitest run src/components/BootstrapConfigPanel.test.tsx src/components/BootstrapDashboard.test.tsx` 通过 `17/17`；`git diff --check` 通过；逐项修复后 `./node_modules/.bin/tsc --noEmit` 通过，当前进度 `7/7`。
- `2026-07-08`: 逐项修复复核完成；`.bootstrap-dashboard__right-column` 改为两行 grid（网格）并为配置面板保留首屏高度，1280x720 visual smoke（视觉冒烟）结果：readonly（只读）`.bootstrap-config-panel` `y=432`、`visibleHeight=288`，editable（可编辑）`y=432`、`visibleHeight=284`，任务完成步数 `7/7`。

## Files（文件）

- Create: `qt-app/frontend/src/components/BootstrapConfigPanel.tsx`
- Create: `qt-app/frontend/src/components/BootstrapConfigPanel.css`
- Create: `qt-app/frontend/src/components/BootstrapConfigPanel.test.tsx`
- Modify: `qt-app/frontend/src/components/BootstrapDashboard.tsx`
- Modify: `qt-app/frontend/src/components/BootstrapDashboard.css`
- Modify: `qt-app/frontend/src/components/BootstrapDashboard.test.tsx`

## Acceptance（验收点）

1. Dashboard（仪表盘） right column（右侧列） renders both ErrorPanel（错误面板） and BootstrapConfigPanel（启动配置面板）.
2. BootstrapConfigPanel（启动配置面板） displays all six config fields（配置字段）.
3. `bootstrapConfigEditable=true` enables fields and save button（保存按钮）.
4. `bootstrapConfigEditable=false` disables fields and hides or disables save button（保存按钮）.
5. Save trims fields, calls `saveNativeConfig()`, then calls `bootstrapSession.retry()` through `onSaved`.
6. Save failure displays Chinese error summary（中文错误摘要）.
7. The panel never renders `sessionToken`, `signedLease`, `signature`, or `signalConfig`.

## Steps（步骤）

- [x] **Step 1: Write RED BootstrapConfigPanel tests（编写失败的配置面板测试）**

Create `qt-app/frontend/src/components/BootstrapConfigPanel.test.tsx`.

```tsx
/**
 * @file BootstrapConfigPanel.test.tsx - 验证启动配置面板。
 * @author PopoY
 * @created 2026-07-08
 * @brief 验证 dashboard config panel（仪表盘配置面板）的只读、编辑和保存行为。
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BootstrapConfigPanel } from "./BootstrapConfigPanel";

const sampleConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "press-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5096",
  configVersion: "v1",
};

it("renders readonly fields when approval is false", () => {
  render(
    <BootstrapConfigPanel
      config={sampleConfig}
      bootstrapConfigEditable={false}
      bootstrapConfigApprovalState="readonly"
      onSaved={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("工位账号 ID")).toBeDisabled();
  expect(screen.queryByText("保存配置")).not.toBeInTheDocument();
  expect(screen.getByText("配置修改未授权或开关不可用")).toBeInTheDocument();
});

it("saves trimmed fields when approval is true", async () => {
  const saveNativeConfig = vi.fn().mockResolvedValue(undefined);
  const onSaved = vi.fn().mockResolvedValue(undefined);

  render(
    <BootstrapConfigPanel
      config={{ ...sampleConfig, stationAccountId: " station-a " }}
      bootstrapConfigEditable={true}
      bootstrapConfigApprovalState="editable"
      onSaved={onSaved}
      saveNativeConfig={saveNativeConfig}
    />,
  );

  fireEvent.click(screen.getByText("保存配置"));

  await waitFor(() => expect(saveNativeConfig).toHaveBeenCalled());
  expect(saveNativeConfig).toHaveBeenCalledWith({
    ...sampleConfig,
    stationAccountId: "station-a",
  });
  expect(onSaved).toHaveBeenCalledTimes(1);
});
```

Expected RED（预期失败）:

```text
FAIL because BootstrapConfigPanel does not exist yet.
```

- [x] **Step 2: Write RED dashboard layout test（编写失败的仪表盘布局测试）**

Modify `qt-app/frontend/src/components/BootstrapDashboard.test.tsx`.

Add:

```tsx
/**
 * @brief 启动仪表盘右侧同时显示 ErrorPanel（错误面板）和 BootstrapConfigPanel（启动配置面板）。
 * @author PopoY
 */
it("renders error panel and bootstrap config panel in the right column", () => {
  const html = renderDashboard(
    <BootstrapDashboard
      bootstrapSession={{
        status: "success",
        config: {
          stationAccountId: "station-account-01",
          granteeHostId: "host-01",
          stationId: "station-01",
          erpBaseUrl: "http://127.0.0.1:8080",
          driverBaseUrl: "http://127.0.0.1:5000",
          configVersion: "v1",
        },
        data: {
          sessionToken: "secret-session-token",
          stationContext: {
            stationAccountId: "station-account-01",
            stationId: "station-01",
            granteeHostId: "host-01",
          },
          defaultDeviceScope: {
            deviceIds: ["device-01"],
          },
          businessContext: {},
          signedLease: {
            leaseId: "lease-01",
            targetDeviceId: "device-01",
          },
          signalConfig: {
            signals: [{ name: "ready", address: 100 }],
          },
          bootstrapConfigEditable: false,
          bootstrapConfigApprovalState: "readonly",
        },
        error: null,
        retry: async () => {},
      }}
    />,
  );

  expect(html).toContain("错误面板");
  expect(html).toContain("启动配置");
  expect(html).toContain("配置修改未授权或开关不可用");
});
```

Expected RED（预期失败）:

```text
FAIL because dashboard only renders ErrorPanel in the right column.
```

- [x] **Step 3: Implement BootstrapConfigPanel component（实现启动配置面板组件）**

Create `qt-app/frontend/src/components/BootstrapConfigPanel.tsx`.

Implementation rules（实现规则）:

1. Use Ant Design `Form + Row + Col（表单、行、列）`; do not use inline form（内联表单）.
2. Keep all six fields visible.
3. Use `disabled={!bootstrapConfigEditable}` for form controls（表单控件）.
4. Use `new URL(value)` for `erpBaseUrl` and `driverBaseUrl` basic URL validation（基础 URL 校验）.
5. Inject `saveNativeConfig` in props for tests; default to imported service in production（生产路径）.
6. On save success call `onSaved()`.
7. On failure show Chinese `Alert（警告）`.

Prop shape（属性形态）:

```ts
export type BootstrapConfigPanelProps = {
  config?: NativeBootstrapConfig | null;
  bootstrapConfigEditable: boolean;
  bootstrapConfigApprovalState: BootstrapConfigApprovalState;
  onSaved: () => Promise<void>;
  saveNativeConfig?: (config: NativeBootstrapConfig) => Promise<void>;
};
```

- [x] **Step 4: Add panel CSS（新增面板样式）**

Create `qt-app/frontend/src/components/BootstrapConfigPanel.css`.

CSS rules（样式规则）:

1. Fit inside dashboard right column（仪表盘右侧列）.
2. Compact spacing（紧凑间距） for 1280x720 IPC viewport（工控机视口）.
3. Avoid card-in-card（卡片嵌套卡片） styling; let existing `StatusBlock（状态块）` frame the panel.
4. No gradient background（渐变背景） or decorative orb（装饰球）.

- [x] **Step 5: Wire BootstrapDashboard layout（接入启动仪表盘布局）**

Modify `qt-app/frontend/src/components/BootstrapDashboard.tsx`.

Rules（规则）:

1. Import `BootstrapConfigPanel`.
2. Keep existing left snapshot column（左侧快照列）.
3. Replace right `StatusBlock` single child with two stacked `StatusBlock（状态块）` sections:
   - top: `title="错误面板"` with `ErrorPanel`.
   - bottom: `title="启动配置"` with `BootstrapConfigPanel`.
4. Pass `bootstrapSession?.config` as config（配置）.
5. Pass `Boolean(bootstrapSession?.data?.bootstrapConfigEditable)`.
6. Pass `bootstrapSession?.data?.bootstrapConfigApprovalState ?? "unavailable"`.
7. Pass `onSaved={() => bootstrapSession?.retry?.() ?? Promise.resolve()}`.

- [x] **Step 6: Adjust dashboard CSS（调整仪表盘样式）**

Modify `qt-app/frontend/src/components/BootstrapDashboard.css`.

Rules（规则）:

1. Add `.bootstrap-dashboard__right-column` with grid（网格） or flex column（纵向弹性布局）.
2. Keep ErrorPanel（错误面板） and BootstrapConfigPanel（启动配置面板） visible without overlap（不重叠）.
3. Preserve existing compact 1280x720 layout（紧凑布局）.

- [x] **Step 7: Verify GREEN（验证通过）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/BootstrapConfigPanel.test.tsx src/components/BootstrapDashboard.test.tsx
./node_modules/.bin/tsc --noEmit
```

Expected（预期）:

```text
PASS（通过）: panel edit state and dashboard right-column layout work.
```

Commit message（提交消息，如执行时需要）:

```bash
git add qt-app/frontend/src/components/BootstrapConfigPanel.tsx qt-app/frontend/src/components/BootstrapConfigPanel.css qt-app/frontend/src/components/BootstrapConfigPanel.test.tsx qt-app/frontend/src/components/BootstrapDashboard.tsx qt-app/frontend/src/components/BootstrapDashboard.css qt-app/frontend/src/components/BootstrapDashboard.test.tsx
git commit -m "feat(qt-app): 增加 dashboard bootstrap config 面板"
```

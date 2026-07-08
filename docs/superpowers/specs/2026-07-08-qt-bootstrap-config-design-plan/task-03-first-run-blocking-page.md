# Task 03: First Run Blocking Page

> @file QT App FirstRunConfigPage（首次启动配置页）任务
> @author PopoY
> @created 2026-07-08
> @purpose 配置缺失时阻塞 App shell（应用外壳），只展示可保存六个 bootstrap config（启动配置）字段的首启页面。

## Goal（目标）

When `readMissingBootstrapConfigFields(config)` returns any missing field（缺失字段）, render a blocking first-run page（首次启动阻塞页） instead of dashboard（仪表盘）, diagnostics（诊断页）, or pressJob（压机作业页） navigation. Saving the six trimmed fields（去空白字段） must call native QSettings（原生 Qt 配置存储） and then run the existing `bootstrapSession.retry()` flow（重试流程）.

## Status（状态）

- `Completed（已完成）`: Task 03（任务三）focused tests（聚焦测试）、frontend regression gates（前端回归门禁）和 FirstRunConfigPage（首次启动配置页）1280x720 visual smoke（视觉冒烟）已通过。

## Progress（进度）

- `2026-07-08`: 计划已落库，当前进度 `0/7`。
- `2026-07-08`: 本轮开始执行 Task 03（任务三），范围限定为 FirstRunConfigPage（首次启动阻塞页）及 App shell gate（应用外壳门控），不进入 Task 04+。
- `2026-07-08`: Step 1 complete（步骤一完成），当前进度 `1/7`；已在 `useBootstrapSession.test.ts` 增加 CONFIG_INVALID（配置无效）保留原始 config（配置）的 RED（红灯）测试。
- `2026-07-08`: Step 2 complete（步骤二完成），当前进度 `2/7`；已新增 `FirstRunConfigPage.test.tsx`，沿用现有 SSR（服务端渲染）测试风格，不新增 `@testing-library/react` 依赖。
- `2026-07-08`: Step 3 complete（步骤三完成），当前进度 `3/7`；已将 `App.test.tsx` 的 bootstrap session（启动会话）mock（模拟）改为可变状态并增加缺失配置阻塞导航 RED（红灯）测试。
- `2026-07-08`: RED verification（红灯验证）完成；focused tests（聚焦测试）按预期失败在缺少 `config`、缺少 `FirstRunConfigPage` 和 App shell gate（应用外壳门控）尚未实现。
- `2026-07-08`: Step 4 complete（步骤四完成），当前进度 `4/7`；`CONFIG_INVALID` error（配置无效错误）已携带原始 native config（原生配置），Hook（钩子）错误态保留 config（配置）供首次启动页预填。
- `2026-07-08`: Step 5 complete（步骤五完成），当前进度 `5/7`；已新增 FirstRunConfigPage（首次启动配置页）和 CSS（样式），使用 Ant Design `Form + Row + Col（表单、行、列）`，保存前 trim（去空白）并使用 native `URL` constructor（原生 URL 构造器）校验 URL。
- `2026-07-08`: Step 6 complete（步骤六完成），当前进度 `6/7`；App shell（应用外壳）已在最终 render（渲染）前按缺失配置返回 FirstRunConfigPage（首次启动配置页），不渲染顶部导航。
- `2026-07-08`: Step 7 verification（步骤七验证）完成；`vitest run src/hooks/useBootstrapSession.test.ts src/components/FirstRunConfigPage.test.tsx src/App.test.tsx` 结果 `17/17 tests passed`；逐项修复后 `tsc --noEmit` 通过。
- `2026-07-08`: Code review fix（代码审查修正）完成；App gate（应用门控）读取 error.missingFields（错误缺失字段）前已严格校验 `code === "CONFIG_INVALID"`，并撤回非 Task 03 的 device event（设备事件）Promise（承诺）链路改动。
- `2026-07-08`: 逐项修复复核完成；frontend focused verification（前端聚焦验证）覆盖 `useBootstrapSession.test.ts`、`FirstRunConfigPage.test.tsx`、`App.test.tsx` 并通过；FirstRunConfigPage（首次启动配置页）`1280x720` 六个表单项不重叠，保存时六字段 trim（去空白）并触发 bootstrap retry（启动重试），任务完成步数 `7/7`。

## Files（文件）

- Modify: `qt-app/frontend/src/hooks/useBootstrapSession.ts`
- Modify: `qt-app/frontend/src/hooks/useBootstrapSession.test.ts`
- Create: `qt-app/frontend/src/components/FirstRunConfigPage.tsx`
- Create: `qt-app/frontend/src/components/FirstRunConfigPage.css`
- Create: `qt-app/frontend/src/components/FirstRunConfigPage.test.tsx`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`

## Acceptance（验收点）

1. Missing config（缺失配置） blocks the whole App shell（应用外壳）.
2. FirstRunConfigPage（首次启动配置页） displays all six config fields（配置字段）.
3. `granteeHostId` prefers existing QSettings（Qt 配置存储） value, then native default IPv4 address（默认 IPv4 地址）.
4. Every field is trimmed before save（保存前去空白）.
5. `stationAccountId`, `granteeHostId`, `stationId`, `erpBaseUrl`, `driverBaseUrl`, and `configVersion` are required（必填）.
6. URL fields（URL 字段） use native `URL` constructor（浏览器原生 URL 构造器） for basic validation（基础校验）; no extra parser dependency（解析依赖）.
7. Save success triggers `bootstrapSession.retry()` and does not call ERP config approval（ERP 配置审批开关）.

## Steps（步骤）

- [x] **Step 1: Write RED hook invalid-config test（编写失败的 Hook 缺失配置测试）**

Modify `qt-app/frontend/src/hooks/useBootstrapSession.test.ts`.

Add:

```ts
/**
 * @brief 缺失 bootstrap config（启动配置）时保留已读取配置，便于 FirstRunConfigPage（首次启动配置页）预填。
 * @author PopoY
 */
it("returns missing config details without calling ERP", async () => {
  const invalidConfig = { ...sampleConfig, stationAccountId: "", granteeHostId: "" };
  const loadSession = vi.fn();

  await expect(
    loadValidatedBootstrapSession(
      vi.fn().mockResolvedValue(invalidConfig),
      loadSession,
    ),
  ).rejects.toMatchObject({
    code: "CONFIG_INVALID",
    config: invalidConfig,
    missingFields: ["stationAccountId", "granteeHostId"],
  });

  expect(loadSession).not.toHaveBeenCalled();
});
```

Expected RED（预期失败）:

```text
FAIL because CONFIG_INVALID error does not expose config yet.
```

- [x] **Step 2: Write RED FirstRunConfigPage test（编写失败的首次启动页测试）**

Create `qt-app/frontend/src/components/FirstRunConfigPage.test.tsx`.

```tsx
/**
 * @file FirstRunConfigPage.test.tsx - 验证首次启动阻塞配置页。
 * @author PopoY
 * @created 2026-07-08
 * @brief 验证缺失配置保存、trim（去空白）和 retry（重试）触发。
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstRunConfigPage } from "./FirstRunConfigPage";

const initialConfig = {
  stationAccountId: "",
  granteeHostId: "",
  stationId: " press-01 ",
  erpBaseUrl: " http://127.0.0.1:8080 ",
  driverBaseUrl: " http://127.0.0.1:5096 ",
  configVersion: " v1 ",
};

it("saves trimmed config and retries bootstrap", async () => {
  const saveNativeConfig = vi.fn().mockResolvedValue(undefined);
  const retry = vi.fn().mockResolvedValue(undefined);

  render(
    <FirstRunConfigPage
      initialConfig={initialConfig}
      missingFields={["stationAccountId", "granteeHostId"]}
      readDefaultHostAddress={vi.fn().mockResolvedValue("192.168.19.100")}
      saveNativeConfig={saveNativeConfig}
      onSaved={retry}
    />,
  );

  fireEvent.change(screen.getByLabelText("工位账号 ID"), {
    target: { value: " station-a " },
  });
  fireEvent.click(await screen.findByText("保存并启动"));

  await waitFor(() => expect(saveNativeConfig).toHaveBeenCalled());
  expect(saveNativeConfig).toHaveBeenCalledWith({
    stationAccountId: "station-a",
    granteeHostId: "192.168.19.100",
    stationId: "press-01",
    erpBaseUrl: "http://127.0.0.1:8080",
    driverBaseUrl: "http://127.0.0.1:5096",
    configVersion: "v1",
  });
  expect(retry).toHaveBeenCalledTimes(1);
});
```

Expected RED（预期失败）:

```text
FAIL because FirstRunConfigPage does not exist yet.
```

- [x] **Step 3: Write RED App shell gate test（编写失败的应用外壳门控测试）**

Modify `qt-app/frontend/src/App.test.tsx`.

First replace the fixed `useBootstrapSession` mock（启动会话模拟） with a hoisted mutable mock（可变模拟）:

```tsx
const bootstrapSessionMock = vi.hoisted(() => ({
  current: {
    status: "idle",
    config: {
      stationAccountId: "station-account-01",
      granteeHostId: "host-01",
      stationId: "station-01",
      erpBaseUrl: "http://127.0.0.1:8080",
      driverBaseUrl: "http://127.0.0.1:5000",
      configVersion: "v1",
    },
    data: null,
    error: null,
    retry: async () => {},
  } satisfies UseBootstrapSessionResult,
}));

vi.mock("./hooks/useBootstrapSession", () => ({
  useBootstrapSession: () => bootstrapSessionMock.current,
}));
```

Then add the render test:

```tsx
/**
 * @brief 配置缺失时只显示 FirstRunConfigPage（首次启动配置页），不显示主导航。
 * @author PopoY
 */
it("renders first-run config page instead of app navigation when config is missing", () => {
  bootstrapSessionMock.current = {
    status: "error",
    config: {
      stationAccountId: "",
      granteeHostId: "host-01",
      stationId: "station-01",
      erpBaseUrl: "http://127.0.0.1:8080",
      driverBaseUrl: "http://127.0.0.1:5000",
      configVersion: "v1",
    },
    data: null,
    error: { code: "CONFIG_INVALID", missingFields: ["stationAccountId"] },
    retry: vi.fn(),
  };

  const html = renderApp();

  expect(html).toContain("首次启动配置");
  expect(html).not.toContain("启动仪表盘");
  expect(html).not.toContain("诊断日志");
  expect(html).not.toContain("压机作业");
});
```

Expected RED（预期失败）:

```text
FAIL because App does not render FirstRunConfigPage yet.
```

- [x] **Step 4: Preserve invalid config in bootstrap hook（在 Hook 中保留缺失配置）**

Modify `qt-app/frontend/src/hooks/useBootstrapSession.ts`.

Rules（规则）:

1. In `loadValidatedBootstrapSession`, attach `config: nextConfig` to `CONFIG_INVALID` error.
2. In `catch`, when caught error has `config`, call `setConfig(error.config as NativeBootstrapConfig)`.
3. Keep `data` as `null` and `status` as `"error"`.
4. Do not call ERP when config is missing.

Minimal shape（最小形态）:

```ts
const error = createBootstrapError(
  "CONFIG_INVALID",
  `Missing bootstrap config: ${missingFields.join(", ")}`,
);

error.config = nextConfig;
error.missingFields = missingFields;
throw error;
```

- [x] **Step 5: Implement FirstRunConfigPage（实现首次启动配置页）**

Create `qt-app/frontend/src/components/FirstRunConfigPage.tsx`.

Implementation rules（实现规则）:

1. Use Ant Design `Form + Row + Col（表单、行、列）`; do not use inline form（内联表单）.
2. Use `layout="vertical"` for compact IPC screen（工控机屏幕） readability.
3. On mount（挂载） call injected or imported `readDefaultHostAddress()`.
4. Fill `granteeHostId` only when existing value is blank and default host address is non-empty.
5. On submit（提交） trim all fields and call injected or imported `saveNativeConfig()`.
6. On failure show `Alert（警告）` with Chinese message（中文消息）.
7. On success call `onSaved()`.

Create `qt-app/frontend/src/components/FirstRunConfigPage.css`.

CSS rules（样式规则）:

1. Full viewport（全视口） blocking layout（阻塞布局）.
2. No hero marketing layout（营销页布局）.
3. No gradient orb（装饰渐变球） or decorative background（装饰背景）.

- [x] **Step 6: Gate App shell（门控应用外壳）**

Modify `qt-app/frontend/src/App.tsx`.

Rules（规则）:

1. Compute `missingConfigFields = readMissingBootstrapConfigFields(bootstrapSession.config)` when config exists.
2. Also read `missingFields` from `CONFIG_INVALID` error for the initial invalid state（初始无效状态）.
3. If missing fields length is greater than zero, return `FirstRunConfigPage`.
4. Do not render top navigation（顶部导航） in this branch.
5. Pass `onSaved={bootstrapSession.retry}`.

- [x] **Step 7: Verify GREEN（验证通过）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/hooks/useBootstrapSession.test.ts src/components/FirstRunConfigPage.test.tsx src/App.test.tsx
./node_modules/.bin/tsc --noEmit
```

Expected（预期）:

```text
PASS（通过）: missing config renders FirstRunConfigPage and save triggers retry.
```

Commit message（提交消息，如执行时需要）:

```bash
git add qt-app/frontend/src/hooks/useBootstrapSession.ts qt-app/frontend/src/hooks/useBootstrapSession.test.ts qt-app/frontend/src/components/FirstRunConfigPage.tsx qt-app/frontend/src/components/FirstRunConfigPage.css qt-app/frontend/src/components/FirstRunConfigPage.test.tsx qt-app/frontend/src/App.tsx qt-app/frontend/src/App.test.tsx
git commit -m "feat(qt-app): 增加 first-run bootstrap config 阻塞页"
```

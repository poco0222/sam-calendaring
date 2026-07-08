# Task 02: Native Config Bridge

> @file QT App V1 原生配置桥接任务
> @author PopoY
> @created 2026-06-25
> @purpose 通过 QWebChannel 暴露只读本机启动配置。

## Goal（目标）

让前端通过 `Promise（异步承诺）` 风格 `native bridge（原生桥接）` 读取本机配置，避免使用 `localStorage（浏览器本地存储）` 保存固定账号。

## Status（状态）

- `Completed`：Task2 已按步骤完成，并已根据 spec review（规格评审）移除 native（原生）侧硬编码默认配置，避免掩盖后续 `ConfigInvalid（配置无效）` 语义；前端侧已通过 `./node_modules/.bin/vitest run nativeBridge` 与 `./node_modules/.bin/vite build` 验证，`pnpm test nativeBridge` 仍受 `esbuild` build approval（构建脚本审批）限制；native（原生）侧因本机缺少 `cmake`、`qmake6` 与 `qt-cmake`，未完成本地编译验证。

## Progress（进度）

- `2026-06-25 Step 1`：已新增 `nativeBridge` 失败契约测试，并在 `frontend（前端）` 工作区补齐最小 `test script（测试脚本）` 以支持后续执行，当前进度 `1/6`。
- `2026-06-25 Step 2`：已先尝试执行 `pnpm test nativeBridge`，但 `pnpm（包管理器）` 被 `esbuild` build approval（构建脚本审批）拦截；随后直接执行 `./node_modules/.bin/vitest run nativeBridge`，确认失败原因为 `./nativeBridge` 缺失，当前进度 `2/6`。
- `2026-06-25 Step 3`：已新增 `NativeBootstrapConfig`、`NativeConfigCallback` 与 `NativeConfigBridge` 类型契约，并声明 `window.__qtNativeBridgePromise` 全局入口，当前进度 `3/6`。
- `2026-06-25 Step 4`：已新增 `AppConfigBridge`，通过 `QSettings（Qt 配置存储）` 暴露只读启动配置，并在 `main.cpp` 中将其注册到 `QWebChannel（Qt Web 通道）`，当前进度 `4/6`。
- `2026-06-25 Step 5`：已实现 `readNativeConfig` 的 `QWebChannel（Qt Web 通道）` 生产路径与 mock bridge（模拟桥接）测试注入路径，并补充“不触碰 localStorage（浏览器本地存储）”测试，当前进度 `5/6`。
- `2026-06-25 Step 6`：已通过 `./node_modules/.bin/vitest run nativeBridge` 验证 `2/2` 测试通过，并通过 `./node_modules/.bin/vite build` 验证前端可构建；`vite build` 仍保留既有 `chunk size` 告警但不影响本轮通过，当前进度 `6/6`。
- `2026-06-25`：native（原生）侧因本机缺少 `cmake`、`qmake6` 与 `qt-cmake`，无法执行本地 CMake configure/build，已作为验证缺口记录。
- `2026-06-25 Verification Follow-up`：上述 native verification gap（原生验证缺口）已由 Task7 final native verification（最终原生验证）补足，`config_bridge_spec` 与 `frontendentrypath_spec` 均已通过。
- `2026-06-25 Spec Review Follow-up`：已移除 `AppConfigBridge` 对缺失配置的硬编码默认值，改为透传 `QSettings（Qt 配置存储）` 实际读取结果，避免污染后续 `ConfigInvalid（配置无效）` 与 `ERP auto-login（ERP 免登录）` 语义。
- `2026-06-25 Code Quality Follow-up`：已修复 `__qtNativeBridgePromise` 失败后永久缓存的问题，并补充 `QWebChannel（Qt Web 通道）` 生产路径、桥对象缺失与失败后可重试测试，避免首次初始化失败后整页才能恢复。

## Files（文件）

- Create: `qt-app/native/src/appconfigbridge.h`
- Create: `qt-app/native/src/appconfigbridge.cpp`
- Modify: `qt-app/native/src/main.cpp`
- Modify: `qt-app/native/CMakeLists.txt`
- Modify: `qt-app/frontend/package.json`
- Modify: `qt-app/frontend/pnpm-lock.yaml`
- Create: `qt-app/frontend/src/types/native.ts`
- Create: `qt-app/frontend/src/services/nativeBridge.ts`
- Create: `qt-app/frontend/src/services/nativeBridge.test.ts`

## Steps（步骤）

- [x] **Step 1: Write the failing bridge contract test**

```ts
// PopoY: config must come from the native bridge, not browser localStorage.
import { expect, it } from "vitest";

it("returns required bootstrap config fields", async () => {
  const config = await readNativeConfig();
  expect(config.stationAccountId).toBe("station-a");
  expect(config.driverBaseUrl).toEqual(expect.any(String));
});
```

- [x] **Step 2: Run the test and confirm it fails**

```bash
cd qt-app/frontend && pnpm test nativeBridge
```

Expected: failure because `readNativeConfig` is missing.

- [x] **Step 3: Add the TypeScript config contract**

```ts
// PopoY: explicit config contract keeps the bootstrap flow narrow.
export type NativeBootstrapConfig = {
  stationAccountId: string;
  granteeHostId: string;
  stationId: string;
  erpBaseUrl: string;
  driverBaseUrl: string;
  configVersion: string;
};
```

- [x] **Step 4: Expose a read-only Qt bridge object**

```cpp
// PopoY: bridge exposes read-only startup config to WebEngine.
class AppConfigBridge : public QObject {
  Q_OBJECT
public:
  explicit AppConfigBridge(QObject *parent = nullptr);
};
```

- [x] **Step 5: Implement `readNativeConfig` with a mocked fallback only for tests**

The production path must use `QWebChannel（Qt Web 通道）`. The test path may inject a mock bridge object.
`driverBaseUrl（驱动服务地址）` is transport config for local `Driver Service（驱动服务）`, not device endpoint authorization.

- [x] **Step 6: Verify**

```bash
cd qt-app/frontend && pnpm test nativeBridge
```

Expected: tests pass and no test writes to `localStorage（浏览器本地存储）`.

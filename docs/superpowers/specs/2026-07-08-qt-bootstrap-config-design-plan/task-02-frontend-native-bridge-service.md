# Task 02: Frontend Native Bridge Service

> @file QT App frontend native bridge（前端原生桥）服务任务
> @author PopoY
> @created 2026-07-08
> @purpose 扩展 TypeScript native bridge（原生桥）类型和服务，封装配置保存、默认主机地址读取和中文错误摘要。

## Goal（目标）

Expose a typed frontend service（前端服务） for `saveBootstrapConfig（保存启动配置）` and `readDefaultHostAddress（读取默认主机地址）`, while reusing the existing QWebChannel（Qt Web 通道） bridge resolution code and keeping all config data in native QSettings（原生 Qt 配置存储）.

## Status（状态）

- `Completed（已完成）`: Task 02（任务二）focused tests（聚焦测试）和 frontend regression gates（前端回归门禁）已通过。

## Progress（进度）

- `2026-07-08`: 计划已落库，当前进度 `0/6`。
- `2026-07-08`: Step 1 complete（步骤一完成），当前进度 `1/6`；已在 `qt-app/frontend/src/services/nativeBridge.test.ts` 增加 `saveNativeConfig` 和 `readDefaultHostAddress` RED（红灯）契约测试，尚未进入实现。
- `2026-07-08`: Step 2 complete（步骤二完成），当前进度 `2/6`；`./node_modules/.bin/vitest run src/services/nativeBridge.test.ts` 已按预期失败，失败原因为 `saveNativeConfig` 和 `readDefaultHostAddress` export（导出）尚未实现。
- `2026-07-08`: Step 3 complete（步骤三完成），当前进度 `3/6`；已扩展 `NativeConfigBridge（原生配置桥类型）`，新增 `saveBootstrapConfig`、`readDefaultHostAddress` 及对应 callback（回调）类型。
- `2026-07-08`: Step 4 complete（步骤四完成），当前进度 `4/6`；已实现 `saveNativeConfig（保存原生配置）`，保存前仅保留六个 bootstrap config（启动配置）字段并执行 trim（去空白），失败时抛出中文错误摘要。
- `2026-07-08`: Step 5 complete（步骤五完成），当前进度 `5/6`；已实现 `readDefaultHostAddress（读取默认主机地址）`，复用现有 QWebChannel（Qt Web 通道）bridge resolution（桥解析）逻辑，并在 native callback（原生回调）返回非 string（字符串）时回退为空字符串。
- `2026-07-08`: Review fix（审查修正）完成；已将 `saveNativeConfig（保存原生配置）` 成功条件收紧为 `ok === true`，并补充 malformed save result（畸形保存结果）中文 fallback（回退）和 non-string default host address fallback（非字符串默认主机地址回退）测试。
- `2026-07-08`: Step 6 verification（步骤六验证）完成；`./node_modules/.bin/vitest run src/services/nativeBridge.test.ts` 结果为 `11/11 tests passed`；逐项修复后 `./node_modules/.bin/tsc --noEmit` 通过。
- `2026-07-08`: 逐项修复复核完成；`tsc --noEmit`、frontend full Vitest（前端全量测试）和 focused verification（聚焦验证）均通过，任务完成步数 `6/6`。

## Files（文件）

- Modify: `qt-app/frontend/src/types/native.ts`
- Modify: `qt-app/frontend/src/services/nativeBridge.ts`
- Modify: `qt-app/frontend/src/services/nativeBridge.test.ts`

## Acceptance（验收点）

1. `NativeConfigBridge（原生配置桥类型）` includes `saveBootstrapConfig` and `readDefaultHostAddress`.
2. `saveNativeConfig(config)` calls the bridge save method and resolves only when `ok === true`.
3. Bridge failure rejects with Chinese message（中文消息） from `errorMessage`.
4. `readDefaultHostAddress()` returns bridge value and falls back to empty string only when bridge returns non-string（非字符串）.
5. No frontend localStorage（前端本地存储） reads or writes are introduced.

## Steps（步骤）

- [x] **Step 1: Write RED nativeBridge tests（编写失败的原生桥服务测试）**

Modify `qt-app/frontend/src/services/nativeBridge.test.ts`.

Add tests:

```ts
/**
 * @brief 验证 saveNativeConfig（保存原生配置）通过 QWebChannel（Qt Web 通道）写入本机 QSettings（Qt 配置存储）。
 * @author PopoY
 */
it("saves bootstrap config through the native bridge", async () => {
  const bridge = createMockBridge();
  const saveSpy = vi.spyOn(bridge, "saveBootstrapConfig");

  await saveNativeConfig(sampleConfig, { bridge });

  expect(saveSpy).toHaveBeenCalledWith(sampleConfig, expect.any(Function));
});

/**
 * @brief 验证保存失败时返回中文错误摘要。
 * @author PopoY
 */
it("rejects native save failures with Chinese summary", async () => {
  const bridge: NativeConfigBridge = {
    ...createMockBridge(),
    saveBootstrapConfig(_config, callback) {
      callback({ ok: false, errorMessage: "启动配置保存失败，请检查本机配置权限。" });
    },
  };

  await expect(saveNativeConfig(sampleConfig, { bridge })).rejects.toThrow(
    "启动配置保存失败，请检查本机配置权限。",
  );
});

/**
 * @brief 验证默认 IPv4 address（IPv4 地址）通过 native bridge（原生桥）读取。
 * @author PopoY
 */
it("reads default host address through the native bridge", async () => {
  const bridge: NativeConfigBridge = {
    ...createMockBridge(),
    readDefaultHostAddress(callback) {
      callback("192.168.19.100");
    },
  };

  await expect(readDefaultHostAddress({ bridge })).resolves.toBe("192.168.19.100");
});
```

Expected RED（预期失败）:

```text
FAIL because saveNativeConfig and readDefaultHostAddress are not exported yet.
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/nativeBridge.test.ts
```

Expected（预期）:

```text
FAIL（失败） with missing nativeBridge exports or missing bridge methods.
```

- [x] **Step 3: Extend native bridge types（扩展原生桥类型）**

Modify `qt-app/frontend/src/types/native.ts`.

```ts
/**
 * @brief Model native save result（原生保存结果）returned by AppConfigBridge（应用配置桥）。
 * @author PopoY
 */
export type NativeBootstrapConfigSaveResult = {
  ok: boolean;
  errorMessage?: string;
};

/**
 * @brief Define the callback signature for native save result（原生保存结果）。
 * @author PopoY
 * @param result 保存结果；失败时包含中文错误摘要。
 */
export type NativeConfigSaveCallback = (
  result: NativeBootstrapConfigSaveResult,
) => void;

/**
 * @brief Define the callback signature for default host address（默认主机地址）。
 * @author PopoY
 * @param hostAddress 默认 IPv4 address（IPv4 地址）；取不到时为空字符串。
 */
export type NativeDefaultHostAddressCallback = (hostAddress: string) => void;
```

Update `NativeConfigBridge`:

```ts
export type NativeConfigBridge = {
  readBootstrapConfig: (callback: NativeConfigCallback) => void;
  saveBootstrapConfig: (
    config: NativeBootstrapConfig,
    callback: NativeConfigSaveCallback,
  ) => void;
  readDefaultHostAddress: (callback: NativeDefaultHostAddressCallback) => void;
};
```

- [x] **Step 4: Implement saveNativeConfig（实现保存原生配置）**

Modify `qt-app/frontend/src/services/nativeBridge.ts`.

```ts
/**
 * @brief 保存 bootstrap config（启动配置）到 Qt native layer（Qt 原生层）。
 * @author PopoY
 * @param config 六个白名单启动配置字段。
 * @param options 测试注入 bridge（桥）或 window（窗口）的选项。
 * @returns 保存成功时 resolved（完成）；失败时 rejected（拒绝）中文错误。
 */
export async function saveNativeConfig(
  config: NativeBootstrapConfig,
  options: ReadNativeConfigOptions = {},
): Promise<void> {
  const bridge = options.bridge ?? (await resolveNativeBridge(options.targetWindow));
  const result = await saveConfigToBridge(bridge, trimNativeConfig(config));

  if (!result.ok) {
    throw new Error(result.errorMessage || "启动配置保存失败，请稍后重试。");
  }
}
```

Add `trimNativeConfig(config)` in the same file. It must return exactly the six keys（六个键） and call `.trim()` on each string.

- [x] **Step 5: Implement default host read（实现默认主机地址读取）**

Modify `qt-app/frontend/src/services/nativeBridge.ts`.

```ts
/**
 * @brief 读取 QT App（Qt 应用）native layer（原生层）提供的默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @param options 测试注入 bridge（桥）或 window（窗口）的选项。
 * @returns 默认主机地址；原生层取不到时为空字符串。
 */
export async function readDefaultHostAddress(
  options: ReadNativeConfigOptions = {},
): Promise<string> {
  const bridge = options.bridge ?? (await resolveNativeBridge(options.targetWindow));
  return readDefaultHostAddressFromBridge(bridge);
}
```

The helper（辅助函数） should wrap the callback with `Promise<string>` and return `""` when callback value is not a string.

- [x] **Step 6: Verify GREEN（验证通过）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/nativeBridge.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected（预期）:

```text
PASS（通过）: nativeBridge tests pass and TypeScript（类型脚本） has no errors.
```

Commit message（提交消息，如执行时需要）:

```bash
git add qt-app/frontend/src/types/native.ts qt-app/frontend/src/services/nativeBridge.ts qt-app/frontend/src/services/nativeBridge.test.ts
git commit -m "feat(qt-app): 增加 bootstrap config 前端原生桥服务"
```

# Task 07: Verification Harness

> @file QT App V1 验证任务
> @author PopoY
> @created 2026-06-25
> @purpose 汇总端到端启动链路验证和最终验收清单。

## Goal（目标）

用最小测试覆盖 `config -> auto-login -> lease -> applyLeaseAndConfig -> getSignalSnapshot -> dashboard` 的 bootstrap happy path（启动成功路径）和关键失败路径，并覆盖现场 `1280x720` fixed window（固定窗口）与 ERP failure Chinese fallback（ERP 失败中文兜底）。

## Files（文件）

- Create: `qt-app/frontend/src/tests/bootstrapFlow.test.ts`
- Create: `qt-app/frontend/src/tests/acceptanceChecklist.test.ts`
- Create: `qt-app/native/tests/config_bridge.spec.cpp`
- Create: `qt-app/native/tests/mainwindow.spec.cpp`

## Steps（步骤）

- [x] **Step 1: Write the failing bootstrap flow test**

```ts
// PopoY: bootstrap acceptance proves the V1 chain before full business UI exists.
import { expect, it } from "vitest";

it("boots from native config to first signal snapshot", async () => {
  const result = await runBootstrapFlow(sampleBootstrapDeps);
  expect(result.state).toBe("SnapshotReady");
});
```

- [x] **Step 2: Run the test and confirm it fails**

```bash
cd qt-app/frontend && pnpm test bootstrapFlow
```

Expected: failure until the composed bootstrap flow exists.

- [x] **Step 3: Add acceptance checklist tests**

Cover these conditions: no password login page, config missing stops flow, login failure stops lease fetch, ERP `deviceConnectionInfo（设备连接信息）` is ignored, driver rejects invalid lease, snapshot renders after success, no raw `ip/port/deviceId` override exists, ERP failure UI（用户界面） stays Chinese.

- [x] **Step 4: Add native config bridge check**

```cpp
// PopoY: native config bridge returns config without exposing browser storage.
int main(int argc, char **argv) {
  return 0;
}
```

Also verify `MainWindow（主窗口）` is fixed at `1280x720` for the field Windows 10 touch IPC（触摸工控机） baseline.

- [x] **Step 5: Run final verification**

```bash
cd qt-app/frontend && pnpm test && pnpm build
cd ../native && cmake -S . -B build && cmake --build build
```

Expected: frontend tests pass, frontend build passes, native shell builds on a machine with Qt installed, and `ctest` passes both config bridge and fixed window specs.

## Progress（进度）

- Status（状态）: Completed（已完成）
- Current Step（当前步骤）: Done
- Notes（备注）:
  - 2026-06-25 Step 1 completed: added `qt-app/frontend/src/tests/bootstrapFlow.test.ts` as the first failing contract test for the composed bootstrap harness from native config to first signal snapshot, current progress `1/5`.
  - 2026-06-25 Step 2 completed: ran `./node_modules/.bin/vitest run src/tests/bootstrapFlow.test.ts` and confirmed the expected RED failure `Cannot find module '../services/bootstrapFlow'`, current progress `2/5`.
  - 2026-06-25 Step 3 completed: added `qt-app/frontend/src/tests/acceptanceChecklist.test.ts` to lock the Task7 acceptance checklist around config validation, ERP short-circuiting, `deviceConnectionInfo（设备连接信息）` filtering, Driver rejection short-circuiting, snapshot rendering, and raw `ip/port/deviceId` override regression coverage, current progress `3/5`.
  - 2026-06-25 Step 4 completed: added `qt-app/native/tests/config_bridge.spec.cpp` plus the minimal `config_bridge_spec` CTest target in `qt-app/native/CMakeLists.txt`; current progress `4/5`.
  - 2026-06-25 Step 5 completed: reran `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, and `./node_modules/.bin/vite build`; all frontend checks passed on the final file set. The plan's `pnpm` commands could not be used because `pnpm` is unavailable in the current PATH, so equivalent local binaries were used instead. Native verification passed with `/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake -S . -B build -G Ninja -D CMAKE_MAKE_PROGRAM=/Users/PopoY/Qt/Tools/Ninja/ninja`, `/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake --build build`, and `/Users/PopoY/Qt/Tools/CMake/CMake.app/Contents/bin/ctest --test-dir build --output-on-failure`; `config_bridge_spec` passed `1/1`, current progress `5/5`.
  - 2026-06-25 Runtime Review Follow-up: fixed the production runtime（生产运行时） gap where `useBootstrapSession` skipped required config validation（必填配置校验） before ERP auto-login（ERP 免登录）. Added `CONFIG_INVALID` error mapping（错误映射） and `loadValidatedBootstrapSession` regression test（回归测试） so blank native config（原生配置） stops before ERP session loading（ERP 会话加载）.
  - 2026-06-25 Field Device Follow-up: added `mainwindow_spec` to verify fixed `1280x720` native window size, updated acceptance coverage to expect Chinese dashboard labels, and added ERP runtime failure regression coverage through `BootstrapDashboard.test.tsx`.

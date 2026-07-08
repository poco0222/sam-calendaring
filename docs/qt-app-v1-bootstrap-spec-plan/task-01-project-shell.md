# Task 01: Project Shell and Workspace Layout

> @file QT App V1 项目壳任务
> @author PopoY
> @created 2026-06-25
> @purpose 创建最小 Qt WebEngine + React + Vite 工作区。

## Goal（目标）

创建 `qt-app（Qt 应用）` 工作区，让 `native（原生壳）` 和 `frontend（前端）` 能独立构建。

## Status（状态）

- `Completed`：Task1 已按步骤完成并通过 spec review（规格评审）与 code quality review（代码质量评审）；frontend（前端）已完成 `pnpm install && pnpm build` 验证，native（原生）侧已补充 `1280x720 fixed-size window（固定尺寸窗口）` 回归验证。

## Progress（进度）

- `2026-06-25 Step 1`：已执行失败脚手架检查，命令按预期返回 `exit code 1`，当前进度 `1/7`。
- `2026-06-25 Step 2`：已创建 `qt-app/native/src`、`qt-app/frontend/src` 与 `qt-app/frontend/src/app` 目录，当前进度 `2/7`。
- `2026-06-25 Step 3`：已补齐最小 Qt native shell 文件，`CMakeLists.txt` 仅链接 `Qt WebEngineWidgets` 与 `Qt WebChannel`，`MainWindow` 仅承载 `QWebEngineView` 占位页，当前进度 `3/7`。
- `2026-06-25 Step 4`：已补齐 `package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、`src/main.tsx` 与 `src/App.tsx`，前端仅保留最小 Vite React 入口，当前进度 `4/7`。
- `2026-06-25 Step 5`：已新增根级 `AntdRootProvider`，集中承载 `ConfigProvider`、`HappyProvider`、`holderRender` 与全局主题，当前进度 `5/7`。
- `2026-06-25 Step 6`：已复跑脚手架存在性检查，命令按预期返回 `exit code 0`，当前进度 `6/7`。
- `2026-06-25 Step 7`：已通过 `pnpm install && pnpm build` 验证前端工作区可构建；`vite build` 成功，存在 `chunk size` 告警但不影响本轮任务通过，当前进度 `7/7`。
- `2026-06-25`：native（原生）侧因本机缺少 `cmake`、`qmake6`、`qt-cmake` 与 Qt6 CMake 配置文件，未能执行本地 CMake configure/build，已在状态中记录为验证缺口。
- `2026-06-25 Verification Follow-up`：上述 native verification gap（原生验证缺口）已由 Task7 final native verification（最终原生验证）补足，`qt-cmake configure/build` 与 `ctest` 均已通过。
- `2026-06-25 Field Device Follow-up`：已按现场 10 英寸 Windows 10 touch IPC（触摸工控机）约束，将 `MainWindow（主窗口）` 固定为 `1280x720`，并新增 `mainwindow_spec` 验证 `size/minimumSize/maximumSize` 均为 `1280x720`。

## Files（文件）

- Create: `qt-app/native/CMakeLists.txt`
- Create: `qt-app/native/src/main.cpp`
- Create: `qt-app/native/src/mainwindow.h`
- Create: `qt-app/native/src/mainwindow.cpp`
- Create: `qt-app/native/tests/mainwindow.spec.cpp`
- Create: `qt-app/frontend/package.json`
- Create: `qt-app/frontend/vite.config.ts`
- Create: `qt-app/frontend/tsconfig.json`
- Create: `qt-app/frontend/index.html`
- Create: `qt-app/frontend/src/main.tsx`
- Create: `qt-app/frontend/src/App.tsx`
- Create: `qt-app/frontend/src/app/AntdRootProvider.tsx`

## Steps（步骤）

- [x] **Step 1: Run the failing scaffold check**

```bash
bash -lc 'test -f qt-app/native/CMakeLists.txt && test -f qt-app/frontend/package.json'
```

Expected: exit code `1`.

- [x] **Step 2: Create the minimal directory layout**

```text
qt-app/
  native/
    src/
  frontend/
    src/
```

- [x] **Step 3: Add the Qt native shell files**

`CMakeLists.txt` must depend only on `Qt WebEngineWidgets（Qt WebEngine 组件）` and `Qt WebChannel（Qt Web 通道）`.
`MainWindow（主窗口）` must call `setFixedSize(1280, 720)` or equivalent fixed-size API; `resize(...)` alone is not accepted.

```cpp
// PopoY: bootstrap shell owns the WebEngine window only.
int main(int argc, char *argv[]) {
  return 0;
}
```

- [x] **Step 4: Add the Vite React files**

`package.json` must use `React（前端框架）`、`TypeScript（类型脚本）`、`Vite（前端构建工具）`、`Ant Design 6.4.5（Ant Design 组件库）` and `@ant-design/happy-work-theme`.

- [x] **Step 5: Add the global Ant Design provider**

当前实现要求：

1. `AntdRootProvider` 集中承载 `ConfigProvider`、`HappyProvider`、`AntdApp` 与 `holderRender`。
2. `theme mode（主题模式）` 支持 `light（浅色）`、`dark（深色）`、`system（跟随系统）`，无本机偏好时默认 `system（跟随系统）`。
3. `light（浅色）` 使用 `theme.defaultAlgorithm`、白底黑字；`dark（深色）` 使用 `theme.darkAlgorithm`、深色背景浅色文字。
4. 操作员选择通过 `localStorage（本地存储）` 持久化，`system（跟随系统）` 通过 `matchMedia("(prefers-color-scheme: dark)")` 解析。
5. 主题 token（设计令牌）只允许由 `ConfigProvider.theme.token` 注入，业务组件不得重复声明基础背景色和文字色。

- [x] **Step 6: Verify scaffold files exist**

```bash
bash -lc 'test -f qt-app/native/CMakeLists.txt && test -f qt-app/frontend/package.json'
```

Expected: exit code `0`.

- [x] **Step 7: Verify frontend build command is available**

```bash
cd qt-app/frontend && pnpm install && pnpm build
```

Expected: `Vite（前端构建工具）` build exits with code `0`.

- [x] **Field Device Follow-up: Verify fixed native window**

```bash
cd qt-app/native && ctest --test-dir build --output-on-failure -R mainwindow_spec
```

Expected: `MainWindow（主窗口）` reports `size/minimumSize/maximumSize` as exactly `1280x720`.

<!--
@file proposal.md - Qt App application icon proposal（Qt 应用图标变更提案）
@author PopoY
@created 2026-07-22 09:39:59
@purpose Define the minimal Windows and Qt runtime icon boundary（定义 Windows 与 Qt 运行时图标的最小变更边界）。
-->

## Why

The packaged Qt App currently uses the default executable and window icons, so operators cannot identify the SAM application consistently in Windows Explorer, the taskbar, or the window chrome. The repository-root `logo.png` is the approved brand source and should be applied without adding a new image-processing dependency to the application.

## What Changes

- Generate a multi-size Windows `.ico` asset from the approved `logo.png` source.
- Embed the `.ico` asset in `qt_app_native.exe` through the existing CMake target.
- Bundle the PNG through Qt Resource System and set it as the Qt application window icon before the main window is created.
- Add the smallest runnable checks for the generated icon and build configuration.

## Capabilities

### New Capabilities

- `qt-app-application-icon`: Defines the approved icon shown by the Windows executable and the running Qt desktop shell.

### Modified Capabilities

None.

## Impact

- Affects only `logo.png`, Qt native resources, `qt-app/native/CMakeLists.txt`, and Qt App startup.
- Keeps the existing executable name, package layout, public API, data model, logging, and dependencies unchanged.
- Windows packaging continues to copy and deploy the same `qt_app_native.exe` path.

<!--
@file design.md - Qt App application icon design（Qt 应用图标设计）
@author PopoY
@created 2026-07-22 09:39:59
@purpose Describe the minimal native resource integration（说明原生资源集成的最小实现方案）。
-->

## Context

`qt_app_native` is built by CMake and packaged as the same Windows 10 x64 executable in the existing GitHub Actions workflow. Its target has no Windows resource file, and `main.cpp` does not set a Qt application icon. The approved repository-root `logo.png` is a square RGBA image, but Windows executable metadata requires an `.ico` container.

## Goals / Non-Goals

**Goals:**

- Give `qt_app_native.exe`, its top-level window, and its taskbar entry the approved SAM branding.
- Keep the existing target name and package layout.
- Use native Qt, CMake, and Windows resource mechanisms without an application dependency.

**Non-Goals:**

- Do not redesign, crop, or simplify the approved logo.
- Do not add macOS or Linux packaging metadata.
- Do not add an icon-generation script or runtime image conversion.

## Decisions

Generate one committed multi-size `app.ico` from `logo.png` with `16`, `24`, `32`, `48`, `64`, `128`, and `256` pixel entries. Image generation is a one-time asset operation using the bundled workspace image tooling; the application and CI do not depend on that tooling.

Add a minimal Windows `.rc` file to the existing executable target only on `WIN32`. Use CMake's existing Qt resource support to embed `logo.png`, then call `QApplication::setWindowIcon` before constructing `MainWindow`. The PNG remains the Qt runtime source while `.ico` supplies native Windows executable metadata.

## Risks / Trade-offs

- [Full wordmark becomes hard to read at small sizes] -> Preserve the user-approved source for this change; create a simplified mark only if field use shows poor recognition.
- [Windows resource integration cannot be exercised by the macOS linker] -> Configure and build the non-Windows Qt target locally, statically validate the guarded `.rc` configuration, and let the existing Windows packaging workflow provide final platform confirmation.
- [Derived `.ico` drifts from `logo.png`] -> Verify its entry sizes and pixel content during this change; regenerate it only when the approved source changes.

## Migration Plan

Build and deploy the package through the existing workflow. Rolling back the CMake, startup, and resource files restores the default icon without data migration.

## Open Questions

None. The source image, Windows target, runtime icon behavior, and minimal implementation boundary are approved.

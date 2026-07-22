<!--
@file spec.md - Qt App application icon requirements（Qt 应用图标需求）
@author PopoY
@created 2026-07-22 09:39:59
@purpose Define the observable desktop icon contract（定义桌面应用图标的可观察契约）。
-->

## ADDED Requirements

### Requirement: Qt App uses the approved SAM application icon

The Qt App SHALL use the repository-approved SAM logo for both Windows executable metadata and the running application's window icon without changing its executable name or package location.

#### Scenario: Packaged application is identifiable by the SAM icon

- **WHEN** the Windows 10 x64 Qt App package is built and `qt_app_native.exe` is launched
- **THEN** Windows SHALL expose the approved SAM icon for the executable and the running Qt application window

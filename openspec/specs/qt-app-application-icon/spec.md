# qt-app-application-icon Specification

## Purpose
TBD - created by archiving change set-qt-app-icon. Update Purpose after archive.
## Requirements
### Requirement: Qt App uses the approved SAM application icon

The Qt App SHALL use the repository-approved SAM logo for both Windows executable metadata and the running application's window icon without changing its executable name or package location.

#### Scenario: Packaged application is identifiable by the SAM icon

- **WHEN** the Windows 10 x64 Qt App package is built and `qt_app_native.exe` is launched
- **THEN** Windows SHALL expose the approved SAM icon for the executable and the running Qt application window

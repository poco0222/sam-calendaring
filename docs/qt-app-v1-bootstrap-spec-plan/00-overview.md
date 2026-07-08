# QT App V1 Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the minimal QT App bootstrap slice that reads local machine config, performs ERP auto-login, fetches signed lease plus signal config, calls Driver Service, and shows the first signal snapshot. V1 must target the existing 10-inch Windows 10 touch IPC devices with fixed `1280x720` resolution.

**Architecture:** The `QT App（Qt 应用）` owns startup orchestration and UI state. The `native bridge（原生桥接）` owns protected local config access. `ERP Server（企业资源计划服务器）` and `Driver Service（驱动服务）` are external dependencies consumed through narrow typed clients.

**Tech Stack:** Qt WebEngine, QWebChannel, React, TypeScript, TSX, Ant Design 6.4.5, @ant-design/happy-work-theme, Vite.

**External Dependencies（外部依赖）:** Existing `Driver Service（驱动服务）` API shell using `.NET 10 LTS + ASP.NET Core Minimal API + NModbus` and existing `ERP Server（企业资源计划服务器）` APIs for auto-login and lease authorization.

---

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Project Shell and Workspace Layout](./task-01-project-shell.md) | Create the Qt native shell and Vite React workspace. | None |
| 2 | [Task 02: Native Config Bridge](./task-02-native-config.md) | Expose read-only local bootstrap config through `QWebChannel（Qt Web 通道）`. | Task 01 |
| 3 | [Task 03: ERP Auto-Login and Lease Fetch](./task-03-erp-auto-login.md) | Call `ERP auto-login API（ERP 免登录接口）` and fetch `signedLease（签名租约） + signalConfig（信号配置）`. | Task 02 |
| 4 | [Task 04: Driver Service Client and Snapshot](./task-04-driver-client.md) | Call `applyLeaseAndConfig` and `getSignalSnapshot` without raw device endpoint overrides. | Task 03 |
| 5 | [Task 05: Bootstrap Dashboard](./task-05-bootstrap-dashboard.md) | Render the bootstrap dashboard sections and allowed actions. | Task 02, Task 03, Task 04 |
| 6 | [Task 06: Error Mapping and Logging](./task-06-error-logging.md) | Map standard errors and record sanitized diagnostics. | Task 03, Task 04 |
| 7 | [Task 07: Verification Harness](./task-07-verification.md) | Verify the complete bootstrap flow and acceptance checklist. | Task 01 through Task 06 |

## Execution Notes（执行说明）

1. Keep each task's implementation details in its own `task-*.md` file.
2. Do not expand V1 into full business UI（用户界面） or full `Driver Service（驱动服务）` implementation.
3. `QT App（Qt 应用）` must not forward, decompose, or override raw `ip（网络地址）`、`port（端口）`、`deviceId（设备 ID）` for device authorization.
4. `driverBaseUrl（驱动服务地址）` is transport config for local `Driver Service（驱动服务）`, not device endpoint authorization.
5. Ant Design global config must live in one root `AntdRootProvider（Ant Design 根提供器）`.
6. `QT App（Qt 应用）` native window must be fixed at `1280x720`; V1 must not rely on fullscreen, maximize, resize, or a larger external display.
7. `Bootstrap Dashboard（启动仪表盘）` must use `1280x720` as the only field viewport baseline, with compact touch-friendly layout and no dependency on wider breakpoints.
8. User-visible UI and error text must be Chinese. ERP failure paths must not show an English full-page fallback, English section titles, or raw English exception messages.

# QT Bootstrap Config Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file QT bootstrap config（启动配置）实现计划总览
> @author PopoY
> @created 2026-07-08
> @purpose 基于 `2026-07-08-qt-bootstrap-config-design.md` 拆分 QT App（Qt 应用）首次启动配置、QSettings（Qt 配置存储）写入、ERP 参数开关和仪表盘配置面板任务。

**Goal（目标）:** 让 QT App（Qt 应用）在 bootstrap config（启动配置）缺失时阻塞首屏完成本机配置，并在 BootstrapDashboard（启动仪表盘）中按 ERP config key（ERP 配置键）`approve.press.config` 控制配置面板编辑能力。

**Architecture（架构）:** 复用现有 `AppConfigBridge（应用配置桥）`、`QSettings（Qt 配置存储）`、`QWebChannel（Qt Web 通道）`、`useBootstrapSession（启动会话 Hook）` 和 Ant Design `Form（表单）`。只新增最小 native bridge（原生桥）写入方法、两个 React component（前端组件）和一个 ERP config client（ERP 配置客户端）；不新增 router（路由）、state management（状态管理）库或 frontend localStorage（前端本地存储）。

**Tech Stack（技术栈）:** Qt 6, C++17, QSettings（Qt 配置存储）, QNetworkInterface（Qt 网络接口）, QWebChannel（Qt Web 通道）, React 19, TypeScript（类型脚本）, Ant Design 6.4.5（组件库）, Vitest（测试框架）, Vite（构建工具）.

**Source Spec（来源规格）:** `docs/superpowers/specs/2026-07-08-qt-bootstrap-config-design.md`

---

## Status（状态）

- `Completed（已完成）`: Task 01 through Task 06（任务一至任务六）已逐项复核并修复；native focused tests（原生聚焦测试）、frontend focused/full tests（前端聚焦/全量测试）、frontend `tsc --noEmit`、frontend build（前端构建）、Driver Service tests（驱动服务测试）和 1280x720 visual smoke（视觉冒烟）均通过，详情见 `verification-record.md`。

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Native Bridge Config Write And Default Host](./task-01-native-bridge-config-write-and-default-host.md) | Completed（已完成）: 扩展 `AppConfigBridge（应用配置桥）`，支持 6 个白名单字段保存和默认 IPv4 address（IPv4 地址）读取。 | None |
| 2 | [Task 02: Frontend Native Bridge Service](./task-02-frontend-native-bridge-service.md) | Completed（已完成）: 扩展 `types/native.ts` 和 `services/nativeBridge.ts`，封装保存配置与默认主机地址读取。 | Task 01 |
| 3 | [Task 03: First Run Blocking Page](./task-03-first-run-blocking-page.md) | Completed（已完成）: 配置缺失时渲染 FirstRunConfigPage（首次启动阻塞页），保存后触发 bootstrap retry（启动重试）。 | Task 02 |
| 4 | [Task 04: ERP Config Approval](./task-04-erp-config-approval.md) | Completed（已完成）: 登录成功后读取 `approve.press.config`，失败、缺失、非 `true` 均按只读处理。 | Task 03 |
| 5 | [Task 05: Dashboard Config Panel](./task-05-dashboard-config-panel.md) | Completed（已完成）: 在 BootstrapDashboard（启动仪表盘）右侧挂载 BootstrapConfigPanel（启动配置面板）并按开关控制编辑。 | Task 04 |
| 6 | [Task 06: Verification And Record](./task-06-verification-and-record.md) | Completed（已完成）: 已跑 native/frontend focused tests（聚焦测试）、regression gates（回归检查）和 1280x720 visual smoke（视觉冒烟），并落库 `verification-record.md`。 | Task 01 through Task 05 |

## File Boundary（文件边界）

### Native（原生）

- Modify: `qt-app/native/src/appconfigbridge.h`
- Modify: `qt-app/native/src/appconfigbridge.cpp`
- Create: `qt-app/native/src/bootstraphostaddress.h`
- Create: `qt-app/native/src/bootstraphostaddress.cpp`
- Modify: `qt-app/native/CMakeLists.txt`
- Modify: `qt-app/native/tests/config_bridge.spec.cpp`
- Create: `qt-app/native/tests/bootstrap_host_address.spec.cpp`

### Frontend（前端）

- Modify: `qt-app/frontend/src/types/native.ts`
- Modify: `qt-app/frontend/src/services/nativeBridge.ts`
- Modify: `qt-app/frontend/src/services/nativeBridge.test.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/hooks/useBootstrapSession.ts`
- Modify: `qt-app/frontend/src/hooks/useBootstrapSession.test.ts`
- Create: `qt-app/frontend/src/components/FirstRunConfigPage.tsx`
- Create: `qt-app/frontend/src/components/FirstRunConfigPage.css`
- Create: `qt-app/frontend/src/components/FirstRunConfigPage.test.tsx`
- Create: `qt-app/frontend/src/components/BootstrapConfigPanel.tsx`
- Create: `qt-app/frontend/src/components/BootstrapConfigPanel.css`
- Create: `qt-app/frontend/src/components/BootstrapConfigPanel.test.tsx`
- Modify: `qt-app/frontend/src/components/BootstrapDashboard.tsx`
- Modify: `qt-app/frontend/src/components/BootstrapDashboard.css`
- Modify: `qt-app/frontend/src/components/BootstrapDashboard.test.tsx`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`

### Docs（文档）

- Update during execution（执行时回写）: `docs/superpowers/specs/2026-07-08-qt-bootstrap-config-design-plan/task-*.md`
- Create during Task 06（任务六执行时创建）: `docs/superpowers/specs/2026-07-08-qt-bootstrap-config-design-plan/verification-record.md`

### Do Not Touch（不得触碰）

- Do not modify（不要修改）: `driver-service/**` business code（业务代码）
- Do not modify（不要修改）: ERP Server（ERP 服务端）`system/config` parameter page（参数页面）
- Do not add（不要新增）: router（路由）, global state store（全局状态仓库）, new component library（新组件库）, new URL parser dependency（URL 解析依赖）, frontend localStorage（前端本地存储）.

## Implementation Notes（实现说明）

1. Use existing QSettings（Qt 配置存储） keys under `bootstrap/*`; do not invent a second storage path（存储路径）.
2. `saveBootstrapConfig(config)` must whitelist exactly six fields: `stationAccountId`, `granteeHostId`, `stationId`, `erpBaseUrl`, `driverBaseUrl`, `configVersion`.
3. `readDefaultHostAddress()` must skip loopback（回环地址）, link-local（链路本地地址）, and non-IPv4 address（非 IPv4 地址）.
4. FirstRunConfigPage（首次启动配置页） bypasses `approve.press.config`; dashboard panel（仪表盘面板） obeys it.
5. `approve.press.config` parsing is strict: `String(data ?? "").trim() === "true"` means editable; every other value means readonly（只读）.
6. All UI copy（界面文案） and user-facing errors（用户可见错误） must be Chinese; English technical terms（英文专业术语） must include Chinese explanation when written in docs or comments.
7. New or modified code comments must include `@author PopoY` in file headers and use Chinese or Chinese-English mixed wording.
8. No sensitive field（敏感字段） may be logged or rendered: `sessionToken`, `signedLease`, `signature`, `signaturePayload`, `signalConfig`, `privateKey`, `credential`.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| 配置缺失时显示 first-run blocking page（首次启动阻塞页） | Task 03 |
| 保存并读取 6 个 bootstrap config（启动配置）字段 | Task 01, Task 02, Task 03 |
| `granteeHostId` 默认使用第一个可用 IPv4 address（IPv4 地址） | Task 01, Task 02, Task 03 |
| Dashboard（仪表盘）右侧拆为 ErrorPanel（错误面板）和 BootstrapConfigPanel（启动配置面板） | Task 05 |
| `approve.press.config=true` 才允许 dashboard panel（仪表盘面板）编辑 | Task 04, Task 05 |
| 读取失败、参数缺失或非 `true` 均只读 | Task 04, Task 05 |
| first-run blocking page（首次启动阻塞页）不受 ERP 参数控制 | Task 03, Task 04 |
| 不新增 router（路由）或 state management（状态管理）库 | File Boundary |
| 不写 frontend localStorage（前端本地存储） | Task 02, Task 06 |
| 保存失败展示中文错误摘要 | Task 01, Task 02, Task 03, Task 05 |

## Verification Gates（验证门禁）

Native focused tests（原生聚焦测试）:

```bash
cd qt-app/native
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake -S . -B build -G Ninja -D CMAKE_MAKE_PROGRAM=/Users/PopoY/Qt/Tools/Ninja/ninja
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake --build build
/Users/PopoY/Qt/Tools/CMake/CMake.app/Contents/bin/ctest --test-dir build --output-on-failure
```

Frontend focused tests（前端聚焦测试）:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/nativeBridge.test.ts src/hooks/useBootstrapSession.test.ts src/services/erpClient.test.ts src/components/FirstRunConfigPage.test.tsx src/components/BootstrapConfigPanel.test.tsx src/components/BootstrapDashboard.test.tsx src/App.test.tsx
```

Frontend regression gates（前端回归门禁）:

```bash
cd qt-app/frontend
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```

Backend regression（后端回归，仅验证不改代码）:

```bash
cd driver-service
dotnet test
```

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: spec（规格）目标、非目标、UI 设计、权限控制、Native Bridge（原生桥）设计、Frontend（前端）设计、Error Handling（错误处理）、Testing（测试）和 Rollout（落地顺序）均映射到 Task 01 through Task 06。
- Placeholder scan（占位扫描）: no unresolved placeholder wording（未留占位描述） or open implementation bucket（未留开放实现桶）。
- Type consistency（类型一致性）: field names use the six existing bootstrap config（启动配置） keys; ERP key is exactly `approve.press.config`; dashboard edit state uses boolean `bootstrapConfigEditable` plus readable state `bootstrapConfigApprovalState`.
- YAGNI（你不会需要它） decision: no router（路由）, no store（状态库）, no backend API（后端接口）, no new dependency（新依赖）, no localStorage（本地存储）.

# Task 06: Verification And Record

> @file QT bootstrap config（启动配置）验证与记录任务
> @author PopoY
> @created 2026-07-08
> @purpose 执行 native/frontend focused tests（聚焦测试）、regression gates（回归检查）和 visual smoke（视觉冒烟），并落库验证记录。

## Goal（目标）

Prove the complete QT bootstrap config（启动配置） workflow works without regressing existing bootstrap（启动）、dashboard（仪表盘）、diagnostics（诊断页）, pressJob（压机作业页）, or Driver Service（驱动服务） behavior. Record exact commands（命令） and outcomes（结果） in `verification-record.md`.

## Status（状态）

- `Completed（已完成）`: 已创建并更新 `verification-record.md`，所有 automated gates（自动化门禁）和 1280x720 visual smoke（视觉冒烟）已通过。

## Progress（进度）

- `2026-07-08`: 计划已落库，当前进度 `0/6`。
- `2026-07-08`: Step 1（步骤一）完成；`qt-cmake -S . -B build` 配置通过，`qt-cmake --build build` 构建通过，`ctest --test-dir build --output-on-failure` 结果为 `4/4 tests passed`，覆盖 `config_bridge_spec`、`bootstrap_host_address_spec`、`frontendentrypath_spec`、`mainwindow_spec`，当前进度 `1/6`。
- `2026-07-08`: Step 2（步骤二）完成；`vitest run src/services/nativeBridge.test.ts src/hooks/useBootstrapSession.test.ts src/services/erpClient.test.ts src/components/FirstRunConfigPage.test.tsx src/components/BootstrapConfigPanel.test.tsx src/components/BootstrapDashboard.test.tsx src/App.test.tsx` 结果为 `7/7 files passed`、`75/75 tests passed`，当前进度 `2/6`。
- `2026-07-08`: Step 3（步骤三）完成；逐项修复后 `tsc --noEmit` 通过，`vitest run` 结果为 `20/20 files passed`、`233/233 tests passed`，`vite build` 通过并保留既有 chunk size warning（分块体积提示），当前进度 `3/6`。
- `2026-07-08`: Step 4（步骤四）完成；`dotnet test` 通过，结果为 `176/176 tests passed`、`0 failed`、`0 skipped`，Driver Service（驱动服务）业务代码未修改，当前进度 `4/6`。
- `2026-07-08`: Step 5（步骤五）完成；Playwright（浏览器自动化）在 `1280x720` 通过 mock QWebChannel（模拟 Qt Web 通道）和 mock fetch（模拟网络请求）验证 FirstRunConfigPage（首次启动配置页）六个表单项不重叠，保存后六字段 trim（去空白）并触发 bootstrap retry（启动重试）；dashboard readonly/editable（仪表盘只读/可编辑）均确认 BootstrapConfigPanel（启动配置面板）首屏可见，当前进度 `5/6`。
- `2026-07-08`: Step 6（步骤六）完成；已更新 `verification-record.md`，记录 automated gates（自动化门禁）、visual smoke（视觉冒烟）、sensitive field check（敏感字段检查）和 remaining risk（剩余风险），并同步 `00-overview.md` 与 Task 01 through Task 06（任务一至任务六）状态，当前进度 `6/6`。

## Files（文件）

- Create: `docs/superpowers/specs/2026-07-08-qt-bootstrap-config-design-plan/verification-record.md`
- Update: `docs/superpowers/specs/2026-07-08-qt-bootstrap-config-design-plan/task-*.md`

## Acceptance（验收点）

1. Native tests（原生测试） prove config save/read and default host address（默认主机地址） selection.
2. Frontend focused tests（前端聚焦测试） prove nativeBridge（原生桥服务）, FirstRunConfigPage（首次启动配置页）, ERP approval（ERP 开关）, BootstrapConfigPanel（启动配置面板）, BootstrapDashboard（启动仪表盘）, and App gate（应用门控）.
3. Frontend regression gates（前端回归门禁） pass.
4. Driver Service（驱动服务） tests pass or any failure is recorded with exact scope（范围） and cause（原因）.
5. 1280x720 visual smoke（视觉冒烟） confirms first-run page and dashboard panel fit without overlap（不重叠）.
6. Verification record（验证记录） states what was checked, what passed, what failed, and which manual smoke（手动冒烟） remains.

## Steps（步骤）

- [x] **Step 1: Run native focused verification（运行原生聚焦验证）**

Run:

```bash
cd qt-app/native
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake -S . -B build -G Ninja -D CMAKE_MAKE_PROGRAM=/Users/PopoY/Qt/Tools/Ninja/ninja
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake --build build
/Users/PopoY/Qt/Tools/CMake/CMake.app/Contents/bin/ctest --test-dir build --output-on-failure
```

Expected（预期）:

```text
PASS（通过）: config_bridge_spec, bootstrap_host_address_spec, frontendentrypath_spec, and mainwindow_spec pass.
```

Record（记录）:

```markdown
| Native focused tests（原生聚焦测试） | `cd qt-app/native && ... ctest --test-dir build --output-on-failure` | PASS | exact summary |
```

- [x] **Step 2: Run frontend focused verification（运行前端聚焦验证）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/nativeBridge.test.ts src/hooks/useBootstrapSession.test.ts src/services/erpClient.test.ts src/components/FirstRunConfigPage.test.tsx src/components/BootstrapConfigPanel.test.tsx src/components/BootstrapDashboard.test.tsx src/App.test.tsx
```

Expected（预期）:

```text
PASS（通过）: all focused Vitest（测试框架） files pass.
```

Record（记录）:

```markdown
| Frontend focused tests（前端聚焦测试） | `cd qt-app/frontend && ./node_modules/.bin/vitest run ...` | PASS | exact file/test count |
```

- [x] **Step 3: Run frontend regression gates（运行前端回归门禁）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```

Expected（预期）:

```text
PASS（通过）: TypeScript（类型脚本） compiles, all Vitest（测试框架） suites pass, and Vite（构建工具） build exits 0. Existing chunk size warning（分块体积提示） may remain if unchanged.
```

- [x] **Step 4: Run Driver Service regression（运行驱动服务回归）**

Run:

```bash
cd driver-service
dotnet test
```

Expected（预期）:

```text
PASS（通过）: existing Driver Service（驱动服务） tests pass because this feature does not modify driver-service business code（业务代码）.
```

If this gate fails（若失败）, record exact failing test（失败测试） and whether failure is related to this feature（是否相关）.

- [x] **Step 5: Run 1280x720 visual smoke（运行视觉冒烟）**

Run the dev server（开发服务器）:

```bash
cd qt-app/frontend
pnpm dev
```

Verify with browser automation（浏览器自动化） at `1280x720 viewport（视口）`:

1. Missing config state（缺失配置状态） shows only FirstRunConfigPage（首次启动配置页）.
2. FirstRunConfigPage（首次启动配置页） form fields do not overlap（不重叠）.
3. Saving valid config triggers bootstrap retry（启动重试）.
4. Dashboard（仪表盘） right column（右侧列） shows ErrorPanel（错误面板） above BootstrapConfigPanel（启动配置面板）.
5. Readonly state（只读状态） disables fields and shows “配置修改未授权或开关不可用”.
6. Editable state（可编辑状态） shows save button（保存按钮） and does not reveal `sessionToken`, `signedLease`, `signature`, or `signalConfig`.

Record screenshots（截图记录） under:

```text
qt-app/frontend/output/playwright/qt-bootstrap-config-first-run-1280x720.png
qt-app/frontend/output/playwright/qt-bootstrap-config-dashboard-1280x720.png
```

- [x] **Step 6: Create verification-record.md（创建验证记录）**

Create `docs/superpowers/specs/2026-07-08-qt-bootstrap-config-design-plan/verification-record.md`.

Use this exact structure（使用此结构）:

```markdown
# QT Bootstrap Config Verification Record

> @file QT bootstrap config（启动配置）验证记录
> @author PopoY
> @created 2026-07-08
> @purpose 记录 `2026-07-08-qt-bootstrap-config-design-plan` 的自动化验证、视觉冒烟和剩余风险。

## Automated Gates（自动化门禁）

| Gate（门禁） | Command（命令） | Result（结果） | Evidence（证据） |
| --- | --- | --- | --- |
| Native focused tests（原生聚焦测试） | `cd qt-app/native && ... ctest --test-dir build --output-on-failure` | PASS | exact summary |
| Frontend focused tests（前端聚焦测试） | `cd qt-app/frontend && ./node_modules/.bin/vitest run ...` | PASS | exact summary |
| Frontend tsc（类型检查） | `cd qt-app/frontend && ./node_modules/.bin/tsc --noEmit` | PASS | exact summary |
| Frontend full tests（前端全量测试） | `cd qt-app/frontend && ./node_modules/.bin/vitest run` | PASS | exact summary |
| Frontend build（前端构建） | `cd qt-app/frontend && ./node_modules/.bin/vite build` | PASS | exact summary |
| Driver Service tests（驱动服务测试） | `cd driver-service && dotnet test` | PASS | exact summary |

## Visual Smoke（视觉冒烟）

| Check（检查） | Result（结果） | Evidence（证据） |
| --- | --- | --- |
| FirstRunConfigPage（首次启动配置页） 1280x720 | PASS | screenshot path |
| BootstrapConfigPanel（启动配置面板） readonly 1280x720 | PASS | screenshot path |
| BootstrapConfigPanel（启动配置面板） editable 1280x720 | PASS | screenshot path |

## Sensitive Field Check（敏感字段检查）

| Field（字段） | Rendered（是否渲染） | Logged（是否记录） |
| --- | --- | --- |
| `sessionToken` | No/Yes | No/Yes |
| `signedLease` | No/Yes | No/Yes |
| `signature` | No/Yes | No/Yes |
| `signalConfig` | No/Yes | No/Yes |

## Remaining Risk（剩余风险）

- State exact residual risk（剩余风险） or write `None observed（未观察到）`.
```

After this record is created, update every task file status/progress（状态/进度） with completed step count（完成步数）.

Commit message（提交消息，如执行时需要）:

```bash
git add docs/superpowers/specs/2026-07-08-qt-bootstrap-config-design-plan
git commit -m "docs(qt-app): 记录 bootstrap config 验证结果"
```

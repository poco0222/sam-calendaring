# QT Bootstrap Config Verification Record

> @file QT bootstrap config（启动配置）验证记录
> @author PopoY
> @created 2026-07-08
> @purpose 记录 `2026-07-08-qt-bootstrap-config-design-plan` 的自动化验证、视觉冒烟和剩余风险。

## Automated Gates（自动化门禁）

| Gate（门禁） | Command（命令） | Result（结果） | Evidence（证据） |
| --- | --- | --- | --- |
| Native focused tests（原生聚焦测试） | `cd qt-app/native && /Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake -S . -B build -G Ninja -D CMAKE_MAKE_PROGRAM=/Users/PopoY/Qt/Tools/Ninja/ninja && /Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake --build build && /Users/PopoY/Qt/Tools/CMake/CMake.app/Contents/bin/ctest --test-dir build --output-on-failure` | PASS | `4/4 tests passed`: `config_bridge_spec`, `bootstrap_host_address_spec`, `frontendentrypath_spec`, `mainwindow_spec`. |
| Frontend focused tests（前端聚焦测试） | `cd qt-app/frontend && ./node_modules/.bin/vitest run src/services/nativeBridge.test.ts src/hooks/useBootstrapSession.test.ts src/services/erpClient.test.ts src/components/FirstRunConfigPage.test.tsx src/components/BootstrapConfigPanel.test.tsx src/components/BootstrapDashboard.test.tsx src/App.test.tsx` | PASS | `7/7 files passed`, `75/75 tests passed`. |
| Frontend tsc（类型检查） | `cd qt-app/frontend && ./node_modules/.bin/tsc --noEmit` | PASS | Command exited 0 with no TypeScript（类型脚本） errors. |
| Frontend full tests（前端全量测试） | `cd qt-app/frontend && ./node_modules/.bin/vitest run` | PASS | `20/20 files passed`, `233/233 tests passed`. |
| Frontend build（前端构建） | `cd qt-app/frontend && ./node_modules/.bin/vite build` | PASS | Build exited 0; output includes existing chunk size warning（分块体积提示） for `dist/assets/index-BS_6Eo-R.js` at `1,137.08 kB`. |
| Driver Service tests（驱动服务测试） | `cd driver-service && dotnet test` | PASS | `176/176 tests passed`, `0 failed`, `0 skipped`; Driver Service（驱动服务）business code（业务代码）未修改。 |

## Visual Smoke（视觉冒烟）

| Check（检查） | Result（结果） | Evidence（证据） |
| --- | --- | --- |
| FirstRunConfigPage（首次启动配置页） 1280x720 | PASS | `qt-app/frontend/output/playwright/qt-bootstrap-config-first-run-1280x720.png`; Playwright（浏览器自动化）断言 `6` 个 `.ant-form-item` 不重叠，dashboard（仪表盘）未提前渲染，保存后六字段 trim（去空白）并触发 bootstrap retry（启动重试）。 |
| BootstrapConfigPanel（启动配置面板） readonly 1280x720 | PASS | `qt-app/frontend/output/playwright/qt-bootstrap-config-dashboard-1280x720.png`; `.bootstrap-config-panel` bounding box（边界框）为 `y=432`、`height=304`、`visibleHeight=288`，`6` 个 disabled input（禁用输入框），无 save button（保存按钮）。 |
| BootstrapConfigPanel（启动配置面板） editable 1280x720 | PASS | `qt-app/frontend/output/playwright/qt-bootstrap-config-dashboard-editable-1280x720.png`; `.bootstrap-config-panel` bounding box（边界框）为 `y=432`、`height=284`、`visibleHeight=284`，`6` 个 enabled input（启用输入框），显示 save button（保存按钮）。 |

## Sensitive Field Check（敏感字段检查）

| Field（字段） | Rendered（是否渲染） | Logged（是否记录） |
| --- | --- | --- |
| `sessionToken` | No | No observed（未观察到） |
| `signedLease` | No | No observed（未观察到） |
| `signature` | No | No observed（未观察到） |
| `signalConfig` | No | No observed（未观察到） |

Evidence（证据）:

- `qt-app/frontend/src/types/native.ts` 的 `NativeBootstrapConfig（原生启动配置）` 仅包含六个字段：`stationAccountId`、`granteeHostId`、`stationId`、`erpBaseUrl`、`driverBaseUrl`、`configVersion`。
- `FirstRunConfigPage（首次启动配置页）` 和 `BootstrapConfigPanel（启动配置面板）` 只渲染六个 bootstrap config（启动配置）字段；Playwright（浏览器自动化）对 first-run、dashboard readonly、dashboard editable 的 body text（页面文本）检查未出现 `sessionToken`、`signedLease`、`signature`、`signalConfig`。
- `BootstrapConfigPanel.test.tsx` 断言 readonly HTML（只读 HTML）不包含 `sessionToken`、`signedLease`、`signature`、`signalConfig`；`BootstrapDashboard.test.tsx` 断言 dashboard（仪表盘）不渲染 `secret-session-token`、`lease-01` 或 `signalConfig`。
- Console log（控制台日志）只出现 React DevTools（React 开发工具）提示、favicon（网站图标）404 和 `[qt-app-bootstrap] {record: Object}` diagnostic（诊断）摘要；未观察到敏感字段名或敏感字段原文。
- Frontend localStorage（前端本地存储）检查未发现 bootstrap config（启动配置）、FirstRunConfigPage、BootstrapConfigPanel 或 nativeBridge（原生桥服务）新增 localStorage/sessionStorage（本地/会话存储）读写；现有 localStorage 命中来自 `AntdRootProvider（Ant Design 根 Provider）` theme mode（主题模式）持久化，和 bootstrap config（启动配置）无关。

## Remaining Risk（剩余风险）

- Manual smoke（手动冒烟）仍建议在真实 QT App（Qt 应用）环境执行，尤其是 QSettings（Qt 配置存储）真实写入、真实 ERP `approve.press.config` 读取和真实 Driver Service（驱动服务）连接。

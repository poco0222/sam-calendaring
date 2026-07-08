# QT App Press Working Mold Lock Verification Record

> @file QT App 锁模验证记录
> @author PopoY
> @created 2026-06-30
> @purpose 记录 Press Working Page（压机作业页面）锁定模具功能的最终验证结果。

## Execution Summary（执行摘要）

- Status（状态）: Completed（已完成）with post-review fixes（含复核后修复）
- Scope（范围）: 原 Task4 只记录验证证据；复核后补充修复 Task3 failure sanitization（失败脱敏）并刷新 Task4 boundary evidence（边界证据）。
- Generated Verification Artifacts（生成的验证证据）: `pnpm build` refreshed `qt-app/frontend/dist/**` build output（构建输出）；Playwright CLI（浏览器自动化命令行）wrote visual evidence（视觉证据）under `qt-app/frontend/.playwright-cli/**`；workspace（工作区）中 `qt-app/native/build/**` 也存在晚于 spec（规格）的 generated files（生成文件）。
- Repository Boundary（仓库边界）: 当前执行目录及 Task4 指定子目录均不是 Git repository（Git 仓库），因此无法通过 Git dirty files（未提交文件）确认变更边界；后续以命令输出、文件边界和实际编辑清单记录。
- Focused Tests（聚焦测试）: PASS（通过），`4` 个 test files（测试文件），`48` 个 tests（测试）。
- Full Regression（完整回归）: PASS（通过），`17` 个 test files（测试文件），`131` 个 tests（测试）。
- Build（构建）: PASS（通过），仅记录 Vite chunk-size warning（包体积告警）。
- Visual Smoke（视觉冒烟）: PASS WITH MOCKED RUNTIME（使用模拟运行时通过），证据截图和手工限制已记录。
- Sensitive Boundary（敏感信息边界）: PASS WITH ALLOWED MATCHES（通过，存在允许匹配），非测试匹配已逐项解释。

## Automated Gates（自动化门禁）

### Step 2: Focused Tests（聚焦测试）

Run at（执行时间）: 2026-06-30 15:30:37

Command（命令）:

```bash
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx src/services/logging.test.ts
```

Result（结果）: PASS（通过）

Evidence（证据）:

```text
Test Files  4 passed (4)
Tests       48 passed (48)
Duration    927ms
```

### Step 3: Full Frontend Regression And Build（完整前端回归与构建）

Run at（执行时间）: 2026-06-30 15:30:57

Command（命令）:

```bash
pnpm test
```

Result（结果）: PASS（通过）

Evidence（证据）:

```text
Test Files  17 passed (17)
Tests       131 passed (131)
Duration    1.33s
```

Run at（执行时间）: 2026-06-30 16:25:40 CST

Command（命令）:

```bash
pnpm build
```

Result（结果）: PASS（通过），with warning（带告警）

Allowed Warning（允许告警）:

```text
(!) Some chunks are larger than 500 kB after minification.
```

Build Output Summary（构建输出摘要）:

```text
dist/index.html                     0.54 kB | gzip:   0.36 kB
dist/assets/index-BOoTNIyY.css     16.97 kB | gzip:   3.28 kB
dist/assets/index-DOE5ZXsU.js   1,055.28 kB | gzip: 337.01 kB
built in 155ms
```

## Visual Smoke（视觉冒烟）

### Step 6: 1280x720 Visual Smoke（视觉冒烟）

Run at（执行时间）: 2026-06-30

Browser Method（浏览器方法）: Playwright CLI（浏览器自动化命令行）, session（会话） `task4-mold-lock`

Viewport（视口）:

```text
1280x720
```

Dev Server（开发服务器）:

```text
http://localhost:5173/
```

Evidence（证据）:

| Evidence Path（证据路径） | Purpose（用途） |
| --- | --- |
| `qt-app/frontend/.playwright-cli/page-2026-06-30T07-34-59-675Z.png` | 缺少 required filters（必填筛选）时点击“锁定模具”，显示中文 warning（警告）“请选择班组”，Mold Lock Panel（模具锁定面板）未打开。 |
| `qt-app/frontend/.playwright-cli/page-2026-06-30T07-40-46-348Z.png` | Mocked bootstrap（模拟启动）成功后，Press Working Page（压机作业页）显示 filter row（筛选行）、action row（操作行）、current job table（当前作业表）和 realtime signals（实时信号）。 |
| `qt-app/frontend/.playwright-cli/page-2026-06-30T07-41-24-869Z.png` | Required filters（必填筛选）存在后打开 Mold Lock Panel（模具锁定面板），toolbar（工具栏）在一行展示，candidate table（候选表）为空态可见。 |
| `qt-app/frontend/.playwright-cli/page-2026-06-30T07-41-52-609Z.png` | Mold candidate search（模具候选查询）后候选表显示 `MO-001 / P123-MOLD-01 / OP10 / P123 / 上模 / CRAFT-001`，未展示 raw response（原始响应）或 device/network fields（设备/网络字段）。 |
| `qt-app/frontend/.playwright-cli/page-2026-06-30T07-44-09-167Z.png` | Dynamic mock（动态模拟）锁模成功后 current job table（当前作业表）刷新为 `P123-MOLD-01`，Driver Service（驱动服务）状态保持 `成功 / Connected`。 |

Observed Results（观察结果）:

- Required filters（必填筛选）缺失时，中文提示为 `请选择班组`，panel（面板）未打开。
- Required filters（必填筛选）存在后，Mold Lock Panel（模具锁定面板）可打开。
- Panel toolbar（面板工具栏）在 1280x720 viewport（视口）下单行展示。
- Candidate table（候选表）字段可读，含单选 radio（单选按钮），只显示白名单字段。
- Lock submit（锁模提交）成功后，Playwright text output（文本输出）包含中文 success message（成功消息）`锁定完成`。
- Dynamic mock（动态模拟）在 lock endpoint（锁模端点）成功后切换 current jobs（当前作业）响应，最终表格显示 `P123-MOLD-01 / 已锁模`。
- Visible sensitive text scan（可见敏感文本扫描）返回 `[]`，未在 UI（界面）文本中发现 `sessionToken`, `signedLease`, `signature`, `signalConfig`, `privateKey`, `credential`, `deviceId`, `ipAddress`, `operationIp`, `selectedRows`。

Manual Limitation（手工限制）:

- 本地浏览器没有 Qt WebChannel（Qt Web 通道）和真实 ERP/Driver hardware（企业资源计划/驱动硬件）上下文；visual smoke（视觉冒烟）使用 Playwright route（网络拦截）和 init script（初始化脚本）模拟 Qt bridge（Qt 桥接）、ERP endpoints（端点）和 Driver Service（驱动服务）响应。该验证证明 UI flow（界面流程）和敏感信息可见边界，不证明真实设备链路。

## Sensitive Data Boundary（敏感信息边界）

### Step 5: Sensitive Data Boundary Scan（敏感信息边界扫描）

Run at（执行时间）: 2026-06-30

Command（命令）:

```bash
rg -n "sessionToken|signedLease|signature|signalConfig|privateKey|credential|deviceId|ipAddress|operationIp|selectedRows" src/components/PressJobPage.tsx src/components/PressJobPage.test.tsx src/services/erpClient.ts src/services/erpClient.test.ts src/domain/logRecord.ts src/services/logging.test.ts
```

Result（结果）: PASS WITH ALLOWED MATCHES（通过，存在允许匹配）

Non-test Matches（非测试匹配）:

| File（文件） | Lines（行） | Match（匹配） | Allowed Reason（允许原因） |
| --- | --- | --- | --- |
| `src/services/erpClient.ts` | 97, 106 | `sessionToken` | Type shape（类型结构）声明 authenticated ERP request（已认证 ERP 请求）入参。 |
| `src/services/erpClient.ts` | 272, 282, 290-291 | `sessionToken`, `signalConfig`, `signedLease` | `fetchLeasePackage` sends `sessionToken` only in ERP request body（请求体）for lease bootstrap（租约启动），return value narrows to `signalConfig` and `signedLease` only. |
| `src/services/erpClient.ts` | 314, 335, 339, 386, 393, 424 | `sessionToken` | Existing read helpers（读取辅助函数）use token for authenticated ERP lookup/current-job calls（已认证查询/当前作业调用）。 |
| `src/services/erpClient.ts` | 459 | `sessionToken` | Mold candidate search（模具候选查询）passes token to `readJson` auth path（认证路径）and sends `X-Correlation-Id（关联 ID 请求头）`. |
| `src/services/erpClient.ts` | 486 | `sessionToken` | Mold lock submit（锁模提交）passes token as `bearerToken（Bearer 令牌）`; request body is narrowed separately. |
| `src/services/erpClient.ts` | 513, 520, 526, 536 | `sessionToken` | Bootstrap orchestration（启动编排）passes login token into existing client helpers; `PressJobPage（压机作业页）` does not read token directly. |
| `src/services/erpClient.ts` | 796 | `selectedRows` | `narrowPressMoldLockRequest` rebuilds lock request（锁模请求）from whitelist fields before submit. |
| `src/services/erpClient.ts` | 872-876 | `signature`, `signedLease`, `signalConfig` | Bootstrap placeholder rejection（启动占位租约拒绝）checks known marker fields and does not log raw payload. |
| `src/services/erpClient.ts` | 908, 916 | `sessionToken` | `narrowAutoLoginResponse` validates and returns approved bootstrap session（启动会话）shape. |
| `src/components/PressJobPage.tsx` | 1128 | `selectedRows` | `createPressMoldLockRequest` builds required ERP lock request body（锁模请求体）from selected mold（选中模具）only. |
| `src/components/PressJobPage.tsx` | 1149, 1184 | `selectedRows` | Diagnostic summary（诊断摘要）intentionally ignores full `selectedRows`; only safe fields such as `moldNo` are copied. |
| `src/components/PressJobPage.tsx` | 1308-1320 | `sessionToken`, `signedLease`, `signature`, `signalConfig`, `privateKey`, `credential`, `selectedRows`, `deviceId` | `isSafeChineseBusinessMessage` banned fragments（禁用片段）block sensitive terms from visible error messages（可见错误消息）. |

Test Match Summary（测试匹配摘要）:

- `src/services/logging.test.ts` seeds sensitive fields（敏感字段）and asserts diagnostic logs（诊断日志）do not contain them.
- `src/components/PressJobPage.test.tsx` asserts lock request（锁模请求）omits raw `deviceId/ip/port（设备和网络字段）`, page source（页面源码）does not read bootstrap token（启动令牌）, and rendered HTML（渲染 HTML）does not contain token/lease/signature/config secrets（令牌/租约/签名/配置敏感值）.
- `src/services/erpClient.test.ts` asserts ERP client（ERP 客户端）drops forbidden fields（禁用字段）from outgoing mold lock payload（锁模出站载荷）and keeps auth token（认证令牌） in the approved auth path（授权路径）.
- `src/domain/logRecord.ts` produced no matches（无匹配） in this scan.

## Driver Service And Native Boundary（驱动服务与原生壳边界）

### Step 1: Repository Boundary（仓库边界）

Run at（执行时间）: 2026-06-30

| Command（命令） | Exit Code（退出码） | Result（结果） |
| --- | ---: | --- |
| `git status --short --branch` | 128 | `fatal: not a git repository (or any of the parent directories): .git` |
| `git -C qt-app/frontend status --short --branch` | 128 | `fatal: not a git repository (or any of the parent directories): .git` |
| `git -C driver-service status --short --branch` | 128 | `fatal: not a git repository (or any of the parent directories): .git` |
| `git -C qt-app/native status --short --branch` | 128 | `fatal: not a git repository (or any of the parent directories): .git` |

Conclusion（结论）: Git evidence（Git 证据）不可用；本记录后续明确区分自动化命令结果、read-only scan（只读扫描）和 manual visual smoke（手工视觉冒烟）结果。

### Step 4: Driver Service And Native Timestamp Scan（驱动服务与原生壳时间戳扫描）

Run at（执行时间）: 2026-06-30

Command（命令）:

```bash
find driver-service qt-app/native -type f -newer docs/qt-app-press-working-mold-lock-spec.md -print
```

Result（结果）: INCONCLUSIVE（证据不充分）

Output（输出）:

```text
driver-service/tests/Sam.Calendaring.DriverService.Tests/bin/Debug/net10.0/.msCoverageSourceRootsMapping_Sam.Calendaring.DriverService.Tests
driver-service/tests/Sam.Calendaring.DriverService.Tests/bin/Debug/net10.0/CoverletSourceRootsMapping_Sam.Calendaring.DriverService.Tests
qt-app/native/build/.ninja_deps
qt-app/native/build/.ninja_log
qt-app/native/build/.qt/qml_imports/qt_app_native_build.rsp
qt-app/native/build/.qt/qml_imports/qt_app_native_conf.cmake
qt-app/native/build/.qt/qml_imports/qt_app_native_conf.rsp
qt-app/native/build/CMakeFiles/InstallScripts.json
qt-app/native/build/CMakeFiles/TargetDirectories.txt
qt-app/native/build/CMakeFiles/clean_additional.cmake
qt-app/native/build/CMakeFiles/cmake.check_cache
qt-app/native/build/CMakeFiles/rules.ninja
qt-app/native/build/CTestTestfile.cmake
qt-app/native/build/build.ninja
qt-app/native/build/cmake_install.cmake
qt-app/native/build/config_bridge_spec_autogen/deps
qt-app/native/build/config_bridge_spec_autogen/timestamp
qt-app/native/build/frontendentrypath_spec_autogen/deps
qt-app/native/build/frontendentrypath_spec_autogen/timestamp
qt-app/native/build/mainwindow_spec_autogen/deps
qt-app/native/build/mainwindow_spec_autogen/timestamp
qt-app/native/build/qt_app_native_autogen/deps
qt-app/native/build/qt_app_native_autogen/timestamp
```

Interpretation（解释）: 以上输出位于 `driver-service/tests/.../bin` 和 `qt-app/native/build/**` generated files（生成文件）目录；未命中 `driver-service/src/**`、`qt-app/native/src/**`、`qt-app/native/tests/**` 或 `qt-app/native/CMakeLists.txt` source files（源码文件）。`find -newer` 只能说明 timestamp（时间戳）晚于 spec（规格）文件，不能证明 Task4 或 post-review fix（复核后修复）修改过 Driver Service（驱动服务）或 native source（原生源码）。当前 Git evidence（Git 证据）不可用，因此本轮边界结论依赖实际编辑清单和 source path（源码路径）扫描。

Actual Task4 Manual Edited Files（本轮 Task4 手工编辑文件）:

```text
docs/qt-app-press-working-mold-lock-spec-plan/verification-record.md
docs/qt-app-press-working-mold-lock-spec-plan/task-04-verification-record.md
```

Post-review Manual Edited Files（复核后手工编辑文件）:

```text
qt-app/frontend/src/components/PressJobPage.tsx
qt-app/frontend/src/components/PressJobPage.test.tsx
docs/qt-app-press-working-mold-lock-spec-plan/task-03-submit-lock-and-current-job-refresh.md
docs/qt-app-press-working-mold-lock-spec-plan/task-04-verification-record.md
docs/qt-app-press-working-mold-lock-spec-plan/verification-record.md
```

Generated Verification Artifacts（生成的验证证据）:

```text
qt-app/frontend/dist/**
qt-app/frontend/.playwright-cli/**
qt-app/native/build/**
```

Boundary Conclusion（边界结论）: 本轮未编辑 `driver-service/**` 或 `qt-app/native/**` source files（源码文件）；`qt-app/native/build/**` 命中仅作为 generated files（生成文件）和 timestamp evidence（时间戳证据）记录。复核后修复修改了 frontend business source code（前端业务源码）中的 failure sanitization（失败脱敏）逻辑。因 Git repository（Git 仓库）不可用，无法提供 Git dirty-file（未提交文件）级别证明。

## Known Gaps（已知缺口）

- Git repository（Git 仓库）不可用，无法用 `git status` 证明 changed files（变更文件）边界。
- `find -newer` 仅提供 timestamp evidence（时间戳证据），不是 reliable change evidence（可靠变更证据）。
- Visual smoke（视觉冒烟）使用 mocked Qt bridge/ERP/Driver Service（模拟 Qt 桥接/企业资源计划/驱动服务），未连接真实设备和真实 ERP endpoint（端点）。

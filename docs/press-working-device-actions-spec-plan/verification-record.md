# Verification Record（验证记录）

> @file Task7 verification record（任务七验证记录）
> @author PopoY
> @created 2026-07-02
> @purpose 记录 App wiring（应用接线）、diagnostic whitelist（诊断白名单）、security boundary（安全边界）和 visual smoke（视觉冒烟）证据。

## Status（状态）

- `Completed（已完成）`: Task7 App wiring（应用接线）、device event subscription（设备事件订阅）、diagnostic summary whitelist（诊断摘要白名单）、review hardening（审查后加固）、automated gates（自动化门禁）、static scans（静态扫描）和 visual smoke（视觉冒烟）均已完成。
- Scope（范围）: 本记录只覆盖 Task7，不推进 Task7 以外任务或额外业务行为。
- `2026-07-03 Follow-up repair（复核修复）`: 已修复 review（复核）发现的 `CleanupPending（清理待完成）` 状态覆盖、SSE snapshot signalCode（服务器发送事件快照信号码）禁止标识过滤和 audit targetEndpoint（审计目标端点）清洗缺口。

## Automated Verification（自动化验证）

| Gate（门禁） | Command（命令） | Result（结果） |
| --- | --- | --- |
| RED frontend（前端失败测试） | `cd qt-app/frontend && ./node_modules/.bin/vitest run src/App.test.tsx src/services/logging.test.ts src/components/PressJobPage.test.tsx` | 预期失败：`App` 缺少 `refreshSignalSnapshot`、`PressJobPage` 接收完整 `bootstrapSession`、`createDiagnosticLog` 未运行时裁剪白名单。 |
| RED driver（驱动失败测试） | `cd driver-service && dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~LoggingContractTests"` | 预期失败：日志清洗未覆盖 `registerAddress/writeValue/signalValues/snapshotValues`。 |
| Review RED frontend（审查后前端失败测试） | `cd qt-app/frontend && ./node_modules/.bin/vitest run src/App.test.tsx src/services/driverDeviceEventsClient.test.ts` | 预期失败：完整 `driverSession（驱动会话）` 仍透传给 `PressJobPage（压机作业页）`，SSE snapshot（服务器发送事件快照）敏感 `signalCode（信号码）` 未过滤。 |
| Review RED driver（审查后驱动失败测试） | `cd driver-service && dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~LoggingContractTests"` | 预期失败：JSON（对象表示法）形式敏感字段和结构化 `targetDeviceId/fencingToken（目标设备/隔离令牌）` 未脱敏。 |
| GREEN focused frontend（前端聚焦通过） | `cd qt-app/frontend && ./node_modules/.bin/vitest run src/App.test.tsx src/services/driverDeviceEventsClient.test.ts` | Passed（通过）：`2` files, `11/11` tests。 |
| GREEN logging contract（日志契约通过） | `cd driver-service && dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~LoggingContractTests"` | Passed（通过）：`6/6` tests。 |
| Driver focused（驱动聚焦） | `cd driver-service && dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~DeviceCommandContractTests\|FullyQualifiedName~PressDeviceCommandExecutorTests\|FullyQualifiedName~PressDownCountMonitorTests\|FullyQualifiedName~DeviceEventStreamTests\|FullyQualifiedName~LoggingContractTests"` | Passed（通过）：`48/48` tests。 |
| Driver regression（驱动回归） | `cd driver-service && dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj` | Passed（通过）：`157/157` tests。 |
| Frontend focused（前端聚焦） | `cd qt-app/frontend && ./node_modules/.bin/vitest run src/services/driverClient.test.ts src/services/driverDeviceEventsClient.test.ts src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx src/services/logging.test.ts src/hooks/useDriverSession.test.ts` | Passed（通过）：`7` files, `110/110` tests。 |
| Frontend regression（前端回归） | `cd qt-app/frontend && pnpm test` | Passed（通过）：`18` files, `179/179` tests。 |
| Frontend build（前端构建） | `cd qt-app/frontend && pnpm build` | Passed（通过）：Vite build 成功；保留 existing chunk size warning（既有分块体积警告）。 |

## Visual Smoke（视觉冒烟）

- Dev server（开发服务）: `cd qt-app/frontend && pnpm dev --host 127.0.0.1`
- URL（地址）: `http://127.0.0.1:5173/`
- Browser（浏览器）: Playwright（浏览器自动化）使用 installed Chrome channel（已安装 Chrome 通道）；本地 Playwright bundled Chromium（捆绑 Chromium）未下载，因此没有使用 bundled browser（捆绑浏览器）。
- Viewport（视口）: `1280x720`
- Screenshot（截图）: `/Users/PopoY/workingFiles/Projects/SAM/sam-calendaring/output/playwright/task7-press-job-1280x720.png`

Observed（观察结果）:

- Seven action buttons（七个动作按钮）均可见且未重叠：`建立通信 / 开始加工 / 完成加工 / 移入 / 移出 / 入线 / 出线`。
- Mocked Qt bridge（模拟 Qt 桥接）、ERP API（企业资源计划接口）和 Driver API（驱动接口）下，`开始加工` workflow（流程）返回中文成功提示 `开始加工已完成。`。
- Running job（加工中作业）状态下点击 `出线`，出现 confirmation modal（确认弹窗）：`当前有正在加工的模具，出线将自动完成加工，是否确认出线？`，点击 `取消` 后弹窗关闭并出现 `已取消出线。`。
- Mocked device event disconnect（模拟设备事件断开）触发 `EVENT_STREAM_UNAVAILABLE` diagnostic log（诊断日志），日志字段只包含白名单 record（记录）字段。
- DOM/HTML（文档对象模型/超文本标记语言）未出现 smoke secret（冒烟密钥）或敏感字段：`visual-token`、`signedLease`、`signalConfig`、`privateKey`、`credential`、`registerAddress`、`writeValue`、`drop-driver-target`、`drop-device-signal`。

## Security Boundary（安全边界）

Static scans（静态扫描）:

```bash
rg -n "sessionToken|signedLease|signature|signalConfig|privateKey|credential|deviceId|ip|port|registerAddress|writeValue" qt-app/frontend/src driver-service/src driver-service/tests
```

Result（结果）:

- Required scan（必需扫描）命中较多字段名，已逐类复核：client contract（客户端契约）、type narrowing（类型收窄）、negative assertions（负向断言）、sanitizer（清洗器）、Driver internal lease/signal parsing（驱动内部租约/信号解析）和 build artifacts（构建产物）。
- `ip` pattern（模式）本身会命中 `import/description/ellipsis` 等无关字符串，因此只作为 broad smoke scan（宽泛冒烟扫描），不作为逐行禁止条件。
- Focused scan（聚焦扫描）确认 `PressJobPage（压机作业页）` 未接收 `bootstrapSession={bootstrapSession}` 或完整 `driverSession={driverSession}`，只接收 sanitized `PressJobPageBootstrapSession（脱敏启动会话）` 和 `PressJobPageDriverSession（脱敏驱动会话）`。
- `createDiagnosticLog（创建诊断日志）` 在 runtime（运行时）按 `logRecordKeys（日志字段白名单）` 裁剪，禁止调用方通过 `as any` 混入敏感字段。
- `driverDeviceEventsClient（驱动事件客户端）` 在 root boundary（根边界）过滤敏感 `signalCode（信号码）`，保留 `pressDownCount（下压计数）` 等安全快照值。
- Driver `AuditLogEntry（审计日志条目）` 与 `DiagnosticLogEntry（诊断日志条目）` 的 sanitizer（清洗器）覆盖 `signedLease/signature/signalConfig/privateKey/credential/sessionToken` 以及 `registerAddress/writeValue/signalValues/snapshotValues/ip/port/deviceId/targetDeviceId/fencingToken` 的 `key=value`、JSON key（JSON 键）和 `key: value` 形式；结构化 `TargetDeviceId/FencingToken（目标设备/隔离令牌）` 通过 factory（工厂方法）落库时置空。

No-polling scan（无轮询扫描）:

```bash
rg -n "pressDownCount|setInterval|requestAnimationFrame|polling|refetch" qt-app/frontend/src
```

Result（结果）:

- `pressDownCount（下压计数）` 只出现在 domain type（领域类型）、event client（事件客户端）、workflow/test（流程/测试）和 safe signal display（安全信号展示）中。
- `setInterval` 只出现在 `DiagnosticLogsPage.tsx` 的 diagnostic logs refresh（诊断日志刷新）中，不是 `pressDownCount` polling（下压计数轮询）。
- 未发现 `requestAnimationFrame` 或 Web polling（网页轮询）用于 `pressDownCount`。

## Known Gaps（已知缺口）

- Visual smoke（视觉冒烟）使用 mock Qt bridge/ERP/Driver（模拟桥接和接口），未连接真实 PLC（可编程逻辑控制器）或真实 ERP environment（企业资源计划环境）。
- `pnpm build` 成功但保留 Vite chunk size warning（分块体积警告）：`index-*.js` 超过 `500 kB`。本轮 Task7 不做 code-splitting（代码分割）重构，避免超出范围。
- Required sensitive scan（必需敏感字段扫描）按计划原样执行，包含 `driver-service/src/**/bin` 与 `obj` build artifacts（构建产物）命中；这些产物来自测试/构建输出，不作为生产源码泄漏判断。

## Git State（Git 状态）

No Git repository（非 Git 仓库）state was verified in all relevant roots（相关根目录均已验证）:

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-calendaring
$ git status --short --branch
fatal: not a git repository (or any of the parent directories): .git
```

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-calendaring/driver-service
$ git status --short --branch
fatal: not a git repository (or any of the parent directories): .git
```

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-calendaring/qt-app/frontend
$ git status --short --branch
fatal: not a git repository (or any of the parent directories): .git
```

Commit（提交）未执行，因为当前目录和子目录均不是 Git repository（Git 仓库）。

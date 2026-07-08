# Task 07: App Wiring Diagnostics And Verification Record

> @file App wiring（应用接线）、诊断与验证记录任务
> @author PopoY
> @created 2026-07-02
> @purpose 完成 QT App（Qt 应用）动作回调注入、diagnostic summary（诊断摘要）、自动化与视觉验证记录。

## Goal（目标）

Finish end-to-end wiring（端到端接线） in `App.tsx（应用入口）`, prove the security boundary（安全边界）, and create `verification-record.md（验证记录）`. This task must not add new business behavior（业务行为） beyond wiring and verification; any bug found during verification should be fixed in the smallest owning file（最小归属文件） and recorded here.

## Status（状态）

- `Completed（已完成）`: Task7 已完成，App wiring（应用接线）、diagnostic whitelist（诊断白名单）、review hardening（审查后加固）、automated gates（自动化门禁）、static scans（静态扫描）、visual smoke（视觉冒烟）和 no-git state（非 Git 状态）均已记录；未推进 Task7 以外范围。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/9`。
- `2026-07-02`: Step 1 完成，已修改 `App.test.tsx`、`logging.test.ts`、`PressJobPage.test.tsx` 和 `LoggingContractTests.cs` 增加 RED tests（失败测试），当前进度 `1/9`。
- `2026-07-02`: Step 2 完成，`vitest run src/App.test.tsx src/services/logging.test.ts src/components/PressJobPage.test.tsx` 出现 3 个预期失败，`dotnet test ... --filter "FullyQualifiedName~LoggingContractTests"` 出现 1 个预期失败，当前进度 `2/9`。
- `2026-07-02`: Step 3 完成，`App.tsx` 已注入 `refreshSignalSnapshot` 与脱敏 `PressJobPageBootstrapSession（压机作业页启动会话）`，`vitest run src/App.test.tsx src/services/logging.test.ts src/components/PressJobPage.test.tsx` 通过 `65/65`，当前进度 `3/9`。
- `2026-07-02`: Step 4 完成，`App.tsx` 保持 `SSE（服务器发送事件）` subscription（订阅）卸载关闭、阈值事件 `type=start` 记录与去重逻辑，未新增 Web polling（网页轮询），同一 focused vitest（聚焦测试）通过 `65/65`，当前进度 `4/9`。
- `2026-07-02`: Step 5 完成，`LogRecord（日志记录）` 与 `createDiagnosticLog（创建诊断日志）` 已按 Task7 whitelist（白名单）运行时裁剪；`dotnet test ... --filter "FullyQualifiedName~LoggingContractTests"` 通过 `5/5`，focused vitest（聚焦测试）通过 `65/65`，当前进度 `5/9`。
- `2026-07-02`: Step 6 完成，driver focused tests（驱动聚焦测试）通过 `34/34`、driver regression（驱动回归）通过 `143/143`、frontend focused tests（前端聚焦测试）通过 `102/102`、`pnpm test` 通过 `177/177`、`pnpm build` 成功但保留 Vite chunk size warning（分块体积警告），当前进度 `6/9`。
- `2026-07-02`: Step 7 完成，required sensitive scan（必需敏感字段扫描）命中 client contract（客户端契约）、type narrowing（类型收窄）、negative assertions（负向断言）、sanitizer（清洗器）和 build artifacts（构建产物）中的字段名；focused scan（聚焦扫描）确认 `PressJobPage（压机作业页）` 未接收完整 `bootstrapSession`，no-polling scan（无轮询扫描）仅命中 `DiagnosticLogsPage` 日志刷新 `setInterval`，未发现 pressDownCount Web polling（网页轮询），当前进度 `7/9`。
- `2026-07-02`: Step 8 完成，已创建 `verification-record.md（验证记录）`；`pnpm dev --host 127.0.0.1` 下以 `1280x720` viewport（视口）完成 Playwright/Chrome visual smoke（视觉冒烟），七按钮可见、开始加工成功、出线确认弹窗可取消、DOM/HTML 无 smoke secret（冒烟密钥）和敏感字段，当前进度 `8/9`。
- `2026-07-02`: Step 9 完成，`sam-calendaring`、`driver-service`、`qt-app/frontend` 三处 `git status --short --branch` 均返回 `fatal: not a git repository (or any of the parent directories): .git`；未生成 commit（提交），no-git state（非 Git 状态）已写入验证记录，当前进度 `9/9`。
- `2026-07-02`: Review hardening（审查后加固）完成，新增 RED tests（失败测试）覆盖 `PressJobPage` driverSession（驱动会话）脱敏、Driver log（驱动日志）JSON/结构化字段脱敏和 SSE snapshot（服务器发送事件快照）敏感 `signalCode（信号码）` 过滤；修复后 driver focused tests（驱动聚焦测试）通过 `35/35`、driver regression（驱动回归）通过 `144/144`、frontend focused tests（前端聚焦测试）通过 `103/103`、`pnpm test` 通过 `178/178`、`pnpm build` 成功但保留 Vite chunk size warning（分块体积警告），visual smoke（视觉冒烟）复验通过。
- `2026-07-03`: Follow-up repair（复核修复）完成，补齐 `CleanupPending（清理待完成）` 状态保留、Driver SSE snapshot（驱动服务器发送事件快照） forbidden identifier（禁止标识）过滤和 audit `targetEndpoint（审计目标端点）` 清洗；最终 driver focused tests（驱动聚焦测试）通过 `48/48`、driver regression（驱动回归）通过 `157/157`、frontend focused tests（前端聚焦测试）通过 `110/110`、`pnpm test` 通过 `179/179`、`pnpm build` 成功但保留 Vite chunk size warning（分块体积警告）。

## Files（文件）

- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify: `qt-app/frontend/src/services/logging.test.ts`
- Modify: `qt-app/frontend/src/domain/logRecord.ts`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs`
- Create: `docs/press-working-device-actions-spec-plan/verification-record.md`
- Update: `docs/press-working-device-actions-spec-plan/task-*.md`

## Wiring（接线）

`App.tsx（应用入口）` injects（注入）:

```text
executePressDeviceCommand
subscribeDriverDeviceEvents
startPressJob
recordPressJobParameters
completePressJob
updatePressMachineStatus
refreshSignalSnapshot
refreshPressJobCurrentJobs
recordPressDeviceActionDiagnostic
```

Forbidden prop data（禁止属性数据）:

```text
sessionToken
signedLease
signature
signalConfig
deviceId
ip
port
registerAddress
writeValue
```

## Steps（步骤）

- [x] **Step 1: Write RED wiring/security tests（编写失败的接线与安全测试）**

Modify `App.test.tsx`, `logging.test.ts`, `PressJobPage.test.tsx`, and Driver logging tests（驱动日志测试）.

Test cases（测试用例）:

1. `App（应用）` injects all action callbacks（动作回调） into `PressJobPage（压机作业页）`.
2. `App（应用）` does not pass `sessionToken/signedLease/signalConfig（令牌/租约/信号配置）` as props（属性）.
3. `recordPressDeviceActionDiagnostic（记录设备动作诊断）` keeps only whitelist fields（白名单字段）.
4. Device event disconnect（设备事件断开） logs Chinese summary（中文摘要） without query string（查询字符串）.
5. Sensitive field scan（敏感字段扫描） fails when logs contain forbidden values（禁止值）.
6. Source scan（源码扫描） fails if `pressDownCount（下压计数）` appears near `setInterval/requestAnimationFrame（定时器/动画帧）` in frontend business code（前端业务代码）.

Expected RED（预期失败）:

```text
App has not wired the new action callbacks and verification record does not exist.
```

- [x] **Step 2: Run wiring/security tests and confirm RED（运行接线与安全测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/App.test.tsx src/services/logging.test.ts src/components/PressJobPage.test.tsx
```

Run:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~LoggingContractTests"
```

Expected（预期）:

```text
FAIL（失败） until App wiring and verification record are complete.
```

- [x] **Step 3: Wire App callbacks（接入应用回调）**

Modify `App.tsx`.

Rules（规则）:

1. Keep `sessionToken（会话令牌）` only inside callback closure（闭包） and ERP client（客户端） call.
2. Keep `driverBaseUrl（驱动服务地址）` only inside callback closure（闭包） and Driver client（客户端） call.
3. Do not pass signed lease（签名租约） or raw signal config（原始信号配置） into `PressJobPage（压机作业页）`.
4. Reuse existing `refreshPressJobCurrentJobs（刷新当前作业）`.
5. Add `refreshSignalSnapshot（刷新信号快照）` by reusing `driverSession.retry/getSignalSnapshot` existing pattern（既有模式） without a new lease flow（新租约流程）.

- [x] **Step 4: Wire device event subscription（接入设备事件订阅）**

Modify `App.tsx`.

Rules（规则）:

1. Subscribe only when bootstrap config（启动配置） and driver base URL（驱动地址） are ready.
2. Close subscription（关闭订阅） on component unmount（组件卸载）.
3. On `pressDownCountThresholdReached（阈值达到）`, call `recordPressJobParameters（记录参数）` with `type=start`.
4. Deduplicate same `localJobSessionId + type=start（本地作业会话 ID + 类型）`.
5. On stream error（事件流错误）, show/record Chinese diagnostic summary（中文诊断摘要）.
6. Do not start Web polling（网页轮询）.

- [x] **Step 5: Complete diagnostic summary whitelist（完成诊断摘要白名单）**

Modify `domain/logRecord.ts`, `logging.test.ts`, and `App.tsx` if needed.

Allowed fields（允许字段）:

```text
correlationId
idempotencyKey
localJobSessionId
buttonKey
commandName
operatorId
teamId
processId
resultCode
durationMs
driverResultCode
erpResultCode
stationAccountId
```

Forbidden fields（禁止字段）:

```text
sessionToken
signedLease
signature
signalConfig
privateKey
credential
deviceId
ip
port
registerAddress
signalValues
snapshotValues
```

- [x] **Step 6: Run full automated gates（运行完整自动化门禁）**

Driver focused tests（驱动聚焦测试）:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter "FullyQualifiedName~DeviceCommandContractTests|FullyQualifiedName~PressDeviceCommandExecutorTests|FullyQualifiedName~PressDownCountMonitorTests|FullyQualifiedName~DeviceEventStreamTests|FullyQualifiedName~LoggingContractTests"
```

Driver regression（驱动回归）:

```bash
cd driver-service
dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj
```

Frontend focused tests（前端聚焦测试）:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/driverClient.test.ts src/services/driverDeviceEventsClient.test.ts src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx src/services/logging.test.ts
```

Frontend regression and build（前端回归与构建）:

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

- [x] **Step 7: Run static sensitive-data and no-polling scans（运行敏感信息与无轮询静态扫描）**

Run:

```bash
rg -n "sessionToken|signedLease|signature|signalConfig|privateKey|credential|deviceId|ip|port|registerAddress|writeValue" qt-app/frontend/src driver-service/src driver-service/tests
```

Run:

```bash
rg -n "pressDownCount|setInterval|requestAnimationFrame|polling|refetch" qt-app/frontend/src
```

Expected（预期）:

```text
Only contract types, narrowing logic, and tests contain forbidden field names as negative assertions（负向断言）; no business path passes them into PressJobPage（压机作业页） or logs.
No frontend business code polls pressDownCount（下压计数）.
```

- [x] **Step 8: Create verification record（创建验证记录）**

Create `docs/press-working-device-actions-spec-plan/verification-record.md`.

Required sections（必需章节）:

```text
Status（状态）
Automated Verification（自动化验证）
Visual Smoke（视觉冒烟）
Security Boundary（安全边界）
Known Gaps（已知缺口）
Git State（Git 状态）
```

Visual smoke（视觉冒烟） command:

```bash
cd qt-app/frontend
pnpm dev
```

Record（记录）:

1. 1280x720 viewport（视口） result.
2. Seven buttons（七按钮） loading/confirm/partial/fail closed（加载/确认/部分成功/失败关闭） checks.
3. Device event disconnect（设备事件断开） check.
4. Sensitive data absence（无敏感信息） check.

- [x] **Step 9: Commit or record no-git state（提交或记录非 Git 状态）**

If a Git repository（Git 仓库） is available:

```bash
git add qt-app/frontend/src driver-service/tests docs/press-working-device-actions-spec-plan
git commit -m "test: 补齐压机设备动作验证记录"
```

If no Git repository（Git 仓库） is available, update this task `Status（状态）`, `Progress（进度）`, and `verification-record.md（验证记录）` with the exact `git status --short --branch` result.

## Acceptance（验收）

- `App.tsx（应用入口）` injects all callbacks（回调） and does not pass sensitive props（敏感属性）.
- Threshold event（阈值事件） records `type=start` parameter（开始参数） once per `localJobSessionId（本地作业会话 ID）`.
- Diagnostic summary（诊断摘要） contains only whitelist fields（白名单字段）.
- Full automated gates（自动化门禁） and visual smoke（视觉冒烟） are recorded.
- `verification-record.md（验证记录）` clearly lists passed, failed, skipped, or manual-pending（通过/失败/跳过/待人工） evidence.

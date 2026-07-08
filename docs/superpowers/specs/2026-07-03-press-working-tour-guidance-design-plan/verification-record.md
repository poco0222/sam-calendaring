# Press Working Tour Guidance Verification Record

> @file QT App 压机作业 Tour guidance（漫游式指导）验证记录
> @author PopoY
> @created 2026-07-03
> @purpose 记录 `2026-07-03-press-working-tour-guidance-design-plan` 自动化验证和 1280x720 visual smoke（视觉冒烟）结果。

## Status（状态）

- `Completed（已完成）`

## Repository Boundary（仓库边界）

- 根目录执行 `git status --short --branch` 返回：`fatal: not a git repository (or any of the parent directories): .git`。
- `qt-app/frontend` 执行 `git status --short --branch` 返回：`fatal: not a git repository (or any of the parent directories): .git`。
- 因当前目录不是 Git repository（Git 仓库），File Boundary（文件边界）使用 path/time audit（路径/时间审计）辅助证明：

```text
$ find qt-app/frontend/src/components/PressJobPage.tsx qt-app/frontend/src/components/PressJobPage.test.tsx docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan -maxdepth 1 -type f -mmin -30 -print
qt-app/frontend/src/components/PressJobPage.tsx
qt-app/frontend/src/components/PressJobPage.test.tsx
docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/00-overview.md
docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/task-05-tests-and-visual-verification.md
docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/task-04-unlock-drawer-tour-flow.md
docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/task-03-start-and-complete-tour-flow.md
docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/verification-record.md

$ find driver-service qt-app/native qt-app/frontend/src/App.tsx qt-app/frontend/src/services -mmin -30 -print
<empty>
```

本轮未修改 `driver-service/**`、`qt-app/native/**`、`qt-app/frontend/src/App.tsx` 或 `qt-app/frontend/src/services/**`。

## Post-review Fix Evidence（复核修复证据）

| Finding（发现） | Fix（修复） | Evidence（证据） |
| --- | --- | --- |
| P1 `Finish（完成）` 绕过最后一步 guard（条件检查） | 新增 `finishPressJobTour`，`onFinish` 先执行 `activeTourSteps[currentTourStep]?.guard?.()`，有 warning（警告）时阻止关闭。 | RED（失败）: `69 tests | 2 failed`，失败点 `guards the current tour step before finish closes the tour`；GREEN（通过）: focused tests（聚焦测试）`69 passed`。 |
| P2 关闭 Unlock Drawer（解锁抽屉）残留 unlock `Tour（解锁漫游）` | `cancelMoldUnlockDrawer` 在 `activeTour === "unlock"` 时调用 `closePressJobTour()`；提交成功路径复用 `cancelMoldUnlockDrawer()`。 | RED（失败）: `closes unlock tour whenever the unlock drawer closes`；GREEN（通过）: focused tests（聚焦测试）`69 passed`。 |
| P2 File Boundary（文件边界）证据不足 | 补充无 Git repository（Git 仓库）状态和 path/time audit（路径/时间审计）输出。 | 见 `Repository Boundary（仓库边界）`。 |
| P3 Visual Smoke（视觉冒烟）缺少 raw output（原始输出） | 补充 Playwright YAML snapshot（页面快照）和 console log（控制台日志）原始片段。 | 见 `Raw Visual Output（原始视觉输出）`。 |
| P3 Finish（完成）source contract（源码契约）偏弱 | 补强测试，断言 warning（警告）分支的 `return` 位于 `closePressJobTour()` 之前。 | Secondary review fix（二次复核修复）后 focused tests（聚焦测试）`69 passed`。 |

## Automated Gates（自动化门禁）

| Gate（门禁） | Command（命令） | Result（结果） | Notes（备注） |
| --- | --- | --- | --- |
| Focused component tests（组件聚焦测试） | `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` | Passed（通过） | `Test Files 1 passed (1)`, `Tests 69 passed (69)`, `Duration 1.25s`。 |
| Frontend regression（前端回归） | `pnpm test` | Passed（通过） | `Test Files 18 passed (18)`, `Tests 206 passed (206)`, `Duration 1.75s`。 |
| Frontend build（前端构建） | `pnpm build` | Passed with allowed warning（通过，含允许告警） | `✓ built in 313ms`；产物 `dist/assets/index-Ce-O9alE.js 1,123.75 kB │ gzip: 355.21 kB`；仅出现既有 chunk-size warning（包体积告警）。 |

## Visual Smoke（视觉冒烟）

| Check（检查项） | Result（结果） | Notes（备注） |
| --- | --- | --- |
| 1280x720 top filters（顶部筛选）不换行、不遮挡 | Passed（通过） | Playwright + Chrome channel（浏览器通道）输出 `filterRowHeight: 44`, `topFiltersOneRow: true`。截图：`qt-app/frontend/.playwright-cli/task5-press-tour-pending-1280x720.png`。 |
| Top guidance buttons（顶部指导按钮）右对齐 | Passed（通过） | 输出 `topGuidanceRightAligned: true`, `guidanceButtonsSameRow: true`。 |
| Real action buttons（真实动作按钮）仍在 production action row（生产操作区） | Passed（通过） | 输出 `realButtonsInActionRow: true`；“开始加工”“完成加工”仍位于操作区按钮行。 |
| Start Tour（开始漫游）步骤顺序正确 | Passed（通过） | 输出 titles：`确认班组 -> 确认人员 -> 确认预选工艺 -> 确认模具锁定 -> 确认预计加工时长 -> 执行开始加工`；`closeVisible: true`。 |
| Complete Tour（完成漫游）步骤顺序正确 | Passed（通过） | 输出 titles：`确认加工中作业 -> 确认实时信号 -> 执行完成加工`；`closeVisible: true`。 |
| Unlock Drawer（解锁抽屉）状态行左右分布正确 | Passed（通过） | 截图 `qt-app/frontend/.playwright-cli/task5-press-tour-running-unlock-1280x720.png` 显示“已锁定 2 套 / 加工中需保留 1 套 / 已选 1 套”在左侧，“解锁模具指导”在右侧；输出 `guidanceRight: true`, `selectedText: true`。 |
| Unlock Tour（解锁漫游）步骤顺序正确 | Passed（通过） | 输出 titles：`查看已锁定数量 -> 确认保留规则 -> 查看已选数量 -> 选择需解锁模具 -> 执行确认解锁`；`closeVisible: true`。 |
| Close control（关闭入口）可见 | Passed（通过） | Start/Complete/Unlock 三条 Tour（漫游）均输出 `closeVisible: true`，关闭后可继续页面操作。 |

## Sensitive Data Boundary（敏感数据边界）

- `PressJobPage.test.tsx` 已新增 source-safety（源码安全）测试，扫描 Tour guidance（漫游式指导）相关源码片段，确认未引入 `guidanceSelectedRows`、`console.log`、`logTour`、`sessionToken`、`signedLease`、`signature`、`privateKey`、`credential`、`signalConfig`、`selectedRows`、`deviceId`、raw `ip/port（网络和端口字段）`。
- 1280x720 visual smoke（视觉冒烟）中页面文本检查输出：`hasSessionToken: false`, `hasSignedLease: false`, `hasSignature: false`, `hasSignalConfig: false`, `hasDeviceId: false`, `hasSelectedRows: false`, `hasIpToken: false`, `hasPortToken: false`。

## Visual Artifacts（视觉产物）

- `qt-app/frontend/.playwright-cli/task5-press-tour-pending-1280x720.png`
- `qt-app/frontend/.playwright-cli/task5-press-tour-running-unlock-1280x720.png`

## Raw Visual Output（原始视觉输出）

Playwright YAML snapshot（页面快照）原始片段，来源：`qt-app/frontend/.playwright-cli/page-2026-07-03T09-36-06-046Z.yml`：

```text
- button "开始加工指导" [active]
- button "完成加工指导"
- button "开始加工"
- button "完成加工"
- generic [ref=e288]: 确认班组
- generic [ref=e289]: 请先确认本次作业班组。
- button "下一步"
```

Playwright YAML snapshot（页面快照）原始片段，来源：`qt-app/frontend/.playwright-cli/page-2026-07-03T09-36-33-782Z.yml`：

```text
- region "压机作业筛选区"
- button "开始加工指导"
- button "完成加工指导"
- region "压机作业操作区"
- button "开始加工"
- button "完成加工"
- region "当前作业信息"
- button "解锁模具" [disabled]
```

Console log（控制台日志）原始片段，来源：`qt-app/frontend/.playwright-cli/console-2026-07-03T09-33-16-306Z.log`：

```text
[ERROR] Failed to load resource: net::ERR_UNKNOWN_URL_SCHEME @ qrc:///qtwebchannel/qwebchannel.js:0
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://127.0.0.1:5173/favicon.ico:0
[ERROR] [qt-app-bootstrap] {record: Object} @ http://127.0.0.1:5173/@vite/client:524
```

Visual artifact stat（视觉产物时间）：

```text
Jul  3 17:47:39 2026 qt-app/frontend/.playwright-cli/task5-press-tour-pending-1280x720.png
Jul  3 17:47:48 2026 qt-app/frontend/.playwright-cli/task5-press-tour-running-unlock-1280x720.png
```

## Notes（备注）

- 裸浏览器环境不具备 Qt WebChannel（Qt 通道）和 ERP data（企业资源计划数据），直接打开时会出现 `qrc:///qtwebchannel/qwebchannel.js` 加载失败和 `favicon.ico` 404。完整 visual smoke（视觉冒烟）使用 Playwright runtime mock（运行时模拟）注入 `QWebChannel（Qt 通道）`、ERP bootstrap（启动数据）、Driver Session（驱动会话）和 locked molds（已锁定模具），不改业务代码、不新增依赖。
- Visual mock（视觉模拟）未模拟 Driver SSE（驱动事件流），Vite terminal（终端）出现 `EVENT_STREAM_UNAVAILABLE`；该日志只包含 `correlationId（关联 ID）`、`commandName（命令名）`、`resultCode（结果码）`、`durationMs（耗时）` 和 `stationAccountId（工位账号）`，未包含敏感字段，不影响 Task 05 验证结论。
- Build（构建）只出现计划允许的 chunk-size warning（包体积告警），未出现 build error（构建错误）。

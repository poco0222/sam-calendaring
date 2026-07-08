# QT App Press Working Mold Lock Implementation Plan

> **For agentic workers（代理执行者）:** REQUIRED SUB-SKILL（必需子技能）: Use `superpowers:subagent-driven-development（子代理驱动开发）` recommended, or `superpowers:executing-plans（执行计划）` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file QT App 压机作业锁定模具实现计划总览
> @author PopoY
> @created 2026-06-30
> @purpose 基于 `qt-app-press-working-mold-lock-spec.md` 拆分 Press Working Page（压机作业页面）锁定模具功能的最小实现任务。

**Goal（目标）:** Add the real `mold lock（模具锁定）` flow to the existing `PressJobPage（压机作业页）`: validate operator context, search/select one mold, call the Qt-specific ERP lock endpoint（端点）, refresh `current jobs（当前作业）`, and keep `Driver Service（驱动服务）` untouched.

**Architecture（架构）:** Keep the flow inside the existing React（前端框架） page and existing `App.tsx` `view state（视图状态）`. Extend `pressJob.ts（压机作业领域模型）` and `erpClient.ts（ERP 客户端）`; inject search, lock, refresh, and diagnostic callbacks from `App.tsx` so `PressJobPage（压机作业页）` never reads `sessionToken（会话令牌）` directly. Use existing Ant Design（组件库） `Drawer（抽屉）`, `Form（表单）`, `Row/Col（栅格）`, `Select（选择器）`, `Table（表格）`, `Modal（确认框）`, and `message（消息提示）`; do not add libraries or a new state store（状态仓库）.

**Tech Stack（技术栈）:** React 19, TypeScript, TSX, Ant Design 6.4.5（组件库）, Vite（构建工具）, Vitest（测试框架）.

**Source Spec（来源规格）:** `docs/qt-app-press-working-mold-lock-spec.md`

---

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Mold Lock Domain And ERP Client](./task-01-mold-lock-domain-and-erp-client.md) | 新增锁模领域模型、Qt 专用候选模具查询和锁模提交 client（客户端），并固定字段白名单和请求安全边界。 | None |
| 2 | [Task 02: Mold Lock Panel Rendering And Validation](./task-02-mold-lock-panel-rendering-and-validation.md) | 在 `PressJobPage（压机作业页）` 中接入锁模入口、`Drawer（抽屉）` 面板、remote search（远程搜索）、单选表格和前端校验。 | Task 01 |
| 3 | [Task 03: Submit Lock And Refresh Current Jobs](./task-03-submit-lock-and-current-job-refresh.md) | 接入真实锁模提交、中文错误处理、白名单 diagnostic log（诊断日志）摘要和只刷新当前作业的局部刷新链路。 | Task 01, Task 02 |
| 4 | [Task 04: Verification Record](./task-04-verification-record.md) | 落库自动化、build（构建）、1280x720 visual smoke（视觉冒烟）和敏感信息边界验证记录。 | Task 01 through Task 03 |

## File Boundary（文件边界）

### Frontend（前端）

- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/domain/logRecord.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/services/logging.test.ts`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

### Docs（文档）

- Create during Task 04（任务四执行时创建）: `docs/qt-app-press-working-mold-lock-spec-plan/verification-record.md`
- Update during execution（执行时回写）: `docs/qt-app-press-working-mold-lock-spec-plan/task-*.md`

### Do Not Touch（不得触碰）

- Do not modify（不要修改）: `driver-service/**`
- Do not modify（不要修改）: `qt-app/native/**`
- Do not modify（不要修改）: `qt-app/frontend/src/services/driverClient.ts`
- Do not modify（不要修改）: `qt-app/frontend/src/hooks/useDriverSession.ts`
- Do not add（不要新增）: `React Router（路由库）`, new component library（组件库）, icon dependency（图标依赖）, global state library（全局状态库）, `polling（轮询）`, or `WebSocket（网页套接字）`.

## Execution Notes（执行说明）

1. Use `RED -> GREEN -> verification（失败 -> 通过 -> 验证）` inside every implementation Task（实现任务）.
2. Keep `PressJobPage（压机作业页）` free of raw `sessionToken（会话令牌）`; `App.tsx` may close over the token only to call `erpClient（ERP 客户端）`.
3. `PressJobPage（压机作业页）` must receive functions such as `searchPressMoldCandidates（查询候选模具）`, `lockPressMold（锁定模具）`, `refreshPressJobCurrentJobs（刷新当前作业）`, and `recordPressMoldLockDiagnostic（记录锁模诊断摘要）` as props（属性）.
4. Use one `correlationId（关联 ID）` for each search request and one fresh `correlationId（关联 ID）` for each lock request. Send it through `X-Correlation-Id（关联 ID 请求头）` and lock request body（请求体）.
5. Lock success must refresh only `current jobs（当前作业）`. It must not call `bootstrapSession.retry（启动会话重试）`, must not re-request `signedLease（签名租约）`, and must not trigger `applyLeaseAndConfig（应用租约和配置）`.
6. All added or changed code comments must include `@author PopoY` in file headers and use Chinese or Chinese-English mixed wording.
7. Generated commit message（提交消息）, if a Git repository（Git 仓库） is available later, must be Chinese except English technical terms（专业术语）.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| 缺班组、人员、预选工艺时中文提示 | Task 02 |
| 当前已锁定 5 套模具时不能打开锁模流程 | Task 02 |
| 模具号搜索调用 Qt 专用 search endpoint（查询端点）并只展示白名单字段 | Task 01, Task 02 |
| 候选模具表支持单选 | Task 02 |
| 候选工艺为空时默认使用当前预选工艺 | Task 02 |
| 跨项目锁模被前端阻止并展示当前项目与所选项目 | Task 02 |
| 确认锁模调用 Qt 专用 lock endpoint（锁模端点），请求体不包含 raw `deviceId/ip/port` | Task 01, Task 03 |
| 锁模成功后刷新当前作业表并展示新锁定模具 | Task 03 |
| 锁模失败展示中文错误且不泄漏 raw response（原始响应）或 token（令牌） | Task 03, Task 04 |
| `Driver Service（驱动服务）` 无代码变更 | Task 04 |

## Verification Gates（验证门禁）

Focused tests（聚焦测试）:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx src/services/logging.test.ts
```

Frontend regression（前端回归）:

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

Visual smoke（视觉冒烟）:

```bash
cd qt-app/frontend
pnpm dev
```

Then verify at `1280x720 viewport（视口）`:

1. “锁定模具” validates required `team/operator/process（班组/人员/工艺）` before opening.
2. `Mold Lock Panel（模具锁定面板）` shows one compact toolbar row and one candidate table.
3. Candidate table supports one selected row and does not show raw response（原始响应） fields.
4. Success refreshes `current jobs（当前作业）` without changing Driver Service（驱动服务） status.
5. Failure message is Chinese and sanitized.
6. No `sessionToken（会话令牌）`, `signedLease（签名租约）`, `signature（签名）`, `signalConfig（信号配置）`, raw `ip/port/deviceId（网络和设备字段）`, or full `selectedRows（选中行）` JSON appears in UI（界面） or logs.

## Plan Self-Review（计划自检）

- Spec coverage（规格覆盖）: sections 1 through 13 map to Tasks 01 through 04.
- Placeholder scan（占位扫描）: no banned placeholder wording or unspecified implementation bucket is used.
- YAGNI（你不会需要它） decision: no new route（路由）, no new store（状态仓库）, no new HTTP client（HTTP 客户端）, no backend（后端） changes, no native（原生） changes, no Driver Service（驱动服务） command.

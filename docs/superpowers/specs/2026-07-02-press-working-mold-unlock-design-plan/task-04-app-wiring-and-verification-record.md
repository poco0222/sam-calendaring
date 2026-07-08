# Task 04: App Wiring And Verification Record

> @file QT App 解锁模具应用接线与验证记录任务
> @author PopoY
> @created 2026-07-02
> @purpose 在 App shell（应用外壳）注入 unlock mold（解锁模具）ERP callbacks（回调）和 diagnostic summary（诊断摘要），并落库 verification record（验证记录）。

## Goal（目标）

Connect the unlock UI（解锁界面） to `erpClient.ts（ERP 客户端）` from `App.tsx（应用入口）` without exposing `sessionToken（会话令牌）` to the page. Record only whitelist diagnostic summary（白名单诊断摘要） and verify that Driver Service（驱动服务） and native Qt shell（Qt 原生壳） remain unchanged.

## Status（状态）

- `Completed（已完成）`: Task4（任务四）App wiring（应用接线）与 verification record（验证记录）已完成。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/7`。
- `2026-07-02`: 已确认只处理 Task4（任务四）边界，当前进度 `0/7`。
- `2026-07-02`: Step 1 完成，已在 `App.test.tsx` 增加 RED（失败）应用接线测试，当前进度 `1/7`。
- `2026-07-02`: Step 2 完成，`./node_modules/.bin/vitest run src/App.test.tsx` 按预期失败，缺少 unlock callbacks（解锁回调），当前进度 `2/7`。
- `2026-07-02`: Step 3 完成，已在 `App.tsx` 导入 unlock client（解锁客户端）函数和 `PressMoldUnlockRequest（解锁请求）` 类型，当前进度 `3/7`。
- `2026-07-02`: Step 4 完成，已新增 `loadPressLockedMolds（加载已锁定模具）` 与 `unlockPressMolds（解锁模具）` App callbacks（应用回调），未向页面暴露 `sessionToken（会话令牌）`，当前进度 `4/7`。
- `2026-07-02`: Step 5 完成，已新增 `recordPressMoldUnlockDiagnostic（记录解锁诊断摘要）` 并向 `PressJobPage` 注入三项 unlock props（解锁属性），当前进度 `5/7`。
- `2026-07-02`: Step 6 完成，focused tests（聚焦测试）、`pnpm test`、`pnpm build` 和 1280x720 visual smoke（视觉冒烟）均已执行，当前进度 `6/7`。
- `2026-07-02`: Step 7 完成，已创建 `verification-record.md` 并如实记录 Git repository（Git 仓库）不可用与边界结果，当前进度 `7/7`。
- `2026-07-02`: Post-review docs fix（复核文档修复）完成，`verification-record.md` 已补充 Acceptance Coverage matrix（验收覆盖矩阵），并将 `driver-service/**`、`qt-app/native/**` 边界说明改为 source unchanged（源码未变）且 generated/build artifacts（生成/构建产物）另行说明，当前进度 `7/7`。

## Files（文件）

- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Create during execution（执行时创建）: `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/verification-record.md`

## Steps（步骤）

- [x] **Step 1: Write RED App wiring tests（编写失败的应用接线测试）**

Modify `qt-app/frontend/src/App.test.tsx`.

Add source-level tests（源码级测试） matching the existing style:

1. `App.tsx` imports `fetchPressLockedMolds（查询已锁定模具）` and `unlockPressMolds（解锁模具）`.
2. `App.tsx` defines `loadPressLockedMolds（加载已锁定模具）` callback with `getJson（GET JSON）`.
3. `App.tsx` defines `unlockPressMolds` callback with `postJson（POST JSON）`.
4. `PressJobPage（压机作业页）` receives `loadPressLockedMolds`, `unlockPressMolds`, and `recordPressMoldUnlockDiagnostic`.
5. Diagnostic summary（诊断摘要） uses `commandName: "pressMoldUnlock"`.
6. No `deviceId`, `ip`, or `port` is added to unlock callbacks（解锁回调）.

Expected RED（预期失败）:

```text
App wiring（应用接线） for unlock mold does not exist yet.
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/App.test.tsx
```

Expected（预期）:

```text
FAIL（失败） because unlock callbacks are not injected yet.
```

- [x] **Step 3: Import unlock client functions and types（导入解锁客户端函数与类型）**

Modify `qt-app/frontend/src/App.tsx`.

Add imports（导入）:

```ts
import type { PressMoldUnlockRequest } from "./domain/pressJob";
import {
  fetchPressLockedMolds,
  unlockPressMolds as submitPressMoldUnlock,
} from "./services/erpClient";
```

If `PressMoldLockRequest（锁模请求）` is already imported from the same module, merge the type import:

```ts
import type {
  PressJobCurrentJobRow,
  PressMoldLockRequest,
  PressMoldUnlockRequest,
} from "./domain/pressJob";
```

- [x] **Step 4: Add App callbacks（新增应用层回调）**

Modify `qt-app/frontend/src/App.tsx`.

Add callbacks near the existing mold lock（锁模）callbacks:

```ts
const loadPressLockedMolds = useCallback(
  async (input: { correlationId: string }) => {
    if (!bootstrapSession.config || !bootstrapSession.data) {
      return [];
    }

    return fetchPressLockedMolds(getJson, {
      erpBaseUrl: bootstrapSession.config.erpBaseUrl,
      sessionToken: bootstrapSession.data.sessionToken,
      correlationId: input.correlationId,
    });
  },
  [bootstrapSession.config, bootstrapSession.data],
);

const unlockPressMolds = useCallback(
  async (request: PressMoldUnlockRequest) => {
    if (!bootstrapSession.config || !bootstrapSession.data) {
      throw new Error("解锁模具前启动会话未就绪。");
    }

    return submitPressMoldUnlock(postJson, {
      erpBaseUrl: bootstrapSession.config.erpBaseUrl,
      sessionToken: bootstrapSession.data.sessionToken,
      request,
    });
  },
  [bootstrapSession.config, bootstrapSession.data],
);
```

Rules:

1. Do not pass `sessionToken（会话令牌）` into `PressJobPage（压机作业页）`.
2. Do not add `deviceId/ip/port（设备/网络字段）`.
3. Do not call Driver Service（驱动服务） from these callbacks.

- [x] **Step 5: Add unlock diagnostic callback and inject props（新增解锁诊断回调并注入属性）**

Modify `qt-app/frontend/src/App.tsx`.

Add diagnostic callback（诊断回调）:

```ts
const recordPressMoldUnlockDiagnostic = useCallback(
  (summary: {
    correlationId: string;
    durationMs: number;
    moldNos: string[];
    operatorId?: string;
    resultCode: string;
  }) => {
    logDiagnostic({
      ...summary,
      commandName: "pressMoldUnlock",
      stationAccountId:
        bootstrapSession.data?.stationContext.stationAccountId ??
        bootstrapSession.config?.stationAccountId ??
        UNKNOWN_STATION_ACCOUNT_ID,
    });
  },
  [bootstrapSession.config?.stationAccountId, bootstrapSession.data],
);
```

Inject props（注入属性）:

```tsx
<PressJobPage
  loadPressLockedMolds={loadPressLockedMolds}
  recordPressMoldUnlockDiagnostic={recordPressMoldUnlockDiagnostic}
  unlockPressMolds={unlockPressMolds}
  /* keep existing props（保留已有属性） */
/>
```

- [x] **Step 6: Run focused tests, regression, and build（运行聚焦测试、回归与构建）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx
pnpm test
pnpm build
```

Expected（预期）:

```text
PASS（通过） focused tests.
PASS（通过） frontend regression.
PASS（通过） build, with existing Vite chunk-size warning（包体积告警） allowed.
```

- [x] **Step 7: Create verification record and update task progress（创建验证记录并回写任务进度）**

Create `docs/superpowers/specs/2026-07-02-press-working-mold-unlock-design-plan/verification-record.md`:

```markdown
# Press Working Mold Unlock Verification Record

> @file QT App 解锁模具验证记录
> @author PopoY
> @created 2026-07-02
> @purpose 记录 PressJobPage（压机作业页）unlock mold（解锁模具）实现后的自动化与边界验证。

## Automated Gates（自动化门禁）

| Gate（门禁） | Command（命令） | Result（结果） | Notes（备注） |
| --- | --- | --- | --- |
| Focused tests（聚焦测试） | `./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx` | Not run yet（未运行） | 执行任务时回写实际结果。 |
| Frontend regression（前端回归） | `pnpm test` | Not run yet（未运行） | 执行任务时回写实际结果。 |
| Frontend build（前端构建） | `pnpm build` | Not run yet（未运行） | 执行任务时回写实际结果。 |

## Boundary Checks（边界检查）

| Boundary（边界） | Result（结果） | Evidence（证据） |
| --- | --- | --- |
| `driver-service/**` unchanged（未修改） | Not checked yet（未检查） | 执行任务时回写 `git status` 或文件 diff（差异）结果。 |
| `qt-app/native/**` unchanged（未修改） | Not checked yet（未检查） | 执行任务时回写 `git status` 或文件 diff（差异）结果。 |
| No raw `deviceId/ip/port（设备/网络字段）` in unlock request（解锁请求） | Not checked yet（未检查） | 执行任务时回写 test（测试）结果。 |
| No sensitive data（敏感数据） in UI/logs（界面/日志） | Not checked yet（未检查） | 执行任务时回写 test（测试）和 visual smoke（视觉冒烟）结果。 |
```

Run:

```bash
git status --short --branch
```

If a Git repository（Git 仓库） is available in the execution environment, commit message（提交消息）:

```text
feat: 接入 QT App 解锁模具应用层
```

## Acceptance Criteria（验收标准）

1. `App.tsx（应用入口）` injects `loadPressLockedMolds（加载已锁定模具）`, `unlockPressMolds（解锁模具）`, and `recordPressMoldUnlockDiagnostic（记录解锁诊断摘要）`.
2. `PressJobPage（压机作业页）` never receives `sessionToken（会话令牌）`.
3. Unlock callbacks（解锁回调） do not pass `deviceId/ip/port（设备/网络字段）`.
4. Diagnostic summary（诊断摘要） includes `commandName: "pressMoldUnlock"` and whitelist（白名单） fields only.
5. Focused tests（聚焦测试）, frontend regression（前端回归）, and build（构建） results are recorded.
6. Verification record（验证记录） states Driver Service（驱动服务） and Qt native（Qt 原生） boundary results honestly.

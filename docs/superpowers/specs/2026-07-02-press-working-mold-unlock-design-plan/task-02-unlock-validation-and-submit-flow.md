# Task 02: Unlock Validation And Submit Flow

> @file QT App 解锁模具校验与提交流程任务
> @author PopoY
> @created 2026-07-02
> @purpose 在 PressJobPage（压机作业页）中新增 unlock mold（解锁模具）的纯 validation（校验）、request builder（请求构造）和 refresh-aware submit helper（带刷新提交流程）。

## Goal（目标）

Add testable helpers that protect the unlock flow（解锁流程） before UI wiring（界面接线）. Frontend validation（前端校验） prevents accidental last-mold unlock（最后一套模具解锁） while ERP Server（企业资源计划服务器） remains the trust boundary（信任边界）.

## Status（状态）

- `Completed（已完成）`: Task 02 已完成，仅处理 validation（校验）、request builder（请求构造）和 submit helper（提交辅助函数），未进入 Task 03+。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/7`。
- `2026-07-02`: 已读取 overview（总览）、Task 01 完成状态、Task 02 范围和现有 PressJobPage（压机作业页）锁模模式；外层目录不是 Git repository（Git 仓库），当前进度 `0/7`。
- `2026-07-02`: Step 1 完成，已在 `PressJobPage.test.tsx` 新增 unlock mold（解锁模具）validation/request/submit/error/diagnostic RED tests（失败测试），当前进度 `1/7`。
- `2026-07-02`: Step 2 完成，focused tests（聚焦测试）按预期失败：`validatePressMoldUnlockSelection/createPressMoldUnlockRequest/resolvePressMoldUnlockErrorMessage/createPressMoldUnlockDiagnosticSummary is not a function`，当前进度 `2/7`。
- `2026-07-02`: Step 3 完成，已新增 unlock mold（解锁模具）diagnostic summary（诊断摘要）和 submit flow（提交流程）类型，当前进度 `3/7`。
- `2026-07-02`: Step 4 完成，已新增 unlock mold（解锁模具）selection validation（选择校验）和 request builder（请求构造），当前进度 `4/7`。
- `2026-07-02`: Step 5 完成，已新增 unlock mold（解锁模具）error resolver（错误解析器）、diagnostic summary（诊断摘要）和 refresh-aware submit helper（带刷新提交辅助函数），当前进度 `5/7`。
- `2026-07-02`: Step 6 完成，`./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 35/35 通过，当前进度 `6/7`。
- `2026-07-02`: Step 7 完成，外层目录 `git status --short --branch` 返回 `fatal: not a git repository`，未提交；额外 regression（回归）验证 `pnpm test` 147/147 通过，`pnpm build` 通过且保留 Vite chunk-size warning（包体积告警），当前进度 `7/7`。
- `2026-07-02`: Code quality review（代码质量评审）反馈已处理：新增 mixed invalid selection（混入非法选择）和 duplicate moldNo（重复模具号）边界 tests（测试），先确认 focused tests（聚焦测试）2 项失败，再修复 validation（校验）与 request dedupe（请求去重）；`./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 35/35 通过，当前进度 `7/7`。
- `2026-07-02`: Review fix regression（评审修复回归）完成，`pnpm test` 147/147 通过，`pnpm build` 通过且保留 Vite chunk-size warning（包体积告警），外层目录仍不是 Git repository（Git 仓库），当前进度 `7/7`。
- `2026-07-02`: Code quality re-review（代码质量复评）确认 Important issues（应修问题）已关闭，未发现新增 abstraction（抽象）或 scope creep（范围蔓延），当前进度 `7/7`。
- `2026-07-02`: Post-review fix（复核修复）完成，已补充空 `operatorId（人员 ID）` 不能提交和缺失 `status（状态）` fail closed（失败关闭）的 RED/GREEN tests（失败/通过测试）与最小实现；`./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 38/38 通过，当前进度 `7/7`。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write RED validation and flow tests（编写失败的校验与流程测试）**

Modify `qt-app/frontend/src/components/PressJobPage.test.tsx`.

Add tests（测试） for:

1. No locked molds（没有已锁定模具） returns `当前没有可解锁模具。`.
2. No selected mold（未选择模具） returns `请先选择要解锁的模具。`.
3. Running or completed current status（加工中或已完成状态） blocks unlocking the last locked mold（最后一套已锁定模具） with `请使用完成加工功能。`.
4. Batch selection（批量选择） that clears all locked molds is blocked with `请使用完成加工功能。`.
5. Pending/not-started status（待加工/未开始状态） allows selecting all locked molds.
6. Unlock request（解锁请求） contains only `operatorId`, `moldNos`, and `correlationId`.
7. Submit helper（提交辅助函数） treats refresh failure（刷新失败） after successful unlock as `CURRENT_JOB_REFRESH_FAILED`, not unlock failure（解锁失败）.
8. Error resolver（错误解析器） keeps safe Chinese ERP business errors（中文业务错误） and rejects sensitive text（敏感文本）.
9. Diagnostic summary（诊断摘要） keeps only whitelist（白名单） fields, including `moldNos（模具号数组）`.

Expected RED（预期失败）:

```text
validatePressMoldUnlockSelection is not exported（未导出）
submitPressMoldUnlockWithRefresh is not exported（未导出）
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） because unlock validation helpers do not exist yet.
```

- [x] **Step 3: Add unlock diagnostic and submit flow types（新增诊断与提交流程类型）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Add types near the existing mold lock（锁模）flow types:

```ts
/**
 * @brief 定义解锁模具 diagnostic summary（诊断摘要）白名单字段。
 * @author PopoY
 */
export type PressMoldUnlockDiagnosticSummary = {
  correlationId: string;
  durationMs: number;
  moldNos: string[];
  operatorId?: string;
  commandName?: string;
  resultCode: string;
  stationAccountId?: string;
};

export type PressMoldUnlockSubmitFlowStatus =
  | "OK"
  | "CURRENT_JOB_REFRESH_FAILED";

/**
 * @brief 定义解锁模具 submit flow（提交流程）的最小依赖。
 * @author PopoY
 */
export type PressMoldUnlockSubmitFlowInput = {
  request: PressMoldUnlockRequest;
  unlockPressMolds?: (
    request: PressMoldUnlockRequest,
  ) => Promise<PressMoldUnlockResult>;
  refreshPressJobCurrentJobs?: () => Promise<PressJobCurrentJobRow[]>;
  recordPressMoldUnlockDiagnostic?: (
    summary: PressMoldUnlockDiagnosticSummary,
  ) => void;
  now?: () => number;
};
```

- [x] **Step 4: Add pure validation and request helpers（新增纯校验与请求辅助函数）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Add exported helpers:

```ts
/**
 * @brief 校验解锁模具 selection（选择），防止误解锁最后一套加工中模具。
 * @author PopoY
 */
export function validatePressMoldUnlockSelection(input: {
  lockedMolds: PressLockedMoldRow[];
  selectedMoldNos: string[];
  currentJobRows: PressJobCurrentJobRow[];
}): string | null {
  if (input.lockedMolds.length === 0) {
    return "当前没有可解锁模具。";
  }

  if (input.selectedMoldNos.length === 0) {
    return "请先选择要解锁的模具。";
  }

  if (
    shouldKeepOneLockedMold(input.currentJobRows) &&
    input.selectedMoldNos.length >= input.lockedMolds.length
  ) {
    return "请使用完成加工功能。";
  }

  return null;
}

/**
 * @brief 构造解锁模具 request（请求），只保留 ERP contract（接口契约）字段。
 * @author PopoY
 */
export function createPressMoldUnlockRequest(
  filters: PressJobFilterState,
  moldNos: string[],
  correlationId: string,
): PressMoldUnlockRequest {
  return {
    operatorId: filters.operatorId ?? "",
    moldNos: moldNos.filter((moldNo) => moldNo.trim().length > 0),
    correlationId,
  };
}
```

Add local helpers（本地辅助函数）:

```ts
/**
 * @brief 判断当前作业状态是否需要保留至少一套 locked mold（已锁定模具）。
 * @author PopoY
 */
function shouldKeepOneLockedMold(
  currentJobRows: PressJobCurrentJobRow[],
): boolean {
  return currentJobRows.some((row) => !isUnlockClearAllowedStatus(row.status));
}

/**
 * @brief 待加工/未开始状态允许清空全部已锁定模具，其余状态需要保留一套。
 * @author PopoY
 */
function isUnlockClearAllowedStatus(status: string | undefined): boolean {
  const normalizedStatus = status?.trim();
  return (
    !normalizedStatus ||
    normalizedStatus === "0" ||
    normalizedStatus === "待加工" ||
    normalizedStatus === "待开始" ||
    normalizedStatus === "未开始"
  );
}
```

- [x] **Step 5: Add error, diagnostic, and submit helpers（新增错误、诊断与提交辅助函数）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Add helpers:

```ts
/**
 * @brief 将解锁失败转换为现场可读中文，并阻止 raw response（原始响应）泄漏。
 * @author PopoY
 */
export function resolvePressMoldUnlockErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return isSafeChineseBusinessMessage(message)
    ? message
    : "解锁失败，请查看诊断信息后重试。";
}

/**
 * @brief 生成解锁模具 diagnostic summary（诊断摘要），忽略 raw response/token（原始响应/令牌）。
 * @author PopoY
 */
export function createPressMoldUnlockDiagnosticSummary(
  input: PressMoldUnlockDiagnosticSummary & Record<string, unknown>,
): PressMoldUnlockDiagnosticSummary {
  const summary: PressMoldUnlockDiagnosticSummary = {
    correlationId: input.correlationId,
    durationMs: input.durationMs,
    moldNos: input.moldNos,
    resultCode: input.resultCode,
  };

  if (input.operatorId) summary.operatorId = input.operatorId;
  if (input.commandName) summary.commandName = input.commandName;
  if (input.stationAccountId) summary.stationAccountId = input.stationAccountId;

  return summary;
}

/**
 * @brief 执行解锁 submit（提交）后刷新 current jobs（当前作业），并区分刷新失败和解锁失败。
 * @author PopoY
 */
export async function submitPressMoldUnlockWithRefresh(
  input: PressMoldUnlockSubmitFlowInput,
): Promise<PressMoldUnlockSubmitFlowStatus> {
  const now = input.now ?? Date.now;
  const startedAt = now();
  const recordResult = (resultCode: string) => {
    input.recordPressMoldUnlockDiagnostic?.(
      createPressMoldUnlockDiagnosticSummary({
        correlationId: input.request.correlationId,
        durationMs: now() - startedAt,
        moldNos: input.request.moldNos,
        operatorId: input.request.operatorId,
        resultCode,
      }),
    );
  };

  try {
    if (!input.unlockPressMolds) {
      throw new Error("解锁模具服务未就绪，请稍后重试。");
    }

    await input.unlockPressMolds(input.request);
  } catch (caughtError) {
    recordResult("ERP_MOLD_UNLOCK_FAILED");
    throw caughtError;
  }

  try {
    await input.refreshPressJobCurrentJobs?.();
  } catch {
    recordResult("CURRENT_JOB_REFRESH_FAILED");
    return "CURRENT_JOB_REFRESH_FAILED";
  }

  recordResult("OK");
  return "OK";
}
```

- [x] **Step 6: Run focused tests（运行聚焦测试）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
PASS（通过） focused tests.
```

- [x] **Step 7: Update task progress and commit when possible（回写任务进度并在可用时提交）**

Update this file’s `Progress（进度）` after each completed step.

Run:

```bash
git status --short --branch
```

If a Git repository（Git 仓库） is available in the execution environment, commit message（提交消息）:

```text
feat: 增加 QT App 解锁模具校验流程
```

## Acceptance Criteria（验收标准）

1. No locked molds（无已锁定模具） and no selection（无选择） return exact Chinese validation messages（中文校验消息）.
2. Running/non-pending current job（加工中或非待加工当前作业） cannot unlock all locked molds（全部已锁定模具）.
3. Pending/not-started status（待加工/未开始状态） can clear all locked molds（清空已锁定模具）.
4. Unlock request（解锁请求） contains only `operatorId`, `moldNos`, and `correlationId`.
5. Unlock success plus refresh failure（刷新失败） shows refresh-specific status, not unlock failure（解锁失败）.
6. Diagnostic summary（诊断摘要） excludes raw response（原始响应）, token（令牌）, selected row JSON（选中行 JSON）, and network fields（网络字段）.

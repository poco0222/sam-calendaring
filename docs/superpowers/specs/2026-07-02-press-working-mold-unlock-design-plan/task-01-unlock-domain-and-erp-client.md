# Task 01: Unlock Domain And ERP Client

> @file QT App 解锁模具领域模型与 ERP 客户端任务
> @author PopoY
> @created 2026-07-02
> @purpose 新增 unlock mold（解锁模具）领域模型、Qt endpoint（Qt 端点）调用和白名单字段 narrowing（收窄）。

## Goal（目标）

Add the smallest `pressJob.ts（压机作业领域模型）` and `erpClient.ts（ERP 客户端）` surface required by unlock mold（解锁模具）. The client must send `Authorization（授权请求头）` and `X-Correlation-Id（关联 ID 请求头）`, must not accept or forward raw `deviceId/ip/port（设备/网络字段）`, and must narrow every ERP response（响应） to the spec whitelist（白名单）.

## Status（状态）

- `Completed（已完成）`: Task 01 已完成，仅处理 domain（领域模型）与 ERP client（客户端），未进入 Task 02+。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/7`。
- `2026-07-02`: 已读取 overview（总览）、Task 01、仓库边界和现有 mold lock（锁模）client/test（客户端/测试）模式，当前进度 `0/7`。
- `2026-07-02`: Step 1 完成，已在 `erpClient.test.ts` 新增 unlock mold（解锁模具）RED tests（失败测试），当前进度 `1/7`。
- `2026-07-02`: Step 2 完成，focused tests（聚焦测试）按预期失败：`fetchPressLockedMolds is not a function`、`unlockPressMolds is not a function`，当前进度 `2/7`。
- `2026-07-02`: Step 3 完成，已新增 `PressLockedMoldRow`、`PressMoldUnlockRequest`、`PressMoldUnlockResult` domain types（领域类型），当前进度 `3/7`。
- `2026-07-02`: Step 4 完成，已新增 locked molds（已锁定模具）/mold unlocks（解锁模具）path constants（路径常量）和 client input types（客户端输入类型），当前进度 `4/7`。
- `2026-07-02`: Step 5 完成，已实现 `fetchPressLockedMolds`、`unlockPressMolds` 与 whitelist narrowing helpers（白名单收窄辅助函数），当前进度 `5/7`。
- `2026-07-02`: Step 6 完成，`./node_modules/.bin/vitest run src/services/erpClient.test.ts` 21/21 通过，`pnpm build` 通过且仅保留既有 Vite chunk-size warning（包体积告警），当前进度 `6/7`。
- `2026-07-02`: Step 7 完成，外层目录 `git status --short --branch` 返回 `fatal: not a git repository`，未提交；额外 regression（回归）验证 `pnpm test` 142/142 通过，当前进度 `7/7`。

## Files（文件）

- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`

## API Contract（接口契约）

Query endpoint（查询端点）:

```text
GET /api/qt/press-working/locked-molds
Authorization: Bearer <sessionToken>
X-Correlation-Id: <correlationId>
```

Unlock endpoint（解锁端点）:

```text
POST /api/qt/press-working/mold-unlocks
Authorization: Bearer <sessionToken>
X-Correlation-Id: <correlationId>
```

Unlock body（解锁请求体）:

```json
{
  "operatorId": "zhangsan",
  "moldNos": ["P123-MOLD-01", "P123-MOLD-02"],
  "correlationId": "press-mold-unlock-..."
}
```

## Steps（步骤）

- [x] **Step 1: Write RED ERP client tests（编写失败的 ERP 客户端测试）**

Modify `qt-app/frontend/src/services/erpClient.test.ts`.

Add focused tests（聚焦测试） that assert:

1. `fetchPressLockedMolds（查询已锁定模具）` calls `/api/qt/press-working/locked-molds` with bearer token（承载令牌） and `X-Correlation-Id（关联 ID 请求头）`.
2. Locked mold response（已锁定模具响应） keeps only `moldNo`, `stages`, `makeOrderNumber`, `craftName`, `workTimeTypeText`, `startedAt`, `operatorName`, and optional `moldJobId`.
3. Locked mold response（已锁定模具响应） drops `deviceId`, `operationIp`, `ipAddress`, `port`, `sessionToken`, `signedLease`, `signature`, and `signalConfig`.
4. `unlockPressMolds（解锁模具）` calls `/api/qt/press-working/mold-unlocks` with the exact request body and no raw `deviceId/ip/port（设备/网络字段）`.
5. Non-200 ERP AjaxResult（企业资源计划响应包装） rejects with the Chinese `msg（消息）`.

Expected RED（预期失败）:

```text
fetchPressLockedMolds is not exported（未导出）
unlockPressMolds is not exported（未导出）
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts
```

Expected（预期）:

```text
FAIL（失败） because unlock mold client functions do not exist yet.
```

- [x] **Step 3: Add unlock domain types（新增解锁领域类型）**

Modify `qt-app/frontend/src/domain/pressJob.ts`.

Add these types near the existing mold lock（锁模）types:

```ts
/**
 * @brief Model one locked mold row（已锁定模具行）shown in Unlock Drawer（解锁抽屉）.
 * @author PopoY
 */
export type PressLockedMoldRow = {
  moldNo: string;
  stages?: string;
  makeOrderNumber?: string;
  craftName?: string;
  workTimeTypeText?: string;
  startedAt?: string;
  operatorName?: string;
  moldJobId?: string;
};

/**
 * @brief Model the Qt-specific mold unlock request（解锁模具请求）.
 * @author PopoY
 */
export type PressMoldUnlockRequest = {
  operatorId: string;
  moldNos: string[];
  correlationId: string;
};

/**
 * @brief Model the Qt-specific mold unlock result（解锁模具结果）.
 * @author PopoY
 */
export type PressMoldUnlockResult = {
  unlockedMoldNos: string[];
};
```

- [x] **Step 4: Add unlock client input types（新增解锁客户端输入类型）**

Modify `qt-app/frontend/src/services/erpClient.ts`.

Add constants and request input types beside the mold lock（锁模）client surface:

```ts
const PRESS_LOCKED_MOLDS_PATH = "/api/qt/press-working/locked-molds";
const PRESS_MOLD_UNLOCKS_PATH = "/api/qt/press-working/mold-unlocks";

/**
 * @brief Define the request shape needed to query locked molds（已锁定模具）.
 * @author PopoY
 */
export type FetchPressLockedMoldsInput = FetchPressJobLookupDataInput & {
  correlationId: string;
};

/**
 * @brief Define the request shape needed to submit mold unlock（解锁模具）.
 * @author PopoY
 */
export type UnlockPressMoldsInput = FetchPressJobLookupDataInput & {
  request: PressMoldUnlockRequest;
};
```

- [x] **Step 5: Implement query and unlock submit（实现查询与解锁提交）**

Modify `qt-app/frontend/src/services/erpClient.ts`.

Add exported functions:

```ts
export async function fetchPressLockedMolds(
  readJson: GetJson,
  request: FetchPressLockedMoldsInput,
): Promise<PressLockedMoldRow[]> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(request.erpBaseUrl, PRESS_LOCKED_MOLDS_PATH),
      request.sessionToken,
      {
        headers: {
          "X-Correlation-Id": request.correlationId,
        },
      },
    ),
  );

  return narrowPressLockedMolds(response);
}

export async function unlockPressMolds(
  sendJson: PostJson,
  input: UnlockPressMoldsInput,
): Promise<PressMoldUnlockResult> {
  const request = narrowPressMoldUnlockRequest(input.request);
  const response = unwrapErpAjaxResult<unknown>(
    await sendJson<unknown>(
      buildErpUrl(input.erpBaseUrl, PRESS_MOLD_UNLOCKS_PATH),
      request,
      {
        bearerToken: input.sessionToken,
        headers: {
          "X-Correlation-Id": request.correlationId,
        },
      },
    ),
  );

  return narrowPressMoldUnlockResult(response);
}
```

Add narrowing helpers（收窄辅助函数）:

```ts
/**
 * @brief Narrow ERP locked mold rows（已锁定模具行）to safe UI（界面）fields.
 * @author PopoY
 */
function narrowPressLockedMolds(value: unknown): PressLockedMoldRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = readRecord(item);
    const moldNo =
      readNonEmptyString(record?.moldNo) ??
      readNonEmptyString(record?.mouldCode) ??
      readNonEmptyString(record?.code);

    if (!moldNo) {
      return [];
    }

    const row: PressLockedMoldRow = { moldNo };
    const stages = readNonEmptyString(record?.stages);
    const makeOrderNumber = readNonEmptyString(record?.makeOrderNumber);
    const craftName = readNonEmptyString(record?.craftName);
    const workTimeTypeText = readNonEmptyString(record?.workTimeTypeText);
    const startedAt = readNonEmptyString(record?.startedAt) ?? readNonEmptyString(record?.startTime);
    const operatorName =
      readNonEmptyString(record?.operatorName) ??
      readNonEmptyString(record?.operatorNickName) ??
      readNonEmptyString(record?.operatorId);
    const moldJobId = readNonEmptyString(record?.moldJobId);

    if (stages) row.stages = stages;
    if (makeOrderNumber) row.makeOrderNumber = makeOrderNumber;
    if (craftName) row.craftName = craftName;
    if (workTimeTypeText) row.workTimeTypeText = workTimeTypeText;
    if (startedAt) row.startedAt = startedAt;
    if (operatorName) row.operatorName = operatorName;
    if (moldJobId) row.moldJobId = moldJobId;

    return [row];
  });
}

/**
 * @brief Rebuild unlock request（解锁请求）from whitelist（白名单）fields before submit.
 * @author PopoY
 */
function narrowPressMoldUnlockRequest(
  request: PressMoldUnlockRequest,
): PressMoldUnlockRequest {
  return {
    operatorId: request.operatorId,
    moldNos: request.moldNos.filter((moldNo) => moldNo.trim().length > 0),
    correlationId: request.correlationId,
  };
}

/**
 * @brief Narrow ERP unlock result（解锁结果）to unlocked mold numbers（已解锁模具号）only.
 * @author PopoY
 */
function narrowPressMoldUnlockResult(value: unknown): PressMoldUnlockResult {
  const record = readRecord(value);
  const unlockedMoldNos = Array.isArray(record?.unlockedMoldNos)
    ? record.unlockedMoldNos.flatMap((item) => {
        const moldNo = readNonEmptyString(item);
        return moldNo ? [moldNo] : [];
      })
    : [];

  return { unlockedMoldNos };
}
```

- [x] **Step 6: Run focused tests and build（运行聚焦测试与构建）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts
pnpm build
```

Expected（预期）:

```text
PASS（通过） focused tests.
PASS（通过） build, with existing Vite chunk-size warning（包体积告警） allowed.
```

- [x] **Step 7: Update task progress and commit when possible（回写任务进度并在可用时提交）**

Update this file’s `Progress（进度）` after each completed step.

Run:

```bash
git status --short --branch
```

Expected in current wrapper（当前外层目录预期）:

```text
fatal: not a git repository（不是 Git 仓库）
```

If a Git repository（Git 仓库） is available in the execution environment, commit message（提交消息）:

```text
feat: 接入 QT App 解锁模具 ERP client
```

## Acceptance Criteria（验收标准）

1. `PressLockedMoldRow（已锁定模具行）`, `PressMoldUnlockRequest（解锁模具请求）`, and `PressMoldUnlockResult（解锁模具结果）` exist.
2. Locked mold query uses `GET /api/qt/press-working/locked-molds`.
3. Unlock submit uses `POST /api/qt/press-working/mold-unlocks`.
4. Both calls include `Authorization（授权请求头）` and `X-Correlation-Id（关联 ID 请求头）`.
5. No raw `deviceId/ip/port（设备/网络字段）` is accepted, emitted, or submitted.
6. Focused tests and build pass（通过）.

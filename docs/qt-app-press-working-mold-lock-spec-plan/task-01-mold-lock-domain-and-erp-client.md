# Task 01: Mold Lock Domain And ERP Client

> @file QT App 锁模领域模型与 ERP 客户端任务
> @author PopoY
> @created 2026-06-30
> @purpose 新增 mold lock（模具锁定）领域模型、Qt 专用 ERP endpoint（端点）调用和白名单字段收窄。

## Goal（目标）

Add the smallest `pressJob.ts（压机作业领域模型）` and `erpClient.ts（ERP 客户端）` surface needed by the mold lock（模具锁定） flow. The client must send `Authorization（授权请求头）` and `X-Correlation-Id（关联 ID 请求头）`, must not accept or forward raw `deviceId/ip/port（设备/网络字段）`, and must narrow every ERP response（响应） to the spec whitelist（白名单）.

## Status（状态）

- `Completed（已完成）`: Task 01 已完成；未执行 commit（提交），因为当前目录不是 Git repository（Git 仓库）。

## Progress（进度）

- `2026-06-30`: 计划已落库，当前进度 `0/7`。
- `2026-06-30`: Step 1 完成，已新增 `erpClient.test.ts` 的 mold lock（模具锁定）失败用例，当前进度 `1/7`。
- `2026-06-30`: Step 2 完成，`./node_modules/.bin/vitest run src/services/erpClient.test.ts` 已确认 5 个预期失败、12 个既有测试通过，当前进度 `2/7`。
- `2026-06-30`: Step 3 完成，已在 `pressJob.ts` 新增 4 个 mold lock（模具锁定）领域类型，当前进度 `3/7`。
- `2026-06-30`: Step 4 完成，已扩展 `GetJson/PostJson` 可选 request options（请求选项）并合并 diagnostic headers（诊断请求头），当前进度 `4/7`。
- `2026-06-30`: Step 5 完成，已实现 candidate search（候选查询）和 lock submit（锁模提交）并按白名单收窄响应/请求体，当前进度 `5/7`。
- `2026-06-30`: Step 6 完成，`./node_modules/.bin/vitest run src/services/erpClient.test.ts` 17/17 通过，`pnpm build` 通过且仅出现计划允许的 Vite chunk-size warning（包体积告警），当前进度 `6/7`。
- `2026-06-30`: Step 7 完成，`git status --short --branch` 在外层目录和 `qt-app/frontend` 均返回 `fatal: not a git repository`；额外执行 `pnpm test` 回归检查 118/118 通过，当前进度 `7/7`。

## Files（文件）

- Modify: `qt-app/frontend/src/domain/pressJob.ts`
- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`

## API Contract（接口契约）

Search endpoint（查询端点）:

```text
GET /api/qt/press-working/mold-candidates?moldNo=<moldNo>&lockedMoldNos=<moldNo>
Authorization: Bearer <sessionToken>
X-Correlation-Id: <correlationId>
```

Lock endpoint（锁模端点）:

```text
POST /api/qt/press-working/mold-locks
Authorization: Bearer <sessionToken>
X-Correlation-Id: <correlationId>
```

Lock body（锁模请求体）:

```json
{
  "operatorId": "zhangsan",
  "teamId": "PLINE-01",
  "processId": "CRAFT-001",
  "selectedRows": [
    {
      "moldNo": "P123-001",
      "makeOrderNumber": "MO_N001",
      "stages": "OP10",
      "craftCode": "CRAFT-001",
      "projectCode": "P123"
    }
  ],
  "correlationId": "press-mold-lock-..."
}
```

## Steps（步骤）

- [x] **Step 1: Write RED erpClient tests（编写失败的 ERP 客户端测试）**

Modify `qt-app/frontend/src/services/erpClient.test.ts`.

Add focused tests（聚焦测试） that assert:

1. `fetchPressMoldCandidates（查询候选模具）` calls `/api/qt/press-working/mold-candidates` with `moldNo（模具号）`, repeated `lockedMoldNos（已锁定模具号）`, bearer token（承载令牌）, and `X-Correlation-Id（关联 ID 请求头）`.
2. Candidate response（候选响应） keeps only `moldNo`, `makeOrderNumber`, `stages`, `projectCode`, `name`, and `defaultProcessId`.
3. Candidate response（候选响应） drops `deviceId`, `operationIp`, `ipAddress`, `port`, `sessionToken`, `signedLease`, `signature`, and `signalConfig`.
4. `lockPressMold（锁定模具）` calls `/api/qt/press-working/mold-locks` with the exact request body and no raw `deviceId/ip/port（设备/网络字段）`.
5. Non-200 ERP AjaxResult（企业资源计划响应包装） rejects with the Chinese `msg（消息）`.

Expected RED（预期失败）:

```text
fetchPressMoldCandidates is not exported（未导出）
lockPressMold is not exported（未导出）
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts
```

Expected（预期）:

```text
FAIL（失败） because mold lock client functions do not exist yet.
```

- [x] **Step 3: Add mold lock domain types（新增锁模领域类型）**

Modify `qt-app/frontend/src/domain/pressJob.ts`.

Add:

```ts
/**
 * @brief Model one mold candidate（模具候选）returned by ERP Qt endpoint（端点）.
 * @author PopoY
 */
export type PressMoldCandidate = {
  moldNo: string;
  makeOrderNumber?: string;
  stages?: string;
  projectCode?: string;
  name?: string;
  defaultProcessId?: string;
};

/**
 * @brief Model one selected mold lock row（锁模选中行）submitted to ERP.
 * @author PopoY
 */
export type PressMoldLockSelection = {
  moldNo: string;
  makeOrderNumber: string;
  stages?: string;
  craftCode: string;
  projectCode?: string;
};

/**
 * @brief Model the Qt-specific mold lock request（锁模请求）.
 * @author PopoY
 */
export type PressMoldLockRequest = {
  operatorId: string;
  teamId: string;
  processId: string;
  selectedRows: PressMoldLockSelection[];
  correlationId: string;
};

/**
 * @brief Model the Qt-specific mold lock result（锁模结果）.
 * @author PopoY
 */
export type PressMoldLockResult = {
  lockedMoldNos: string[];
};
```

- [x] **Step 4: Extend JSON helpers without changing existing callers（扩展 JSON 辅助函数且不破坏现有调用）**

Modify `qt-app/frontend/src/services/erpClient.ts`.

Add one optional request options（请求选项） type and keep existing two-argument calls valid:

```ts
/**
 * @brief Model optional ERP JSON request headers（请求头）without exposing tokens to UI（界面）.
 * @author PopoY
 */
export type ErpJsonRequestOptions = {
  bearerToken?: string;
  headers?: Record<string, string>;
};
```

Rules:

1. Keep existing `GetJson（GET JSON 读取器）` calls with `(url, sessionToken)` unchanged.
2. Extend `PostJson（POST JSON 发送器）` with optional `ErpJsonRequestOptions（请求选项）`.
3. `postJson（发送 JSON）` must add `Authorization（授权请求头）` only when `bearerToken（承载令牌）` is passed.
4. Both helpers must merge `X-Correlation-Id（关联 ID 请求头）` from `headers（请求头）`.
5. Do not log the token（令牌） or request body（请求体）.

- [x] **Step 5: Implement candidate search and lock submit（实现候选查询与锁模提交）**

Modify `qt-app/frontend/src/services/erpClient.ts`.

Add exported functions:

```ts
export async function fetchPressMoldCandidates(
  readJson: GetJson,
  request: FetchPressMoldCandidatesInput,
): Promise<PressMoldCandidate[]>;

export async function lockPressMold(
  sendJson: PostJson,
  input: LockPressMoldInput,
): Promise<PressMoldLockResult>;
```

Implementation rules（实现规则）:

1. `fetchPressMoldCandidates（查询候选模具）` trims blank `moldNo（模具号）`; blank query returns `[]` without calling ERP.
2. `lockedMoldNos（已锁定模具号）` is sent as repeated query params（重复查询参数） and only from current UI rows（当前界面行）.
3. `lockPressMold（锁定模具）` sends exactly `PressMoldLockRequest（锁模请求）`; do not add `deviceId`, `ip`, or `port`.
4. Use `unwrapErpAjaxResult（ERP 响应解包）`.
5. Candidate narrowing（候选收窄） accepts either `moldNo` or legacy `mouldCode` and emits only `moldNo`.
6. Lock result narrowing（锁模结果收窄） emits `{ lockedMoldNos: string[] }`; missing data becomes `[]`.

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
feat: 接入 QT App 锁模 ERP client
```

## Acceptance Criteria（验收标准）

1. `PressMoldCandidate（模具候选）`, `PressMoldLockSelection（锁模选中行）`, `PressMoldLockRequest（锁模请求）`, and `PressMoldLockResult（锁模结果）` exist.
2. Candidate search uses `GET /api/qt/press-working/mold-candidates`.
3. Lock submit uses `POST /api/qt/press-working/mold-locks`.
4. Both calls include `Authorization（授权请求头）` and `X-Correlation-Id（关联 ID 请求头）`.
5. No raw `deviceId/ip/port（设备/网络字段）` is accepted, emitted, or submitted.
6. Focused tests and build pass（通过）.

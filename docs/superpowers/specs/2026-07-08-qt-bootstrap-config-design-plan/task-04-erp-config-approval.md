# Task 04: ERP Config Approval

> @file ERP config approval（ERP 配置审批开关）读取任务
> @author PopoY
> @created 2026-07-08
> @purpose 在 QT App（Qt 应用）auto-login（自动登录）成功后读取 `approve.press.config`，决定仪表盘配置面板是否可编辑。

## Goal（目标）

After auto-login（自动登录） succeeds and `sessionToken（会话令牌）` exists, call ERP Server（ERP 服务端） config endpoint（配置接口） and convert the response to a safe dashboard edit state（仪表盘编辑状态）. The first-run blocking page（首次启动阻塞页） must never depend on this switch（开关）.

## Status（状态）

- `Completed（已完成）`: Task 04（任务四）focused tests（聚焦测试）和 full Vitest（全量测试）已通过；acceptance checklist（验收清单）已同步 approval fields（审批字段）。

## Progress（进度）

- `2026-07-08`: 计划已落库，当前进度 `0/6`。
- `2026-07-08`: 本轮开始 Task 04（任务四），已确认只处理 ERP config approval（ERP 配置审批开关）读取，不进入 Task 05（任务五）。
- `2026-07-08`: Step 1 RED（红灯）完成；`vitest run src/services/erpClient.test.ts` 失败在 `fetchBootstrapConfigApproval is not a function`，符合预期，当前进度 `1/6`。
- `2026-07-08`: Step 2 RED（红灯）完成；单测 `keeps bootstrap successful when config approval read fails` 失败在 `bootstrapConfigEditable` 为 `undefined`，符合预期，当前进度 `2/6`。
- `2026-07-08`: Step 3 GREEN（绿灯）完成；新增 approval client（审批开关客户端）后，`vitest run src/services/erpClient.test.ts -t "approve.press.config|treats non-true values"` 通过，当前进度 `3/6`。
- `2026-07-08`: Step 4 完成；`BootstrapSession`（启动会话）增加 approval（审批）字段，并补齐现有测试 fixture（夹具）的新增字段，当前进度 `4/6`。
- `2026-07-08`: Step 5 GREEN（绿灯）完成；`loadBootstrapSession`（启动会话加载）接入 approval（审批）读取，失败降级为 `unavailable`，`vitest run src/services/erpClient.test.ts src/hooks/useBootstrapSession.test.ts` 31 个测试通过，当前进度 `5/6`。
- `2026-07-08`: Step 6 focused verification（聚焦验证）完成；补充 `AjaxResult.data` 缺失用例后，`vitest run src/services/erpClient.test.ts src/hooks/useBootstrapSession.test.ts` 32 个测试通过；逐项修复后 `tsc --noEmit` 已通过，当前进度 `6/6`。
- `2026-07-08`: Review（评审）完成；子代理未发现 Critical/Important（严重/重要）问题，仅要求同步状态，Task 04（任务四）标记为 Completed（已完成）。
- `2026-07-08`: 逐项修复复核完成；`acceptanceChecklist.test.ts` 已补齐 `bootstrapConfigEditable=false` 和 `bootstrapConfigApprovalState="unavailable"` 断言，frontend full Vitest（前端全量测试）通过 `20/20 files`、`233/233 tests`，本任务完成步数 `6/6`。

## Files（文件）

- Modify: `qt-app/frontend/src/services/erpClient.ts`
- Modify: `qt-app/frontend/src/services/erpClient.test.ts`
- Modify: `qt-app/frontend/src/hooks/useBootstrapSession.test.ts`

## Acceptance（验收点）

1. `GET /system/config/configKey/approve.press.config` is called with `Authorization: Bearer <sessionToken>` through the existing `GetJson（GET JSON）` helper.
2. `AjaxResult.data` is read as string（字符串）.
3. Only trimmed value（去空白值） exactly equal to `"true"` allows edit（允许编辑）.
4. Missing, empty, `"false"`, `"TRUE"`, `"1"`, and request failure all become readonly（只读）.
5. Approval read failure does not fail bootstrap auto-login（启动自动登录）.
6. FirstRunConfigPage（首次启动配置页） path never calls the approval endpoint（审批接口）.

## Steps（步骤）

- [x] **Step 1: Write RED ERP approval tests（编写失败的 ERP 开关测试）**

Modify `qt-app/frontend/src/services/erpClient.test.ts`.

Add:

```ts
/**
 * @brief `approve.press.config` 只有字符串 true 才允许编辑启动配置。
 * @author PopoY
 */
it("allows bootstrap config editing only when approve.press.config is true", async () => {
  const getJson = vi.fn().mockResolvedValue({ code: 200, data: " true " });

  await expect(
    fetchBootstrapConfigApproval(getJson, {
      erpBaseUrl: "http://127.0.0.1:8080",
      sessionToken: "session-token",
    }),
  ).resolves.toEqual({
    bootstrapConfigEditable: true,
    bootstrapConfigApprovalState: "editable",
  });

  expect(getJson).toHaveBeenCalledWith(
    "http://127.0.0.1:8080/system/config/configKey/approve.press.config",
    "session-token",
  );
});

/**
 * @brief 缺失、非 true 或读取失败都按 readonly（只读）处理。
 * @author PopoY
 */
it.each([
  [{ code: 200, data: "" }, "readonly"],
  [{ code: 200, data: "false" }, "readonly"],
  [{ code: 200, data: "TRUE" }, "readonly"],
  [{ code: 200, data: "1" }, "readonly"],
])("treats non-true values as readonly", async (response, state) => {
  const getJson = vi.fn().mockResolvedValue(response);

  await expect(
    fetchBootstrapConfigApproval(getJson, {
      erpBaseUrl: "http://127.0.0.1:8080",
      sessionToken: "session-token",
    }),
  ).resolves.toEqual({
    bootstrapConfigEditable: false,
    bootstrapConfigApprovalState: state,
  });
});
```

Expected RED（预期失败）:

```text
FAIL because fetchBootstrapConfigApproval is not exported yet.
```

- [x] **Step 2: Write RED bootstrap integration test（编写失败的启动集成测试）**

Modify `qt-app/frontend/src/services/erpClient.test.ts`.

Add one test around existing `loadBootstrapSession` fixture（夹具）:

```ts
/**
 * @brief auto-login（自动登录）成功后读取 config approval（配置审批开关），失败时不阻断启动。
 * @author PopoY
 */
it("keeps bootstrap successful when config approval read fails", async () => {
  const postJson = vi
    .fn()
    .mockResolvedValueOnce(createLoginResponse())
    .mockResolvedValueOnce(createLeaseResponse());
  const getJson = vi.fn().mockRejectedValue(new Error("network"));

  const session = await loadBootstrapSession(postJson, sampleConfig, getJson);

  expect(session.bootstrapConfigEditable).toBe(false);
  expect(session.bootstrapConfigApprovalState).toBe("unavailable");
});
```

Expected RED（预期失败）:

```text
FAIL because BootstrapSession does not include bootstrapConfigEditable yet.
```

- [x] **Step 3: Implement approval client（实现审批开关客户端）**

Modify `qt-app/frontend/src/services/erpClient.ts`.

Add constants and types near existing path constants（路径常量）:

```ts
const BOOTSTRAP_CONFIG_APPROVAL_PATH =
  "/system/config/configKey/approve.press.config";

export type BootstrapConfigApprovalState =
  | "editable"
  | "readonly"
  | "unavailable";

export type BootstrapConfigApproval = {
  bootstrapConfigEditable: boolean;
  bootstrapConfigApprovalState: BootstrapConfigApprovalState;
};
```

Add export:

```ts
/**
 * @brief 读取 ERP config key（ERP 配置键）判断仪表盘启动配置是否允许编辑。
 * @author PopoY
 * @param readJson 现有 GET JSON（GET 请求）辅助函数。
 * @param input ERP base URL（基础地址）和 sessionToken（会话令牌）。
 * @returns 可编辑状态；失败由调用方降级为 unavailable（不可用）。
 */
export async function fetchBootstrapConfigApproval(
  readJson: GetJson,
  input: FetchPressJobLookupDataInput,
): Promise<BootstrapConfigApproval> {
  const response = unwrapErpAjaxResult<unknown>(
    await readJson<unknown>(
      buildErpUrl(input.erpBaseUrl, BOOTSTRAP_CONFIG_APPROVAL_PATH),
      input.sessionToken,
    ),
  );
  const editable = String(response ?? "").trim() === "true";

  return {
    bootstrapConfigEditable: editable,
    bootstrapConfigApprovalState: editable ? "editable" : "readonly",
  };
}
```

- [x] **Step 4: Add approval fields to BootstrapSession（给启动会话增加审批字段）**

Modify `BootstrapSession` type in `qt-app/frontend/src/services/erpClient.ts`:

```ts
export type BootstrapSession = AutoLoginResponse &
  LeasePackage & {
    bootstrapConfigEditable: boolean;
    bootstrapConfigApprovalState: BootstrapConfigApprovalState;
    parameterGroupOptions?: ParameterGroupOption[];
    pressMoldWorkTypeOptions?: ErpDictOption[];
    pressMoldCraftOptions?: ErpDictOption[];
    pressMoldOperatorOptions?: ErpDictOption[];
    pressJobLookupData?: PressJobLookupData;
    pressJobCurrentJobs?: PressJobCurrentJobRow[];
  };
```

- [x] **Step 5: Integrate into loadBootstrapSession（接入启动会话加载）**

Modify `loadBootstrapSession`.

Rules（规则）:

1. Call `fetchBootstrapConfigApproval(readJson, { erpBaseUrl, sessionToken })` only after auto-login（自动登录） succeeds.
2. If `readJson` is not passed, set `{ bootstrapConfigEditable: false, bootstrapConfigApprovalState: "unavailable" }`.
3. If call throws, catch locally and use unavailable（不可用） state.
4. Do not include `sessionToken` in thrown errors or rendered messages.

- [x] **Step 6: Verify GREEN and first-run bypass（验证通过并确认首启不受控制）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/hooks/useBootstrapSession.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected（预期）:

```text
PASS（通过）: approval client handles true/readonly/unavailable, and missing config still stops before ERP calls.
```

Commit message（提交消息，如执行时需要）:

```bash
git add qt-app/frontend/src/services/erpClient.ts qt-app/frontend/src/services/erpClient.test.ts qt-app/frontend/src/hooks/useBootstrapSession.test.ts
git commit -m "feat(qt-app): 增加 approve.press.config 编辑开关"
```

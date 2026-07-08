# Task 03: ERP Auto-Login and Lease Fetch

> @file QT App V1 ERP 免登录和租约获取任务
> @author PopoY
> @created 2026-06-25
> @purpose 调用 ERP auto-login API 并获取 signalConfig + signedLease。

## Goal（目标）

实现最小 `ERP Client（ERP 客户端）`，用本机配置账号完成 `auto-login（免登录）`，成功后获取 `signalConfig（信号配置） + signedLease（签名租约）`。
如果 `ERP Server（企业资源计划服务器）` 返回 `deviceConnectionInfo（设备连接信息）`，客户端必须忽略它，不得转发、拆解或用于覆盖设备授权。

## Status（状态）

- `Completed`：Task3 的 Step 1 到 Step 6 已按顺序完成，并已通过 spec review（规格复核）、code quality review（代码质量复核）和前端构建验证。

## Progress（进度）

- `2026-06-25 Step 1`：已新增 `erpClient.test.ts` RED 套件，覆盖 `ERP_AUTO_LOGIN_FAILED` 映射、登录失败短路租约请求，以及成功路径忽略 `deviceConnectionInfo（设备连接信息）` 的契约，当前进度 `1/6`。
- `2026-06-25 Step 2`：已先按 spec 执行 `pnpm test erpClient`，但当前环境缺少 `pnpm（包管理器）` 命令；随后执行 `./node_modules/.bin/vitest run erpClient`，确认 RED 原因为 `./erpClient` 缺失，当前进度 `2/6`。
- `2026-06-25 Step 3`：已新增 `session.ts`、`lease.ts` 与 `errors.ts` 三个领域契约文件，补齐 `auto-login（免登录）` 请求/响应、租约授权包和 `ERP_AUTO_LOGIN_FAILED` 错误类型，当前进度 `3/6`。
- `2026-06-25 Step 4`：已新增 `erpClient.ts` 与 `useBootstrapSession.ts`，实现 `autoLogin`、`fetchLeasePackage`、`loadBootstrapSession` 和最小 bootstrap `hook（钩子）` 状态封装；当前租约请求仅透出 `signalConfig（信号配置） + signedLease（签名租约）`，显式忽略 `deviceConnectionInfo（设备连接信息）`，当前进度 `4/6`。
- `2026-06-25 Step 5`：已执行 `./node_modules/.bin/vitest run erpClient`，确认 `does not request a lease package when auto-login fails` 失败路径测试通过，登录失败后不会继续触发租约请求，当前进度 `5/6`。
- `2026-06-25 Step 6`：已再次执行 `./node_modules/.bin/vitest run erpClient`，确认成功路径会返回 `sessionToken（会话令牌） + signalConfig（信号配置） + signedLease（签名租约）`，且 ERP 响应中的 `deviceConnectionInfo（设备连接信息）` 未出现在返回载荷中，当前进度 `6/6`。
- `2026-06-25 Spec Review Follow-up`：已补充 `autoLogin response（自动登录响应）` 的白名单收窄逻辑，并新增回归测试覆盖 auto-login 与 lease response 两侧的 `deviceConnectionInfo（设备连接信息）` 忽略场景，避免额外字段通过 `loadBootstrapSession` 透传。
- `2026-06-25 Code Quality Follow-up`：已在成功路径测试中补充两次 `postJson` 调用的 URL（地址）与 body（请求体）断言，锁定 `auto-login（免登录）` 和 `lease-package（租约包）` 的请求形状，防止端点或请求体回归。
- `2026-06-25 Verification`：已执行 `./node_modules/.bin/vitest run erpClient`，确认 `5/5` 测试通过；已执行 `./node_modules/.bin/vite build`，前端构建通过，保留既有 `chunk size warning（分块体积告警）` 但不影响本轮结果。
- `2026-06-26 Runtime Follow-up`：已基于真实 ERP `lease-package（租约包）` 响应确认当前仍返回 bootstrap placeholder（启动占位数据）：`signature = UNSIGNED_BOOTSTRAP_PLACEHOLDER`、`targetEndpoint = driver://pending`、`signalConfig.mode = bootstrap-minimal`。QT App 已新增 `ERP_LEASE_PLACEHOLDER（ERP 租约仍为占位）` 前置错误，避免继续把占位租约发送到 Driver Service（驱动服务）后误判为真实设备或 Driver 问题。

## Files（文件）

- Create: `qt-app/frontend/src/domain/session.ts`
- Create: `qt-app/frontend/src/domain/lease.ts`
- Create: `qt-app/frontend/src/domain/errors.ts`
- Create: `qt-app/frontend/src/services/erpClient.ts`
- Create: `qt-app/frontend/src/services/erpClient.test.ts`
- Create: `qt-app/frontend/src/hooks/useBootstrapSession.ts`

## Steps（步骤）

- [x] **Step 1: Write the failing auto-login error test**

```ts
// PopoY: ERP login failure must stop the device authorization flow.
import { expect, it, vi } from "vitest";

it("maps login failure to ERP_AUTO_LOGIN_FAILED", async () => {
  const postJson = vi.fn().mockRejectedValue(new Error("401"));
  await expect(autoLogin(postJson, sampleConfig)).rejects.toMatchObject({
    code: "ERP_AUTO_LOGIN_FAILED",
  });
});
```

- [x] **Step 2: Run the test and confirm it fails**

```bash
cd qt-app/frontend && pnpm test erpClient
```

Expected: failure because `autoLogin` is missing.

- [x] **Step 3: Add typed request and response models**

```ts
// PopoY: only fields needed by bootstrap are modeled here.
export type AutoLoginRequest = {
  stationAccountId: string;
  granteeHostId: string;
  stationId: string;
};
```

- [x] **Step 4: Implement `autoLogin` and `fetchLeasePackage`**

`autoLogin` must return `sessionToken（会话令牌）` and station context. `fetchLeasePackage` must return `signalConfig（信号配置）` and `signedLease（签名租约）` together.

- [x] **Step 5: Verify login failure prevents lease fetch**

```bash
cd qt-app/frontend && pnpm test erpClient
```

Expected: a failed login never calls the lease endpoint.

- [x] **Step 6: Verify success path**

```bash
cd qt-app/frontend && pnpm test erpClient
```

Expected: success returns `sessionToken`、`signalConfig` and `signedLease`.
Expected: any `deviceConnectionInfo（设备连接信息）` in ERP response is ignored and absent from the returned bootstrap payload.

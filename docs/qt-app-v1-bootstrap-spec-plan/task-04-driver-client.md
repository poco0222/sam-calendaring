# Task 04: Driver Service Client and Snapshot

> @file QT App V1 Driver Service 客户端任务
> @author PopoY
> @created 2026-06-25
> @purpose 通过 signedLease + signalConfig 调用 Driver Service。

## Goal（目标）

实现 `Driver Service Client（驱动服务客户端）`，只允许传递 `signedLease（签名租约） + signalConfig（信号配置）`，并获取一次 `signal snapshot（信号快照）`。

## Status（状态）

- `Completed`：Task4 已完成并通过契约验证；`Driver Service（驱动服务）` 领域契约、最小 client（客户端）实现与 `useDriverSession（驱动会话钩子）` 均已落盘，review follow-up（评审跟进）已补齐 snapshot error（快照错误）处理、非 `2xx` JSON 错误体保留与 `Refresh Snapshot（刷新快照）` 动作，`./node_modules/.bin/vitest run driverClient` 与 `./node_modules/.bin/vite build` 已通过。

## Progress（进度）

- `2026-06-25 Step 1`：已新增 `driverClient.test.ts` RED 套件，覆盖请求体禁止裸 `ip（网络地址）/port（端口）/deviceId（设备 ID）` 覆盖、标准 `Driver Service（驱动服务）` 错误码透传，以及 `getSignalSnapshot（获取信号快照）` 类型化返回契约，当前进度 `1/6`。
- `2026-06-25 Step 2`：先尝试 `pnpm test driverClient`，但本机缺少 `pnpm` 命令；随后直接执行 `./node_modules/.bin/vitest run driverClient`，确认 RED 原因是 `./driverClient` 模块尚不存在，当前进度 `2/6`。
- `2026-06-25 Step 3`：已新增 `driver.ts` 与 `driverErrors.ts`，补齐 `applyLeaseAndConfig（应用租约与配置）`、`getSignalSnapshot（获取信号快照）` 的最小请求/响应契约，以及 Task4/Task6 共享的标准 `Driver Service（驱动服务）` 错误码集合，当前进度 `3/6`。
- `2026-06-25 Step 4`：已新增 `driverClient.ts` 与 `useDriverSession.ts`，实现 `applyLeaseAndConfig（应用租约与配置）`、`getSignalSnapshot（获取信号快照）`、请求白名单构造、真实 `timeoutMs（超时时间）` 透传与最小驱动状态封装，当前进度 `4/6`。
- `2026-06-25 Step 5`：已执行 `./node_modules/.bin/vitest run driverClient`，确认 `LEASE_INVALID`、`LEASE_EXPIRED`、`HOST_MISMATCH`、`SIGNAL_CONFIG_MISMATCH` 四类标准 `Driver Service（驱动服务）` 错误码在 `applyLeaseAndConfig（应用租约与配置）` 返回中原样保留，当前进度 `5/6`。
- `2026-06-25 Step 6`：已再次执行 `./node_modules/.bin/vitest run driverClient`，确认 `getSignalSnapshot（获取信号快照）` 返回类型化载荷并保持 `correlationId（关联 ID）` 与信号值字段；随后执行 `./node_modules/.bin/vite build`，前端构建通过，仅保留既有 `chunk size` 告警，当前进度 `6/6`。
- `2026-06-25 Code Quality Follow-up`：已根据评审意见补齐 `postJson` 对非 `2xx` JSON 错误体的标准 `resultCode（结果码）` 保留、`useDriverSession` 对 snapshot error（快照错误）的 `error（错误）` 路径处理，以及 `refreshSnapshot（刷新快照）` 动作；随后重新执行 `./node_modules/.bin/vitest run driverClient` 与 `./node_modules/.bin/vite build`，均通过。

## Files（文件）

- Create: `qt-app/frontend/src/domain/driver.ts`
- Create: `qt-app/frontend/src/domain/driverErrors.ts`
- Create: `qt-app/frontend/src/services/driverClient.ts`
- Create: `qt-app/frontend/src/services/driverClient.test.ts`
- Create: `qt-app/frontend/src/hooks/useDriverSession.ts`

## Steps（步骤）

- [x] **Step 1: Write the failing request-shape test**

```ts
// PopoY: driver requests must not accept raw ip, port, or deviceId overrides.
import { expect, it } from "vitest";

it("builds applyLeaseAndConfig with signedLease and signalConfig only", () => {
  const request = buildApplyLeaseRequest(sampleLease, sampleSignalConfig);
  expect(request).not.toHaveProperty("ip");
  expect(request).not.toHaveProperty("port");
  expect(request).not.toHaveProperty("deviceId");
});
```

- [x] **Step 2: Run the test and confirm it fails**

```bash
cd qt-app/frontend && pnpm test driverClient
```

Expected: failure because `buildApplyLeaseRequest` is missing.

- [x] **Step 3: Add request and response types**

```ts
// PopoY: correlationId is required for cross-process diagnostics.
export type ApplyLeaseAndConfigRequest = {
  correlationId: string;
  timeoutMs: number;
  signedLease: unknown;
  signalConfig: unknown;
};
```

- [x] **Step 4: Implement `applyLeaseAndConfig` and `getSignalSnapshot`**

Both calls must accept `timeoutMs（超时时间）` and return standard `Driver Service（驱动服务）` result codes.

- [x] **Step 5: Verify standard error mapping**

```bash
cd qt-app/frontend && pnpm test driverClient
```

Expected: `LEASE_INVALID`、`LEASE_EXPIRED`、`HOST_MISMATCH`、`SIGNAL_CONFIG_MISMATCH` are preserved.

- [x] **Step 6: Verify snapshot path**

```bash
cd qt-app/frontend && pnpm test driverClient
```

Expected: `getSignalSnapshot` returns a typed payload with `correlationId` and signal values.

# Task 06: Error Mapping and Logging

> @file QT App V1 错误映射和日志任务
> @author PopoY
> @created 2026-06-25
> @purpose 映射 ERP 与 Driver 错误码，并记录脱敏诊断日志。

## Goal（目标）

把 `ERP_AUTO_LOGIN_FAILED（ERP 免登录失败）` 和 `Driver Service（驱动服务）` 标准错误码映射为用户提示，并保证日志只记录诊断字段。未知 runtime error（运行时错误）也必须回退到稳定中文提示，不能把英文 exception message（异常消息）直接显示给现场用户。

## Files（文件）

- Create: `qt-app/frontend/src/domain/errorDisplay.ts`
- Create: `qt-app/frontend/src/domain/logRecord.ts`
- Create: `qt-app/frontend/src/services/errorMapper.ts`
- Create: `qt-app/frontend/src/services/logging.ts`
- Create: `qt-app/frontend/src/services/errorMapper.test.ts`
- Create: `qt-app/frontend/src/services/logging.test.ts`

## Steps（步骤）

- [x] **Step 1: Write the failing error mapping test**

```ts
// PopoY: all standard driver errors must have stable user-facing messages.
import { expect, it } from "vitest";

it("maps LEASE_INVALID to a user message", () => {
  expect(mapErrorCode("LEASE_INVALID").title).toBe("租约无效");
});
```

- [x] **Step 2: Run the test and confirm it fails**

```bash
cd qt-app/frontend && pnpm test errorMapper
```

Expected: failure because `mapErrorCode` is missing.

- [x] **Step 3: Add the log record type**

```ts
// PopoY: logs keep correlation metadata and exclude reusable secrets.
export type LogRecord = {
  correlationId: string;
  leaseId?: string;
  localJobSessionId?: string;
  targetDeviceId?: string;
  fencingToken?: string;
  commandName: string;
  durationMs: number;
  resultCode: string;
  stationAccountId: string;
};
```

- [x] **Step 4: Add secret filtering tests**

Verify logs reject `privateKey（私钥）`、raw `signature（签名原文）` and full authorization payload fields.

- [x] **Step 5: Verify mappings and logging**

```bash
cd qt-app/frontend && pnpm test errorMapper logging
```

Expected: every required error code maps to text, unknown runtime errors use Chinese fallback text, and logs stay sanitized.

## Progress（进度）

- Status（状态）: Completed（已完成）
- Current Step（当前步骤）: Done
- Notes（备注）:
  - 2026-06-25 Step 1 completed: added `qt-app/frontend/src/services/errorMapper.test.ts` to lock `ERP_AUTO_LOGIN_FAILED（ERP 免登录失败）` plus all standard `Driver Service（驱动服务）` error-code mappings and the unknown-error fallback contract, current progress `1/5`.
  - 2026-06-25 Step 2 completed: ran `./node_modules/.bin/vitest run src/services/errorMapper.test.ts` and confirmed the expected RED failure `Cannot find module './errorMapper'`, current progress `2/5`.
  - 2026-06-25 Step 3 completed: added `qt-app/frontend/src/domain/logRecord.ts` as the whitelist-only diagnostic log contract so later logging code can emit only approved fields, current progress `3/5`.
  - 2026-06-25 Step 4 completed: added `qt-app/frontend/src/services/logging.test.ts` for secret filtering and sink behavior, then ran `./node_modules/.bin/vitest run src/services/logging.test.ts` to confirm the expected RED failure `Cannot find module './logging'`, current progress `4/5`.
  - 2026-06-25 Step 5 completed: added `qt-app/frontend/src/domain/errorDisplay.ts`, `qt-app/frontend/src/services/errorMapper.ts`, and `qt-app/frontend/src/services/logging.ts`; connected mapped user-facing errors in `qt-app/frontend/src/components/ErrorPanel.tsx`; connected whitelist-only diagnostic logging in `qt-app/frontend/src/hooks/useBootstrapSession.ts` and `qt-app/frontend/src/hooks/useDriverSession.ts`; verified `./node_modules/.bin/vitest run src/services/errorMapper.test.ts src/services/logging.test.ts`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, and `./node_modules/.bin/vite build`, current progress `5/5`.
  - 2026-06-25 Spec Review Follow-up: tightened `logging.ts` to emit whitelist-only `LogRecord（日志记录）` output and removed extra diagnostic context from both hooks so Task6 logs now keep only the approved fields.
  - 2026-06-25 Code Quality Follow-up: added a runtime `resultCode（结果码）` regression test to `qt-app/frontend/src/services/errorMapper.test.ts` and fixed `mapRuntimeError` to fall back from `code` to `resultCode`, so Driver Service（驱动服务） error objects map to the planned user-facing text.
  - 2026-06-25 Field Device Follow-up: tightened `mapRuntimeError（运行时错误映射）` so unknown `Error` object（错误对象） and string error（字符串错误） no longer leak raw English messages into the UI（用户界面）; sanitized details remain a logging concern.

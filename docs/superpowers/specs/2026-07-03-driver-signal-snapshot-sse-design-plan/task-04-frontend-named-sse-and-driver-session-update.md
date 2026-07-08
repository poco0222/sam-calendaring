# Task 04: Frontend Named SSE and Driver Session Update

> @file 前端命名 SSE 与驱动会话更新任务
> @author PopoY
> @created 2026-07-03
> @purpose 补齐 EventSource.addEventListener（事件监听）和 driverSession.applySignalSnapshotEvent（应用信号快照事件），让信号快照从同一份 driverSession（驱动会话）状态刷新。

## Goal（目标）

Consume the backend named event（命名事件） `signalSnapshotChanged` with `addEventListener`, narrow the payload（收窄载荷）, and update `driverSession.data.signalSnapshot.signalValues` without calling `applyLeaseAndConfig（应用租约与配置）`, `bootstrapSession.retry（启动会话重试）`, or a frontend polling（轮询） path.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/8`。
- `2026-07-03`: Step 1 已完成，新增 Fake EventSource（事件源）named event（命名事件）测试，当前进度 `1/8`。
- `2026-07-03`: Step 2 已完成，新增 driverSession（驱动会话）signalSnapshotChanged（信号快照变化）应用测试，当前进度 `2/8`。
- `2026-07-03`: Step 3 已完成，focused frontend tests（聚焦前端测试）按预期 RED（失败），当前进度 `3/8`。
- `2026-07-03`: Step 4 已完成，前端 domain type（领域类型）加入 signalSnapshotChanged（信号快照变化）与 signalSnapshotPublisher（信号快照发布器），当前进度 `4/8`。
- `2026-07-03`: Step 5 已完成，EventSource（事件源）注册 named event（命名事件）监听且复用统一 payload（载荷）收窄，当前进度 `5/8`。
- `2026-07-03`: Step 6 已完成，useDriverSession（驱动会话 hook）新增 applySignalSnapshotEvent（应用信号快照事件）入口，当前进度 `6/8`。
- `2026-07-03`: Step 7 已完成，App（应用入口）将 SSE（服务器发送事件）回调串到 driverSession（驱动会话）并保留 pressDownCount（下压计数）路径，当前进度 `7/8`。
- `2026-07-03`: Step 8 已完成，focused frontend tests（聚焦前端测试）、App/PressJobPage regression（回归测试）、frontend full test（前端全量测试）和 build（构建）均通过，当前进度 `8/8`。
- `2026-07-03`: Review fix（审查修复）完成，补齐 frontend payload narrowing（前端载荷收窄）对 `rawRegisters`、`targetEndpoint`、`signaturePayload` 的过滤；focused frontend tests（聚焦前端测试）先 RED（失败）后 `14/14` 通过，frontend full test（前端完整测试）`186/186` 通过，build（构建）通过。

## Files（文件）

- Modify: `qt-app/frontend/src/domain/driver.ts`
- Modify: `qt-app/frontend/src/services/driverDeviceEventsClient.ts`
- Modify: `qt-app/frontend/src/services/driverDeviceEventsClient.test.ts`
- Modify: `qt-app/frontend/src/hooks/useDriverSession.ts`
- Modify: `qt-app/frontend/src/hooks/useDriverSession.test.ts`
- Modify: `qt-app/frontend/src/App.tsx`
- Modify: `qt-app/frontend/src/App.test.tsx`

## Steps（步骤）

- [x] **Step 1: Write failing EventSource tests（编写失败事件源测试）**

Update `qt-app/frontend/src/services/driverDeviceEventsClient.test.ts` fake EventSource（事件源）:

```ts
private readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

/**
 * @brief 注册 named event（命名事件）监听器。
 * @author PopoY
 * @param eventName SSE（服务器发送事件）事件名。
 * @param listener 事件监听函数。
 */
addEventListener(eventName: string, listener: (event: MessageEvent<string>) => void): void {
  const nextListeners = this.listeners.get(eventName) ?? [];
  nextListeners.push(listener);
  this.listeners.set(eventName, nextListeners);
}

/**
 * @brief 触发 named event（命名事件），模拟浏览器 EventSource（事件源）行为。
 * @author PopoY
 * @param eventName SSE（服务器发送事件）事件名。
 * @param data JSON（数据）字符串。
 */
emit(eventName: string, data: string): void {
  for (const listener of this.listeners.get(eventName) ?? []) {
    listener(new MessageEvent(eventName, { data }));
  }
}
```

Add test:

```ts
/**
 * @brief 断言 named event（命名事件）signalSnapshotChanged 能通过 addEventListener（事件监听）进入统一回调。
 * @author PopoY
 */
it("receives signalSnapshotChanged as a named event", () => {
  vi.stubGlobal("EventSource", FakeEventSource);
  const onEvent = vi.fn();
  const onError = vi.fn();

  subscribeDriverDeviceEvents("http://127.0.0.1:5000", onEvent, onError);
  createdEventSources[0].emit(
    "signalSnapshotChanged",
    JSON.stringify({
      eventId: "evt-snapshot-001",
      correlationId: "signal-snapshot-publisher-001",
      eventName: "signalSnapshotChanged",
      commandName: "signalSnapshotPublisher",
      resultCode: "OK",
      occurredAt: "2026-07-03T00:00:00Z",
      snapshotValues: [
        { signalCode: "pressure", value: 100 },
        { signalCode: "registerAddress", value: 100 },
      ],
    }),
  );

  expect(onError).not.toHaveBeenCalled();
  expect(onEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      eventName: "signalSnapshotChanged",
      commandName: "signalSnapshotPublisher",
      snapshotValues: [{ signalCode: "pressure", value: 100 }],
    }),
  );
});
```

- [x] **Step 2: Add failing driver session tests（新增失败驱动会话测试）**

Update `qt-app/frontend/src/hooks/useDriverSession.test.ts`:

```ts
import type { PressDeviceEvent } from "../domain/driver";
import {
  applySignalSnapshotEventToData,
  canRefreshSignalSnapshot,
  loadSignalSnapshotWithStartupRetry,
  resolveApplyResultAfterSnapshot,
} from "./useDriverSession";
```

Add tests:

```ts
/**
 * @brief signalSnapshotChanged（信号快照变化）应只更新 signalSnapshot（信号快照），保留 applyResult（授权结果）。
 * @author PopoY
 */
it("applies signalSnapshotChanged events to existing driver session data", () => {
  const event: PressDeviceEvent = {
    eventId: "evt-snapshot-001",
    correlationId: "signal-snapshot-publisher-001",
    localJobSessionId: "",
    eventName: "signalSnapshotChanged",
    commandName: "signalSnapshotPublisher",
    resultCode: "OK",
    occurredAt: "2026-07-03T00:00:00Z",
    snapshotValues: [{ signalCode: "pressure", value: 120 }],
  };

  const nextData = applySignalSnapshotEventToData(
    { applyResult: connectedApplyResult, signalSnapshot: okSnapshot },
    event,
  );

  expect(nextData?.applyResult).toBe(connectedApplyResult);
  expect(nextData?.signalSnapshot?.correlationId).toBe("signal-snapshot-publisher-001");
  expect(nextData?.signalSnapshot?.signalValues).toEqual({ pressure: 120 });
});

/**
 * @brief 非 OK 或非 signalSnapshotChanged（信号快照变化）事件不应改动 driverSession（驱动会话）。
 * @author PopoY
 */
it("ignores non-ok signal snapshot events", () => {
  const event: PressDeviceEvent = {
    eventId: "evt-snapshot-failed",
    correlationId: "signal-snapshot-publisher-failed",
    localJobSessionId: "",
    eventName: "signalSnapshotChanged",
    commandName: "signalSnapshotPublisher",
    resultCode: "DEVICE_TIMEOUT",
    occurredAt: "2026-07-03T00:00:00Z",
    snapshotValues: [{ signalCode: "pressure", value: 120 }],
  };

  const currentData = { applyResult: connectedApplyResult, signalSnapshot: okSnapshot };

  expect(applySignalSnapshotEventToData(currentData, event)).toBe(currentData);
});
```

- [x] **Step 3: Run frontend tests to confirm RED（确认前端失败状态）**

Run:

```bash
cd qt-app/frontend
pnpm test src/services/driverDeviceEventsClient.test.ts src/hooks/useDriverSession.test.ts
```

Expected（期望）: FAIL because `signalSnapshotChanged`, `signalSnapshotPublisher`, `addEventListener`, and `applySignalSnapshotEventToData` are not implemented.

- [x] **Step 4: Update frontend types（更新前端类型）**

Update `qt-app/frontend/src/domain/driver.ts`:

```ts
/**
 * @brief 定义 Driver device event stream（驱动设备事件流）稳定事件名。
 * @author PopoY
 */
export type PressDeviceEventName =
  | "signalSnapshotChanged"
  | "pressDownCountMonitorStarted"
  | "pressDownCountChanged"
  | "pressDownCountThresholdReached"
  | "pressDownCountMonitorFailed"
  | "pressDownCountMonitorStopped";
```

Update `PressDeviceCommandName`:

```ts
export type PressDeviceCommandName =
  | "signalSnapshotPublisher"
  | "connectMes"
  | "precheckForStart"
  | "startDeviceSession"
  | "startPressDownCountMonitor"
  | "stopPressDownCountMonitor"
  | "rollbackStartSignal"
  | "cleanupDeviceSession"
  | "moveIn"
  | "moveOut"
  | "lineIn"
  | "lineOut";
```

- [x] **Step 5: Register named listeners（注册命名事件监听器）**

Update `qt-app/frontend/src/services/driverDeviceEventsClient.ts`:

```ts
const DEVICE_EVENT_NAMES: PressDeviceEventName[] = [
  "signalSnapshotChanged",
  "pressDownCountMonitorStarted",
  "pressDownCountChanged",
  "pressDownCountThresholdReached",
  "pressDownCountMonitorFailed",
  "pressDownCountMonitorStopped",
];

/**
 * @brief 解析并分发 SSE event（服务器发送事件）。
 * @author PopoY
 * @param event 浏览器 EventSource（事件源）事件。
 * @param onEvent 安全事件回调。
 * @param onError 中文错误摘要回调。
 */
function handleDeviceEventMessage(
  event: MessageEvent<string>,
  onEvent: (event: PressDeviceEvent) => void,
  onError: (error: Error) => void,
): void {
  try {
    onEvent(narrowPressDeviceEvent(JSON.parse(event.data)));
  } catch (error) {
    onError(createDeviceEventError("设备事件数据解析失败，请查看诊断日志。", error));
  }
}
```

Replace `eventSource.onmessage` with:

```ts
for (const eventName of DEVICE_EVENT_NAMES) {
  eventSource.addEventListener(eventName, (event) => {
    handleDeviceEventMessage(event as MessageEvent<string>, onEvent, onError);
  });
}

eventSource.onmessage = (event) => {
  handleDeviceEventMessage(event, onEvent, onError);
};
```

Keep existing `onerror（错误处理）`; do not add retry polling（轮询重试）.

- [x] **Step 6: Add driver session update entry（新增驱动会话更新入口）**

Update `qt-app/frontend/src/hooks/useDriverSession.ts` type:

```ts
export type UseDriverSessionResult = {
  status: DriverSessionStatus;
  data: DriverSessionData | null;
  error: unknown;
  retry: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  applySignalSnapshotEvent: (event: PressDeviceEvent) => void;
};
```

Add helper:

```ts
/**
 * @brief 将 signalSnapshotChanged（信号快照变化）事件应用到 driverSession（驱动会话）数据。
 * @author PopoY
 * @param currentData 当前 driverSession（驱动会话）数据。
 * @param event Driver device event（驱动设备事件）。
 * @returns 更新后的数据；不应处理的事件返回原引用。
 */
export function applySignalSnapshotEventToData(
  currentData: DriverSessionData | null,
  event: PressDeviceEvent,
): DriverSessionData | null {
  if (
    !currentData ||
    event.eventName !== "signalSnapshotChanged" ||
    event.resultCode !== "OK"
  ) {
    return currentData;
  }

  return {
    applyResult: currentData.applyResult,
    signalSnapshot: {
      correlationId: event.correlationId,
      resultCode: "OK",
      signalValues: Object.fromEntries(
        event.snapshotValues.map((item) => [item.signalCode, item.value]),
      ),
    },
  };
}
```

Inside `useDriverSession` add callback:

```ts
const applySignalSnapshotEvent = useCallback((event: PressDeviceEvent) => {
  setData((currentData) => applySignalSnapshotEventToData(currentData, event));
}, []);
```

Return it from the hook. Do not call `retry（重试）`, `refreshSnapshot（刷新快照）`, or `bootstrapSession.retry（启动会话重试）`.

- [x] **Step 7: Wire App event flow（串联 App 事件流）**

Update the `subscribeDriverDeviceEvents` callback in `qt-app/frontend/src/App.tsx`:

```tsx
(event) => {
  driverSession.applySignalSnapshotEvent(event);
  void handlePressParameterThresholdReached({
    event,
    recordDiagnostic: (summary) => logDiagnostic(summary),
    recordPressJobParameters,
    recordedStartParameterKeys: recordedStartParameterKeysRef.current,
    stationAccountId: diagnosticStationAccountId,
  });
}
```

Add `driverSession.applySignalSnapshotEvent` to the effect dependency list. Keep the existing pressDownCount threshold（下压计数阈值） path unchanged.

- [x] **Step 8: Run focused frontend tests（运行聚焦前端测试）**

Run:

```bash
cd qt-app/frontend
pnpm test src/services/driverDeviceEventsClient.test.ts src/hooks/useDriverSession.test.ts
```

Expected（期望）: PASS.

Then run:

```bash
cd qt-app/frontend
pnpm test src/App.test.tsx src/components/PressJobPage.test.tsx
```

Expected（期望）: PASS, with no new polling（轮询） assertions required.

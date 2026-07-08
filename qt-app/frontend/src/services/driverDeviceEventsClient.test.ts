/**
 * @file driverDeviceEventsClient.test.ts - 验证 Driver device events（驱动设备事件）客户端。
 * @author PopoY
 * @created 2026-07-02
 * @brief 验证 SSE（服务器发送事件）订阅不泄露令牌、租约或设备网络字段。
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  narrowPressDeviceEvent,
  subscribeDriverDeviceEvents,
} from "./driverDeviceEventsClient";

const createdEventSources: FakeEventSource[] = [];

/**
 * @brief 提供测试用的 EventSource（事件源）替身，用于捕获 URL（地址）和触发 message（消息）。
 * @author PopoY
 */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  private readonly listeners = new Map<
    string,
    Array<(event: MessageEvent<string>) => void>
  >();

  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  readyState = FakeEventSource.CONNECTING;
  readonly url: string;

  /**
   * @brief 记录订阅 URL（地址），用于断言 query params（查询参数）不包含敏感字段。
   * @author PopoY
   * @param url EventSource（事件源）打开的完整 URL（地址）。
   */
  constructor(url: string) {
    this.url = url;
    createdEventSources.push(this);
  }

  /**
   * @brief 标记 EventSource（事件源）已关闭。
   * @author PopoY
   */
  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  /**
   * @brief 注册 named event（命名事件）监听器。
   * @author PopoY
   * @param eventName SSE（服务器发送事件）事件名。
   * @param listener 事件监听函数。
   */
  addEventListener(
    eventName: string,
    listener: (event: MessageEvent<string>) => void,
  ): void {
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
}

/**
 * @brief 清理测试替身，避免 EventSource（事件源）全局污染后续用例。
 * @author PopoY
 */
afterEach(() => {
  createdEventSources.length = 0;
  vi.unstubAllGlobals();
});

describe("driverDeviceEventsClient", () => {
  /**
   * @brief 断言订阅只打开 /deviceEvents/stream（设备事件流），不拼接 token（令牌）或 lease（租约）。
   * @author PopoY
   */
  it("opens device event stream without token or lease query params", () => {
    vi.stubGlobal("EventSource", FakeEventSource);

    const subscription = subscribeDriverDeviceEvents(
      "http://127.0.0.1:5000?sessionToken=drop-token",
      vi.fn(),
      vi.fn(),
    );

    expect(createdEventSources).toHaveLength(1);
    expect(createdEventSources[0].url).toBe("http://127.0.0.1:5000/deviceEvents/stream");
    expect(createdEventSources[0].url).not.toContain("sessionToken");
    expect(createdEventSources[0].url).not.toContain("signedLease");
    expect(createdEventSources[0].url).not.toContain("signature");
    expect(createdEventSources[0].url).not.toContain("signalConfig");

    subscription.close();
    expect(createdEventSources[0].readyState).toBe(FakeEventSource.CLOSED);
  });

  /**
   * @brief 断言事件 payload（载荷）只保留安全字段和安全快照。
   * @author PopoY
   */
  it("narrows device event payloads to safe fields", () => {
    const event = narrowPressDeviceEvent({
      eventId: "evt-01",
      correlationId: "press-start-01",
      localJobSessionId: "press-job-row-01",
      eventName: "pressDownCountThresholdReached",
      commandName: "startPressDownCountMonitor",
      resultCode: "OK",
      pressDownCount: 5,
      threshold: 5,
      parameterIdempotencyKey: "param-start-01",
      occurredAt: "2026-07-02T10:00:00Z",
      snapshotValues: [
        { signalCode: "pressDownCount", value: 5, registerAddress: 100 },
        { signalCode: "deviceId", value: "drop-device-from-signal" },
        { signalCode: "rawRegisters", value: "drop-raw-registers" },
        { signalCode: "registerAddress", value: 100 },
        { signalCode: "signaturePayload", value: "drop-signature-payload" },
        { signalCode: "targetEndpoint", value: "drop-target-endpoint" },
      ],
      deviceId: "drop-device",
      ip: "drop-ip",
      port: 502,
      signalConfig: "drop-config",
    });

    expect(event).toEqual({
      eventId: "evt-01",
      correlationId: "press-start-01",
      localJobSessionId: "press-job-row-01",
      eventName: "pressDownCountThresholdReached",
      commandName: "startPressDownCountMonitor",
      resultCode: "OK",
      pressDownCount: 5,
      threshold: 5,
      parameterIdempotencyKey: "param-start-01",
      occurredAt: "2026-07-02T10:00:00Z",
      snapshotValues: [{ signalCode: "pressDownCount", value: 5 }],
    });
    expect(JSON.stringify(event)).not.toContain("drop-device");
    expect(JSON.stringify(event)).not.toContain("drop-device-from-signal");
    expect(JSON.stringify(event)).not.toContain("drop-ip");
    expect(JSON.stringify(event)).not.toContain("drop-config");
    expect(JSON.stringify(event)).not.toContain("drop-raw-registers");
    expect(JSON.stringify(event)).not.toContain("drop-signature-payload");
    expect(JSON.stringify(event)).not.toContain("drop-target-endpoint");
    expect(JSON.stringify(event)).not.toContain("registerAddress");
  });

  /**
   * @brief 断言无效 JSON（数据）触发中文错误摘要，不启动 polling（轮询）兜底。
   * @author PopoY
   */
  it("reports invalid event JSON with a Chinese summary", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const onEvent = vi.fn();
    const onError = vi.fn();

    subscribeDriverDeviceEvents("http://127.0.0.1:5000", onEvent, onError);
    createdEventSources[0].onmessage?.(
      new MessageEvent("message", {
        data: "{invalid-json",
      }),
    );

    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "设备事件数据解析失败，请查看诊断日志。",
      }),
    );
  });

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
});

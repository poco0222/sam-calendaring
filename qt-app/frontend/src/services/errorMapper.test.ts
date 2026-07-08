/**
 * @file errorMapper.test.ts - 验证错误映射逻辑。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 Task6（任务六）错误映射契约。
 */

import { describe, expect, it } from "vitest";

import { mapErrorCode, mapRuntimeError } from "./errorMapper";

const expectedMappings = [
  ["CONFIG_INVALID", "本机配置无效", "请补齐工位启动配置后重试。"],
  [
    "ERP_AUTO_LOGIN_FAILED",
    "ERP 免登录失败",
    "请检查工位配置或账号状态后重试。",
  ],
  [
    "ERP_LEASE_PLACEHOLDER",
    "ERP 租约仍为占位数据",
    "请先让 ERP 返回真实签名租约和信号配置。",
  ],
  ["LEASE_INVALID", "租约无效", "请重新获取授权后再试。"],
  ["LEASE_EXPIRED", "租约已过期", "请重新获取授权。"],
  ["HOST_MISMATCH", "工控机身份不匹配", "请确认当前机器与授权工位一致。"],
  ["SIGNAL_CONFIG_MISMATCH", "信号配置不匹配", "请刷新配置后重试。"],
  ["FENCING_TOKEN_STALE", "授权令牌已失效", "当前授权已被更新或接管，请重新获取授权。"],
  ["DEVICE_IDENTITY_MISMATCH", "设备身份不匹配", "请核对目标设备身份后再试。"],
  ["DEVICE_TIMEOUT", "设备通信超时", "请检查设备连接状态后重试。"],
  ["DEVICE_REJECTED", "设备拒绝执行", "设备回读确认失败或拒绝执行。"],
  ["DEVICE_BUSY", "设备当前不可操作", "请等待设备回到允许状态后重试。"],
  ["CLEANUP_PENDING", "上次收尾未完成", "请先完成上次收尾，再继续启动流程。"],
] as const;

describe("errorMapper", () => {
  /**
   * @brief Assert that every planned bootstrap and driver error code maps to a stable user-facing title and detail.
   * @param code Stable runtime error code under test.
   * @param title User-facing title expected by the bootstrap UI.
   * @param detail User-facing detail expected by the bootstrap UI.
   */
  it.each(expectedMappings)(
    "maps %s to a stable user-facing message",
    (code, title, detail) => {
      const display = mapErrorCode(code);

      expect(display.title).toBe(title);
      expect(display.detail).toBe(detail);
    },
  );

  /**
   * @brief Assert that unknown runtime errors use a stable Chinese fallback instead of leaking English details.
   */
  it("falls back to stable Chinese text for unknown runtime errors", () => {
    const display = mapRuntimeError(new Error("network unavailable"));

    expect(display.title).toBe("启动失败");
    expect(display.detail).toBe("请查看诊断日志后重试。");
  });

  /**
   * @brief Assert that runtime errors using resultCode still map to the planned Driver Service user message.
   */
  it("maps runtime resultCode objects to the planned Driver Service message", () => {
    const display = mapRuntimeError({
      resultCode: "DEVICE_TIMEOUT",
    });

    expect(display.title).toBe("设备通信超时");
    expect(display.detail).toBe("请检查设备连接状态后重试。");
  });
});

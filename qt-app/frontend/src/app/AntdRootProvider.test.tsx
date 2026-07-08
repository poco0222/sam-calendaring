/**
 * @file AntdRootProvider.test.tsx - 验证 Ant Design（前端组件库）根级配置。
 * @author PopoY
 * @created 2026-06-25
 * @brief 锁定 QT App light/dark/system theme（亮色/暗色/系统主题）契约。
 */

import { theme } from "antd";
import { describe, expect, it, vi } from "vitest";

import {
  buildQtAppAntdTheme,
  normalizeThemeMode,
  QT_APP_THEME_MODE_STORAGE_KEY,
  readStoredThemeMode,
  resolveEffectiveThemeMode,
  resolveSystemThemeMode,
  subscribeSystemThemeMode,
  writeStoredThemeMode,
} from "./AntdRootProvider";

/**
 * @brief Build the smallest Storage mock needed by the theme preference helpers.
 * @param initialValue Optional value returned for the theme storage key.
 * @returns Storage-like object with spyable getItem and setItem calls.
 */
function createStorageProbe(initialValue?: string) {
  return {
    getItem: vi.fn((key: string) =>
      key === QT_APP_THEME_MODE_STORAGE_KEY ? initialValue ?? null : null,
    ),
    setItem: vi.fn(),
  };
}

describe("AntdRootProvider theme mode", () => {
  /**
   * @brief Assert that persisted theme values are normalized before use.
   */
  it("normalizes stored theme modes and falls back to system", () => {
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("system")).toBe("system");
    expect(normalizeThemeMode("unsupported")).toBe("system");
    expect(readStoredThemeMode(createStorageProbe("dark") as unknown as Storage)).toBe(
      "dark",
    );
    expect(readStoredThemeMode(createStorageProbe("legacy") as unknown as Storage)).toBe(
      "system",
    );
  });

  /**
   * @brief Assert that system mode resolves through the browser media preference.
   */
  it("resolves system mode from prefers-color-scheme", () => {
    const darkMatchMedia = vi.fn().mockReturnValue({ matches: true });
    const lightMatchMedia = vi.fn().mockReturnValue({ matches: false });

    expect(resolveSystemThemeMode(darkMatchMedia)).toBe("dark");
    expect(resolveSystemThemeMode(lightMatchMedia)).toBe("light");
    expect(resolveEffectiveThemeMode("system", "dark")).toBe("dark");
    expect(resolveEffectiveThemeMode("system", "light")).toBe("light");
    expect(resolveEffectiveThemeMode("dark", "light")).toBe("dark");
    expect(resolveEffectiveThemeMode("light", "dark")).toBe("light");
  });

  /**
   * @brief Assert that light and dark modes never reuse the old mixed token combination.
   */
  it("builds readable light and dark Ant Design themes", () => {
    const lightTheme = buildQtAppAntdTheme("light");
    const darkTheme = buildQtAppAntdTheme("dark");

    expect(lightTheme.algorithm).toBe(theme.defaultAlgorithm);
    expect(lightTheme.token?.colorBgBase).toBe("#ffffff");
    expect(lightTheme.token?.colorTextBase).toBe("#000000");

    expect(darkTheme.algorithm).toBe(theme.darkAlgorithm);
    expect(darkTheme.token?.colorPrimary).toBe("#0a84ff");
    expect(darkTheme.token?.colorBgBase).toBe("#151518");
    expect(darkTheme.token?.colorBgContainer).toBe("#242428");
    expect(darkTheme.token?.colorBgElevated).toBe("#2c2c30");
    expect(darkTheme.token?.colorTextBase).toBe("#f5f5f7");
    expect(darkTheme.token?.colorTextSecondary).toBe("#d1d1d6");
    expect(darkTheme.token?.colorBorder).toBe("#6e6e73");
  });

  /**
   * @brief Assert that user theme choices persist through the narrow storage helper.
   */
  it("writes the selected theme mode to localStorage", () => {
    const storageProbe = createStorageProbe();

    writeStoredThemeMode(storageProbe as unknown as Storage, "dark");

    expect(storageProbe.setItem).toHaveBeenCalledWith(
      QT_APP_THEME_MODE_STORAGE_KEY,
      "dark",
    );
  });

  /**
   * @brief Assert that system theme subscriptions support modern and legacy Qt WebEngine APIs.
   */
  it("subscribes to modern and legacy matchMedia change APIs", () => {
    const onChange = vi.fn();
    const modernMediaQueryList = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const legacyMediaQueryList = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    const cleanupModern = subscribeSystemThemeMode(
      modernMediaQueryList as unknown as MediaQueryList,
      onChange,
    );
    const cleanupLegacy = subscribeSystemThemeMode(
      legacyMediaQueryList as unknown as MediaQueryList,
      onChange,
    );

    expect(modernMediaQueryList.addEventListener).toHaveBeenCalledWith(
      "change",
      onChange,
    );
    cleanupModern();
    expect(modernMediaQueryList.removeEventListener).toHaveBeenCalledWith(
      "change",
      onChange,
    );

    expect(legacyMediaQueryList.addListener).toHaveBeenCalledWith(onChange);
    cleanupLegacy();
    expect(legacyMediaQueryList.removeListener).toHaveBeenCalledWith(onChange);
  });
});

/**
 * @file AntdRootProvider.tsx - 提供 Ant Design（前端组件库）根级配置。
 * @author PopoY
 * @created 2026-06-25
 * @brief 集中管理 QT App 的 Ant Design（前端组件库）provider（提供器）和 theme（主题）。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import type { ThemeConfig } from "antd";
import zhCN from "antd/es/locale/zh_CN";
import { HappyProvider } from "@ant-design/happy-work-theme";

export type QtAppThemeMode = "light" | "dark" | "system";
export type QtAppEffectiveThemeMode = Exclude<QtAppThemeMode, "system">;

export const QT_APP_THEME_MODE_STORAGE_KEY = "qt-app-theme-mode";

const qtAppCommonToken = {
  colorPrimary: "#0078c8",
  colorInfo: "#0078c8",
  colorSuccess: "#52c41a",
  colorWarning: "#faad14",
  colorError: "#ff4d4f",
  borderRadius: 6,
  fontFamily:
    "IBM Plex Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const qtAppLightToken = {
  ...qtAppCommonToken,
  colorTextBase: "#000000",
  colorBgBase: "#ffffff",
};

// PopoY: dark mode（深色模式）使用 macOS-like（类 macOS）neutral material（中性材质）层级，降低旧 slate（蓝灰）底色压迫感。
const qtAppDarkToken = {
  ...qtAppCommonToken,
  colorPrimary: "#0a84ff",
  colorInfo: "#0a84ff",
  colorSuccess: "#30d158",
  colorWarning: "#ffd60a",
  colorError: "#ff453a",
  colorTextBase: "#f5f5f7",
  colorTextSecondary: "#d1d1d6",
  colorTextTertiary: "#98989d",
  colorBgBase: "#151518",
  colorBgLayout: "#151518",
  colorBgContainer: "#242428",
  colorBgElevated: "#2c2c30",
  colorFillSecondary: "#2f2f34",
  colorFillTertiary: "#343438",
  colorFillQuaternary: "#3a3a3f",
  colorBorder: "#6e6e73",
  colorBorderSecondary: "#48484a",
};

type ThemeModeContextValue = {
  themeMode: QtAppThemeMode;
  effectiveThemeMode: QtAppEffectiveThemeMode;
  setThemeMode: (nextThemeMode: QtAppThemeMode) => void;
};

type SystemThemeMediaQueryList = Pick<MediaQueryList, "matches"> & {
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

/**
 * @brief Normalize a raw storage or UI value into a supported QT App theme mode.
 * @param value Unknown theme mode input read from storage or the UI.
 * @returns Supported theme mode with system as the safe fallback.
 */
export function normalizeThemeMode(value: unknown): QtAppThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

/**
 * @brief Read the persisted QT App theme mode from localStorage.
 * @param storage Storage-like object used by the browser or unit tests.
 * @returns Normalized persisted theme mode.
 */
export function readStoredThemeMode(storage?: Pick<Storage, "getItem"> | null): QtAppThemeMode {
  try {
    return normalizeThemeMode(storage?.getItem(QT_APP_THEME_MODE_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/**
 * @brief Persist the selected QT App theme mode to localStorage.
 * @param storage Storage-like object used by the browser or unit tests.
 * @param nextThemeMode Theme mode selected by the operator.
 * @returns Nothing.
 */
export function writeStoredThemeMode(
  storage: Pick<Storage, "setItem"> | null | undefined,
  nextThemeMode: QtAppThemeMode,
): void {
  try {
    storage?.setItem(QT_APP_THEME_MODE_STORAGE_KEY, nextThemeMode);
  } catch {
    // PopoY: theme selection is non-critical; storage failures must not block startup.
  }
}

/**
 * @brief Resolve the current browser system theme preference.
 * @param matchMediaFn Browser matchMedia function or a test double.
 * @returns Effective light or dark theme mode.
 */
export function resolveSystemThemeMode(
  matchMediaFn?: Pick<Window, "matchMedia">["matchMedia"] | null,
): QtAppEffectiveThemeMode {
  try {
    return matchMediaFn?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * @brief Convert user mode and system mode into the effective Ant Design theme mode.
 * @param themeMode User-selected theme mode.
 * @param systemThemeMode Current system light or dark mode.
 * @returns Effective light or dark theme mode.
 */
export function resolveEffectiveThemeMode(
  themeMode: QtAppThemeMode,
  systemThemeMode: QtAppEffectiveThemeMode,
): QtAppEffectiveThemeMode {
  return themeMode === "system" ? systemThemeMode : themeMode;
}

/**
 * @brief Build the Ant Design theme object for the effective QT App theme mode.
 * @param effectiveThemeMode Effective light or dark theme mode.
 * @returns Ant Design theme configuration.
 */
export function buildQtAppAntdTheme(
  effectiveThemeMode: QtAppEffectiveThemeMode,
): ThemeConfig {
  return {
    algorithm:
      effectiveThemeMode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: effectiveThemeMode === "dark" ? qtAppDarkToken : qtAppLightToken,
  };
}

/**
 * @brief Subscribe to system theme changes with modern and legacy MediaQueryList APIs.
 * @param mediaQueryList Browser media query list for prefers-color-scheme detection.
 * @param onChange Callback that refreshes the resolved system theme mode.
 * @returns Cleanup function that removes the active listener.
 */
export function subscribeSystemThemeMode(
  mediaQueryList: SystemThemeMediaQueryList,
  onChange: () => void,
): () => void {
  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", onChange);

    return () => {
      mediaQueryList.removeEventListener?.("change", onChange);
    };
  }

  if (typeof mediaQueryList.addListener === "function") {
    mediaQueryList.addListener(onChange);

    return () => {
      mediaQueryList.removeListener?.(onChange);
    };
  }

  return () => {};
}

/**
 * @brief Safely read browser localStorage when running in Qt WebEngine.
 * @returns Browser localStorage or null outside the browser.
 */
function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * @brief Safely read browser matchMedia when running in Qt WebEngine.
 * @returns Browser matchMedia function or null outside the browser.
 */
function getBrowserMatchMedia(): Pick<Window, "matchMedia">["matchMedia"] | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  return window.matchMedia.bind(window);
}

/**
 * @brief Expose QT App theme mode state to toolbar controls.
 * @returns Current theme mode, effective theme mode, and setter.
 */
export function useQtAppThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useQtAppThemeMode must be used inside AntdRootProvider.");
  }

  return context;
}

/**
 * @brief Wrap children with the single allowed global Ant Design provider chain.
 * @param children Nested React tree for the QT App frontend.
 * @returns Provider-wrapped React tree.
 */
export function AntdRootProvider({ children }: PropsWithChildren) {
  const [themeMode, setThemeModeState] = useState<QtAppThemeMode>(() =>
    readStoredThemeMode(getBrowserStorage()),
  );
  const [systemThemeMode, setSystemThemeMode] = useState<QtAppEffectiveThemeMode>(() =>
    resolveSystemThemeMode(getBrowserMatchMedia()),
  );
  const effectiveThemeMode = resolveEffectiveThemeMode(themeMode, systemThemeMode);
  const qtAppAntdTheme = useMemo(
    () => buildQtAppAntdTheme(effectiveThemeMode),
    [effectiveThemeMode],
  );
  const setThemeMode = useCallback((nextThemeMode: QtAppThemeMode) => {
    const normalizedThemeMode = normalizeThemeMode(nextThemeMode);

    setThemeModeState(normalizedThemeMode);
    writeStoredThemeMode(getBrowserStorage(), normalizedThemeMode);
  }, []);
  const contextValue = useMemo(
    () => ({
      themeMode,
      effectiveThemeMode,
      setThemeMode,
    }),
    [effectiveThemeMode, setThemeMode, themeMode],
  );

  useEffect(() => {
    const matchMediaFn = getBrowserMatchMedia();

    if (!matchMediaFn) {
      return undefined;
    }

    const mediaQueryList = matchMediaFn("(prefers-color-scheme: dark)");
    const updateSystemThemeMode = () => {
      setSystemThemeMode(mediaQueryList.matches ? "dark" : "light");
    };

    updateSystemThemeMode();
    return subscribeSystemThemeMode(mediaQueryList, updateSystemThemeMode);
  }, []);

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ConfigProvider locale={zhCN} componentSize="medium" theme={qtAppAntdTheme}>
        <HappyProvider>
          <AntdApp>
            <div
              data-theme={effectiveThemeMode}
              style={{
                backgroundColor: qtAppAntdTheme.token?.colorBgBase,
                color: qtAppAntdTheme.token?.colorTextBase,
                minHeight: "100%",
              }}
            >
              {children}
            </div>
          </AntdApp>
        </HappyProvider>
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
}

ConfigProvider.config({
  holderRender: (children) => <AntdRootProvider>{children}</AntdRootProvider>,
});

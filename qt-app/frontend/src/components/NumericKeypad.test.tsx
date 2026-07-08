/**
 * @file NumericKeypad.test.tsx - 验证 NumericKeypad（数字键盘）组件。
 * @author PopoY
 * @created 2026-06-30
 * @brief 锁定预计时长 input（输入框）使用的数字键盘布局和输入规则。
 */

// @ts-ignore @author PopoY: 当前项目未安装 Node types（Node 类型），此测试运行时由 Vitest（测试框架）提供 node:fs。
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import { applyNumericKeypadAction, NumericKeypad } from "./NumericKeypad";

const keypadSourceUrl = new URL("./NumericKeypad.tsx", import.meta.url);
const keypadSource = existsSync(keypadSourceUrl)
  ? readFileSync(keypadSourceUrl, "utf8")
  : "";

describe("NumericKeypad", () => {
  /**
   * @brief 断言 keypad（键盘）按参考图渲染 3-column（3 列）数字布局。
   * @author PopoY
   */
  it("renders the touch numeric keypad layout", () => {
    const html = renderToStaticMarkup(
      <AntdRootProvider>
        <NumericKeypad
          onChange={vi.fn()}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          value="2.5"
        />
      </AntdRootProvider>,
    );

    expect(html).toContain("aria-label=\"数字键盘\"");
    expect(html).toContain("1");
    expect(html).toContain("2");
    expect(html).toContain("3");
    expect(html).toContain("4");
    expect(html).toContain("5");
    expect(html).toContain("6");
    expect(html).toContain("7");
    expect(html).toContain("8");
    expect(html).toContain("9");
    expect(html).toContain(".");
    expect(html).toContain("0");
    expect(html).toContain("aria-label=\"回退\"");
    expect(html).toContain("清空");
    expect(html).toContain("确认");
    expect(html).toContain("关闭");
  });

  /**
   * @brief 断言 keypad action（键盘动作）只处理预计时长需要的最小输入规则。
   * @author PopoY
   */
  it("applies digit, decimal, backspace, and clear actions", () => {
    expect(applyNumericKeypadAction("2", "5")).toBe("25");
    expect(applyNumericKeypadAction("2", ".")).toBe("2.");
    expect(applyNumericKeypadAction("2.5", ".")).toBe("2.5");
    expect(applyNumericKeypadAction("2.5", "backspace")).toBe("2.");
    expect(applyNumericKeypadAction("2.5", "clear")).toBe("");
  });

  /**
   * @brief 断言 moldNo（模具号）键盘变体把 decimal key（小数点键）替换为 hyphen（连字符）。
   * @author PopoY
   */
  it("can render a mold-number keypad variant with a hyphen key", () => {
    const html = renderToStaticMarkup(
      <AntdRootProvider>
        <NumericKeypad
          onChange={vi.fn()}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          specialKey="-"
          value="123-"
        />
      </AntdRootProvider>,
    );

    expect(html).toContain("-");
    expect(html).not.toContain(">.<");
    expect(applyNumericKeypadAction("123", "-")).toBe("123-");
    expect(applyNumericKeypadAction("123-", "-")).toBe("123--");
  });

  /**
   * @brief 断言 touch/pointer（触控/指针）点击键盘时不让 input blur（输入框失焦）先卸载键盘。
   * @author PopoY
   */
  it("prevents pointer down from blurring the active input before keypad clicks", () => {
    expect(keypadSource).toContain("onPointerDown");
    expect(keypadSource).toContain("event.preventDefault()");
  });
});

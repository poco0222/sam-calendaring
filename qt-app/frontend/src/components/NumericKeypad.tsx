/**
 * @file NumericKeypad.tsx - 提供 touch IPC（触控工控机）数字键盘。
 * @author PopoY
 * @created 2026-06-30
 * @brief 用于预计时长 input（输入框）的本地数字输入，不包含业务保存逻辑。
 */

import { Button } from "antd";
import type { CSSProperties } from "react";

type NumericKeypadDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type NumericKeypadSpecialKey = "." | "-";
export type NumericKeypadAction =
  | NumericKeypadDigit
  | NumericKeypadSpecialKey
  | "backspace"
  | "clear";

export type NumericKeypadProps = {
  value: string;
  onChange: (nextValue: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  specialKey?: NumericKeypadSpecialKey;
  style?: CSSProperties;
};

const NUMERIC_KEYPAD_BASE_ROWS: ReadonlyArray<ReadonlyArray<NumericKeypadAction>> = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

/**
 * @brief 按 keypad action（键盘动作）计算下一个 input value（输入值）。
 * @author PopoY
 * @param value 当前输入值。
 * @param action 当前按键动作。
 * @returns 下一个输入值。
 */
export function applyNumericKeypadAction(
  value: string,
  action: NumericKeypadAction,
): string {
  if (action === "clear") {
    return "";
  }

  if (action === "backspace") {
    return value.slice(0, -1);
  }

  if (action === "-") {
    return `${value}-`;
  }

  if (action === ".") {
    return value.includes(".") ? value : `${value}.`;
  }

  return `${value}${action}`;
}

/**
 * @brief 渲染 3-column（3 列）数字键盘。
 * @author PopoY
 * @param props 当前值、变更回调、确认和关闭回调。
 * @returns 数字键盘 React element（React 元素）。
 */
export function NumericKeypad({
  value,
  onChange,
  onConfirm,
  onClose,
  specialKey = ".",
  style,
}: NumericKeypadProps) {
  const keypadRows = createNumericKeypadRows(specialKey);

  /**
   * @brief 执行单个 keypad action（键盘动作）。
   * @author PopoY
   * @param action 当前按键动作。
   */
  const handleAction = (action: NumericKeypadAction) => {
    onChange(applyNumericKeypadAction(value, action));
  };

  return (
    <div
      aria-label="数字键盘"
      className="numeric-keypad"
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => event.preventDefault()}
      role="group"
      style={style}
    >
      {keypadRows.flatMap((row) =>
        row.map((action) => (
          <Button
            aria-label={action === "backspace" ? "回退" : undefined}
            autoInsertSpace={false}
            className={createNumericKeypadButtonClassName(action)}
            key={action}
            onClick={() => handleAction(action)}
          >
            {formatNumericKeypadActionLabel(action)}
          </Button>
        )),
      )}
      <Button
        autoInsertSpace={false}
        className="numeric-keypad__key numeric-keypad__key--confirm"
        onClick={onConfirm}
        type="primary"
      >
        确认
      </Button>
      <Button
        autoInsertSpace={false}
        className="numeric-keypad__key numeric-keypad__key--close"
        onClick={onClose}
      >
        关闭
      </Button>
    </div>
  );
}

/**
 * @brief 创建 keypad rows（键盘行），允许 moldNo（模具号）场景把小数点替换为连字符。
 * @author PopoY
 * @param specialKey 第四行左侧特殊键。
 * @returns NumericKeypad（数字键盘）渲染用行配置。
 */
function createNumericKeypadRows(
  specialKey: NumericKeypadSpecialKey,
): NumericKeypadAction[][] {
  return [
    ...NUMERIC_KEYPAD_BASE_ROWS.map((row) => [...row]),
    [specialKey, "0", "backspace"],
    ["clear"],
  ];
}

/**
 * @brief 转换 keypad action（键盘动作）的展示文案。
 * @author PopoY
 * @param action 当前按键动作。
 * @returns 按钮展示文案。
 */
function formatNumericKeypadActionLabel(action: NumericKeypadAction): string {
  if (action === "backspace") {
    return "←";
  }

  if (action === "clear") {
    return "清空";
  }

  return action;
}

/**
 * @brief 创建 keypad button（键盘按钮）的 className（样式类名）。
 * @author PopoY
 * @param action 当前按键动作。
 * @returns 按钮样式类名。
 */
function createNumericKeypadButtonClassName(action: NumericKeypadAction): string {
  return action === "clear"
    ? "numeric-keypad__key numeric-keypad__key--clear"
    : "numeric-keypad__key";
}

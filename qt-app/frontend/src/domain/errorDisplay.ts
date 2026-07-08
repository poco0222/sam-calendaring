/**
 * @file errorDisplay.ts - 定义错误展示模型。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义面向用户的 bootstrap error display（启动引导错误展示）契约。
 */

/**
 * @brief Model the stable title and detail text shown for bootstrap failures.
 */
export type ErrorDisplay = {
  title: string;
  detail: string;
};

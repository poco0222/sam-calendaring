/**
 * @file ErrorPanel.tsx - 渲染错误提示面板。
 * @author PopoY
 * @created 2026-06-25
 * @brief 使用 Task6（任务六）用户文案映射渲染 bootstrap（启动引导）和 driver（驱动）错误。
 */

import { Alert, Typography } from "antd";
import { mapRuntimeError } from "../services/errorMapper";

type ErrorEntry = {
  key: string;
  title: string;
  detail: string;
};

/**
 * @brief Describe the props accepted by the minimal dashboard error panel.
 */
export type ErrorPanelProps = {
  bootstrapError?: unknown;
  driverError?: unknown;
};

/**
 * @brief Render bootstrap and driver errors with stable user-facing Task6 titles and details.
 * @param props Bootstrap and driver error objects captured by the hooks.
 * @returns React element for the dashboard error section.
 */
export function ErrorPanel({
  bootstrapError,
  driverError,
}: ErrorPanelProps) {
  const entries = buildErrorEntries([
    ["启动会话", bootstrapError],
    ["驱动会话", driverError],
  ]);

  if (entries.length === 0) {
    return (
      <Typography.Text type="secondary">
        暂无错误。
      </Typography.Text>
    );
  }

  return (
    <Alert
      type="error"
      showIcon
      title="启动流程异常"
      description={
        <div>
          {entries.map((entry) => (
            <div key={entry.key}>
              <Typography.Text strong>{entry.title}: </Typography.Text>
              <Typography.Text>{entry.detail}</Typography.Text>
            </div>
          ))}
        </div>
      }
    />
  );
}

/**
 * @brief Extract mapped bootstrap and driver error entries from supported runtime error shapes.
 * @param sources Named error sources from the dashboard hooks.
 * @returns Flattened error entries suitable for the minimal error panel.
 */
function buildErrorEntries(
  sources: ReadonlyArray<readonly [string, unknown]>,
): ErrorEntry[] {
  return sources.flatMap(([sourceTitle, error]) => {
    if (!error) {
      return [];
    }

    const display = mapRuntimeError(error);

    return [
      {
        key: sourceTitle,
        title: `${sourceTitle} | ${display.title}`,
        detail: display.detail,
      },
    ];
  });
}

/**
 * @file StatusBlock.tsx - 渲染状态信息块。
 * @author PopoY
 * @created 2026-06-25
 * @brief 渲染 dashboard（仪表盘）状态区块。
 */

import type { PropsWithChildren, ReactNode } from "react";
import { Card, Space, Tag, Typography } from "antd";

/**
 * @brief Describe the props accepted by the reusable dashboard status block.
 * @author PopoY
 */
export type StatusBlockProps = PropsWithChildren<{
  extra?: ReactNode;
  title: string;
  status?: string;
  summary?: ReactNode;
}>;

/**
 * @brief Render a single dashboard block with a stable title and lightweight status summary.
 * @param props Block title, status, summary text, and optional child content.
 * @returns React element for one bootstrap dashboard section.
 */
export function StatusBlock({
  extra,
  title,
  status,
  summary,
  children,
}: StatusBlockProps) {
  const statusTag = status ? (
    <Tag color={pickTagColor(status)}>{formatStatusText(status)}</Tag>
  ) : null;

  return (
    <Card
      size="small"
      title={title}
      extra={
        extra || statusTag ? (
          <Space size={8}>
            {extra}
            {statusTag}
          </Space>
        ) : null
      }
    >
      {summary ? (
        <Typography.Paragraph style={{ marginBottom: children ? 12 : 0 }}>
          {summary}
        </Typography.Paragraph>
      ) : null}
      {children}
    </Card>
  );
}

/**
 * @brief Map the lightweight async status string to an Ant Design tag color.
 * @param status Async or domain status text rendered by the dashboard.
 * @returns Tag color token suitable for the status badge.
 */
function pickTagColor(status: string): string {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "success" || normalizedStatus === "active") {
    return "success";
  }

  if (normalizedStatus === "error" || normalizedStatus === "faulted") {
    return "error";
  }

  if (normalizedStatus === "loading" || normalizedStatus === "pending") {
    return "processing";
  }

  return "default";
}

/**
 * @brief Map internal async status codes to concise Chinese text for field operators.
 * @param status Async or domain status text rendered by the dashboard.
 * @returns User-facing Chinese status text.
 */
function formatStatusText(status: string): string {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "success" || normalizedStatus === "active") {
    return "成功";
  }

  if (normalizedStatus === "error" || normalizedStatus === "faulted") {
    return "异常";
  }

  if (normalizedStatus === "loading" || normalizedStatus === "pending") {
    return "加载中";
  }

  if (normalizedStatus === "idle") {
    return "未启动";
  }

  return "未知";
}

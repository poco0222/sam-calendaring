/**
 * @file BootstrapDashboard.tsx - 渲染 Bootstrap Dashboard（启动仪表盘）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 渲染紧凑 bootstrap dashboard（启动仪表盘）主界面。
 */

import { Button, Col, Descriptions, Row, Space } from "antd";
import type { UseBootstrapSessionResult } from "../hooks/useBootstrapSession";
import {
  canRefreshSignalSnapshot,
  type UseDriverSessionResult,
} from "../hooks/useDriverSession";
import { ErrorPanel } from "./ErrorPanel";
import {
  SignalSnapshotRefreshMeta,
  SignalSnapshotTable,
} from "./SignalSnapshotTable";
import { StatusBlock } from "./StatusBlock";
import "./BootstrapDashboard.css";

/**
 * @brief 定义 BootstrapDashboard（启动仪表盘）接收的 props（属性）。
 */
export type BootstrapDashboardProps = {
  bootstrapSession?: UseBootstrapSessionResult;
  driverSession?: UseDriverSessionResult;
};

/**
 * @brief 渲染紧凑 no-scroll（无滚动）启动区块和 V1 允许的操作按钮。
 * @param props App shell（应用外壳）传入的 bootstrap（启动）与 driver（驱动）hook 结果。
 * @returns 用于现场工控机的 React element（React 元素）。
 */
export function BootstrapDashboard({
  bootstrapSession,
  driverSession,
}: BootstrapDashboardProps = {}) {
  const stationContext = bootstrapSession?.data?.stationContext;
  const config = bootstrapSession?.config;
  const leasePackage = bootstrapSession?.data;
  const signalSnapshot = driverSession?.data?.signalSnapshot;
  const hasRuntimeError = Boolean(bootstrapSession?.error || driverSession?.error);

  return (
    <Row className="bootstrap-dashboard" gutter={[12, 12]}>
      <Col span={24}>
        <section className="bootstrap-dashboard__header" aria-label="启动操作">
          <Space className="bootstrap-dashboard__toolbar" size={8}>
            <Button
              disabled={!bootstrapSession?.retry || bootstrapSession.status === "loading"}
              icon={createToolbarIcon("↻")}
              loading={bootstrapSession?.status === "loading"}
              onClick={() => {
                void bootstrapSession?.retry?.();
              }}
              size="middle"
              type="default"
            >
              重试登录
            </Button>
            <Button
              disabled={
                !driverSession?.retry ||
                !bootstrapSession?.data ||
                driverSession.status === "loading"
              }
              icon={createToolbarIcon("⇄")}
              loading={driverSession?.status === "loading"}
              onClick={() => {
                void driverSession?.retry?.();
              }}
              size="middle"
              type="default"
            >
              重获授权
            </Button>
            <Button
              disabled={
                !driverSession?.refreshSnapshot ||
                !canRefreshSignalSnapshot(driverSession?.data?.applyResult) ||
                driverSession.status === "loading"
              }
              icon={createToolbarIcon("⟳")}
              onClick={() => {
                void driverSession?.refreshSnapshot?.();
              }}
              size="middle"
              type="primary"
            >
              刷新快照
            </Button>
          </Space>
        </section>
      </Col>
      <Col span={24} lg={12}>
        <StatusBlock
          title="工控机绑定信息"
          status={bootstrapSession?.status}
        >
          <Descriptions
            column={1}
            items={[
              createDescriptionItem(
                "授权主机 ID",
                stationContext?.granteeHostId ?? config?.granteeHostId,
              ),
              createDescriptionItem("配置版本", config?.configVersion),
            ]}
            size="small"
          />
        </StatusBlock>
      </Col>
      <Col span={24} lg={12}>
        <StatusBlock
          title="ERP 登录状态"
          status={bootstrapSession?.status}
        >
          <Descriptions
            column={1}
            items={[
              createDescriptionItem(
                "工控机绑定校验",
                stationContext ? "已通过" : "待校验",
              ),
              createDescriptionItem(
                "租约授权包",
                leasePackage?.signedLease ? "已获取" : "待获取",
              ),
            ]}
            size="small"
          />
        </StatusBlock>
      </Col>
      <Col className="bootstrap-dashboard__snapshot-panel" span={24} lg={17}>
        <StatusBlock
          extra={
            <SignalSnapshotRefreshMeta
              refreshedKey={
                signalSnapshot?.resultCode === "OK"
                  ? signalSnapshot.correlationId
                  : undefined
              }
            />
          }
          title="信号快照"
          status={driverSession?.status}
        >
          <SignalSnapshotTable
            parameterGroupOptions={bootstrapSession?.data?.parameterGroupOptions}
            signalValues={signalSnapshot?.signalValues}
          />
        </StatusBlock>
      </Col>
      <Col className="bootstrap-dashboard__error-panel" span={24} lg={7}>
        <StatusBlock
          title="错误面板"
          status={hasRuntimeError ? "error" : undefined}
        >
          <ErrorPanel
            bootstrapError={bootstrapSession?.error}
            driverError={driverSession?.error}
          />
        </StatusBlock>
      </Col>
    </Row>
  );
}

/**
 * @brief 创建 toolbar button（工具栏按钮）的轻量字符 icon（图标），避免新增 icon dependency（图标依赖）。
 * @author PopoY
 * @param symbol 用于表达操作含义的字符图标。
 * @returns Ant Design Button（按钮）icon prop（图标属性）使用的 React element（React 元素）。
 */
function createToolbarIcon(symbol: string) {
  return (
    <span aria-hidden="true" className="bootstrap-dashboard__toolbar-icon">
      {symbol}
    </span>
  );
}

/**
 * @brief 创建小型 Descriptions（描述列表）字段，并统一空值占位。
 * @param label 操作员可读的字段 label（标签）。
 * @param value 需要展示的 scalar（标量）或已格式化文本。
 * @returns Ant Design Descriptions item（描述项）配置。
 */
function createDescriptionItem(label: string, value: unknown) {
  return {
    key: label,
    label,
    children: formatDisplayValue(value),
  };
}

/**
 * @brief 将 structured value（结构化值）渲染为 JSON，并保持空值占位稳定。
 * @param value bootstrap data model（启动数据模型）中的运行时结构化值。
 * @returns 适合 minimal dashboard（最小仪表盘）展示的字符串。
 */
function formatStructuredValue(value: unknown): string {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
    return "暂无数据";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * @brief 将 scalar（标量）或 unknown（未知）值渲染成稳定的用户可见文本。
 * @param value 原始 runtime field（运行时字段）值。
 * @returns Descriptions（描述列表）区块使用的占位或字符串化结果。
 */
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "暂无数据";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return formatStructuredValue(value);
}

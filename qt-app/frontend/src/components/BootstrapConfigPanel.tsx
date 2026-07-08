/**
 * @file BootstrapConfigPanel.tsx - 渲染 BootstrapConfigPanel（启动配置面板）。
 * @author PopoY
 * @created 2026-07-08
 * @brief 在 BootstrapDashboard（启动仪表盘）中展示并按 ERP approval（ERP 审批）保存启动配置。
 */

import { Alert, Col, Form, Input, Row } from "antd";
import { useEffect, useState } from "react";

import type { RequiredBootstrapConfigField } from "../services/bootstrapFlow";
import { readMissingBootstrapConfigFields } from "../services/bootstrapFlow";
import type { BootstrapConfigApprovalState } from "../services/erpClient";
import { saveNativeConfig as saveNativeBootstrapConfig } from "../services/nativeBridge";
import type { NativeBootstrapConfig } from "../types/native";
import "./BootstrapConfigPanel.css";

const emptyConfig: NativeBootstrapConfig = {
  stationAccountId: "",
  granteeHostId: "",
  stationId: "",
  erpBaseUrl: "",
  driverBaseUrl: "",
  configVersion: "",
};

// @author PopoY: 六个字段 label（标签）与 QSettings（Qt 配置存储）白名单字段一一对应。
const fieldLabels: Record<RequiredBootstrapConfigField, string> = {
  stationAccountId: "工位账号 ID",
  granteeHostId: "授权主机 ID",
  stationId: "工位/设备 ID",
  erpBaseUrl: "ERP 服务地址",
  driverBaseUrl: "驱动服务地址",
  configVersion: "配置版本",
};

/**
 * @brief 描述启动配置面板接收的 config（配置）、approval（审批）状态和保存依赖。
 * @author PopoY
 */
export type BootstrapConfigPanelProps = {
  config?: NativeBootstrapConfig | null;
  formId?: string;
  bootstrapConfigEditable: boolean;
  bootstrapConfigApprovalState: BootstrapConfigApprovalState;
  onSavingChange?: (saving: boolean) => void;
  onSaved: () => Promise<void>;
  saveNativeConfig?: (config: NativeBootstrapConfig) => Promise<void>;
};

/**
 * @brief 渲染 dashboard（仪表盘）内的启动配置只读/编辑面板。
 * @author PopoY
 * @param props 当前 native config（原生配置）、ERP approval（ERP 审批）和保存回调。
 * @returns React element（React 元素）。
 */
export function BootstrapConfigPanel({
  config,
  formId,
  bootstrapConfigEditable,
  onSavingChange,
  onSaved,
  saveNativeConfig = saveNativeBootstrapConfig,
}: BootstrapConfigPanelProps) {
  const [form] = Form.useForm<NativeBootstrapConfig>();
  const [saveError, setSaveError] = useState("");
  const initialValues = config ?? emptyConfig;

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  /**
   * @brief 提交表单后保存 QSettings（Qt 配置存储）并触发 bootstrap retry（启动重试）。
   * @author PopoY
   * @param values Ant Design Form（表单）收集的六字段启动配置。
   */
  async function handleSubmit(values: NativeBootstrapConfig): Promise<void> {
    if (!bootstrapConfigEditable) {
      return;
    }

    onSavingChange?.(true);
    setSaveError("");

    try {
      await saveBootstrapConfigPanelValues(values, saveNativeConfig, onSaved);
    } catch (error) {
      setSaveError(readChineseSaveErrorMessage(error));
    } finally {
      onSavingChange?.(false);
    }
  }

  return (
    <section className="bootstrap-config-panel" aria-label="启动配置">
      {saveError ? (
        <Alert
          className="bootstrap-config-panel__alert"
          showIcon
          title={saveError}
          type="error"
        />
      ) : null}
      <Form<NativeBootstrapConfig>
        form={form}
        id={formId}
        initialValues={initialValues}
        layout="vertical"
        onFinish={(values) => {
          void handleSubmit(values);
        }}
      >
        <Row gutter={8}>
          <Col span={24} md={12}>
            <Form.Item
              label={fieldLabels.stationAccountId}
              name="stationAccountId"
              rules={[createRequiredRule(fieldLabels.stationAccountId)]}
            >
              <Input autoComplete="off" disabled={!bootstrapConfigEditable} />
            </Form.Item>
          </Col>
          <Col span={24} md={12}>
            <Form.Item
              label={fieldLabels.granteeHostId}
              name="granteeHostId"
              rules={[createRequiredRule(fieldLabels.granteeHostId)]}
            >
              <Input autoComplete="off" disabled={!bootstrapConfigEditable} />
            </Form.Item>
          </Col>
          <Col span={24} md={12}>
            <Form.Item
              label={fieldLabels.stationId}
              name="stationId"
              rules={[createRequiredRule(fieldLabels.stationId)]}
            >
              <Input autoComplete="off" disabled={!bootstrapConfigEditable} />
            </Form.Item>
          </Col>
          <Col span={24} md={12}>
            <Form.Item
              label={fieldLabels.configVersion}
              name="configVersion"
              rules={[createRequiredRule(fieldLabels.configVersion)]}
            >
              <Input autoComplete="off" disabled={!bootstrapConfigEditable} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label={fieldLabels.erpBaseUrl}
              name="erpBaseUrl"
              rules={[
                createRequiredRule(fieldLabels.erpBaseUrl),
                createUrlRule(fieldLabels.erpBaseUrl),
              ]}
            >
              <Input autoComplete="off" disabled={!bootstrapConfigEditable} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label={fieldLabels.driverBaseUrl}
              name="driverBaseUrl"
              rules={[
                createRequiredRule(fieldLabels.driverBaseUrl),
                createUrlRule(fieldLabels.driverBaseUrl),
              ]}
            >
              <Input autoComplete="off" disabled={!bootstrapConfigEditable} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </section>
  );
}

/**
 * @brief 保存 dashboard config panel（仪表盘配置面板）提交值，并在成功后触发 retry（重试）。
 * @author PopoY
 * @param config 表单提交的 bootstrap config（启动配置）。
 * @param saveNativeConfig 写入 QSettings（Qt 配置存储）的 native bridge（原生桥）函数。
 * @param onSaved 保存成功后的 bootstrap retry（启动重试）回调。
 */
export async function saveBootstrapConfigPanelValues(
  config: NativeBootstrapConfig,
  saveNativeConfig: (config: NativeBootstrapConfig) => Promise<void>,
  onSaved: () => Promise<void>,
): Promise<void> {
  const normalizedConfig = normalizeBootstrapConfigPanelValues(config);

  validateBootstrapConfigPanelValues(normalizedConfig);
  await saveNativeConfig(normalizedConfig);
  await onSaved();
}

/**
 * @brief trim（去空白）六个 bootstrap config（启动配置）字段。
 * @author PopoY
 * @param config 表单中的原始配置。
 * @returns 适合保存到 native QSettings（原生 Qt 配置存储）的配置。
 */
function normalizeBootstrapConfigPanelValues(
  config: NativeBootstrapConfig,
): NativeBootstrapConfig {
  return {
    stationAccountId: config.stationAccountId.trim(),
    granteeHostId: config.granteeHostId.trim(),
    stationId: config.stationId.trim(),
    erpBaseUrl: config.erpBaseUrl.trim(),
    driverBaseUrl: config.driverBaseUrl.trim(),
    configVersion: config.configVersion.trim(),
  };
}

/**
 * @brief 校验 dashboard config panel（仪表盘配置面板）必填字段和 URL（统一资源定位符）。
 * @author PopoY
 * @param config 已 trim（去空白）的 bootstrap config（启动配置）。
 */
function validateBootstrapConfigPanelValues(config: NativeBootstrapConfig): void {
  const missingFields = readMissingBootstrapConfigFields(config);

  if (missingFields.length > 0) {
    throw new Error(`请补齐必填字段：${formatMissingFieldText(missingFields)}。`);
  }

  if (!isValidUrl(config.erpBaseUrl)) {
    throw new Error("ERP 服务地址格式不正确。");
  }

  if (!isValidUrl(config.driverBaseUrl)) {
    throw new Error("驱动服务地址格式不正确。");
  }
}

/**
 * @brief 创建 Ant Design Form（表单）必填 rule（规则）。
 * @author PopoY
 * @param label 中文字段名。
 * @returns Ant Design Form.Item rule（表单项规则）。
 */
function createRequiredRule(label: string) {
  return {
    required: true,
    transform: (value: string | undefined) => value?.trim(),
    message: `请输入${label}。`,
  };
}

/**
 * @brief 创建 URL（统一资源定位符）格式 validator（校验器）。
 * @author PopoY
 * @param label 中文字段名。
 * @returns Ant Design Form.Item rule（表单项规则）。
 */
function createUrlRule(label: string) {
  return {
    validator: (_: unknown, value: string | undefined) => {
      const trimmedValue = String(value ?? "").trim();

      if (trimmedValue.length === 0 || isValidUrl(trimmedValue)) {
        return Promise.resolve();
      }

      return Promise.reject(new Error(`${label}格式不正确。`));
    },
  };
}

/**
 * @brief 使用 native URL constructor（原生 URL 构造器）做基础 URL（统一资源定位符）校验。
 * @author PopoY
 * @param value 待校验的地址字符串。
 * @returns 可被 URL constructor（URL 构造器）解析时返回 true。
 */
function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @brief 将缺失字段 key（键）格式化为中文字段名。
 * @author PopoY
 * @param missingFields 缺失的 bootstrap config（启动配置）字段。
 * @returns Alert（警告）使用的中文摘要。
 */
function formatMissingFieldText(
  missingFields: readonly RequiredBootstrapConfigField[],
): string {
  return missingFields.map((fieldName) => fieldLabels[fieldName]).join("、");
}

/**
 * @brief 将 ERP approval state（ERP 审批状态）转换为现场可读中文文案。
 * @author PopoY
 * @param state ERP config key（ERP 配置键）读取后的审批状态。
 * @returns 面板只读提示文案。
 */
export function formatApprovalStateText(state: BootstrapConfigApprovalState): string {
  if (state === "editable") {
    return "配置修改已授权";
  }

  return "配置修改未授权或开关不可用";
}

/**
 * @brief 保存失败时只展示中文摘要，避免泄露 raw exception（原始异常）。
 * @author PopoY
 * @param error 捕获到的未知保存失败。
 * @returns 中文错误摘要。
 */
function readChineseSaveErrorMessage(error: unknown): string {
  if (error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)) {
    return error.message;
  }

  return "启动配置保存失败，请稍后重试。";
}

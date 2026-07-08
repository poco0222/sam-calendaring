/**
 * @file FirstRunConfigPage.tsx - 渲染 QT App（Qt 应用）首次启动配置页。
 * @author PopoY
 * @created 2026-07-08
 * @brief 在 bootstrap config（启动配置）缺失时阻塞 App shell（应用外壳）并保存本机配置。
 */

import { Alert, Button, Card, Col, Form, Input, Row, Typography } from "antd";
import { useEffect, useState } from "react";

import type { RequiredBootstrapConfigField } from "../services/bootstrapFlow";
import { readMissingBootstrapConfigFields } from "../services/bootstrapFlow";
import {
  readDefaultHostAddress as readNativeDefaultHostAddress,
  saveNativeConfig as saveNativeBootstrapConfig,
} from "../services/nativeBridge";
import type { NativeBootstrapConfig } from "../types/native";
import "./FirstRunConfigPage.css";

// @author PopoY: 字段 label（标签）统一供 Form（表单）和 Alert（警告）复用，避免文案漂移。
const fieldLabels: Record<RequiredBootstrapConfigField, string> = {
  stationAccountId: "工位账号 ID",
  granteeHostId: "授权主机 ID",
  stationId: "工位/设备 ID",
  erpBaseUrl: "ERP 服务地址",
  driverBaseUrl: "驱动服务地址",
  configVersion: "配置版本",
};

/**
 * @brief 描述首次启动配置页依赖的 native bridge（原生桥）和保存回调。
 * @author PopoY
 */
export type FirstRunConfigPageProps = {
  initialConfig: NativeBootstrapConfig;
  missingFields?: readonly RequiredBootstrapConfigField[];
  onSaved: () => Promise<void> | void;
  readDefaultHostAddress?: () => Promise<string>;
  saveNativeConfig?: (config: NativeBootstrapConfig) => Promise<void>;
};

/**
 * @brief 渲染首次启动阻塞配置页。
 * @author PopoY
 * @param props 页面初始配置、缺失字段和注入式 native bridge（原生桥）操作。
 * @returns React element（React 元素）。
 */
export function FirstRunConfigPage({
  initialConfig,
  missingFields = [],
  onSaved,
  readDefaultHostAddress = readNativeDefaultHostAddress,
  saveNativeConfig = saveNativeBootstrapConfig,
}: FirstRunConfigPageProps) {
  const [form] = Form.useForm<NativeBootstrapConfig>();
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void readDefaultHostAddress()
      .then((hostAddress) => {
        const trimmedHostAddress = hostAddress.trim();
        const currentHostId = String(form.getFieldValue("granteeHostId") ?? "");

        if (!cancelled && currentHostId.trim().length === 0 && trimmedHostAddress) {
          form.setFieldsValue({ granteeHostId: trimmedHostAddress });
        }
      })
      .catch(() => {
        // @author PopoY: 默认 IPv4 address（IPv4 地址）只是预填便利项，读取失败不阻塞人工填写。
      });

    return () => {
      cancelled = true;
    };
  }, [form, readDefaultHostAddress]);

  /**
   * @brief 提交表单后保存 native config（原生配置）并触发 bootstrap retry（启动重试）。
   * @author PopoY
   * @param values Ant Design Form（表单）收集的六个 bootstrap config（启动配置）字段。
   */
  async function handleSubmit(values: NativeBootstrapConfig): Promise<void> {
    setSaving(true);
    setSaveError("");

    try {
      await saveFirstRunBootstrapConfig(values, saveNativeConfig, onSaved);
    } catch (error) {
      setSaveError(readChineseSaveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const missingFieldText = formatMissingFieldText(missingFields);

  return (
    <main className="first-run-config-page">
      <Card className="first-run-config-page__panel" title="首次启动配置">
        <Typography.Paragraph className="first-run-config-page__intro">
          当前工控机缺少启动配置，请补齐后保存并启动。
        </Typography.Paragraph>
        {missingFieldText ? (
          <Alert
            className="first-run-config-page__alert"
            showIcon
            title={`缺失字段：${missingFieldText}`}
            type="warning"
          />
        ) : null}
        {saveError ? (
          <Alert
            className="first-run-config-page__alert"
            showIcon
            title={saveError}
            type="error"
          />
        ) : null}
        <Form<NativeBootstrapConfig>
          form={form}
          initialValues={createFirstRunInitialValues(initialConfig, "")}
          layout="vertical"
          onFinish={(values) => {
            void handleSubmit(values);
          }}
        >
          <Row gutter={12}>
            <Col span={24} md={12}>
              <Form.Item
                label={fieldLabels.stationAccountId}
                name="stationAccountId"
                rules={[createRequiredRule(fieldLabels.stationAccountId)]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            </Col>
            <Col span={24} md={12}>
              <Form.Item
                label={fieldLabels.granteeHostId}
                name="granteeHostId"
                rules={[createRequiredRule(fieldLabels.granteeHostId)]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            </Col>
            <Col span={24} md={12}>
              <Form.Item
                label={fieldLabels.stationId}
                name="stationId"
                rules={[createRequiredRule(fieldLabels.stationId)]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            </Col>
            <Col span={24} md={12}>
              <Form.Item
                label={fieldLabels.configVersion}
                name="configVersion"
                rules={[createRequiredRule(fieldLabels.configVersion)]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            </Col>
            <Col span={24} md={12}>
              <Form.Item
                label={fieldLabels.erpBaseUrl}
                name="erpBaseUrl"
                rules={[
                  createRequiredRule(fieldLabels.erpBaseUrl),
                  createUrlRule(fieldLabels.erpBaseUrl),
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            </Col>
            <Col span={24} md={12}>
              <Form.Item
                label={fieldLabels.driverBaseUrl}
                name="driverBaseUrl"
                rules={[
                  createRequiredRule(fieldLabels.driverBaseUrl),
                  createUrlRule(fieldLabels.driverBaseUrl),
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            </Col>
          </Row>
          <Button htmlType="submit" loading={saving} type="primary">
            保存并启动
          </Button>
        </Form>
      </Card>
    </main>
  );
}

/**
 * @brief 合并 QSettings（Qt 配置存储）现有配置和默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @param config 当前 native config（原生配置）。
 * @param defaultHostAddress native layer（原生层）读取的默认主机地址。
 * @returns 首次启动表单 initial values（初始值）。
 */
export function createFirstRunInitialValues(
  config: NativeBootstrapConfig,
  defaultHostAddress: string,
): NativeBootstrapConfig {
  return {
    ...config,
    granteeHostId:
      config.granteeHostId.trim().length > 0
        ? config.granteeHostId
        : defaultHostAddress.trim(),
  };
}

/**
 * @brief 保存首次启动配置，并在成功后触发 bootstrap retry（启动重试）。
 * @author PopoY
 * @param config 表单中的 bootstrap config（启动配置）。
 * @param saveNativeConfig 写入 QSettings（Qt 配置存储）的 native bridge（原生桥）函数。
 * @param onSaved 保存成功后的 retry（重试）回调。
 */
export async function saveFirstRunBootstrapConfig(
  config: NativeBootstrapConfig,
  saveNativeConfig: (config: NativeBootstrapConfig) => Promise<void>,
  onSaved: () => Promise<void> | void,
): Promise<void> {
  const normalizedConfig = normalizeFirstRunConfigForSave(config);

  validateFirstRunConfig(normalizedConfig);
  await saveNativeConfig(normalizedConfig);
  await onSaved();
}

/**
 * @brief trim（去空白）全部六个 bootstrap config（启动配置）字段。
 * @author PopoY
 * @param config 表单中的原始配置。
 * @returns 适合保存到 native QSettings（原生 Qt 配置存储）的配置。
 */
export function normalizeFirstRunConfigForSave(
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
 * @brief 校验首次启动配置的必填项和 URL（统一资源定位符）格式。
 * @author PopoY
 * @param config 已 trim（去空白）的 bootstrap config（启动配置）。
 */
function validateFirstRunConfig(config: NativeBootstrapConfig): void {
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
 * @brief 创建 Ant Design Form（表单）必填规则。
 * @author PopoY
 * @param label 中文字段名。
 * @returns Ant Design rule（规则）对象。
 */
function createRequiredRule(label: string) {
  return {
    required: true,
    transform: (value: string | undefined) => value?.trim(),
    message: `请输入${label}。`,
  };
}

/**
 * @brief 创建 URL（统一资源定位符）格式校验规则。
 * @author PopoY
 * @param label 中文字段名。
 * @returns Ant Design validator（校验器）规则。
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
 * @brief 使用 native URL constructor（原生 URL 构造器）做基础地址校验。
 * @author PopoY
 * @param value 待校验的 URL（统一资源定位符）字符串。
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
 * @returns 用于 Alert（警告）展示的中文摘要。
 */
function formatMissingFieldText(
  missingFields: readonly RequiredBootstrapConfigField[],
): string {
  return missingFields.map((fieldName) => fieldLabels[fieldName]).join("、");
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

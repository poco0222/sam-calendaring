/**
 * @file BootstrapConfigPanel.test.tsx - 验证 BootstrapConfigPanel（启动配置面板）。
 * @author PopoY
 * @created 2026-07-08
 * @brief 验证 dashboard config panel（仪表盘配置面板）的只读、编辑和保存行为。
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import type { NativeBootstrapConfig } from "../types/native";
import {
  BootstrapConfigPanel,
  saveBootstrapConfigPanelValues,
} from "./BootstrapConfigPanel";

const sampleConfig: NativeBootstrapConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "press-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5096",
  configVersion: "v1",
};

/**
 * @brief 渲染 BootstrapConfigPanel（启动配置面板）为 static HTML（静态 HTML）。
 * @author PopoY
 * @param panel 被测试的面板元素。
 * @returns server-rendered HTML（服务端渲染 HTML）字符串。
 */
function renderPanel(panel: ReactElement): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      {panel}
    </AntdRootProvider>,
  );
}

describe("BootstrapConfigPanel", () => {
  /**
   * @brief 未获得 ERP approval（ERP 审批）时渲染只读字段，header action（标题操作区）由外层 Card（卡片）承载。
   * @author PopoY
   */
  it("renders readonly fields without taking form space for header actions", () => {
    const html = renderPanel(
      <BootstrapConfigPanel
        config={sampleConfig}
        bootstrapConfigEditable={false}
        bootstrapConfigApprovalState="readonly"
        onSaved={vi.fn()}
      />,
    );

    expect(html).toContain("工位账号 ID");
    expect(html).toContain("授权主机 ID");
    expect(html).toContain("工位/设备 ID");
    expect(html).toContain("ERP 服务地址");
    expect(html).toContain("驱动服务地址");
    expect(html).toContain("配置版本");
    expect(html).not.toContain("配置修改未授权或开关不可用");
    expect(html).not.toContain("保存配置");
    expect(html).not.toContain("sessionToken");
    expect(html).not.toContain("signedLease");
    expect(html).not.toContain("signature");
    expect(html).not.toContain("signalConfig");
  });

  /**
   * @brief 获得 ERP approval（ERP 审批）后保存 trim（去空白）的六字段配置并触发 retry（重试）。
   * @author PopoY
   */
  it("saves trimmed fields when approval is true", async () => {
    const saveNativeConfig = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn().mockResolvedValue(undefined);

    await saveBootstrapConfigPanelValues(
      { ...sampleConfig, stationAccountId: " station-a " },
      saveNativeConfig,
      onSaved,
    );

    expect(saveNativeConfig).toHaveBeenCalledWith(sampleConfig);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});

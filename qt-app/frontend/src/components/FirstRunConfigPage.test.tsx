/**
 * @file FirstRunConfigPage.test.tsx - 验证首次启动阻塞配置页。
 * @author PopoY
 * @created 2026-07-08
 * @brief 验证缺失配置展示、trim（去空白）保存和 retry（重试）触发。
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import type { NativeBootstrapConfig } from "../types/native";
import {
  createFirstRunInitialValues,
  FirstRunConfigPage,
  saveFirstRunBootstrapConfig,
} from "./FirstRunConfigPage";

const initialConfig: NativeBootstrapConfig = {
  stationAccountId: "",
  granteeHostId: "",
  stationId: " press-01 ",
  erpBaseUrl: " http://127.0.0.1:8080 ",
  driverBaseUrl: " http://127.0.0.1:5096 ",
  configVersion: " v1 ",
};

/**
 * @brief 渲染 FirstRunConfigPage（首次启动配置页）为 static HTML（静态 HTML）。
 * @author PopoY
 * @returns 用于断言中文字段的 HTML（超文本标记语言）。
 */
function renderFirstRunPage(): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      <FirstRunConfigPage
        initialConfig={initialConfig}
        missingFields={["stationAccountId", "granteeHostId"]}
        onSaved={async () => {}}
        readDefaultHostAddress={async () => "192.168.19.100"}
        saveNativeConfig={async () => {}}
      />
    </AntdRootProvider>,
  );
}

describe("FirstRunConfigPage", () => {
  /**
   * @brief 验证首次启动页展示全部六个 bootstrap config（启动配置）字段。
   * @author PopoY
   */
  it("renders all six bootstrap config fields", () => {
    const html = renderFirstRunPage();

    expect(html).toContain("首次启动配置");
    expect(html).toContain("工位账号 ID");
    expect(html).toContain("授权主机 ID");
    expect(html).toContain("工位/设备 ID");
    expect(html).toContain("ERP 服务地址");
    expect(html).toContain("驱动服务地址");
    expect(html).toContain("配置版本");
    expect(html).toContain("保存并启动");
  });

  /**
   * @brief 验证保存时裁剪全部字段，并在 native save（原生保存）成功后触发 bootstrap retry（启动重试）。
   * @author PopoY
   */
  it("saves trimmed config and retries bootstrap", async () => {
    const saveNativeConfig = vi.fn().mockResolvedValue(undefined);
    const retry = vi.fn().mockResolvedValue(undefined);

    await saveFirstRunBootstrapConfig(
      {
        ...initialConfig,
        stationAccountId: " station-a ",
        granteeHostId: " 192.168.19.100 ",
      },
      saveNativeConfig,
      retry,
    );

    expect(saveNativeConfig).toHaveBeenCalledWith({
      stationAccountId: "station-a",
      granteeHostId: "192.168.19.100",
      stationId: "press-01",
      erpBaseUrl: "http://127.0.0.1:8080",
      driverBaseUrl: "http://127.0.0.1:5096",
      configVersion: "v1",
    });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief 验证授权主机 ID 为空时才使用 default IPv4 address（默认 IPv4 地址）。
   * @author PopoY
   */
  it("uses default host address only when grantee host id is blank", () => {
    expect(createFirstRunInitialValues(initialConfig, "192.168.19.100")).toMatchObject({
      granteeHostId: "192.168.19.100",
    });
    expect(
      createFirstRunInitialValues(
        { ...initialConfig, granteeHostId: " host-from-settings " },
        "192.168.19.100",
      ),
    ).toMatchObject({
      granteeHostId: " host-from-settings ",
    });
  });
});

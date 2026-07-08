/**
 * @file acceptanceChecklist.test.ts - 验证 Qt App（Qt 应用）验收清单。
 * @author PopoY
 * @created 2026-06-25
 * @brief 锁定 Task7（任务七）bootstrap verification（启动引导验证）验收清单。
 */

import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import {
  BootstrapDashboard,
  type BootstrapDashboardProps,
} from "../components/BootstrapDashboard";
import { buildApplyLeaseRequest } from "../services/driverClient";
import type { BootstrapSession } from "../services/erpClient";
import { loadBootstrapSession } from "../services/erpClient";
import { runBootstrapFlow } from "../services/bootstrapFlow";
import type { NativeBootstrapConfig } from "../types/native";

const sampleConfig: NativeBootstrapConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "station-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5000",
  configVersion: "v1",
};

const sampleBootstrapSession: BootstrapSession = {
  bootstrapConfigEditable: false,
  bootstrapConfigApprovalState: "readonly",
  sessionToken: "erp-session-token",
  stationContext: {
    stationAccountId: "station-a",
    stationId: "station-01",
  },
  defaultDeviceScope: {
    deviceIds: ["device-01"],
  },
  businessContext: {
    shiftCode: "A",
  },
  signalConfig: {
    signals: [
      {
        address: 100,
        name: "mesCommunication",
      },
    ],
  },
  signedLease: {
    leaseId: "lease-01",
    targetDeviceId: "device-01",
    expiresAt: "2026-06-25T16:00:00Z",
    fencingToken: "fence-01",
    signature: "signed-payload",
    targetEndpoint: {
      ip: "10.10.10.10",
      port: 502,
    },
  },
};

/**
 * @brief 构建 checklist assertions（验收断言）使用的 static dashboard HTML（静态仪表盘 HTML）快照。
 * @author PopoY
 * @returns bootstrap dashboard（启动仪表盘）的 server-rendered HTML（服务端渲染 HTML）字符串。
 */
function renderDashboard(): string {
  const dashboardProps: BootstrapDashboardProps = {
    bootstrapSession: {
      status: "success",
      config: sampleConfig,
      data: sampleBootstrapSession,
      error: null,
      retry: async () => {},
    },
    driverSession: {
      status: "success",
      data: {
        applyResult: {
          correlationId: "corr-apply-01",
          resultCode: "OK",
          leaseState: "Active",
          deviceSessionState: "Connected",
          leaseId: "lease-01",
          targetDeviceId: "device-01",
          fencingToken: "fence-01",
        },
        signalSnapshot: {
          correlationId: "corr-snapshot-01",
          resultCode: "OK",
          signalValues: {
            machineState: "Ready",
            mesCommunication: true,
          },
        },
      },
      error: null,
      retry: async () => {},
      refreshSnapshot: async () => {},
      applySignalSnapshotEvent: () => {},
    },
  };
  const DashboardComponent = BootstrapDashboard as ComponentType<BootstrapDashboardProps>;

  return renderToStaticMarkup(
    createElement(
      AntdRootProvider,
      {},
      createElement(DashboardComponent, dashboardProps),
    ),
  );
}

describe("Task7 acceptance checklist", () => {
  /**
   * @brief 断言 bootstrap dashboard（启动仪表盘）不会回退到 password login page（密码登录页）。
   * @author PopoY
   */
  it("does not render a password login page", () => {
    const html = renderDashboard();

    expect(html).not.toContain("type=\"password\"");
    expect(html).not.toContain("Password Login");
    expect(html).not.toContain("密码登录");
  });

  /**
   * @brief 断言缺失 native config（原生配置）会在 ERP requests（ERP 请求）开始前阻断组合流程。
   * @author PopoY
   * @returns ConfigInvalid state（配置无效状态）断言完成后 resolved（完成）的 Promise（承诺）。
   */
  it("stops the flow when required config is missing", async () => {
    const loadBootstrapSessionSpy = vi.fn();

    const result = await runBootstrapFlow({
      readNativeConfig: vi.fn().mockResolvedValue({
        ...sampleConfig,
        stationAccountId: "",
      }),
      loadBootstrapSession: loadBootstrapSessionSpy,
      applyLeaseAndConfig: vi.fn(),
      getSignalSnapshot: vi.fn(),
    });

    expect(result.state).toBe("ConfigInvalid");
    expect(loadBootstrapSessionSpy).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言 ERP login failure（ERP 登录失败）会 short-circuit（短路）lease request（租约请求）。
   * @author PopoY
   * @returns 单次 ERP call（ERP 调用）断言完成后 resolved（完成）的 Promise（承诺）。
   */
  it("stops the lease fetch after login failure", async () => {
    const postJson = vi.fn().mockRejectedValueOnce(new Error("401"));

    await expect(loadBootstrapSession(postJson, sampleConfig)).rejects.toMatchObject({
      code: "ERP_AUTO_LOGIN_FAILED",
    });

    expect(postJson).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief 断言 composed flow（组合流程）不会暴露 ERP deviceConnectionInfo（设备连接信息）字段。
   * @author PopoY
   * @returns narrowed bootstrap session shape（收窄后的启动会话结构）断言完成后 resolved（完成）的 Promise（承诺）。
   */
  it("ignores ERP deviceConnectionInfo fields", async () => {
    const postJson = vi
      .fn()
      .mockResolvedValueOnce({
        sessionToken: "erp-session-token",
        stationContext: {
          stationAccountId: "station-a",
          stationId: "station-01",
        },
        defaultDeviceScope: {
          deviceIds: ["device-01"],
        },
        businessContext: {
          shiftCode: "A",
        },
        deviceConnectionInfo: {
          host: "forbidden-host",
          password: "secret",
        },
      })
      .mockResolvedValueOnce({
        signalConfig: {
          signals: [
            {
              address: 100,
              name: "mesCommunication",
            },
          ],
        },
        signedLease: {
          leaseId: "lease-01",
          signature: "signed-payload",
        },
        deviceConnectionInfo: {
          host: "forbidden-host",
          password: "secret",
        },
      });

    const session = await loadBootstrapSession(postJson, sampleConfig);

    expect(session).not.toHaveProperty("deviceConnectionInfo");
    expect(session).toEqual({
      sessionToken: "erp-session-token",
      stationContext: {
        stationAccountId: "station-a",
        stationId: "station-01",
      },
      defaultDeviceScope: {
        deviceIds: ["device-01"],
      },
      businessContext: {
        shiftCode: "A",
      },
      bootstrapConfigEditable: false,
      bootstrapConfigApprovalState: "unavailable",
      parameterGroupOptions: [],
      pressMoldWorkTypeOptions: [],
      signalConfig: {
        signals: [
          {
            address: 100,
            name: "mesCommunication",
          },
        ],
      },
      signedLease: {
        leaseId: "lease-01",
        signature: "signed-payload",
      },
    });
  });

  /**
   * @brief 断言 invalid lease（无效租约）会在 snapshot retrieval（快照获取）开始前停止组合流程。
   * @author PopoY
   * @returns DriverRejected state（驱动拒绝状态）和 snapshot short-circuit（快照短路）断言完成后的 Promise（承诺）。
   */
  it("stops before snapshot when the driver rejects the lease", async () => {
    const getSignalSnapshotSpy = vi.fn();

    const result = await runBootstrapFlow({
      readNativeConfig: vi.fn().mockResolvedValue(sampleConfig),
      loadBootstrapSession: vi.fn().mockResolvedValue(sampleBootstrapSession),
      applyLeaseAndConfig: vi.fn().mockResolvedValue({
        correlationId: "corr-apply-01",
        resultCode: "LEASE_INVALID",
        leaseState: "Rejected",
        deviceSessionState: "Disconnected",
        leaseId: "lease-01",
        targetDeviceId: "device-01",
        fencingToken: "fence-01",
      }),
      getSignalSnapshot: getSignalSnapshotSpy,
    });

    expect(result.state).toBe("DriverRejected");
    expect(getSignalSnapshotSpy).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言 successful bootstrap（启动成功）会在 dashboard（仪表盘）渲染首个 signal snapshot（信号快照）。
   * @author PopoY
   */
  it("renders the first signal snapshot after a successful bootstrap", () => {
    const html = renderDashboard();

    expect(html).toContain("信号快照");
    expect(html).toContain("mesCommunication");
    expect(html).toContain("Ready");
  });

  /**
   * @brief 断言 driver apply requests（驱动应用请求）不会暴露 raw endpoint override fields（原始端点覆盖字段）。
   * @author PopoY
   */
  it("does not allow raw ip, port, or deviceId overrides", () => {
    const request = buildApplyLeaseRequest({
      correlationId: "corr-apply-01",
      timeoutMs: 5000,
      signalConfig: sampleBootstrapSession.signalConfig,
      signedLease: sampleBootstrapSession.signedLease,
    });

    // PopoY: signedLease may contain device endpoint details, but bootstrap cannot elevate them into top-level overrides.
    expect(request).not.toHaveProperty("ip");
    expect(request).not.toHaveProperty("port");
    expect(request).not.toHaveProperty("deviceId");
  });
});

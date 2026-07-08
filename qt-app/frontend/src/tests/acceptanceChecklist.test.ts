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
 * @brief Build a static dashboard HTML snapshot for checklist assertions.
 * @returns Server-rendered HTML string for the bootstrap dashboard.
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
   * @brief Assert that the bootstrap dashboard does not fall back to a password login page.
   */
  it("does not render a password login page", () => {
    const html = renderDashboard();

    expect(html).not.toContain("type=\"password\"");
    expect(html).not.toContain("Password Login");
    expect(html).not.toContain("密码登录");
  });

  /**
   * @brief Assert that missing native config blocks the composed flow before ERP requests start.
   * @returns Promise resolved when the ConfigInvalid state is asserted.
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
   * @brief Assert that an ERP login failure short-circuits the lease request.
   * @returns Promise resolved when the single-call ERP assertion completes.
   */
  it("stops the lease fetch after login failure", async () => {
    const postJson = vi.fn().mockRejectedValueOnce(new Error("401"));

    await expect(loadBootstrapSession(postJson, sampleConfig)).rejects.toMatchObject({
      code: "ERP_AUTO_LOGIN_FAILED",
    });

    expect(postJson).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief Assert that the composed flow never exposes ERP deviceConnectionInfo fields.
   * @returns Promise resolved when the narrowed bootstrap session shape is asserted.
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
   * @brief Assert that an invalid lease stops the composed flow before snapshot retrieval starts.
   * @returns Promise resolved when the DriverRejected state and snapshot short-circuit are asserted.
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
   * @brief Assert that a successful bootstrap renders the first signal snapshot in the dashboard.
   */
  it("renders the first signal snapshot after a successful bootstrap", () => {
    const html = renderDashboard();

    expect(html).toContain("信号快照");
    expect(html).toContain("mesCommunication");
    expect(html).toContain("Ready");
  });

  /**
   * @brief Assert that driver apply requests never expose raw endpoint override fields.
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

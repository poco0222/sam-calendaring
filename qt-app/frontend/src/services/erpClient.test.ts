/**
 * @file erpClient.test.ts - 验证 ERP client（企业资源计划客户端）。
 * @author PopoY
 * @created 2026-06-25
 * @editor PopoY
 * @edited 2026-07-28 17:34:47
 * @brief 验证 ERP client（企业资源计划客户端）自动登录和租约流程。
 */

import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { PressJobOperationCode } from "../domain/pressJob";
import type { NativeBootstrapConfig } from "../types/native";
import {
  autoLogin,
  completePressJob,
  fetchBootstrapConfigApproval,
  fetchLeasePackage,
  fetchParameterGroupOptions,
  fetchPressMoldWorkTypeOptions,
  fetchPressMoldCandidates,
  fetchPressMoldInfoRows,
  fetchPressJobCurrentJobs,
  fetchPressJobHistory,
  fetchPressJobHistoryDetail,
  fetchPressJobLookupData,
  fetchPressJobTeamOptions,
  fetchPressLockedMolds,
  getJson,
  lockPressMold,
  loadBootstrapSession,
  recordPressJobOperation,
  recordPressJobParameters,
  startPressJob,
  updatePressJobExpectedDuration,
  updatePressMachineStatus,
  unlockPressMolds,
  postJson,
} from "./erpClient";

const sampleConfig: NativeBootstrapConfig = {
  stationAccountId: "station-a",
  granteeHostId: "host-a",
  stationId: "station-01",
  erpBaseUrl: "http://127.0.0.1:8080",
  driverBaseUrl: "http://127.0.0.1:5000",
  configVersion: "v1",
};

const qtPressJobOperationCodes = [
  "CONNECT",
  "MOVE_IN",
  "MOVE_OUT",
  "START",
  "PARAMETER_START",
  "PARAMETER_END",
  "LINE_IN",
  "LINE_OUT",
  "COMPLETE",
] as const;

/**
 * @brief Reset all mocks between test cases so call assertions stay isolated.
 * @author PopoY
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * @brief 创建最小 fetch response（响应）对象，用于验证原生 JSON helper（辅助函数）请求头。
 * @author PopoY
 * @param payload JSON payload（载荷）returned by mocked fetch.
 * @returns Fetch-compatible response（响应）stub.
 */
function createFetchResponse(payload: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

/**
 * @brief Create a minimal ERP login success payload for downstream lease requests.
 * @returns Minimal login response shape required by the planned service contract.
 */
function createLoginResponse() {
  return {
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
  };
}

/**
 * @brief Create an ERP login payload that illegally includes device connection data.
 * @returns Login response payload used to verify bootstrap session narrowing.
 */
function createLoginResponseWithDeviceConnectionInfo() {
  return {
    ...createLoginResponse(),
    deviceConnectionInfo: {
      host: "should-not-leak-from-login",
      password: "secret",
      port: 9527,
      username: "device-user",
    },
  };
}

/**
 * @brief Create a minimal ERP lease payload that also includes the forbidden deviceConnectionInfo field.
 * @returns Lease response payload used to assert that device connection details are ignored.
 */
function createLeaseResponse() {
  return {
    signalConfig: {
      baseUrl: "http://127.0.0.1:9000",
      topic: "stations/station-01",
    },
    signedLease: {
      leaseId: "lease-01",
      signature: "signed-payload",
    },
    deviceConnectionInfo: {
      host: "should-not-leak",
      password: "secret",
      port: 9527,
      username: "device-user",
    },
  };
}

/**
 * @brief Create the stringified lease payload shape commonly returned by backend signing code.
 * @returns Lease response where signedLease and signalConfig are JSON strings.
 */
function createStringifiedLeaseResponse() {
  return {
    signalConfig: JSON.stringify({
      signals: [
        {
          address: 100,
          name: "pressure",
        },
      ],
    }),
    signedLease: JSON.stringify({
      alg: "RS256",
      kid: "lease-key-01",
      payloadJson: JSON.stringify({
        leaseId: "lease-01",
        targetDeviceId: "device-01",
        expiresAt: "2026-06-25T16:00:00Z",
        fencingToken: 10,
      }),
      signature: "signed-payload",
    }),
  };
}

/**
 * @brief Create the ERP placeholder lease payload currently rejected by Driver Real Mode.
 * @returns Lease response where ERP still returns the bootstrap placeholder package.
 */
function createBootstrapPlaceholderLeaseResponse() {
  return {
    signalConfig: {
      granteeHostId: "host-a",
      mode: "bootstrap-minimal",
      signalConfigHash: "legacy-hash",
      stationId: "station-01",
      targetDeviceId: "device-01",
    },
    signedLease: {
      granteeHostId: "host-a",
      leaseId: "bootstrap-lease-01",
      signature: "UNSIGNED_BOOTSTRAP_PLACEHOLDER",
      targetDeviceId: "device-01",
      targetEndpoint: "driver://pending",
    },
  };
}

describe("erpClient", () => {
  /**
   * @brief `approve.press.config=false` 表示关闭审批开关，启动配置允许编辑。
   * @author PopoY
   */
  it("allows bootstrap config editing when approve.press.config is false", async () => {
    const getJson = vi.fn().mockResolvedValue({ code: 200, data: " false " });

    await expect(
      fetchBootstrapConfigApproval(getJson, {
        erpBaseUrl: "http://127.0.0.1:8080",
        sessionToken: "session-token",
      }),
    ).resolves.toEqual({
      bootstrapConfigEditable: true,
      bootstrapConfigApprovalState: "editable",
    });

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/system/config/configKey/approve.press.config",
      "session-token",
    );
  });

  /**
   * @brief 兼容 RuoYi AjaxResult（若依统一响应）把 String 配置值放在 msg（消息）字段的返回格式。
   * @author PopoY
   */
  it("allows bootstrap config editing when approve.press.config false is returned in msg", async () => {
    const getJson = vi.fn().mockResolvedValue({ code: 200, msg: " false " });

    await expect(
      fetchBootstrapConfigApproval(getJson, {
        erpBaseUrl: "http://127.0.0.1:8080",
        sessionToken: "session-token",
      }),
    ).resolves.toEqual({
      bootstrapConfigEditable: true,
      bootstrapConfigApprovalState: "editable",
    });
  });

  /**
   * @brief 缺失、非 false 或读取失败都按 readonly（只读）处理。
   * @author PopoY
   */
  it.each([
    [{ code: 200 }, "readonly"],
    [{ code: 200, data: "" }, "readonly"],
    [{ code: 200, data: "true" }, "readonly"],
    [{ code: 200, msg: "true" }, "readonly"],
    [{ code: 200, data: "FALSE" }, "readonly"],
    [{ code: 200, data: "1" }, "readonly"],
  ])("treats non-false values as readonly", async (response, state) => {
    const getJson = vi.fn().mockResolvedValue(response);

    await expect(
      fetchBootstrapConfigApproval(getJson, {
        erpBaseUrl: "http://127.0.0.1:8080",
        sessionToken: "session-token",
      }),
    ).resolves.toEqual({
      bootstrapConfigEditable: false,
      bootstrapConfigApprovalState: state,
    });
  });

  /**
   * @brief 断言 press working（压机作业）Qt clients（客户端）发送认证头、关联头并收窄请求体。
   * @author PopoY
   */
  it("submits press working Qt requests with auth headers and whitelisted bodies", async () => {
    const postJson = vi
      .fn()
      .mockResolvedValueOnce({
        code: 200,
        data: {
          correlationId: "press-start-01",
          localJobSessionId: "press-job-row-01",
          resultCode: "OK",
          deviceId: "drop-device",
        },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: {
          correlationId: "press-param-01",
          localJobSessionId: "press-job-row-01",
          resultCode: "OK",
          registerAddress: 100,
        },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: {
          correlationId: "press-complete-01",
          localJobSessionId: "press-job-row-01",
          resultCode: "OK",
          ip: "drop-ip",
        },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: {
          correlationId: "press-line-in-01",
          localJobSessionId: "press-device-action-01",
          resultCode: "OK",
          status: "0",
          port: 502,
        },
      });

    await expect(
      startPressJob(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request: {
          correlationId: "press-start-01",
          idempotencyKey: "press-start-01",
          localJobSessionId: "press-job-row-01",
          operatorId: "zhangsan",
          teamId: "PLINE-01",
          processId: "CRAFT-001",
          expectedDuration: "1.5",
          deviceId: "drop-device",
          ip: "drop-ip",
        } as never,
      }),
    ).resolves.toEqual({
      correlationId: "press-start-01",
      localJobSessionId: "press-job-row-01",
      resultCode: "OK",
    });
    await expect(
      recordPressJobParameters(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request: {
          correlationId: "press-param-01",
          idempotencyKey: "press-param-01",
          parameterIdempotencyKey: "press-param-start-01",
          localJobSessionId: "press-job-row-01",
          type: "start",
          signalValues: {
            pressDownCount: 5,
          },
          registerAddress: 100,
          writeValue: true,
        } as never,
      }),
    ).resolves.toEqual({
      correlationId: "press-param-01",
      localJobSessionId: "press-job-row-01",
      resultCode: "OK",
    });
    await expect(
      completePressJob(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request: {
          correlationId: "press-complete-01",
          idempotencyKey: "press-complete-01",
          localJobSessionId: "press-job-row-01",
          operatorId: "zhangsan",
          signalConfig: "drop-config",
        } as never,
      }),
    ).resolves.toEqual({
      correlationId: "press-complete-01",
      localJobSessionId: "press-job-row-01",
      resultCode: "OK",
    });
    await expect(
      updatePressMachineStatus(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request: {
          correlationId: "press-line-in-01",
          idempotencyKey: "press-line-in-01",
          localJobSessionId: "press-device-action-01",
          status: "0",
          reason: "lineIn",
          deviceId: "drop-device",
          port: 502,
        } as never,
      }),
    ).resolves.toEqual({
      correlationId: "press-line-in-01",
      localJobSessionId: "press-device-action-01",
      resultCode: "OK",
      status: "0",
    });

    expect(postJson).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/api/qt/press-working/press-job-starts",
      {
        correlationId: "press-start-01",
        idempotencyKey: "press-start-01",
        localJobSessionId: "press-job-row-01",
        operatorId: "zhangsan",
        teamId: "PLINE-01",
        processId: "CRAFT-001",
        expectedDuration: "1.5",
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-start-01",
        },
      },
    );
    expect(postJson).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/api/qt/press-working/press-job-parameters",
      {
        correlationId: "press-param-01",
        idempotencyKey: "press-param-01",
        parameterIdempotencyKey: "press-param-start-01",
        localJobSessionId: "press-job-row-01",
        type: "start",
        signalValues: {
          pressDownCount: 5,
        },
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-param-01",
        },
      },
    );
    expect(postJson).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/api/qt/press-working/press-job-completions",
      {
        correlationId: "press-complete-01",
        idempotencyKey: "press-complete-01",
        localJobSessionId: "press-job-row-01",
        operatorId: "zhangsan",
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-complete-01",
        },
      },
    );
    expect(postJson).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/api/qt/press-working/machine-status",
      {
        correlationId: "press-line-in-01",
        idempotencyKey: "press-line-in-01",
        localJobSessionId: "press-device-action-01",
        status: "0",
        reason: "lineIn",
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-line-in-01",
        },
      },
    );
    expect(JSON.stringify(postJson.mock.calls)).not.toContain("drop-device");
    expect(JSON.stringify(postJson.mock.calls)).not.toContain("drop-ip");
    expect(JSON.stringify(postJson.mock.calls)).not.toContain("drop-config");
    expect(JSON.stringify(postJson.mock.calls)).not.toContain("registerAddress");
  });

  /**
   * @brief 断言 operation log（操作日志）请求严格使用六字段白名单、认证头和关联请求头。
   * @author PopoY
   */
  it("records a press job operation with exactly six whitelisted fields", async () => {
    const postJson = vi.fn().mockResolvedValue({ code: 200 });
    const request = {
      correlationId: "press-operation-01",
      localJobSessionId: "press-job-id-17",
      operationCode: "LINE_OUT" as const,
      result: false,
      teamId: "team-1",
      operatorId: "user-1",
      deviceId: "drop-device",
      ip: "drop-ip",
      port: 502,
      signalValues: { pressure: 135 },
      error: "drop-error",
      signature: "drop-signature",
      signedLease: "drop-lease",
      sessionToken: "drop-token",
    };

    await expect(
      recordPressJobOperation(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request,
      }),
    ).resolves.toBeUndefined();

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/operation-logs",
      {
        correlationId: "press-operation-01",
        localJobSessionId: "press-job-id-17",
        operationCode: "LINE_OUT",
        result: false,
        teamId: "team-1",
        operatorId: "user-1",
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-operation-01",
        },
      },
    );
    expect(Object.keys(postJson.mock.calls[0][1]).sort()).toEqual([
      "correlationId",
      "localJobSessionId",
      "operationCode",
      "operatorId",
      "result",
      "teamId",
    ]);
    expect(JSON.stringify(postJson.mock.calls[0][1])).not.toMatch(
      /deviceId|ip|port|signalValues|error|signature|signedLease|sessionToken/,
    );
  });

  /**
   * @brief 断言 QT operation code（操作码）精确为九类且不包含 ERP 模具动作。
   * @author PopoY
   */
  it("keeps the QT press job operation code contract at exactly nine actions", () => {
    expectTypeOf<PressJobOperationCode>().toEqualTypeOf<
      (typeof qtPressJobOperationCodes)[number]
    >();
    expect(qtPressJobOperationCodes).not.toContain("LOCK_MOLD");
    expect(qtPressJobOperationCodes).not.toContain("UNLOCK_MOLD");
  });

  /**
   * @brief 断言三类新增 Driver action（驱动动作）继续使用既有严格六字段日志请求。
   * @author PopoY
   */
  it.each(qtPressJobOperationCodes.slice(0, 3))(
    "sends CONNECT/MOVE_IN/MOVE_OUT through the strict six-field operation-log request: %s",
    async (operationCode) => {
      const postJson = vi.fn().mockResolvedValue({ code: 200 });
      const request = {
        correlationId: `press-operation-${operationCode}`,
        localJobSessionId: "press-job-id-17",
        operationCode,
        result: true,
        teamId: "team-1",
        operatorId: "user-1",
        deviceId: "drop-device",
        ip: "drop-ip",
        port: 502,
        connectionState: "drop-connection",
      };

      await recordPressJobOperation(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request,
      });

      expect(postJson).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/api/qt/press-working/operation-logs",
        {
          correlationId: `press-operation-${operationCode}`,
          localJobSessionId: "press-job-id-17",
          operationCode,
          result: true,
          teamId: "team-1",
          operatorId: "user-1",
        },
        {
          bearerToken: "erp-session-token",
          headers: {
            "X-Correlation-Id": `press-operation-${operationCode}`,
          },
        },
      );
      expect(Object.keys(postJson.mock.calls[0][1]).sort()).toEqual([
        "correlationId",
        "localJobSessionId",
        "operationCode",
        "operatorId",
        "result",
        "teamId",
      ]);
      expect(JSON.stringify(postJson.mock.calls[0][1])).not.toMatch(
        /deviceId|ip|port|connectionState/,
      );
    },
  );

  /**
   * @brief 断言 Driver metadata（驱动元数据）只向 ERP 投影标量 value（值）。
   * @author PopoY
   */
  it("projects driver signal metadata to scalar ERP parameter values", async () => {
    const postJson = vi.fn().mockResolvedValue({
      code: 200,
      data: {
        correlationId: "press-param-end-01",
        localJobSessionId: "press-job-row-01",
        resultCode: "OK",
      },
    });

    await recordPressJobParameters(postJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-session-token",
      request: {
        correlationId: "press-param-end-01",
        idempotencyKey: "press-param-end-01",
        parameterIdempotencyKey: "press-param-end-01",
        localJobSessionId: "press-job-row-01",
        type: "end",
        signalValues: {
          pressure: {
            value: 135,
            name: "压力",
            unit: "MPa",
            registerAddress: 100,
          },
          pressDownCount: 5,
          isPressed: true,
          mode: "auto",
          deviceId: "drop-device",
          signalConfig: "drop-config",
        },
      } as never,
    });

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/press-job-parameters",
      {
        correlationId: "press-param-end-01",
        idempotencyKey: "press-param-end-01",
        parameterIdempotencyKey: "press-param-end-01",
        localJobSessionId: "press-job-row-01",
        type: "end",
        signalValues: {
          pressure: 135,
          pressDownCount: 5,
          isPressed: true,
          mode: "auto",
        },
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-param-end-01",
        },
      },
    );
  });

  /**
   * @brief 断言不可安全序列化为 ERP scalar（标量）的信号值会在 HTTP 前失败。
   * @author PopoY
   */
  it.each([
    { label: "null", value: null },
    { label: "array", value: [] },
    { label: "metadata without value", value: { name: "压力" } },
    { label: "nested value", value: { value: { raw: 135 } } },
    { label: "undefined", value: undefined },
    { label: "non-finite number", value: Number.POSITIVE_INFINITY },
  ])("rejects invalid ERP signal values before HTTP: $label", async ({ value }) => {
    const postJson = vi.fn().mockResolvedValue({
      code: 200,
      data: {
        correlationId: "press-param-invalid-01",
        localJobSessionId: "press-job-row-01",
        resultCode: "OK",
      },
    });

    await expect(
      recordPressJobParameters(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request: {
          correlationId: "press-param-invalid-01",
          idempotencyKey: "press-param-invalid-01",
          parameterIdempotencyKey: "press-param-invalid-01",
          localJobSessionId: "press-job-row-01",
          type: "end",
          signalValues: { pressure: value },
        },
      }),
    ).rejects.toThrow("信号参数值必须是 String、有限 Number 或 Boolean。");
    expect(postJson).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言 mold candidate（模具候选）查询使用 Qt 专用 endpoint（端点）并丢弃敏感字段。
   * @author PopoY
   * @returns Promise resolved when candidate narrowing（候选收窄）is asserted.
   */
  it("fetches press mold candidates with correlation header and whitelisted fields", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: [
        {
          moldNo: "MOLD-01",
          makeOrderNumber: "MO-01",
          stages: "OP10",
          projectCode: "P123",
          name: "上模",
          defaultProcessId: "CRAFT-001",
          deviceId: "drop-device",
          operationIp: "drop-operation-ip",
          ipAddress: "drop-ip",
          port: 502,
          sessionToken: "drop-token",
          signedLease: "drop-lease",
          signature: "drop-signature",
          signalConfig: "drop-config",
        },
        {
          code: "MOLD-02",
          makeOrderNumber: "MO-02",
          projectCode: "P123",
          privateKey: "drop-key",
        },
      ],
    });

    await expect(
      fetchPressMoldCandidates(getJson, {
        correlationId: "press-mold-search-01",
        erpBaseUrl: sampleConfig.erpBaseUrl,
        lockedMoldNos: ["LOCKED-01", "LOCKED-02"],
        moldNo: " MOLD-01 ",
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([
      {
        moldNo: "MOLD-01",
        makeOrderNumber: "MO-01",
        stages: "OP10",
        projectCode: "P123",
        name: "上模",
        defaultProcessId: "CRAFT-001",
      },
      {
        moldNo: "MOLD-02",
        makeOrderNumber: "MO-02",
        projectCode: "P123",
      },
    ]);

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/mold-candidates?moldNo=MOLD-01&lockedMoldNos=LOCKED-01&lockedMoldNos=LOCKED-02",
      "erp-session-token",
      {
        headers: {
          "X-Correlation-Id": "press-mold-search-01",
        },
      },
    );
  });

  /**
   * @brief 断言空 moldNo（模具号）不会触发 ERP 查询。
   * @author PopoY
   * @returns Promise resolved when blank query（空查询）short-circuits.
   */
  it("skips press mold candidate lookup when mold number is blank", async () => {
    const getJson = vi.fn();

    await expect(
      fetchPressMoldCandidates(getJson, {
        correlationId: "press-mold-search-blank",
        erpBaseUrl: sampleConfig.erpBaseUrl,
        lockedMoldNos: [],
        moldNo: "   ",
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([]);

    expect(getJson).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言 mold info rows（模具明细行）查询独立使用 list endpoint（列表端点），不混入近似候选查询。
   * @author PopoY
   * @returns Promise resolved when detail rows（明细行）narrowing（收窄）is asserted.
   */
  it("fetches press mold info rows only from the detail endpoint", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: [
        {
          mouldCode: "MOLD-01",
          makeOrderNumber: "MO-01",
          stages: "OP10",
          projectCode: "P123",
          name: "上模",
          deviceId: "drop-device",
          operationIp: "drop-operation-ip",
        },
      ],
    });

    await expect(
      fetchPressMoldInfoRows(getJson, {
        correlationId: "press-mold-info-01",
        erpBaseUrl: sampleConfig.erpBaseUrl,
        lockedMoldNos: ["LOCKED-01"],
        moldNo: " MOLD-01 ",
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([
      {
        moldNo: "MOLD-01",
        makeOrderNumber: "MO-01",
        stages: "OP10",
        projectCode: "P123",
        name: "上模",
      },
    ]);

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/mold-info-rows?moldNo=MOLD-01&lockedMoldNos=LOCKED-01",
      "erp-session-token",
      {
        headers: {
          "X-Correlation-Id": "press-mold-info-01",
        },
      },
    );
  });

  /**
   * @brief 断言 lock mold（锁模）提交只发送白名单 body（请求体）和 correlation header（关联请求头）。
   * @author PopoY
   * @returns Promise resolved when lock request（锁模请求）and result are asserted.
   */
  it("locks a press mold without forwarding raw device or network fields", async () => {
    const postJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: {
        lockedMoldNos: ["MOLD-01"],
        deviceId: "drop-device",
      },
    });
    const request = {
      operatorId: "zhangsan",
      teamId: "PLINE-01",
      processId: "CRAFT-001",
      selectedRows: [
        {
          moldNo: "MOLD-01",
          makeOrderNumber: "MO-01",
          stages: "OP10",
          craftCode: "CRAFT-001",
          projectCode: "P123",
          ip: "drop-ip",
          port: 502,
          deviceId: "drop-device",
        },
      ],
      correlationId: "press-mold-lock-01",
      operationIp: "drop-operation-ip",
    };

    await expect(
      lockPressMold(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        request,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual({
      lockedMoldNos: ["MOLD-01"],
    });

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/mold-locks",
      {
        operatorId: "zhangsan",
        teamId: "PLINE-01",
        processId: "CRAFT-001",
        selectedRows: [
          {
            moldNo: "MOLD-01",
            makeOrderNumber: "MO-01",
            stages: "OP10",
            craftCode: "CRAFT-001",
            projectCode: "P123",
          },
        ],
        correlationId: "press-mold-lock-01",
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-mold-lock-01",
        },
      },
    );
  });

  /**
   * @brief 断言 ERP AjaxResult（企业资源计划响应包装）业务失败返回中文 msg（消息）。
   * @author PopoY
   * @returns Promise resolved when Chinese business error（中文业务错误）is propagated.
   */
  it("rejects mold lock ERP business failures with the Chinese message", async () => {
    const postJson = vi.fn().mockResolvedValueOnce({
      code: 500,
      msg: "模具号 MOLD-01 已存在，请检查后重试。",
    });

    await expect(
      lockPressMold(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        request: {
          operatorId: "zhangsan",
          teamId: "PLINE-01",
          processId: "CRAFT-001",
          selectedRows: [
            {
              moldNo: "MOLD-01",
              makeOrderNumber: "MO-01",
              craftCode: "CRAFT-001",
            },
          ],
          correlationId: "press-mold-lock-error",
        },
        sessionToken: "erp-session-token",
      }),
    ).rejects.toThrow("模具号 MOLD-01 已存在，请检查后重试。");
  });

  /**
   * @brief 断言 locked molds（已锁定模具）查询使用 Qt endpoint（端点）并只保留解锁抽屉白名单字段。
   * @author PopoY
   * @returns Promise resolved when locked mold narrowing（已锁定模具收窄）is asserted.
   */
  it("fetches locked press molds with correlation header and whitelisted fields", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: [
        {
          moldNo: "MOLD-01",
          stages: "OP10",
          makeOrderNumber: "MO-01",
          craftCode: "PRESS-01",
          craftName: "冲压成型",
          mouldMakeOrderType: "1",
          workTimeTypeText: "正常",
          startedAt: "2026-07-02 08:30:00",
          operator: "zhangsan",
          operatorName: "张三",
          moldJobId: "MJ-01",
          deviceId: "drop-device",
          operationIp: "drop-operation-ip",
          ipAddress: "drop-ip",
          port: 502,
          sessionToken: "drop-token",
          signedLease: "drop-lease",
          signature: "drop-signature",
          signalConfig: "drop-config",
        },
        {
          mouldCode: "MOLD-02",
          startTime: "2026-07-02 09:00:00",
          operatorNickName: "李四",
          privateKey: "drop-key",
        },
        {
          moldNo: "MOLD-03",
          craftName: "WX1",
          workTimeTypeText: "0",
          operatorName: "liangy",
        },
      ],
    });

    await expect(
      fetchPressLockedMolds(getJson, {
        correlationId: "press-mold-unlock-query-01",
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([
      {
        moldNo: "MOLD-01",
        stages: "OP10",
        makeOrderNumber: "MO-01",
        craftCode: "PRESS-01",
        craftName: "冲压成型",
        workTimeType: "1",
        workTimeTypeText: "正常",
        startedAt: "2026-07-02 08:30:00",
        operatorId: "zhangsan",
        operatorName: "张三",
        moldJobId: "MJ-01",
      },
      {
        moldNo: "MOLD-02",
        startedAt: "2026-07-02 09:00:00",
        operatorName: "李四",
      },
      {
        moldNo: "MOLD-03",
        craftCode: "WX1",
        craftName: "WX1",
        workTimeType: "0",
        workTimeTypeText: "0",
        operatorId: "liangy",
        operatorName: "liangy",
      },
    ]);

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/locked-molds",
      "erp-session-token",
      {
        headers: {
          "X-Correlation-Id": "press-mold-unlock-query-01",
        },
      },
    );
  });

  /**
   * @brief 断言 unlock mold（解锁模具）提交只发送白名单 body（请求体）和 correlation header（关联请求头）。
   * @author PopoY
   * @returns Promise resolved when unlock request（解锁请求）and result are asserted.
   */
  it("sends teamId in the mold unlock request without raw device fields", async () => {
    const postJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: {
        unlockedMoldNos: ["MOLD-01", "MOLD-02"],
        deviceId: "drop-device",
      },
    });
    const request = {
      operatorId: "zhangsan",
      teamId: "PLINE-01",
      moldNos: ["MOLD-01", " ", "MOLD-02"],
      correlationId: "press-mold-unlock-01",
      deviceId: "drop-device",
      ip: "drop-ip",
      port: 502,
    };

    await expect(
      unlockPressMolds(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        request,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual({
      unlockedMoldNos: ["MOLD-01", "MOLD-02"],
    });

    expect(postJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/mold-unlocks",
      {
        operatorId: "zhangsan",
        teamId: "PLINE-01",
        moldNos: ["MOLD-01", "MOLD-02"],
        correlationId: "press-mold-unlock-01",
      },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-mold-unlock-01",
        },
      },
    );
    expect(Object.keys(postJson.mock.calls[0][1]).sort()).toEqual([
      "correlationId",
      "moldNos",
      "operatorId",
      "teamId",
    ]);
    expect(JSON.stringify(postJson.mock.calls[0][1])).not.toMatch(
      /deviceId|ip|port/,
    );
  });

  /**
   * @brief 断言 unlock mold（解锁模具）ERP AjaxResult（响应包装）失败返回中文 msg（消息）。
   * @author PopoY
   * @returns Promise resolved when Chinese business error（中文业务错误）is propagated.
   */
  it("rejects mold unlock ERP business failures with the Chinese message", async () => {
    const postJson = vi.fn().mockResolvedValueOnce({
      code: 500,
      msg: "加工中不能解锁最后一套模具，请使用完成加工功能。",
    });

    await expect(
      unlockPressMolds(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        request: {
          operatorId: "zhangsan",
          teamId: "PLINE-01",
          moldNos: ["MOLD-01"],
          correlationId: "press-mold-unlock-error",
        },
        sessionToken: "erp-session-token",
      }),
    ).rejects.toThrow("加工中不能解锁最后一套模具，请使用完成加工功能。");
  });

  /**
   * @brief 断言 JSON helper（辅助函数）合并 Authorization（授权）和 X-Correlation-Id（关联 ID）请求头。
   * @author PopoY
   * @returns Promise resolved when native fetch（原生请求）headers are asserted.
   */
  it("merges optional ERP JSON request headers for native GET and POST helpers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ code: 200, data: [] }))
      .mockResolvedValueOnce(createFetchResponse({ code: 200, data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await getJson("http://127.0.0.1:8080/get", "erp-session-token", {
      headers: {
        "X-Correlation-Id": "press-mold-search-01",
      },
    });
    await postJson(
      "http://127.0.0.1:8080/post",
      { hello: "world" },
      {
        bearerToken: "erp-session-token",
        headers: {
          "X-Correlation-Id": "press-mold-lock-01",
        },
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8080/get", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer erp-session-token",
        "X-Correlation-Id": "press-mold-search-01",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:8080/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer erp-session-token",
        "X-Correlation-Id": "press-mold-lock-01",
      },
      body: JSON.stringify({ hello: "world" }),
    });
  });

  /**
   * @brief 断言历史作业列表使用转义 query（查询参数）、独立关联头和响应白名单。
   * @author PopoY
   */
  it("fetches a narrowed press job history page with an independent correlation header", async () => {
    const forbiddenPayload = {
      deviceId: 10,
      ip: "192.0.2.10",
      port: 502,
      signedLease: "secret-lease",
      signature: "secret-signature",
      signalConfig: { raw: true },
      sessionToken: "secret-token",
      idempotencyKey: "secret-idempotency",
      requestFingerprint: "secret-fingerprint",
    };
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: {
        rows: [
          {
            mouldJobId: "123",
            deviceName: "一号压机",
            mouldCode: "M-01",
            operator: "op-01",
            craftCode: "CRAFT-01",
            startTime: "2026-07-24 08:00:00",
            endTime: "2026-07-24 09:30:00",
            mouldWorkingTime: "5400.5",
            status: "UNRECOGNIZED",
            ...forbiddenPayload,
          },
        ],
        total: 1,
        pageNum: 1,
        pageSize: 10,
        ...forbiddenPayload,
      },
    });

    const result = await fetchPressJobHistory(getJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-token",
      query: {
        startTime: "2026-07-24T00:00:00+08:00",
        endTime: "2026-07-25T00:00:00+08:00",
        mouldCode: "M-01",
        operator: "op-01",
        pageNum: 1,
        pageSize: 10,
        correlationId: "corr-list-1",
      },
    });

    expect(result).toEqual({
      rows: [
        {
          moldJobId: "123",
          pressName: "一号压机",
          moldNo: "M-01",
          operatorId: "op-01",
          craftCode: "CRAFT-01",
          startedAt: "2026-07-24 08:00:00",
          completedAt: "2026-07-24 09:30:00",
          actualDurationHours: "1.5",
          status: "UNRECOGNIZED",
        },
      ],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    });
    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/history-jobs?startTime=2026-07-24T00%3A00%3A00%2B08%3A00&endTime=2026-07-25T00%3A00%3A00%2B08%3A00&mouldCode=M-01&operator=op-01&pageNum=1&pageSize=10",
      "erp-token",
      { headers: { "X-Correlation-Id": "corr-list-1" } },
    );
    expect(JSON.stringify(result)).not.toMatch(
      /deviceId|192\.0\.2\.10|signedLease|secret-signature|signalConfig|secret-token|idempotencyKey|requestFingerprint/,
    );
  });

  /**
   * @brief 断言历史时长仅接收可安全换算的后端 string（字符串）秒数。
   * @author PopoY
   */
  it("rejects missing, unsafe, non-finite, negative, or non-string history durations", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: {
        rows: [
          { mouldJobId: "1", mouldCode: "M-01", mouldWorkingTime: "360.5" },
          { mouldJobId: "2", mouldCode: "M-02", mouldWorkingTime: null },
          {
            mouldJobId: "3",
            mouldCode: "M-03",
            mouldWorkingTime: "9007199254740992",
          },
          { mouldJobId: "4", mouldCode: "M-04", mouldWorkingTime: "Infinity" },
          { mouldJobId: "5", mouldCode: "M-05", mouldWorkingTime: "-1" },
          { mouldJobId: "6", mouldCode: "M-06", mouldWorkingTime: 3600 },
        ],
        total: 6,
        pageNum: 1,
        pageSize: 10,
      },
    });

    const result = await fetchPressJobHistory(getJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-token",
      query: {
        startTime: "2026-07-24T00:00:00+08:00",
        endTime: "2026-07-25T00:00:00+08:00",
        pageNum: 1,
        pageSize: 10,
        correlationId: "corr-list-duration",
      },
    });

    expect(result.rows[0].actualDurationHours).toBe("0.1");
    expect(result.rows.slice(1)).toHaveLength(5);
    expect(
      result.rows.slice(1).every((row) => row.actualDurationHours === undefined),
    ).toBe(true);
  });

  /**
   * @brief 断言历史作业 ID（标识）在列表收窄和详情请求边界使用同一正整数规则。
   * @author PopoY
   */
  it("rejects unsafe history job IDs before building detail URLs", async () => {
    const listGetJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: {
        rows: [
          { mouldJobId: ".", mouldCode: "M-DOT" },
          { mouldJobId: "..", mouldCode: "M-DOT-DOT" },
        ],
        total: 2,
        pageNum: 1,
        pageSize: 10,
      },
    });

    const listResult = await fetchPressJobHistory(listGetJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-token",
      query: {
        startTime: "2026-07-24T00:00:00+08:00",
        endTime: "2026-07-25T00:00:00+08:00",
        pageNum: 1,
        pageSize: 10,
        correlationId: "corr-list-invalid-id",
      },
    });

    expect(listResult.rows).toEqual([]);

    const detailGetJson = vi.fn();
    for (const moldJobId of [".", "..", "123 / A"]) {
      await expect(
        fetchPressJobHistoryDetail(detailGetJson, {
          erpBaseUrl: sampleConfig.erpBaseUrl,
          sessionToken: "erp-token",
          moldJobId,
          correlationId: "corr-detail-invalid-id",
        }),
      ).rejects.toThrow("历史作业标识无效。");
    }
    expect(detailGetJson).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言历史作业详情转义稳定身份，并仅保留安全参数和操作字段。
   * @author PopoY
   */
  it("fetches a narrowed press job history detail without nested parameter payloads", async () => {
    const forbiddenPayload = {
      deviceId: 10,
      ip: "192.0.2.10",
      port: 502,
      signedLease: "secret-lease",
      signature: "secret-signature",
      signalConfig: { raw: true },
      sessionToken: "secret-token",
      idempotencyKey: "secret-idempotency",
      requestFingerprint: "secret-fingerprint",
    };
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: {
        mouldJobId: "9223372036854775807",
        pressName: "一号压机",
        mouldCode: "M-01",
        operator: "op-01",
        endOperator: "op-02",
        craftCode: "CRAFT-01",
        startTime: "2026-07-24 08:00:00",
        endTime: "2026-07-24 09:00:00",
        mouldWorkingTime: "3600",
        status: "3",
        startParameterState: "recorded",
        endParameterState: "invalid",
        startParameters: [
          {
            parameterName: "压力",
            value: 135.5,
            valueKind: "scalar",
            unit: "MPa",
            recordedAt: "2026-07-24 08:00:01",
            ...forbiddenPayload,
          },
          { parameterName: "自动模式", value: 1, valueKind: "state" },
          { parameterName: "非法空白", value: 1, valueKind: " state " },
          { parameterName: "非法大小写", value: 1, valueKind: "STATE" },
          {
            parameterName: "非法对象",
            value: 1,
            valueKind: { raw: "state" },
          },
          { parameterName: "备注", value: "稳定" },
          { parameterName: "嵌套对象", value: { raw: "secret-nested" } },
          { parameterName: "嵌套数组", value: ["secret-array"] },
          { parameterName: "非有限值", value: Number.POSITIVE_INFINITY },
          "drop-non-object",
        ],
        endParameters: [],
        operationRecords: [
          {
            operationTime: "2026-07-24 09:00:00",
            operationName: "完成加工",
            result: "失败",
            content: "完成加工失败",
            teamName: "甲班",
            operatorName: "张三",
            ...forbiddenPayload,
          },
          {
            operationTime: "2026-07-24 08:00:00",
            operationName: null,
            result: "成功",
            content: null,
            teamName: null,
            operatorName: null,
          },
          "drop-non-object-operation",
        ],
        ...forbiddenPayload,
      },
    });

    const result = await fetchPressJobHistoryDetail(getJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-token",
      moldJobId: "9223372036854775807",
      correlationId: "corr-detail-1",
    });

    expect(result).toEqual({
      moldJobId: "9223372036854775807",
      pressName: "一号压机",
      moldNo: "M-01",
      operatorId: "op-01",
      endOperatorId: "op-02",
      craftCode: "CRAFT-01",
      startedAt: "2026-07-24 08:00:00",
      completedAt: "2026-07-24 09:00:00",
      actualDurationHours: "1.0",
      status: "3",
      startParameterState: "recorded",
      endParameterState: "invalid",
      startParameters: [
        {
          parameterName: "压力",
          value: 135.5,
          valueKind: "scalar",
          unit: "MPa",
          recordedAt: "2026-07-24 08:00:01",
          status: "recorded",
        },
        {
          parameterName: "自动模式",
          value: 1,
          valueKind: "state",
          status: "recorded",
        },
        { parameterName: "非法空白", value: 1, status: "recorded" },
        { parameterName: "非法大小写", value: 1, status: "recorded" },
        { parameterName: "非法对象", value: 1, status: "recorded" },
        { parameterName: "备注", value: "稳定", status: "recorded" },
        { parameterName: "嵌套对象", status: "invalid" },
        { parameterName: "嵌套数组", status: "invalid" },
        { parameterName: "非有限值", status: "invalid" },
      ],
      endParameters: [],
      operationRecords: [
        {
          operationTime: "2026-07-24 09:00:00",
          operationName: "完成加工",
          result: "失败",
          teamName: "甲班",
          operatorName: "张三",
        },
        {
          operationTime: "2026-07-24 08:00:00",
          operationName: undefined,
          result: "成功",
          teamName: undefined,
          operatorName: undefined,
        },
      ],
    });
    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/qt/press-working/history-jobs/9223372036854775807",
      "erp-token",
      { headers: { "X-Correlation-Id": "corr-detail-1" } },
    );
    expect(result.startParameters[0].valueKind).toBe("scalar");
    expect(result.startParameters[1].valueKind).toBe("state");
    expect(result.startParameters[2]).not.toHaveProperty("valueKind");
    expect(result.startParameters[3]).not.toHaveProperty("valueKind");
    expect(result.startParameters[4]).not.toHaveProperty("valueKind");
    expect(result.operationRecords[0]).toEqual({
      operationTime: "2026-07-24 09:00:00",
      operationName: "完成加工",
      result: "失败",
      teamName: "甲班",
      operatorName: "张三",
    });
    expect(JSON.stringify(result.operationRecords)).not.toContain(
      "完成加工失败",
    );
    expect(JSON.stringify(result)).not.toMatch(
      /deviceId|192\.0\.2\.10|signedLease|secret-signature|signalConfig|secret-token|idempotencyKey|requestFingerprint|secret-nested|secret-array/,
    );
  });

  /**
   * @brief 断言 current job（当前作业）查询使用 sam-erp 当前处理端接口并只保留展示白名单。
   * @author PopoY
   * @returns Promise resolved when current job rows（当前作业行）are normalized.
   */
  it("fetches current press jobs without exposing raw device or network fields", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: [
        {
          id: 101,
          deviceId: 9001,
          deviceName: "一号压机",
          expectedDuration: "2.5",
          mouldCode: "MOLD-01",
          operationIp: "192.168.1.10",
          port: 502,
          startParameterRecords: "[secret-records]",
          startTime: "2026-06-30 08:00:00",
          status: "1",
          modbusEntity: {
            ipAddress: "10.0.0.8",
            port: 1502,
          },
        },
        {},
      ],
    });

    await expect(
      fetchPressJobCurrentJobs(getJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([
      {
        localJobSessionId: "press-job-id-101",
        pressJobId: 101,
        pressName: "一号压机",
        moldNo: "MOLD-01",
        plannedDurationHours: "2.5",
        startedAt: "2026-06-30 08:00:00",
        status: "1",
      },
    ]);

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/modbus/device/getPressJobByHandleIp",
      "erp-session-token",
    );
  });

  /**
   * @brief 断言同一数组位置被另一条无 ID 作业替换时生成不同的本地作业身份。
   * @author PopoY
   */
  it("does not reuse a local current-job identity when the same position is replaced", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            deviceName: "一号压机",
            mouldCode: "MOLD-A",
            startTime: "2026-07-21 08:00:00",
            expectedDuration: "1",
            status: "1",
          },
        ],
      })
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            deviceName: "二号压机",
            mouldCode: "MOLD-B",
            startTime: "2026-07-21 09:00:00",
            expectedDuration: "2",
            status: "0",
          },
        ],
      });

    const [firstJob] = await fetchPressJobCurrentJobs(getJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-session-token",
    });
    const [replacementJob] = await fetchPressJobCurrentJobs(getJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-session-token",
    });

    expect(firstJob.localJobSessionId).not.toBe(
      replacementJob.localJobSessionId,
    );
  });

  /**
   * @brief 断言作业身份不受数组重排及 expectedDuration/status（预计时长/状态）变化影响。
   * @author PopoY
   */
  it("keeps current-job identities stable across reorder and volatile field changes", async () => {
    const firstPayload = [
      {
        deviceId: "drop-device-a",
        deviceName: "一号压机",
        ip: "drop-ip-a",
        mouldCode: "MOLD-A",
        port: 502,
        sessionToken: "drop-token-a",
        signalConfig: "drop-config-a",
        startTime: "2026-07-21 08:00:00",
        expectedDuration: "1",
        status: "1",
      },
      {
        deviceName: "二号压机",
        mouldCode: "MOLD-B",
        startTime: "2026-07-21 09:00:00",
        expectedDuration: "2",
        status: "0",
      },
      {
        id: 101,
        deviceName: "三号压机",
        mouldCode: "MOLD-C",
        startTime: "2026-07-21 10:00:00",
        expectedDuration: "3",
        status: "1",
      },
    ];
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({ code: 200, data: firstPayload })
      .mockResolvedValueOnce({
        code: 200,
        data: [
          { ...firstPayload[2], expectedDuration: "3.5", status: "0" },
          {
            ...firstPayload[0],
            deviceId: "drop-device-a-next",
            expectedDuration: "1.5",
            ip: "drop-ip-a-next",
            port: 1502,
            sessionToken: "drop-token-a-next",
            signalConfig: "drop-config-a-next",
            status: "0",
          },
          { ...firstPayload[1], expectedDuration: "2.5", status: "1" },
        ],
      });

    const firstRows = await fetchPressJobCurrentJobs(getJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-session-token",
    });
    const reorderedRows = await fetchPressJobCurrentJobs(getJson, {
      erpBaseUrl: sampleConfig.erpBaseUrl,
      sessionToken: "erp-session-token",
    });
    const firstIdentityByMold = Object.fromEntries(
      firstRows.map((row) => [row.moldNo, row.localJobSessionId]),
    );
    const reorderedIdentityByMold = Object.fromEntries(
      reorderedRows.map((row) => [row.moldNo, row.localJobSessionId]),
    );

    expect(reorderedIdentityByMold).toEqual(firstIdentityByMold);
    expect(firstRows[2].pressJobId).toBe(101);
    expect(JSON.stringify([...firstRows, ...reorderedRows])).not.toContain(
      "drop-",
    );
    expect(Object.keys(firstRows[0]).sort()).toEqual(
      [
        "localJobSessionId",
        "moldNo",
        "plannedDurationHours",
        "pressName",
        "startedAt",
        "status",
      ].sort(),
    );
  });

  /**
   * @brief 断言缺少 ERP ID 和全部稳定展示字段的行不会生成可碰撞的空本地身份。
   * @author PopoY
   */
  it("drops no-id current jobs without stable identity fields", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: [{ expectedDuration: "1" }, { status: "0" }],
    });

    await expect(
      fetchPressJobCurrentJobs(getJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([]);
  });

  /**
   * @brief 断言 expected duration（预计时长）更新使用 ERP PUT 契约，token（令牌）只进入认证请求头。
   * @author PopoY
   */
  it("updates press job expected duration with PUT and a whitelisted body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createFetchResponse({
        code: 200,
        msg: "操作成功",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      updatePressJobExpectedDuration({
        correlationId: "press-job-duration-01",
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request: {
          id: 101,
          expectedDuration: "2.5",
          sessionToken: "must-not-enter-body",
        } as never,
      }),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/modbus/pressjob",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer erp-session-token",
          "X-Correlation-Id": "press-job-duration-01",
        },
        body: JSON.stringify({ id: 101, expectedDuration: "2.5" }),
      },
    );
  });

  /**
   * @brief 断言 ERP AjaxResult（统一响应）业务失败时拒绝预计时长更新。
   * @author PopoY
   */
  it("rejects press job expected duration updates when ERP AjaxResult fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createFetchResponse({
          code: 500,
          msg: "预计时长更新失败",
        }),
      ),
    );
    await expect(
      updatePressJobExpectedDuration({
        correlationId: "press-job-duration-error",
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        request: { id: 101, expectedDuration: "3" },
      }),
    ).rejects.toThrow("预计时长更新失败");
  });

  /**
   * @brief 断言 press job lookup data（压机作业查询数据）复用 sam-erp 班组、人员和工艺接口。
   * @author PopoY
   * @returns Promise resolved when lookup data（查询数据）is normalized.
   */
  it("fetches press job team, current user, operator, and process lookup data", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({
        code: 200,
        data: [
          { code: "PLINE-A", name: "压机一班", rawSecret: "drop-team-secret" },
          { code: "PLINE-B", name: "压机二班" },
          { code: "", name: "空班组不展示" },
        ],
      })
      .mockResolvedValueOnce({
        code: 200,
        data: {
          plineCode: "PLINE-A",
          userName: "zhangsan",
          nickName: "张三",
          credential: "drop-user-secret",
        },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: [
          { userName: "zhangsan", nickName: "张三", sessionToken: "drop-token" },
          { userName: "lisi", nickName: "李四" },
        ],
      })
      .mockResolvedValueOnce({
        code: 200,
        data: [
          { craftCode: "PRESS-01", craftName: "压制作业", privateKey: "drop-key" },
          { craftCode: "PRESS-02", craftName: "整形作业" },
        ],
      });

    await expect(
      fetchPressJobLookupData(getJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual({
      defaultOperatorId: "zhangsan",
      defaultTeamId: "PLINE-A",
      operatorOptions: [
        { operatorId: "zhangsan", operatorName: "张三", teamId: "PLINE-A" },
        { operatorId: "lisi", operatorName: "李四", teamId: "PLINE-A" },
      ],
      processOptions: [
        { processId: "PRESS-01", processName: "压制作业", teamId: "PLINE-A" },
        { processId: "PRESS-02", processName: "整形作业", teamId: "PLINE-A" },
      ],
      teamOptions: [
        { teamId: "PLINE-A", teamName: "压机一班" },
        { teamId: "PLINE-B", teamName: "压机二班" },
      ],
    });

    expect(getJson).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/fm/pline/getPlnListByDept2/30",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/rel/qtrel/getQtUserInfo",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/rel/qtrel/getQtUserList2/PLINE-A",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/samMesPlineCraft/samMesPlineCraftController/getCraftByPlineIdAndDeviceType/PLINE-A/0",
      "erp-session-token",
    );
  });

  /**
   * @brief 断言 team cascade（班组级联）只读取目标班组的人员和预选工艺。
   * @author PopoY
   * @returns Promise resolved when selected team options are normalized.
   */
  it("fetches operator and process options for the selected press job team", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({
        code: 200,
        data: [{ userName: "wangwu", nickName: "王五" }],
      })
      .mockResolvedValueOnce({
        code: 200,
        data: [{ craftCode: "PRESS-09", craftName: "校形作业" }],
      });

    await expect(
      fetchPressJobTeamOptions(getJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
        teamId: "PLINE-B",
      }),
    ).resolves.toEqual({
      operatorOptions: [
        { operatorId: "wangwu", operatorName: "王五", teamId: "PLINE-B" },
      ],
      processOptions: [
        { processId: "PRESS-09", processName: "校形作业", teamId: "PLINE-B" },
      ],
      teamId: "PLINE-B",
    });

    expect(getJson).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/rel/qtrel/getQtUserList2/PLINE-B",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/samMesPlineCraft/samMesPlineCraftController/getCraftByPlineIdAndDeviceType/PLINE-B/0",
      "erp-session-token",
    );
  });

  /**
   * @brief 断言 parameter_group dict（参数组别字典）按 sam-erp 字典接口读取并压缩成展示选项。
   * @author PopoY
   * @returns Promise resolved when dict options and bearer token are asserted.
   */
  it("fetches parameter_group dict options with the ERP session token", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: [
        { dictValue: "4", dictLabel: "压机动作参数", listClass: "default" },
        { dictValue: 5, dictLabel: "报警状态", cssClass: "" },
        { dictValue: "", dictLabel: "空值不应展示" },
      ],
    });

    await expect(
      fetchParameterGroupOptions(getJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([
      { dictValue: "4", dictLabel: "压机动作参数" },
      { dictValue: "5", dictLabel: "报警状态" },
    ]);

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/system/dict/data/type/parameter_group",
      "erp-session-token",
    );
  });

  /**
   * @brief 断言 mould_make_order_type dictionary（字典）读取复用 ERP 字典接口。
   * @author PopoY
   * @returns Promise resolved when mold work type dict（工时类型字典）is narrowed.
   */
  it("fetches mold work type dict options with the ERP session token", async () => {
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: [
        { dictValue: "1", dictLabel: "正常作业" },
        { dictValue: 2, dictLabel: "返修作业" },
      ],
    });

    await expect(
      fetchPressMoldWorkTypeOptions(getJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        sessionToken: "erp-session-token",
      }),
    ).resolves.toEqual([
      { dictValue: "1", dictLabel: "正常作业" },
      { dictValue: "2", dictLabel: "返修作业" },
    ]);

    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/system/dict/data/type/mould_make_order_type",
      "erp-session-token",
    );
  });

  /**
   * @brief Assert that ERP login errors are normalized into the domain error code expected by callers.
   * @returns Promise resolved when the rejection shape assertion completes.
   */
  it("maps login failure to ERP_AUTO_LOGIN_FAILED", async () => {
    const postJson = vi.fn().mockRejectedValue(new Error("401"));

    await expect(autoLogin(postJson, sampleConfig)).rejects.toMatchObject({
      code: "ERP_AUTO_LOGIN_FAILED",
    });

    expect(postJson).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief Assert that a failed ERP login short-circuits the lease flow and does not trigger a second request.
   * @returns Promise resolved when the short-circuit assertion completes.
   */
  it("does not request a lease package when auto-login fails", async () => {
    const postJson = vi.fn().mockRejectedValueOnce(new Error("401"));

    await expect(loadBootstrapSession(postJson, sampleConfig)).rejects.toMatchObject({
      code: "ERP_AUTO_LOGIN_FAILED",
    });

    // 先验证登录失败场景，再断言后续租约请求没有被触发。
    expect(postJson).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief Assert that ERP AjaxResult business errors do not enter the lease flow.
   * @author PopoY
   * @returns Promise resolved when the wrapped business failure is rejected.
   */
  it("rejects ERP AjaxResult business errors from auto-login", async () => {
    const postJson = vi.fn().mockResolvedValueOnce({
      code: 500,
      msg: '403 FORBIDDEN "Station is not bound to granteeHostId"',
    });

    await expect(loadBootstrapSession(postJson, sampleConfig)).rejects.toMatchObject({
      code: "ERP_AUTO_LOGIN_FAILED",
    });

    expect(postJson).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief Assert that the lease API response is narrowed to the bootstrap lease package fields only.
   * @returns Promise resolved when the response shape assertion completes.
   */
  it("returns signalConfig and signedLease while ignoring deviceConnectionInfo", async () => {
    const postJson = vi.fn().mockResolvedValueOnce(createLeaseResponse());

    await expect(
      fetchLeasePackage(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        granteeHostId: sampleConfig.granteeHostId,
        sessionToken: "erp-session-token",
        stationId: sampleConfig.stationId,
      }),
    ).resolves.toEqual({
      signalConfig: {
        baseUrl: "http://127.0.0.1:9000",
        topic: "stations/station-01",
      },
      signedLease: {
        leaseId: "lease-01",
        signature: "signed-payload",
      },
    });

    expect(postJson).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief Assert that JSON-string lease package fields are parsed before Driver Service receives them.
   * @returns Promise resolved when the normalized lease package shape is asserted.
   */
  it("parses stringified signedLease and signalConfig from the lease response", async () => {
    const postJson = vi.fn().mockResolvedValueOnce(createStringifiedLeaseResponse());

    await expect(
      fetchLeasePackage(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        granteeHostId: sampleConfig.granteeHostId,
        sessionToken: "erp-session-token",
        stationId: sampleConfig.stationId,
      }),
    ).resolves.toEqual({
      signalConfig: {
        signals: [
          {
            address: 100,
            name: "pressure",
          },
        ],
      },
      signedLease: {
        alg: "RS256",
        kid: "lease-key-01",
        payloadJson: JSON.stringify({
          leaseId: "lease-01",
          targetDeviceId: "device-01",
          expiresAt: "2026-06-25T16:00:00Z",
          fencingToken: 10,
        }),
        signature: "signed-payload",
      },
    });
  });

  /**
   * @brief Assert that ERP placeholder leases stop before they reach Driver Service Real Mode.
   * @returns Promise resolved when the placeholder lease rejection is asserted.
   */
  it("rejects ERP bootstrap placeholder lease packages before Driver Service calls", async () => {
    const postJson = vi.fn().mockResolvedValueOnce(createBootstrapPlaceholderLeaseResponse());

    await expect(
      fetchLeasePackage(postJson, {
        erpBaseUrl: sampleConfig.erpBaseUrl,
        granteeHostId: sampleConfig.granteeHostId,
        sessionToken: "erp-session-token",
        stationId: sampleConfig.stationId,
      }),
    ).rejects.toMatchObject({
      code: "ERP_LEASE_PLACEHOLDER",
    });

    expect(postJson).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief Assert that the composed ERP bootstrap flow returns the login session alongside the lease package.
   * @returns Promise resolved when the composed happy-path assertion completes.
   */
  it("returns sessionToken, signalConfig, and signedLease on the success path", async () => {
    const postJson = vi
      .fn()
      .mockResolvedValueOnce(createLoginResponse())
      .mockResolvedValueOnce(createLeaseResponse());
    const getJson = vi.fn().mockResolvedValueOnce({
      code: 200,
      data: "false",
    }).mockResolvedValueOnce({
      code: 200,
      data: [{ dictValue: "4", dictLabel: "压机动作参数" }],
    }).mockResolvedValueOnce({
      code: 200,
      data: [{ dictValue: "0", dictLabel: "正常作业" }],
    }).mockResolvedValueOnce({
      code: 200,
      data: [{ craftCode: "WX1", craftName: "外协一" }],
    }).mockResolvedValueOnce({
      code: 200,
      data: [{ userName: "liangy", nickName: "梁燕" }],
    }).mockResolvedValueOnce({ code: 200, data: [] })
      .mockResolvedValueOnce({ code: 200, data: {} })
      .mockResolvedValueOnce({ code: 200, data: [] });

    await expect(loadBootstrapSession(postJson, sampleConfig, getJson)).resolves.toEqual({
      bootstrapConfigApprovalState: "editable",
      bootstrapConfigEditable: true,
      businessContext: {
        shiftCode: "A",
      },
      defaultDeviceScope: {
        deviceIds: ["device-01"],
      },
      sessionToken: "erp-session-token",
      signalConfig: {
        baseUrl: "http://127.0.0.1:9000",
        topic: "stations/station-01",
      },
      signedLease: {
        leaseId: "lease-01",
        signature: "signed-payload",
      },
      parameterGroupOptions: [{ dictValue: "4", dictLabel: "压机动作参数" }],
      pressMoldWorkTypeOptions: [{ dictValue: "0", dictLabel: "正常作业" }],
      pressMoldCraftOptions: [{ dictValue: "WX1", dictLabel: "外协一" }],
      pressMoldOperatorOptions: [{ dictValue: "liangy", dictLabel: "梁燕" }],
      pressJobLookupData: {
        operatorOptions: [],
        processOptions: [],
        teamOptions: [],
      },
      pressJobCurrentJobs: [],
      stationContext: {
        stationAccountId: "station-a",
        stationId: "station-01",
      },
    });

    expect(postJson).toHaveBeenCalledTimes(2);
    // 先锁定第一次 auto-login 请求的地址和基于 native config 组装的请求体。
    expect(postJson).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/api/qt/bootstrap/auto-login",
      {
        granteeHostId: sampleConfig.granteeHostId,
        stationAccountId: sampleConfig.stationAccountId,
        stationId: sampleConfig.stationId,
      },
    );
    // 再锁定第二次 lease-package 请求的地址和由登录结果衔接出的请求体。
    expect(postJson).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/api/qt/bootstrap/lease-package",
      {
        granteeHostId: sampleConfig.granteeHostId,
        sessionToken: "erp-session-token",
        stationId: sampleConfig.stationId,
      },
    );
    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/system/config/configKey/approve.press.config",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/system/dict/data/type/parameter_group",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/system/dict/data/type/mould_make_order_type",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/moldStandardCraft/moldStandardCraftController/getCraftList",
      "erp-session-token",
    );
    expect(getJson).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/system/user/getAllUserForOptions",
      "erp-session-token",
    );
  });

  /**
   * @brief auto-login（自动登录）成功后读取 config approval（配置审批开关），失败时不阻断启动。
   * @author PopoY
   */
  it("keeps bootstrap successful when config approval read fails", async () => {
    const postJson = vi
      .fn()
      .mockResolvedValueOnce(createLoginResponse())
      .mockResolvedValueOnce(createLeaseResponse());
    const getJson = vi.fn().mockRejectedValue(new Error("network"));

    const session = await loadBootstrapSession(postJson, sampleConfig, getJson);

    expect(session.bootstrapConfigEditable).toBe(false);
    expect(session.bootstrapConfigApprovalState).toBe("unavailable");
  });

  /**
   * @brief Assert that bootstrap ignores deviceConnectionInfo even when ERP auto-login returns it.
   * @returns Promise resolved when the narrowed bootstrap payload assertion completes.
   */
  it("does not expose deviceConnectionInfo from the auto-login response", async () => {
    const postJson = vi
      .fn()
      .mockResolvedValueOnce(createLoginResponseWithDeviceConnectionInfo())
      .mockResolvedValueOnce(createLeaseResponse());

    await expect(loadBootstrapSession(postJson, sampleConfig)).resolves.toEqual({
      bootstrapConfigApprovalState: "unavailable",
      bootstrapConfigEditable: false,
      businessContext: {
        shiftCode: "A",
      },
      defaultDeviceScope: {
        deviceIds: ["device-01"],
      },
      parameterGroupOptions: [],
      pressMoldWorkTypeOptions: [],
      sessionToken: "erp-session-token",
      signalConfig: {
        baseUrl: "http://127.0.0.1:9000",
        topic: "stations/station-01",
      },
      signedLease: {
        leaseId: "lease-01",
        signature: "signed-payload",
      },
      stationContext: {
        stationAccountId: "station-a",
        stationId: "station-01",
      },
    });

    expect(postJson).toHaveBeenCalledTimes(2);
  });
});

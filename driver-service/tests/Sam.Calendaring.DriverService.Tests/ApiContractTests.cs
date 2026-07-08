/**
 * @file ApiContractTests.cs - 验证 Driver Service API（驱动服务接口）契约。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 在实现业务逻辑前先锁定 Driver Service V1 API Contract（接口契约）的外部行为。
 */
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 锁定 Driver Service V1 API Contract（接口契约）的失败行为，确保未实现时保持 RED 状态。
/// </summary>
public sealed class ApiContractTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private KestrelRuntimeHost? _runtimeHost;
    private HttpClient? _runtimeClient;

    /// <summary>
    /// 初始化 API Contract（接口契约）测试使用的内存宿主客户端。
    /// </summary>
    /// <param name="factory">用于启动 Driver Service 测试宿主的工厂。</param>
    public ApiContractTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    /// <summary>
    /// 为每个测试提供默认空初始化；真实 Kestrel（ASP.NET Core Web 服务器）仅在需要 runtime（真实运行时）的用例中按需启动。
    /// </summary>
    public Task InitializeAsync()
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// 清理真实 Kestrel（ASP.NET Core Web 服务器）宿主进程，避免残留后台实例影响后续验证。
    /// </summary>
    public async Task DisposeAsync()
    {
        _runtimeClient?.Dispose();

        if (_runtimeHost is not null)
        {
            await _runtimeHost.DisposeAsync();
        }
    }

    /// <summary>
    /// 验证 /applyLeaseAndConfig 会拒绝原始设备覆盖字段，并返回约定的租约错误响应。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigRejectsRawDeviceOverrideFields()
    {
        var response = await _client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                leaseToken = "lease-token-001",
                ip = "10.10.10.10",
                port = 502,
                deviceId = "PLC-01"
            });

        await AssertLeaseInvalidJsonAsync(
            response,
            HttpStatusCode.BadRequest,
            expectedMessageFragment: "请求字段不允许");
    }

    /// <summary>
    /// 验证真实 Kestrel（ASP.NET Core Web 服务器）在 /applyLeaseAndConfig 收到畸形 JSON 时也返回契约 JSON。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigMalformedJsonReturnsContractJsonOnKestrelRuntime()
    {
        var response = await (await GetRuntimeClientAsync()).PostAsync(
            "/applyLeaseAndConfig",
            CreateJsonContent("{"));

        await AssertLeaseInvalidJsonAsync(
            response,
            HttpStatusCode.BadRequest,
            expectedMessageFragment: "格式不正确");
    }

    /// <summary>
    /// 验证 /getSignalSnapshot 会拒绝 pointOverride（点位覆盖）字段，并返回租约错误响应。
    /// </summary>
    [Fact]
    public async Task GetSignalSnapshotRejectsPointOverride()
    {
        var response = await _client.PostAsJsonAsync(
            "/getSignalSnapshot",
            new
            {
                leaseToken = "lease-token-001",
                pointOverride = new
                {
                    signalCode = "READY",
                    address = "D100"
                }
            });

        await AssertLeaseInvalidJsonAsync(response, HttpStatusCode.BadRequest);
    }

    /// <summary>
    /// 验证真实 Kestrel（ASP.NET Core Web 服务器）在 /getSignalSnapshot 收到畸形 JSON 时也返回契约 JSON。
    /// </summary>
    [Fact]
    public async Task GetSignalSnapshotMalformedJsonReturnsContractJsonOnKestrelRuntime()
    {
        var response = await (await GetRuntimeClientAsync()).PostAsync(
            "/getSignalSnapshot",
            CreateJsonContent("{"));

        await AssertLeaseInvalidJsonAsync(
            response,
            HttpStatusCode.BadRequest,
            expectedMessageFragment: "格式不正确");
    }

    /// <summary>
    /// 验证真实 Kestrel（ASP.NET Core Web 服务器）在 /applyLeaseAndConfig 收到额外字段时返回契约 JSON。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigRejectsExtraFieldOnKestrelRuntime()
    {
        const string requestJson = """
            {"correlationId":"cid-runtime-001","timeoutMs":5000,"signedLease":{},"signalConfig":{},"ip":"10.0.0.1"}
            """;

        var response = await (await GetRuntimeClientAsync()).PostAsync(
            "/applyLeaseAndConfig",
            CreateJsonContent(requestJson));

        await AssertLeaseInvalidJsonAsync(
            response,
            HttpStatusCode.BadRequest,
            expectedMessageFragment: "请求字段不允许");
    }

    /// <summary>
    /// 验证 /applyLeaseAndConfig 缺失 signedLease（签名租约）时返回 400 + LEASE_INVALID，而不是 500。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigMissingSignedLeaseReturnsLeaseInvalid()
    {
        var response = await _client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-missing-signed-lease-001",
                timeoutMs = 5000,
                signalConfig = new { signals = Array.Empty<object>() }
            });

        await AssertLeaseInvalidJsonAsync(
            response,
            HttpStatusCode.BadRequest,
            expectedMessageFragment: "字段");
    }

    /// <summary>
    /// 验证 /applyLeaseAndConfig 缺失 signalConfig（信号配置）时返回 400 + LEASE_INVALID，而不是 500。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigMissingSignalConfigReturnsLeaseInvalid()
    {
        var response = await _client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-missing-signal-config-001",
                timeoutMs = 5000,
                signedLease = new { leaseId = "lease-001" }
            });

        await AssertLeaseInvalidJsonAsync(
            response,
            HttpStatusCode.BadRequest,
            expectedMessageFragment: "字段");
    }

    /// <summary>
    /// 验证合法白名单请求在 /applyLeaseAndConfig 上会透传 correlationId（关联 ID），并返回最小状态字段。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigValidWhitelistRequestReturnsCorrelationAndDisconnectedStatesOnKestrelRuntime()
    {
        var response = await (await GetRuntimeClientAsync()).PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-allowed-apply-001",
                timeoutMs = 5000,
                signedLease = new { leaseId = "lease-001" },
                signalConfig = new { signals = Array.Empty<object>() }
            });

        var payload = await response.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal("cid-allowed-apply-001", payload.CorrelationId);
        Assert.Equal("None", payload.LeaseState);
        Assert.Equal("Disconnected", payload.DeviceSessionState);
    }

    /// <summary>
    /// 验证配置正确公钥后，有效租约在 /applyLeaseAndConfig 上只更新授权，不提前连接设备。
    /// @author PopoY
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigValidLeaseReturnsOkAndDisconnectedBeforeSnapshot()
    {
        var fixture = TestLeaseFactory.CreateValidLease(referenceNow: DateTimeOffset.UtcNow);
        using var client = CreateConfiguredClient(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            CreateTempDriverStateConnectionString(),
            driverMode: "Mock");
        using var signedLeaseDocument = JsonDocument.Parse(fixture.SignedLease);
        using var signalConfigDocument = JsonDocument.Parse(fixture.SignalConfig);

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-task3-valid-001",
                timeoutMs = 5000,
                signedLease = signedLeaseDocument.RootElement.Clone(),
                signalConfig = signalConfigDocument.RootElement.Clone()
            });

        var payload = await response.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal("cid-task3-valid-001", payload.CorrelationId);
        Assert.Equal(DriverResultCode.Ok, payload.ResultCode);
        Assert.Equal("Active", payload.LeaseState);
        Assert.Equal("Disconnected", payload.DeviceSessionState);
        Assert.Equal("lease-001", payload.LeaseId);
        Assert.Equal("press-001", payload.TargetDeviceId);
        Assert.Equal("10", payload.FencingToken);
        Assert.Contains("授权已更新", payload.Message);
    }

    /// <summary>
    /// 验证 Mock Mode（模拟模式）可以兼容 ERP bootstrap（启动引导）的未签名占位租约，并允许后续刷新快照成功。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigAcceptsErpBootstrapPlaceholderLeaseInMockMode()
    {
        using var client = CreateConfiguredClient(
            string.Empty,
            "SAM-LOCAL-HOST",
            CreateTempDriverStateConnectionString(),
            driverMode: "Mock");

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            CreateErpBootstrapPlaceholderApplyRequest());

        var payload = await response.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(DriverResultCode.Ok, payload.ResultCode);
        Assert.Equal(LeaseState.Active, payload.LeaseState);
        Assert.Equal(DeviceSessionState.Disconnected, payload.DeviceSessionState);
        Assert.Equal("qt-bootstrap-10-001", payload.LeaseId);
        Assert.Equal("10", payload.TargetDeviceId);

        var snapshotResponse = await client.PostAsJsonAsync(
            "/getSignalSnapshot",
            new
            {
                correlationId = "cid-erp-placeholder-snapshot-001",
                timeoutMs = 5000
            });
        var snapshotPayload = await snapshotResponse.Content.ReadFromJsonAsync<GetSignalSnapshotResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.OK, snapshotResponse.StatusCode);
        Assert.NotNull(snapshotPayload);
        Assert.Equal(DriverResultCode.Ok, snapshotPayload.ResultCode);
        Assert.True(snapshotPayload.SignalValues.ContainsKey("pressure"));
        var pressure = Assert.IsType<JsonElement>(snapshotPayload.SignalValues["pressure"]);
        Assert.Equal(100, pressure.GetInt32());
    }

    /// <summary>
    /// 验证 Real Mode（真实模式）不会接受 ERP bootstrap（启动引导）的未签名占位租约。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigRejectsErpBootstrapPlaceholderLeaseOutsideMockMode()
    {
        using var client = CreateConfiguredClient(
            string.Empty,
            "SAM-LOCAL-HOST",
            CreateTempDriverStateConnectionString(),
            driverMode: "Real");

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            CreateErpBootstrapPlaceholderApplyRequest());
        var payload = await response.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(DriverResultCode.LeaseInvalid, payload.ResultCode);
        Assert.Equal(DeviceSessionState.Disconnected, payload.DeviceSessionState);
    }

    /// <summary>
    /// 验证过期租约在 /applyLeaseAndConfig 上映射为 409 Conflict（冲突）。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigExpiredLeaseReturnsConflict()
    {
        var fixture = TestLeaseFactory.CreateExpiredLease(referenceNow: DateTimeOffset.UtcNow);
        using var client = CreateConfiguredClient(fixture.PublicKeyPem, "SAM-LOCAL-HOST");
        using var signedLeaseDocument = JsonDocument.Parse(fixture.SignedLease);
        using var signalConfigDocument = JsonDocument.Parse(fixture.SignalConfig);

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-task3-expired-001",
                timeoutMs = 5000,
                signedLease = signedLeaseDocument.RootElement.Clone(),
                signalConfig = signalConfigDocument.RootElement.Clone()
            });

        var payload = await response.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(DriverResultCode.LeaseExpired, payload.ResultCode);
        Assert.Equal("Expired", payload.LeaseState);
        Assert.Equal("Disconnected", payload.DeviceSessionState);
    }

    /// <summary>
    /// 验证当本地已持久化 CleanupPending（清理待完成）状态时，/applyLeaseAndConfig 会返回 CLEANUP_PENDING。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigReturnsCleanupPendingWhenPersistedStateBlocksNewApply()
    {
        var fixture = TestLeaseFactory.CreateValidLease(referenceNow: DateTimeOffset.UtcNow);
        var connectionString = CreateTempDriverStateConnectionString();
        var store = new SqliteDriverStateStore(connectionString);
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveSnapshotAsync(new DriverStateSnapshot(
            null,
            20,
            LeaseState.Active,
            DeviceSessionState.CleanupPending), CancellationToken.None);
        using var client = CreateConfiguredClient(fixture.PublicKeyPem, "SAM-LOCAL-HOST", connectionString);
        using var signedLeaseDocument = JsonDocument.Parse(fixture.SignedLease);
        using var signalConfigDocument = JsonDocument.Parse(fixture.SignalConfig);

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-task4-cleanup-001",
                timeoutMs = 5000,
                signedLease = signedLeaseDocument.RootElement.Clone(),
                signalConfig = signalConfigDocument.RootElement.Clone()
            });

        var payload = await response.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(DriverResultCode.CleanupPending, payload.ResultCode);
        Assert.Equal(LeaseState.Active, payload.LeaseState);
        Assert.Equal(DeviceSessionState.CleanupPending, payload.DeviceSessionState);
        Assert.Contains("上次清理未完成", payload.Message);
    }

    /// <summary>
    /// 验证 /applyLeaseAndConfig 会读取已持久化的最大 fencing token（隔离令牌）并拦截旧租约。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigUsesPersistedMaxSeenFencingToken()
    {
        var fixture = TestLeaseFactory.CreateValidLease(fencingToken: 9, referenceNow: DateTimeOffset.UtcNow);
        var connectionString = CreateTempDriverStateConnectionString();
        var store = new SqliteDriverStateStore(connectionString);
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveSnapshotAsync(new DriverStateSnapshot(
            null,
            10,
            LeaseState.Active,
            DeviceSessionState.Disconnected), CancellationToken.None);
        using var client = CreateConfiguredClient(fixture.PublicKeyPem, "SAM-LOCAL-HOST", connectionString);
        using var signedLeaseDocument = JsonDocument.Parse(fixture.SignedLease);
        using var signalConfigDocument = JsonDocument.Parse(fixture.SignalConfig);

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-task4-fencing-001",
                timeoutMs = 5000,
                signedLease = signedLeaseDocument.RootElement.Clone(),
                signalConfig = signalConfigDocument.RootElement.Clone()
            });

        var payload = await response.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(DriverResultCode.FencingTokenStale, payload.ResultCode);
        Assert.Equal("Disconnected", payload.DeviceSessionState);
        Assert.Contains("隔离令牌过旧", payload.Message);
    }

    /// <summary>
    /// 验证合法白名单请求在 /getSignalSnapshot 上会透传 correlationId（关联 ID），并返回空 signalValues（信号值集合）。
    /// </summary>
    [Fact]
    public async Task GetSignalSnapshotValidWhitelistRequestReturnsCorrelationAndEmptySignalValuesOnKestrelRuntime()
    {
        var response = await (await GetRuntimeClientAsync()).PostAsJsonAsync(
            "/getSignalSnapshot",
            new
            {
                correlationId = "cid-allowed-snapshot-001",
                timeoutMs = 5000
            });

        var payload = await response.Content.ReadFromJsonAsync<GetSignalSnapshotResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal("cid-allowed-snapshot-001", payload.CorrelationId);
        Assert.NotNull(payload.SignalValues);
        Assert.Empty(payload.SignalValues);
    }

    /// <summary>
    /// 验证请求预验证只作用于 POST（创建/提交）请求，避免把 GET（读取）错误地改写成契约 JSON。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigGetWithJsonBodyStillReturnsMethodNotAllowed()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/applyLeaseAndConfig")
        {
            Content = CreateJsonContent("{")
        };

        var response = await (await GetRuntimeClientAsync()).SendAsync(request);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
    }

    /// <summary>
    /// 验证 /executeDeviceCommand 也只接受 POST（创建/提交）请求。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task ExecuteDeviceCommandGetWithJsonBodyStillReturnsMethodNotAllowed()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/executeDeviceCommand")
        {
            Content = CreateJsonContent("{")
        };

        var response = await (await GetRuntimeClientAsync()).SendAsync(request);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
    }

    /// <summary>
    /// 验证 Qt WebEngine（Qt 网页引擎）从 file:// 来源调用 Driver Service 前的 CORS（跨源资源共享）预检请求会被允许。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigAllowsQtFileOriginCorsPreflightOnKestrelRuntime()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/applyLeaseAndConfig");

        // PopoY: browser（浏览器）在 CORS preflight（跨源预检）中常把 file:// 来源序列化为 null。
        request.Headers.Add("Origin", "null");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");

        var response = await (await GetRuntimeClientAsync()).SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        AssertHeaderContains(response, "Access-Control-Allow-Origin", "null");
        AssertHeaderContains(response, "Access-Control-Allow-Methods", "POST");
        AssertHeaderContains(response, "Access-Control-Allow-Headers", "content-type");
    }

    /// <summary>
    /// 验证 Qt WebEngine（Qt 网页引擎）按 file:// 来源发出 CORS（跨源资源共享）预检时也会被允许。
    /// </summary>
    [Fact]
    public async Task ApplyLeaseAndConfigAllowsLiteralQtFileOriginCorsPreflightOnKestrelRuntime()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/applyLeaseAndConfig");

        // PopoY: some Qt WebEngine diagnostics and versions surface the file:// origin literally.
        request.Headers.Add("Origin", "file://");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");

        var response = await (await GetRuntimeClientAsync()).SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        AssertHeaderContains(response, "Access-Control-Allow-Origin", "file://");
        AssertHeaderContains(response, "Access-Control-Allow-Methods", "POST");
        AssertHeaderContains(response, "Access-Control-Allow-Headers", "content-type");
    }

    /// <summary>
    /// 验证 V1 不暴露 /renewLease 端点，避免客户端绕过授权模型。
    /// </summary>
    [Fact]
    public async Task RenewLeaseEndpointDoesNotExist()
    {
        var response = await _client.PostAsJsonAsync("/renewLease", new { leaseToken = "lease-token-001" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>
    /// 获取真实 Kestrel（ASP.NET Core Web 服务器）客户端，确保 runtime（真实运行时）测试不会退化回 TestServer。
    /// </summary>
    /// <returns>指向真实 Kestrel 进程的 HTTP 客户端。</returns>
    private async Task<HttpClient> GetRuntimeClientAsync()
    {
        if (_runtimeClient is not null)
        {
            return _runtimeClient;
        }

        _runtimeHost = await KestrelRuntimeHost.StartAsync();
        _runtimeClient = _runtimeHost.CreateClient();

        return _runtimeClient;
    }

    /// <summary>
    /// 创建带有测试主机身份配置的内存宿主客户端。
    /// </summary>
    /// <param name="publicKeyPem">用于离线验签的 RSA（Rivest-Shamir-Adleman）公钥 PEM。</param>
    /// <param name="hostId">测试主机身份。</param>
    /// <returns>返回配置后的 HTTP 客户端。</returns>
    private HttpClient CreateConfiguredClient(
        string publicKeyPem,
        string hostId,
        string? driverStateConnectionString = null,
        string? driverMode = null)
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                var configuration = new Dictionary<string, string?>
                {
                    ["HostIdentity:PublicKeyPem"] = publicKeyPem,
                    ["HostIdentity:GranteeHostId"] = hostId
                };

                if (!string.IsNullOrWhiteSpace(driverStateConnectionString))
                {
                    configuration["ConnectionStrings:DriverState"] = driverStateConnectionString;
                }

                if (!string.IsNullOrWhiteSpace(driverMode))
                {
                    configuration["Driver:Mode"] = driverMode;
                }

                configurationBuilder.AddInMemoryCollection(configuration);
            });
        }).CreateClient();
    }

    /// <summary>
    /// 构造当前 ERP bootstrap（启动引导）接口返回的占位 applyLease（应用租约）请求。
    /// </summary>
    /// <returns>返回可直接提交给 /applyLeaseAndConfig 的请求对象。</returns>
    private static object CreateErpBootstrapPlaceholderApplyRequest()
    {
        return new
        {
            correlationId = "cid-erp-placeholder-apply-001",
            timeoutMs = 5000,
            signedLease = new
            {
                leaseId = "qt-bootstrap-10-001",
                targetDeviceId = "10",
                targetEndpoint = "driver://pending",
                granteeHostId = "192.168.11.36",
                operatorId = "qt-bootstrap",
                stationId = "10",
                jobId = "bootstrap",
                signalConfigHash = "legacy-hash",
                allowedScopes = new[] { "signal:read" },
                allowedAddressRanges = Array.Empty<string>(),
                issuedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
                notBefore = DateTimeOffset.UtcNow.AddMinutes(-1),
                expiresAt = DateTimeOffset.UtcNow.AddMinutes(15),
                fencingToken = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                signature = "UNSIGNED_BOOTSTRAP_PLACEHOLDER"
            },
            signalConfig = new
            {
                mode = "bootstrap-minimal",
                stationId = "10",
                granteeHostId = "192.168.11.36",
                targetDeviceId = "10",
                signalConfigHash = "legacy-hash"
            }
        };
    }

    /// <summary>
    /// 创建用于测试隔离的临时 Driver state（驱动状态）连接字符串。
    /// </summary>
    /// <returns>返回指向唯一临时 SQLite 文件的连接字符串。</returns>
    private static string CreateTempDriverStateConnectionString()
    {
        return $"Data Source={Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db")}";
    }

    /// <summary>
    /// 创建发送原始 JSON 字符串的请求体，复现 curl（命令行工具）直接提交时的运行时行为。
    /// </summary>
    /// <param name="json">待发送的原始 JSON 字符串。</param>
    /// <returns>带有 application/json 媒体类型的字符串内容。</returns>
    private static StringContent CreateJsonContent(string json)
    {
        return new StringContent(json, Encoding.UTF8, "application/json");
    }

    /// <summary>
    /// 验证租约非法场景统一返回 JSON，并携带 LEASE_INVALID 错误码。
    /// </summary>
    /// <param name="response">待断言的 HTTP 响应。</param>
    /// <param name="expectedStatusCode">期望的 HTTP 状态码。</param>
    /// <param name="expectedMessageFragment">可选的消息片段断言。</param>
    private static async Task AssertLeaseInvalidJsonAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatusCode,
        string? expectedMessageFragment = null)
    {
        Assert.Equal(expectedStatusCode, response.StatusCode);
        Assert.NotNull(response.Content.Headers.ContentType);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        // PopoY: parse the response body only after the transport contract matches the expected JSON shape.
        var payload = JsonSerializer.Deserialize<ContractErrorResponse>(
            await response.Content.ReadAsStringAsync(),
            JsonOptions);

        Assert.NotNull(payload);
        Assert.Equal("LEASE_INVALID", payload.ResultCode);

        if (!string.IsNullOrWhiteSpace(expectedMessageFragment))
        {
            Assert.Contains(expectedMessageFragment, payload.Message);
        }
    }

    /// <summary>
    /// 验证 HTTP response header（响应头）包含目标值。
    /// </summary>
    /// <param name="response">待断言的 HTTP 响应。</param>
    /// <param name="headerName">待读取的 header（响应头）名称。</param>
    /// <param name="expectedValue">期望包含的 header（响应头）值。</param>
    private static void AssertHeaderContains(
        HttpResponseMessage response,
        string headerName,
        string expectedValue)
    {
        Assert.True(response.Headers.TryGetValues(headerName, out var values), $"缺少响应头 {headerName}");
        // PopoY: ASP.NET Core CORS（跨源资源共享）可能把多个 method（方法）合并成一个逗号分隔响应头。
        var headerValues = values.SelectMany(value => value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));
        Assert.Contains(expectedValue, headerValues, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 表示契约测试需要校验的最小错误响应结构。
    /// </summary>
    /// <param name="ResultCode">服务端返回的业务错误码。</param>
    /// <param name="Message">服务端返回的中文错误消息。</param>
    private sealed record ContractErrorResponse(string ResultCode, string Message);

    /// <summary>
    /// 启动和管理真实 Kestrel（ASP.NET Core Web 服务器）进程，确保契约测试覆盖真实 runtime（真实运行时）行为。
    /// </summary>
    private sealed class KestrelRuntimeHost : IAsyncDisposable
    {
        private const int MaxPortBindRetries = 5;
        private readonly Process _process;
        private readonly Uri _baseAddress;

        /// <summary>
        /// 初始化真实 Kestrel（ASP.NET Core Web 服务器）宿主管理器。
        /// </summary>
        /// <param name="process">已启动的 Driver Service 进程。</param>
        /// <param name="logBuffer">用于保留启动与失败日志的缓冲区。</param>
        /// <param name="baseAddress">真实 Kestrel 监听地址。</param>
        private KestrelRuntimeHost(Process process, StringBuilder logBuffer, Uri baseAddress)
        {
            _process = process;
            _baseAddress = baseAddress;
        }

        /// <summary>
        /// 启动一个绑定到空闲端口的真实 Kestrel（ASP.NET Core Web 服务器）实例。
        /// </summary>
        /// <returns>可供测试复用的宿主管理器。</returns>
        public static async Task<KestrelRuntimeHost> StartAsync()
        {
            var applicationAssemblyPath = typeof(Program).Assembly.Location;
            var applicationDirectory = Path.GetDirectoryName(applicationAssemblyPath)
                ?? throw new InvalidOperationException("无法确定 Driver Service 程序集目录。");
            var driverStateConnectionString = CreateTempDriverStateConnectionString();

            Exception? lastException = null;
            string lastLog = string.Empty;

            for (var attempt = 1; attempt <= MaxPortBindRetries; attempt++)
            {
                var port = AllocateFreePort();
                var baseAddress = new Uri($"http://127.0.0.1:{port}");
                var logBuffer = new StringBuilder();
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "dotnet",
                        WorkingDirectory = applicationDirectory,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    }
                };

                process.StartInfo.ArgumentList.Add(applicationAssemblyPath);
                process.StartInfo.Environment["Driver__Port"] = port.ToString();
                process.StartInfo.Environment["ConnectionStrings__DriverState"] = driverStateConnectionString;
                process.OutputDataReceived += (_, args) => AppendLog(logBuffer, args.Data);
                process.ErrorDataReceived += (_, args) => AppendLog(logBuffer, args.Data);

                try
                {
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();

                    await WaitForHealthyAsync(process, baseAddress, logBuffer);
                    return new KestrelRuntimeHost(process, logBuffer, baseAddress);
                }
                catch (Exception exception) when (attempt < MaxPortBindRetries && IsPortBindRace(logBuffer, exception))
                {
                    lastException = exception;
                    lastLog = ReadLog(logBuffer);
                    await DisposeProcessAsync(process);
                }
                catch
                {
                    await DisposeProcessAsync(process);
                    throw;
                }
            }

            throw new InvalidOperationException(
                $"真实 Kestrel 端口绑定在 {MaxPortBindRetries} 次尝试后仍失败。最后异常：{lastException?.Message ?? "无"}{Environment.NewLine}{lastLog}");
        }

        /// <summary>
        /// 创建指向真实 Kestrel（ASP.NET Core Web 服务器）的 HTTP 客户端。
        /// </summary>
        /// <returns>带有真实监听地址的 HTTP 客户端。</returns>
        public HttpClient CreateClient()
        {
            return new HttpClient
            {
                BaseAddress = _baseAddress
            };
        }

        /// <summary>
        /// 停止真实 Kestrel（ASP.NET Core Web 服务器）进程并释放资源。
        /// </summary>
        public async ValueTask DisposeAsync()
        {
            if (!_process.HasExited)
            {
                _process.Kill(entireProcessTree: true);
                await _process.WaitForExitAsync();
            }

            _process.Dispose();
        }

        /// <summary>
        /// 申请一个临时空闲端口，避免测试与本机其他实例冲突。
        /// </summary>
        /// <returns>可供当前测试进程立即使用的本机回环端口。</returns>
        private static int AllocateFreePort()
        {
            using var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }

        /// <summary>
        /// 等待真实 Kestrel（ASP.NET Core Web 服务器）通过 /health 健康检查，若失败则带出日志。
        /// </summary>
        /// <param name="process">待观察的 Driver Service 进程。</param>
        /// <param name="baseAddress">待探测的基地址。</param>
        /// <param name="logBuffer">启动日志缓冲区。</param>
        private static async Task WaitForHealthyAsync(Process process, Uri baseAddress, StringBuilder logBuffer)
        {
            using var healthClient = new HttpClient
            {
                BaseAddress = baseAddress,
                Timeout = TimeSpan.FromMilliseconds(500)
            };

            Exception? lastException = null;
            var deadline = DateTime.UtcNow.AddSeconds(10);

            while (DateTime.UtcNow < deadline)
            {
                if (process.HasExited)
                {
                    throw new InvalidOperationException(
                        $"真实 Kestrel 进程启动后提前退出。日志如下：{Environment.NewLine}{ReadLog(logBuffer)}");
                }

                try
                {
                    using var response = await healthClient.GetAsync("/health");
                    if (response.StatusCode == HttpStatusCode.OK)
                    {
                        return;
                    }
                }
                catch (Exception exception)
                {
                    // PopoY: 启动窗口内允许短暂连接失败，记录最后一次异常即可。
                    lastException = exception;
                }

                await Task.Delay(200);
            }

            throw new TimeoutException(
                $"等待真实 Kestrel 健康检查超时。最后异常：{lastException?.Message ?? "无"}{Environment.NewLine}{ReadLog(logBuffer)}");
        }

        /// <summary>
        /// 判断启动失败是否属于端口检查与实际绑定之间的竞争窗口，命中时允许有限重试。
        /// </summary>
        /// <param name="logBuffer">当前启动尝试的日志缓冲区。</param>
        /// <param name="exception">本轮启动异常。</param>
        /// <returns>命中端口绑定竞争特征时返回 true。</returns>
        private static bool IsPortBindRace(StringBuilder logBuffer, Exception exception)
        {
            var diagnosticText = $"{exception.Message}{Environment.NewLine}{ReadLog(logBuffer)}";

            return diagnosticText.Contains("address already in use", StringComparison.OrdinalIgnoreCase)
                || diagnosticText.Contains("only one usage of each socket address", StringComparison.OrdinalIgnoreCase)
                || diagnosticText.Contains("failed to bind", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 释放失败启动留下的进程资源，避免重试前残留子进程。
        /// </summary>
        /// <param name="process">需要清理的 Driver Service 进程。</param>
        private static async Task DisposeProcessAsync(Process process)
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync();
            }

            process.Dispose();
        }

        /// <summary>
        /// 线程安全地读取日志缓冲区，用于异常诊断和重试判断。
        /// </summary>
        /// <param name="logBuffer">待读取的日志缓冲区。</param>
        /// <returns>当前日志文本快照。</returns>
        private static string ReadLog(StringBuilder logBuffer)
        {
            lock (logBuffer)
            {
                return logBuffer.ToString();
            }
        }

        /// <summary>
        /// 记录真实 Kestrel（ASP.NET Core Web 服务器）进程输出，便于启动失败时定位问题。
        /// </summary>
        /// <param name="logBuffer">日志缓冲区。</param>
        /// <param name="line">当前读取到的日志行。</param>
        private static void AppendLog(StringBuilder logBuffer, string? line)
        {
            if (!string.IsNullOrWhiteSpace(line))
            {
                lock (logBuffer)
                {
                    logBuffer.AppendLine(line);
                }
            }
        }
    }
}

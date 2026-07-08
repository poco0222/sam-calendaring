/**
 * @file DiagnosticLogsApiTests.cs - 验证 diagnostic logs API（诊断日志接口）。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 锁定 GET /diagnosticLogs（诊断日志接口）的查询、CORS（跨源资源共享）和中文错误响应契约。
 */
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 diagnostic logs API（诊断日志接口）的只读查询契约。
/// </summary>
public sealed class DiagnosticLogsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    /// <summary>
    /// 初始化诊断日志接口测试工厂。
    /// </summary>
    /// <param name="factory">ASP.NET Core 测试宿主工厂。</param>
    public DiagnosticLogsApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// 验证接口按 statusClass（状态分类）、category（分类）和 correlationId（关联 ID）返回日志。
    /// </summary>
    [Fact]
    public async Task DiagnosticLogsEndpointReturnsFilteredLogs()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.AppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Error",
            category: "Device",
            eventName: "SignalReadFailed",
            message: "设备通信超时",
            correlationId: "cid-api-001",
            commandName: "getSignalSnapshot",
            resultCode: DriverResultCode.DeviceTimeout), CancellationToken.None);
        await store.AppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "收到驱动请求",
            correlationId: "cid-api-002",
            commandName: "applyLeaseAndConfig",
            resultCode: DriverResultCode.Ok), CancellationToken.None);

        var client = CreateClientWithStore(store);
        var response = await client.GetFromJsonAsync<DiagnosticLogsResponse>(
            "/diagnosticLogs?statusClass=abnormal&category=device&correlationId=cid-api-001&limit=100");

        Assert.NotNull(response);
        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        var log = Assert.Single(response.Logs);
        Assert.Equal("Device", log.Category);
        Assert.Equal("Abnormal", log.StatusClass);
        Assert.Equal("cid-api-001", log.CorrelationId);
    }

    /// <summary>
    /// 验证最近三天 time range（时间范围）查询返回范围内全部日志，不被默认 limit（数量限制）截断。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task DiagnosticLogsEndpointReturnsAllLogsWithinTimeRange()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        var fromUtc = DateTimeOffset.UtcNow.AddDays(-3);
        var toUtc = fromUtc.AddDays(3);
        await store.AppendDiagnosticLogAsync(CreateDiagnosticLog(
            fromUtc.AddSeconds(-1),
            "cid-outside-range"), CancellationToken.None);

        for (var index = 0; index < 501; index++)
        {
            await store.AppendDiagnosticLogAsync(CreateDiagnosticLog(
                fromUtc.AddMinutes(index),
                $"cid-range-{index}"), CancellationToken.None);
        }

        var client = CreateClientWithStore(store);
        var response = await client.GetFromJsonAsync<DiagnosticLogsResponse>(
            $"/diagnosticLogs?statusClass=all&category=all&fromUtc={WebUtility.UrlEncode(fromUtc.ToString("O"))}&toUtc={WebUtility.UrlEncode(toUtc.ToString("O"))}");

        Assert.NotNull(response);
        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal(501, response.Logs.Count);
        Assert.DoesNotContain(response.Logs, entry => entry.CorrelationId == "cid-outside-range");
    }

    /// <summary>
    /// 验证无效查询参数返回中文 JSON（JavaScript Object Notation）错误响应。
    /// </summary>
    [Fact]
    public async Task DiagnosticLogsEndpointRejectsInvalidStatusClassWithChineseJson()
    {
        var client = CreateClientWithStore(SqliteDriverStateStore.CreateTempFileForTests());

        var response = await client.GetAsync("/diagnosticLogs?statusClass=broken");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("请求参数不正确", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Exception", body, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证 CORS（跨源资源共享）允许 Qt WebEngine 的 null origin（空来源）访问 GET 接口。
    /// </summary>
    [Fact]
    public async Task CorsAllowsDiagnosticLogsGetFromNullOrigin()
    {
        var client = CreateClientWithStore(SqliteDriverStateStore.CreateTempFileForTests());
        using var request = new HttpRequestMessage(HttpMethod.Options, "/diagnosticLogs");
        request.Headers.Add("Origin", "null");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins));
        Assert.Contains("null", origins);
    }

    /// <summary>
    /// 验证 audit log（审计日志）写入失败时仍写入失败诊断事件。
    /// </summary>
    [Fact]
    public async Task AuditAppendFailureWritesDiagnosticFailureEvent()
    {
        var store = new AuditFailingStore();
        var client = CreateClientWithStore(store);

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId = "cid-audit-fail-001",
                timeoutMs = 5000,
                signedLease = (object?)null,
                signalConfig = (object?)null
            });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "AuditLogAppendFailed"
            && entry.CorrelationId == "cid-audit-fail-001"
            && entry.ExceptionType == nameof(InvalidOperationException));
        Assert.DoesNotContain(store.DiagnosticLogs, entry =>
            entry.Message.Contains("signedLease", StringComparison.OrdinalIgnoreCase)
            || entry.Message.Contains("signalConfig", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// 验证 JSON Contract（JSON 契约）预验证失败时也写入 Request（请求）诊断链路。
    /// </summary>
    [Fact]
    public async Task InvalidContractJsonWritesRequestDiagnosticEvents()
    {
        var store = new CapturingStore();
        var client = CreateClientWithStore(store);
        const string correlationId = "cid-contract-invalid-001";

        var response = await client.PostAsync(
            "/applyLeaseAndConfig",
            CreateJsonContent("""
                {"correlationId":"cid-contract-invalid-001","timeoutMs":5000,"signedLease":{},"signalConfig":{},"ip":"10.0.0.1"}
                """));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "RequestReceived"
            && entry.CorrelationId == correlationId);
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "RequestContractValidationFailed"
            && entry.CorrelationId == correlationId
            && entry.ResultCode == DriverResultCode.LeaseInvalid
            && entry.StatusClass == "Abnormal");
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "RequestRejected"
            && entry.CorrelationId == correlationId);
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "RequestCompleted"
            && entry.CorrelationId == correlationId
            && entry.HttpStatusCode == StatusCodes.Status400BadRequest);
    }

    /// <summary>
    /// 验证审计日志成功写入时有 Started/Completed（开始/完成）诊断事件。
    /// </summary>
    [Fact]
    public async Task AuditAppendSuccessWritesStartedAndCompletedDiagnosticEvents()
    {
        var store = new CapturingStore();
        var client = CreateClientWithStore(store);
        const string correlationId = "cid-audit-start-001";

        var response = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId,
                timeoutMs = 5000,
                signedLease = (object?)null,
                signalConfig = (object?)null
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "AuditLogAppendStarted"
            && entry.CorrelationId == correlationId);
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "AuditLogAppendCompleted"
            && entry.CorrelationId == correlationId);
    }

    /// <summary>
    /// 使用指定状态存储创建隔离测试客户端。
    /// </summary>
    /// <param name="store">测试注入的状态存储。</param>
    /// <returns>返回配置完成的 HTTP client（客户端）。</returns>
    private HttpClient CreateClientWithStore(IDriverStateStore store)
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Driver:Mode"] = "Mock"
                });
            });
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(store);
                services.AddSingleton<IDriverStateStore>(store);
            });
        }).CreateClient();
    }

    /// <summary>
    /// 创建原始 JSON（JavaScript Object Notation）测试正文。
    /// </summary>
    /// <param name="json">待发送的 JSON 正文。</param>
    /// <returns>返回 HTTP content（正文对象）。</returns>
    private static StringContent CreateJsonContent(string json)
    {
        return new StringContent(json, Encoding.UTF8, "application/json");
    }

    /// <summary>
    /// 创建测试用 diagnostic log（诊断日志）并指定 createdAt（创建时间）。
    /// </summary>
    /// <param name="createdAt">UTC 创建时间。</param>
    /// <param name="correlationId">关联 ID。</param>
    /// <returns>返回测试日志。</returns>
    /// <remarks>@author PopoY</remarks>
    private static DiagnosticLogEntry CreateDiagnosticLog(DateTimeOffset createdAt, string correlationId)
    {
        return new DiagnosticLogEntry(
            createdAt,
            "Information",
            "Request",
            "Normal",
            "RequestReceived",
            "Completed",
            correlationId,
            "applyLeaseAndConfig",
            DriverResultCode.Ok,
            StatusCodes.Status200OK,
            1,
            LeaseState.Active,
            DeviceSessionState.Connected,
            "lease-test",
            "device-test",
            1,
            null,
            "收到驱动请求。");
    }

    /// <summary>
    /// 表示 GET /diagnosticLogs（诊断日志接口）的测试响应。
    /// </summary>
    private sealed record DiagnosticLogsResponse(string ResultCode, IReadOnlyList<DiagnosticLogEntry> Logs);

    /// <summary>
    /// 捕获 audit log（审计日志）与 diagnostic log（诊断日志）的测试状态存储。
    /// </summary>
    private sealed class CapturingStore : IDriverStateStore
    {
        public List<AuditLogEntry> AuditLogs { get; } = [];

        public List<DiagnosticLogEntry> DiagnosticLogs { get; } = [];

        public Task InitializeAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new DriverStateSnapshot(null, 0, LeaseState.None, DeviceSessionState.Disconnected));
        }

        public Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(0L);
        }

        public Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }

        public Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken)
        {
            AuditLogs.Add(entry);
            return Task.CompletedTask;
        }

        public Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken)
        {
            DiagnosticLogs.Add(entry);
            return Task.CompletedTask;
        }

        public Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
        {
            return Task.FromResult(0);
        }

        public Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(
            DiagnosticLogQuery query,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<DiagnosticLogEntry>>(DiagnosticLogs);
        }
    }

    /// <summary>
    /// 模拟 audit log（审计日志）写入失败，同时捕获 diagnostic log（诊断日志）。
    /// </summary>
    private sealed class AuditFailingStore : IDriverStateStore
    {
        public List<DiagnosticLogEntry> DiagnosticLogs { get; } = [];

        public Task InitializeAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new DriverStateSnapshot(null, 0, LeaseState.None, DeviceSessionState.Disconnected));
        }

        public Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(0L);
        }

        public Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }

        public Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken)
        {
            throw new InvalidOperationException("模拟审计日志写入失败，signedLease=secret。");
        }

        public Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken)
        {
            DiagnosticLogs.Add(entry);
            return Task.CompletedTask;
        }

        public Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
        {
            return Task.FromResult(0);
        }

        public Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(
            DiagnosticLogQuery query,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<DiagnosticLogEntry>>(DiagnosticLogs);
        }
    }
}

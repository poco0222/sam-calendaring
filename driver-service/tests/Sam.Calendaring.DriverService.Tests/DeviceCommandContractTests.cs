/**
 * @file DeviceCommandContractTests.cs - 验证 executeDeviceCommand（执行设备命令）请求边界。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 锁定 /executeDeviceCommand 的白名单字段、稳定响应和脱敏日志契约。
 */
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证设备命令 API（应用程序编程接口）只暴露 Task 01 允许的最小请求面。
/// </summary>
public sealed class DeviceCommandContractTests : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly WebApplicationFactory<Program> _factory;

    /// <summary>
    /// 初始化设备命令契约测试工厂。
    /// </summary>
    /// <param name="factory">ASP.NET Core 测试宿主工厂。</param>
    public DeviceCommandContractTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// 验证 /executeDeviceCommand 接受且只需要白名单字段。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_Accepts_OnlyWhitelistFields()
    {
        var client = CreateClientWithStore(new CapturingStore());

        var response = await client.PostAsJsonAsync("/executeDeviceCommand", CreateValidRequest("cid-command-ok-001"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var payload = await ReadJsonAsync(response);
        Assert.Equal("cid-command-ok-001", payload.RootElement.GetProperty("correlationId").GetString());
        Assert.Equal(DriverResultCode.Ok, payload.RootElement.GetProperty("resultCode").GetString());
    }

    /// <summary>
    /// 验证 /executeDeviceCommand 拒绝裸设备和网络字段。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_Rejects_RawDeviceFields()
    {
        var client = CreateClientWithStore(new CapturingStore());

        var response = await client.PostAsync(
            "/executeDeviceCommand",
            CreateJsonContent("""
                {"correlationId":"cid-command-forbidden-001","commandName":"connectMes","localJobSessionId":"job-001","idempotencyKey":"idem-001","timeoutMs":5000,"deviceId":"PLC-01","ip":"10.0.0.1","port":502}
                """));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var payload = await ReadJsonAsync(response);
        Assert.Equal(DriverResultCode.LeaseInvalid, payload.RootElement.GetProperty("resultCode").GetString());
        Assert.Contains("请求字段不允许", payload.RootElement.GetProperty("message").GetString(), StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证未知 commandName（命令名）返回 COMMAND_NOT_ALLOWED（命令不允许）。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_Rejects_UnknownCommandName()
    {
        var store = new CapturingStore();
        var client = CreateClientWithStore(store);

        var response = await client.PostAsJsonAsync(
            "/executeDeviceCommand",
            CreateValidRequest("cid-command-unknown-001") with { CommandName = "openEverything" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var payload = await ReadJsonAsync(response);
        Assert.Equal("COMMAND_NOT_ALLOWED", payload.RootElement.GetProperty("resultCode").GetString());
        Assert.Contains("不在 Driver Service 允许列表", payload.RootElement.GetProperty("message").GetString(), StringComparison.Ordinal);
        var completedLog = Assert.Single(
            store.DiagnosticLogs,
            entry => entry.EventName == "ActionCompleted" && entry.CorrelationId == "cid-command-unknown-001");
        Assert.Contains("动作：未知命令", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("命令名：openEverything", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("结果码：命令未获授权或不在白名单", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("原因：命令不在 Driver Service 允许列表中", completedLog.Message, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证响应包含稳定字段，且不泄露设备或网络字段。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_Returns_StableResponseShape()
    {
        var client = CreateClientWithStore(new CapturingStore());

        var response = await client.PostAsJsonAsync("/executeDeviceCommand", CreateValidRequest("cid-command-shape-001"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var payload = await ReadJsonAsync(response);
        var root = payload.RootElement;

        Assert.Equal(JsonValueKind.String, root.GetProperty("correlationId").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("commandName").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("localJobSessionId").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("idempotencyKey").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("resultCode").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("message").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("leaseState").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("deviceSessionState").ValueKind);
        Assert.Equal(JsonValueKind.Array, root.GetProperty("completedSteps").ValueKind);
        Assert.Equal(JsonValueKind.Array, root.GetProperty("failedSteps").ValueKind);
        Assert.False(root.TryGetProperty("deviceId", out _));
        Assert.False(root.TryGetProperty("ip", out _));
        Assert.False(root.TryGetProperty("port", out _));
        Assert.False(root.TryGetProperty("registerAddress", out _));
        Assert.False(root.TryGetProperty("writeValue", out _));
    }

    /// <summary>
    /// 验证成功请求会写入 request/action/response（请求/动作/响应）诊断链路和审计日志。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_Writes_RequestResponseAudit()
    {
        var store = new CapturingStore();
        var client = CreateClientWithStore(store);
        const string correlationId = "cid-command-audit-001";

        var response = await client.PostAsJsonAsync("/executeDeviceCommand", CreateValidRequest(correlationId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var audit = Assert.Single(store.AuditLogs);
        Assert.Equal(correlationId, audit.CorrelationId);
        Assert.Equal("connectMes", audit.CommandName);
        Assert.Equal(DriverResultCode.Ok, audit.ResultCode);
        Assert.Contains(store.DiagnosticLogs, entry => entry.EventName == "RequestReceived" && entry.CorrelationId == correlationId);
        var startedLog = Assert.Single(
            store.DiagnosticLogs,
            entry => entry.EventName == "ActionStarted" && entry.CorrelationId == correlationId);
        Assert.Contains("动作：建立通信", startedLog.Message, StringComparison.Ordinal);
        Assert.Contains("命令名：connectMes", startedLog.Message, StringComparison.Ordinal);
        var completedLog = Assert.Single(
            store.DiagnosticLogs,
            entry => entry.EventName == "ActionCompleted" && entry.CorrelationId == correlationId);
        Assert.Contains("动作：建立通信", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("命令名：connectMes", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("结果码：请求执行成功", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains(store.DiagnosticLogs, entry => entry.EventName == "ResponseSent" && entry.CorrelationId == correlationId);
    }

    /// <summary>
    /// 验证租约 scope（作用域）拒绝时，诊断日志说明能直接指出具体授权原因。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task ExecuteDeviceCommand_Logs_ScopeRejectionReason()
    {
        var store = new CapturingStore(["pressWorking.deviceActions.moveIn"]);
        var client = CreateClientWithStore(store);
        const string correlationId = "cid-command-scope-rejected-001";

        var response = await client.PostAsJsonAsync("/executeDeviceCommand", CreateValidRequest(correlationId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var completedLog = Assert.Single(
            store.DiagnosticLogs,
            entry => entry.EventName == "ActionCompleted" && entry.CorrelationId == correlationId);
        Assert.Contains("动作：建立通信", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("命令名：connectMes", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("结果码：命令未获授权或不在白名单", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("原因：命令不在租约授权范围内", completedLog.Message, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证 /precheckDeviceCommand 会在不执行设备写入前返回 signal write authorization（信号写入授权）失败。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task PrecheckDeviceCommand_ReturnsSignalNotWritable_WhenOptionalSignalNotWritable()
    {
        var store = new CapturingStore(signalConfigJson:
            """{"signals":[{"name":"MES通信状态","signalName":"MES通信状态","registerAddress":10,"registerType":"1","writable":true},{"name":"下压计数清零","signalName":"下压计数清零","registerAddress":11,"registerType":"1","writable":true},{"name":"开始信号","signalName":"开始信号","registerAddress":12,"registerType":"1","writable":false}]}""");
        var client = CreateClientWithStore(store);
        const string correlationId = "cid-command-precheck-unwritable-001";

        var response = await client.PostAsJsonAsync(
            "/precheckDeviceCommand",
            CreateValidRequest(correlationId) with
            {
                CommandName = "startDeviceSession",
                IdempotencyKey = "press-start-precheck-001"
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var payload = await ReadJsonAsync(response);
        var root = payload.RootElement;
        Assert.Equal(DriverResultCode.SignalNotWritable, root.GetProperty("resultCode").GetString());
        Assert.Empty(root.GetProperty("completedSteps").EnumerateArray());
        Assert.Equal("开始信号", Assert.Single(root.GetProperty("failedSteps").EnumerateArray()).GetString());
        Assert.False(root.TryGetProperty("deviceId", out _));
        Assert.False(root.TryGetProperty("ip", out _));
        Assert.False(root.TryGetProperty("port", out _));
        Assert.False(root.TryGetProperty("registerAddress", out _));
        Assert.False(root.TryGetProperty("writeValue", out _));
        var completedLog = Assert.Single(
            store.DiagnosticLogs,
            entry => entry.EventName == "ActionCompleted" && entry.CorrelationId == correlationId);
        Assert.Contains("动作：启动设备会话", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("命令名：startDeviceSession", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("结果码：信号不可写", completedLog.Message, StringComparison.Ordinal);
        Assert.Contains("原因：信号不可写", completedLog.Message, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证敏感字段不会进入 audit log（审计日志）或 diagnostic log（诊断日志）。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_DoesNotLogSensitiveFields()
    {
        var store = new CapturingStore();
        var client = CreateClientWithStore(store);

        var response = await client.PostAsync(
            "/executeDeviceCommand",
            CreateJsonContent("""
                {"correlationId":"cid-command-sensitive-001","commandName":"connectMes","localJobSessionId":"job-001","idempotencyKey":"idem-001","timeoutMs":5000,"signedLease":"secret","signature":"secret","signalConfig":{},"sessionToken":"secret","privateKey":"secret","credential":"secret","deviceId":"PLC-01","ip":"10.0.0.1","port":502,"registerAddress":1,"writeValue":1}
                """));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var payload = await ReadJsonAsync(response);
        Assert.Equal("cid-command-sensitive-001", payload.RootElement.GetProperty("correlationId").GetString());
        var audit = Assert.Single(store.AuditLogs);
        Assert.Equal("cid-command-sensitive-001", audit.CorrelationId);
        Assert.Equal("executeDeviceCommand", audit.CommandName);
        Assert.Equal(DriverResultCode.LeaseInvalid, audit.ResultCode);
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "RequestReceived"
            && entry.CorrelationId == "cid-command-sensitive-001");
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "ActionStarted"
            && entry.CorrelationId == "cid-command-sensitive-001");
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "ActionCompleted"
            && entry.CorrelationId == "cid-command-sensitive-001");
        Assert.Contains(store.DiagnosticLogs, entry =>
            entry.EventName == "ResponseSent"
            && entry.CorrelationId == "cid-command-sensitive-001");
        var combinedLogs = string.Join(
            '\n',
            store.AuditLogs
                .Where(static entry => entry.CorrelationId == "cid-command-sensitive-001")
                .Select(static entry => JsonSerializer.Serialize(entry, JsonOptions))
                .Concat(store.DiagnosticLogs
                    .Where(static entry => entry.CorrelationId == "cid-command-sensitive-001")
                    .Select(static entry => JsonSerializer.Serialize(entry, JsonOptions))));
        foreach (var sensitiveField in SensitiveFields)
        {
            Assert.DoesNotContain($"\"{sensitiveField}\"", combinedLogs, StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// 创建白名单请求对象，保持测试输入不包含裸设备字段。
    /// </summary>
    /// <param name="correlationId">关联 ID。</param>
    /// <returns>返回测试请求。</returns>
    private static ExecuteDeviceCommandRequest CreateValidRequest(string correlationId)
    {
        return new ExecuteDeviceCommandRequest
        {
            CorrelationId = correlationId,
            CommandName = "connectMes",
            LocalJobSessionId = "press-device-action-001",
            IdempotencyKey = "press-connect-001",
            TimeoutMs = 5000
        };
    }

    /// <summary>
    /// 读取 JSON 响应并断言响应体格式正确。
    /// </summary>
    /// <param name="response">HTTP 响应。</param>
    /// <returns>返回 JSON 文档。</returns>
    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(content);
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
    /// 使用指定状态存储创建隔离 HTTP client（客户端）。
    /// </summary>
    /// <param name="store">测试注入的状态存储。</param>
    /// <returns>返回配置完成的客户端。</returns>
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
    /// Task 01 禁止落入日志的敏感字段名。
    /// </summary>
    private static readonly string[] SensitiveFields =
    [
        "signedLease",
        "signature",
        "signalConfig",
        "sessionToken",
        "privateKey",
        "credential",
        "deviceId",
        "ip",
        "port",
        "registerAddress",
        "writeValue"
    ];

    /// <summary>
    /// 捕获 audit log（审计日志）与 diagnostic log（诊断日志）的测试状态存储。
    /// </summary>
    private sealed class CapturingStore : IDriverStateStore
    {
        private DriverStateSnapshot _snapshot;

        /// <summary>
        /// 初始化测试状态存储，可按用例覆盖租约 allowedScopes（授权范围）。
        /// </summary>
        /// <param name="allowedScopes">租约允许的 scope（作用域）列表。</param>
        /// <param name="signalConfigJson">可选 signalConfig（信号配置）JSON。</param>
        /// <remarks>@author PopoY</remarks>
        public CapturingStore(IReadOnlyList<string>? allowedScopes = null, string? signalConfigJson = null)
        {
            _snapshot = new DriverStateSnapshot(
                new ActiveLeaseSummary(
                "lease-001",
                "press-001",
                "192.168.19.110:502",
                signalConfigJson ?? """{"signals":[{"name":"MES通信状态","signalName":"MES通信状态","registerAddress":10,"registerType":"1","writable":true},{"name":"下压计数清零","signalName":"下压计数清零","registerAddress":11,"registerType":"1","writable":true}]}""",
                ["1-120"],
                10,
                DateTimeOffset.UtcNow.AddMinutes(10),
                LeaseState.Active,
                DeviceSessionState.Connected)
                {
                    AllowedScopes = allowedScopes ?? ["pressWorking.deviceActions"]
                },
                10,
                LeaseState.Active,
                DeviceSessionState.Connected);
        }

        public List<AuditLogEntry> AuditLogs { get; } = [];

        public List<DiagnosticLogEntry> DiagnosticLogs { get; } = [];

        public Task InitializeAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(_snapshot);
        }

        public Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(0L);
        }

        public Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken)
        {
            _snapshot = new DriverStateSnapshot(summary, summary.FencingToken, summary.LeaseState, summary.DeviceSessionState);
            return Task.FromResult(true);
        }

        public Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken)
        {
            _snapshot = snapshot;
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
}

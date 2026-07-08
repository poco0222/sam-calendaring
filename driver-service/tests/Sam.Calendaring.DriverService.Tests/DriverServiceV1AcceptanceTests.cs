/**
 * @file DriverServiceV1AcceptanceTests.cs - 验证 Driver Service V1（驱动服务第一版）验收场景。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 以最小验收测试锁定 applyLeaseAndConfig 授权更新 + getSignalSnapshot 自动连接读取的串联成功路径。
 */
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 Driver Service V1 在有效租约场景下的最小串联成功路径。
/// </summary>
public sealed class DriverServiceV1AcceptanceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly WebApplicationFactory<Program> _factory;

    /// <summary>
    /// 初始化验收测试使用的宿主工厂。
    /// </summary>
    /// <param name="factory">用于创建测试客户端的宿主工厂。</param>
    public DriverServiceV1AcceptanceTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// 验证有效 signedLease（签名租约）与 signalConfig（信号配置）可先更新授权，再由快照读取连接设备。
    /// @author PopoY
    /// </summary>
    [Fact]
    public async Task ApplyLeaseThenGetSignalSnapshotReturnsOkDisconnectedThenSignalValues()
    {
        var fixture = TestLeaseFactory.CreateValidLease(referenceNow: DateTimeOffset.UtcNow);
        var connectionString = CreateTempDriverStateConnectionString();
        const string correlationId = "cid-task6-001";
        using var client = CreateConfiguredClient(fixture.PublicKeyPem, "SAM-LOCAL-HOST", connectionString);
        using var signedLeaseDocument = JsonDocument.Parse(fixture.SignedLease);
        using var signalConfigDocument = JsonDocument.Parse(fixture.SignalConfig);

        var applyResponse = await client.PostAsJsonAsync(
            "/applyLeaseAndConfig",
            new
            {
                correlationId,
                timeoutMs = 5000,
                signedLease = signedLeaseDocument.RootElement.Clone(),
                signalConfig = signalConfigDocument.RootElement.Clone()
            });
        var applyPayload = await applyResponse.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.OK, applyResponse.StatusCode);
        Assert.NotNull(applyPayload);
        Assert.Equal(DriverResultCode.Ok, applyPayload.ResultCode);
        Assert.Equal(LeaseState.Active, applyPayload.LeaseState);
        Assert.Equal(DeviceSessionState.Disconnected, applyPayload.DeviceSessionState);
        Assert.Equal(correlationId, applyPayload.CorrelationId);

        var snapshotResponse = await client.PostAsJsonAsync(
            "/getSignalSnapshot",
            new
            {
                correlationId,
                timeoutMs = 5000
            });
        var snapshotPayload = await snapshotResponse.Content.ReadFromJsonAsync<GetSignalSnapshotResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.OK, snapshotResponse.StatusCode);
        Assert.NotNull(snapshotPayload);
        Assert.Equal(DriverResultCode.Ok, snapshotPayload.ResultCode);
        Assert.Equal(correlationId, snapshotPayload.CorrelationId);
        Assert.NotNull(snapshotPayload.SignalValues);
        Assert.NotEmpty(snapshotPayload.SignalValues);

        var store = new SqliteDriverStateStore(connectionString);
        var driverSnapshot = await store.LoadSnapshotAsync(CancellationToken.None);
        var auditLogs = await store.ReadAuditLogsForTestsAsync(CancellationToken.None);

        Assert.Equal(DeviceSessionState.Connected, driverSnapshot.DeviceSessionState);

        Assert.Contains(auditLogs, log =>
            log.CommandName == "applyLeaseAndConfig"
            && log.CorrelationId == correlationId
            && log.ResultCode == DriverResultCode.Ok);
        Assert.Contains(auditLogs, log =>
            log.CommandName == "getSignalSnapshot"
            && log.CorrelationId == correlationId
            && log.ResultCode == DriverResultCode.Ok);

        var diagnosticLogs = await store.QueryDiagnosticLogsAsync(
            new DiagnosticLogQuery("all", "all", correlationId, 100),
            CancellationToken.None);

        Assert.Contains(diagnosticLogs, entry => entry.EventName == "RequestReceived");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "ApplyLeaseStarted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "ValidateLeaseStarted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "ValidateLeaseCompleted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "SaveLeaseStarted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "SaveLeaseCompleted");
        Assert.DoesNotContain(diagnosticLogs, entry => entry.EventName == "ConnectActiveLeaseStarted");
        Assert.DoesNotContain(diagnosticLogs, entry => entry.EventName == "ConnectActiveLeaseCompleted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "GetSignalSnapshotStarted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "DeviceConnectStarted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "DeviceConnectCompleted");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "ResponseSent");
        Assert.Contains(diagnosticLogs, entry => entry.EventName == "AuditLogAppendCompleted");
    }

    /// <summary>
    /// 创建带有测试主机身份和状态库路径的客户端。
    /// </summary>
    /// <param name="publicKeyPem">离线验签使用的公钥 PEM。</param>
    /// <param name="hostId">当前测试主机身份。</param>
    /// <param name="driverStateConnectionString">测试隔离使用的 SQLite 连接串。</param>
    /// <returns>返回配置后的测试客户端。</returns>
    private HttpClient CreateConfiguredClient(string publicKeyPem, string hostId, string driverStateConnectionString)
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["HostIdentity:PublicKeyPem"] = publicKeyPem,
                    ["HostIdentity:GranteeHostId"] = hostId,
                    ["ConnectionStrings:DriverState"] = driverStateConnectionString,
                    // PopoY: acceptance test（验收测试）只验证 API 串联，不依赖现场 Real Modbus（真实设备）在线。
                    ["Driver:Mode"] = "Mock"
                });
            });
        }).CreateClient();
    }

    /// <summary>
    /// 创建测试隔离使用的临时 SQLite 连接串。
    /// </summary>
    /// <returns>返回指向唯一临时数据库文件的连接串。</returns>
    private static string CreateTempDriverStateConnectionString()
    {
        return $"Data Source={Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db")}";
    }
}

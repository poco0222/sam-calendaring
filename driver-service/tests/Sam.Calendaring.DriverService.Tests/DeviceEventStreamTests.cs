/**
 * @file DeviceEventStreamTests.cs - 验证 Driver device event stream（设备事件流）。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 锁定 GET /deviceEvents/stream 的 SSE（服务器发送事件）格式、查询参数边界和断开诊断脱敏规则。
 */
using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证设备事件流只提供单向 SSE（服务器发送事件），不要求 query string（查询字符串）携带敏感令牌。
/// </summary>
public sealed class DeviceEventStreamTests : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly WebApplicationFactory<Program> _factory;

    /// <summary>
    /// 初始化事件流测试工厂。
    /// </summary>
    /// <param name="factory">ASP.NET Core 测试宿主工厂。</param>
    public DeviceEventStreamTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// 验证 SSE（服务器发送事件）端点会输出 event/id/data 帧。
    /// </summary>
    [Fact]
    public async Task DeviceEventsStream_SendsSseFrames()
    {
        var factory = CreateFactory(new CapturingStore());
        var client = factory.CreateClient();
        var hub = factory.Services.GetRequiredService<DeviceEventHub>();
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        using var response = await client.GetAsync(
            "/deviceEvents/stream?correlationId=cid-stream-001",
            HttpCompletionOption.ResponseHeadersRead,
            timeoutCts.Token);
        await hub.PublishAsync(CreateThresholdEvent("cid-stream-001"), timeoutCts.Token);

        var frame = await ReadUntilEventFrameAsync(response, "pressDownCountThresholdReached", timeoutCts.Token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("event: pressDownCountThresholdReached", frame, StringComparison.Ordinal);
        Assert.Contains("data:", frame, StringComparison.Ordinal);
        Assert.Contains("parameterIdempotencyKey", frame, StringComparison.Ordinal);
    }

    /// <summary>
    /// @author PopoY
    /// 验证 signalSnapshotChanged（信号快照变化）作为 named SSE event（命名服务器发送事件）输出。
    /// </summary>
    [Fact]
    public async Task DeviceEventsStream_SendsSignalSnapshotChangedFrame()
    {
        var factory = CreateFactory(new CapturingStore());
        var client = factory.CreateClient();
        var hub = factory.Services.GetRequiredService<DeviceEventHub>();
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        using var response = await client.GetAsync(
            "/deviceEvents/stream?correlationId=cid-snapshot-stream-001",
            HttpCompletionOption.ResponseHeadersRead,
            timeoutCts.Token);
        await hub.PublishAsync(new DeviceEventStreamItem
        {
            EventId = "evt-snapshot-001",
            CorrelationId = "signal-snapshot-publisher-001",
            EventName = DeviceEventNames.SignalSnapshotChanged,
            CommandName = "signalSnapshotPublisher",
            ResultCode = DriverResultCode.Ok,
            OccurredAt = DateTimeOffset.UtcNow,
            SnapshotValues = [new DeviceEventSnapshotValue("pressure", 100)]
        }, timeoutCts.Token);

        var frame = await ReadUntilEventFrameAsync(response, "signalSnapshotChanged", timeoutCts.Token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("event: signalSnapshotChanged", frame, StringComparison.Ordinal);
        Assert.Contains("snapshotValues", frame, StringComparison.Ordinal);
        Assert.DoesNotContain("signalConfig", frame, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("targetEndpoint", frame, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("registerAddress", frame, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证事件流不需要 token（令牌）或 lease（租约）作为查询参数。
    /// </summary>
    [Fact]
    public async Task DeviceEventsStream_DoesNotUseTokenOrLeaseInQuery()
    {
        var client = CreateFactory(new CapturingStore()).CreateClient();
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        using var response = await client.GetAsync(
            "/deviceEvents/stream?correlationId=cid-stream-no-token",
            HttpCompletionOption.ResponseHeadersRead,
            timeoutCts.Token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
    }

    /// <summary>
    /// 验证事件流断开时 diagnostic log（诊断日志）不记录完整 query string（查询字符串）。
    /// </summary>
    [Fact]
    public async Task DeviceEventsStream_LogsDisconnectWithoutQueryString()
    {
        var store = new CapturingStore();
        var client = CreateFactory(store).CreateClient();
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));

        try
        {
            using var response = await client.GetAsync(
                "/deviceEvents/stream?correlationId=cid-stream-disconnect&sessionToken=secret&signedLease=secret",
                HttpCompletionOption.ResponseHeadersRead,
                timeoutCts.Token);
            await response.Content.ReadAsStringAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException)
        {
            // PopoY: 测试主动取消长连接，只关心 finally（最终）阶段写入的断开诊断。
        }

        await WaitForDisconnectLogAsync(store, TimeSpan.FromSeconds(2));

        DiagnosticLogEntry[] logs;
        lock (store.DiagnosticLogs)
        {
            logs = store.DiagnosticLogs.ToArray();
        }

        var combinedLogs = string.Join('\n', logs.Select(static entry => JsonSerializer.Serialize(entry, JsonOptions)));
        Assert.Contains("DeviceEventStreamDisconnected", combinedLogs, StringComparison.Ordinal);
        Assert.DoesNotContain("sessionToken", combinedLogs, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signedLease", combinedLogs, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secret", combinedLogs, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证慢 subscriber（订阅者）不会阻塞 event hub（事件中心）发布高价值事件。
    /// </summary>
    [Fact]
    public async Task DeviceEventHub_DoesNotBlockPublish_WhenSubscriberIsSlow()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        using var subscriberCts = new CancellationTokenSource();
        await using var enumerator = hub.SubscribeAsync(subscriberCts.Token).GetAsyncEnumerator();
        var firstReadTask = enumerator.MoveNextAsync().AsTask();
        var publishTasks = Enumerable.Range(0, 100)
            .Select(index => hub.PublishAsync(CreateThresholdEvent($"cid-slow-{index}"), CancellationToken.None))
            .ToArray();

        await Task.WhenAny(Task.WhenAll(publishTasks), Task.Delay(TimeSpan.FromSeconds(1)));

        Assert.True(Task.WhenAll(publishTasks).IsCompletedSuccessfully, "慢 SSE subscriber（订阅者）不得阻塞 publish（发布）。");
        subscriberCts.Cancel();
        try
        {
            await firstReadTask;
        }
        catch (OperationCanceledException)
        {
            // PopoY: 只释放未消费的订阅枚举器，取消属于预期路径。
        }
    }

    /// <summary>
    /// @author PopoY
    /// 验证 DeviceEventHub（设备事件中心）能暴露当前 subscriber（订阅者）状态。
    /// </summary>
    [Fact]
    public async Task DeviceEventHub_ReportsSubscriberGate()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));

        Assert.False(hub.HasSubscribers);

        using var subscriberCts = new CancellationTokenSource();
        await using var enumerator = hub.SubscribeAsync(subscriberCts.Token).GetAsyncEnumerator();
        var pendingRead = enumerator.MoveNextAsync().AsTask();

        Assert.True(hub.HasSubscribers);

        subscriberCts.Cancel();
        try
        {
            await pendingRead;
        }
        catch (OperationCanceledException)
        {
            // @author PopoY: 测试主动取消长连接，只验证 subscriber gate（订阅者门控）。
        }
    }

    /// <summary>
    /// 等待 SSE（服务器发送事件）断开诊断落入测试状态存储。
    /// </summary>
    /// <param name="store">测试状态存储。</param>
    /// <param name="timeout">最长等待时间。</param>
    private static async Task WaitForDisconnectLogAsync(CapturingStore store, TimeSpan timeout)
    {
        var deadline = DateTimeOffset.UtcNow.Add(timeout);
        while (DateTimeOffset.UtcNow < deadline)
        {
            lock (store.DiagnosticLogs)
            {
                if (store.DiagnosticLogs.Any(static entry => entry.EventName == "DeviceEventStreamDisconnected"))
                {
                    return;
                }
            }

            await Task.Delay(10);
        }
    }

    /// <summary>
    /// 创建带测试状态存储的 WebApplicationFactory（测试宿主工厂）。
    /// </summary>
    /// <param name="store">测试状态存储。</param>
    /// <returns>返回测试宿主工厂。</returns>
    private WebApplicationFactory<Program> CreateFactory(IDriverStateStore store)
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
        });
    }

    /// <summary>
    /// 创建阈值事件测试载荷。
    /// </summary>
    /// <param name="correlationId">关联 ID。</param>
    /// <returns>返回事件对象。</returns>
    private static DeviceEventStreamItem CreateThresholdEvent(string correlationId)
    {
        return new DeviceEventStreamItem
        {
            EventId = "evt-001",
            CorrelationId = correlationId,
            LocalJobSessionId = "press-job-001",
            EventName = DeviceEventNames.PressDownCountThresholdReached,
            CommandName = "startPressDownCountMonitor",
            ResultCode = DriverResultCode.Ok,
            PressDownCount = 5,
            Threshold = 5,
            ParameterIdempotencyKey = "parameter-start-press-job-001",
            OccurredAt = DateTimeOffset.UtcNow,
            SnapshotValues = [new DeviceEventSnapshotValue("PRESS_DOWN_COUNT", 5)]
        };
    }

    /// <summary>
    /// 读取 SSE（服务器发送事件）响应直到包含目标文本。
    /// </summary>
    /// <param name="response">HTTP 响应。</param>
    /// <param name="expected">目标文本。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回累计帧文本。</returns>
    private static async Task<string> ReadUntilEventFrameAsync(
        HttpResponseMessage response,
        string expected,
        CancellationToken cancellationToken)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);
        var buffer = new List<string>();

        var foundExpected = false;
        while (true)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line is null)
            {
                break;
            }

            buffer.Add(line);
            var text = string.Join('\n', buffer);
            foundExpected = foundExpected || text.Contains(expected, StringComparison.Ordinal);
            if (foundExpected && string.IsNullOrEmpty(line))
            {
                return text;
            }
        }

        throw new TimeoutException("未读取到预期 SSE 帧。");
    }

    /// <summary>
    /// 捕获 diagnostic log（诊断日志）的最小状态存储。
    /// </summary>
    private sealed class CapturingStore : IDriverStateStore
    {
        private DriverStateSnapshot _snapshot = new(
            new ActiveLeaseSummary(
                "lease-001",
                "press-001",
                "192.168.19.110:502",
                """{"signals":[{"name":"下压计数","signalName":"下压计数","signalCode":"PRESS_DOWN_COUNT","registerAddress":12,"registerType":"1"}]}""",
                ["1-120"],
                10,
                DateTimeOffset.UtcNow.AddMinutes(10),
                LeaseState.Active,
                DeviceSessionState.Connected)
            {
                AllowedScopes = ["pressWorking.deviceActions"]
            },
            10,
            LeaseState.Active,
            DeviceSessionState.Connected);

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
            lock (DiagnosticLogs)
            {
                DiagnosticLogs.Add(entry);
            }

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

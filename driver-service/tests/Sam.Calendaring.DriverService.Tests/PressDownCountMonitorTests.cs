/**
 * @file PressDownCountMonitorTests.cs - 验证 pressDownCountMonitor（下压计数监测）。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 以 TDD（测试驱动开发）锁定 Driver-owned monitor（驱动侧监测）的生命周期、阈值事件和脱敏快照边界。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Monitoring;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.State;
using Sam.Calendaring.DriverService.Domain;
using System.Text.Json;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证下压计数监测只能由 Driver Service（驱动服务）读取授权点位并发送安全事件。
/// </summary>
public sealed class PressDownCountMonitorTests
{
    /// <summary>
    /// 验证计数达到五次时发送一次 threshold reached（阈值达到）事件。
    /// </summary>
    [Fact]
    public async Task Monitor_EmitsThresholdReached_WhenCountReachesFive()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        var monitor = await CreateMonitorAsync(new SequenceReadModbusAdapter(0, 2, 5), hub);

        var thresholdTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountThresholdReached,
            TimeSpan.FromSeconds(3));
        var response = await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);
        var thresholdEvent = await thresholdTask;

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal(5, thresholdEvent.PressDownCount);
        Assert.Equal(PressDownCountMonitorService.Threshold, thresholdEvent.Threshold);
        Assert.False(string.IsNullOrWhiteSpace(thresholdEvent.ParameterIdempotencyKey));
    }

    /// <summary>
    /// 验证缺少 下压计数 signalName（信号名）时返回 SIGNAL_NOT_CONFIGURED（信号未配置）。
    /// </summary>
    [Fact]
    public async Task Monitor_ReturnsSignalNotConfigured_WhenPressDownCountMissing()
    {
        var monitor = await CreateMonitorAsync(
            new SequenceReadModbusAdapter(0),
            signalConfigJson: """{"signals":[{"name":"pressure","semanticKey":"pressure","signalCode":"P001","registerAddress":10,"registerType":"1"}]}""");

        var response = await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);

        Assert.Equal(DriverResultCode.SignalNotConfigured, response.ResultCode);
    }

    /// <summary>
    /// 验证同一个 localJobSessionId（本地作业会话 ID）重复启动会返回 MONITOR_ALREADY_RUNNING（监测已运行）。
    /// </summary>
    [Fact]
    public async Task Monitor_ReturnsMonitorAlreadyRunning_ForDuplicateStart()
    {
        var monitor = await CreateMonitorAsync(
            new SequenceReadModbusAdapter(0, 0, 0),
            options: new DriverOptions { PressDownCountPollIntervalMs = 100, PressDownCountMaxDurationMs = 1000 });
        var request = CreateRequest("startPressDownCountMonitor");

        var first = await monitor.StartAsync(request, CancellationToken.None);
        var second = await monitor.StartAsync(request with { IdempotencyKey = "idem-monitor-duplicate" }, CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, first.ResultCode);
        Assert.Equal(DriverResultCode.MonitorAlreadyRunning, second.ResultCode);
    }

    /// <summary>
    /// 验证未达到阈值时发送 MONITOR_TIMEOUT（监测超时）失败事件并停止。
    /// </summary>
    [Fact]
    public async Task Monitor_ReturnsMonitorTimeout_WhenThresholdNotReached()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        var monitor = await CreateMonitorAsync(
            new SequenceReadModbusAdapter(0, 1, 2),
            hub,
            options: new DriverOptions { PressDownCountPollIntervalMs = 5, PressDownCountMaxDurationMs = 25 });

        var failedTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountMonitorFailed,
            TimeSpan.FromSeconds(3));
        await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);
        var failedEvent = await failedTask;

        Assert.Equal(DriverResultCode.MonitorTimeout, failedEvent.ResultCode);
    }

    /// <summary>
    /// 验证 rollback/cleanup/explicit stop（回滚/收尾/显式停止）会停止监测。
    /// </summary>
    [Fact]
    public async Task Monitor_Stops_OnRollbackCleanupOrExplicitStop()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        var monitor = await CreateMonitorAsync(
            new SequenceReadModbusAdapter(0, 0, 0),
            hub,
            options: new DriverOptions { PressDownCountPollIntervalMs = 100, PressDownCountMaxDurationMs = 1000 });

        var stoppedTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountMonitorStopped,
            TimeSpan.FromSeconds(3));
        await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);
        var response = await monitor.StopAsync(CreateRequest("stopPressDownCountMonitor"), CancellationToken.None);
        var stoppedEvent = await stoppedTask;

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal("press-job-001", stoppedEvent.LocalJobSessionId);
    }

    /// <summary>
    /// 验证事件快照只包含 safe signal code（安全信号码）和值，不包含原始 signalConfig（信号配置）或 Modbus（工业通信协议）地址。
    /// </summary>
    [Fact]
    public async Task Monitor_EmitsNarrowedSnapshot_WithoutRawSignalConfig()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        var monitor = await CreateMonitorAsync(new SequenceReadModbusAdapter(5), hub);

        var thresholdTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountThresholdReached,
            TimeSpan.FromSeconds(3));
        await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);
        var thresholdEvent = await thresholdTask;

        var snapshot = Assert.Single(thresholdEvent.SnapshotValues);
        Assert.Equal("PRESS_DOWN_COUNT", snapshot.SignalCode);
        Assert.Equal(5, snapshot.Value);
        Assert.DoesNotContain(thresholdEvent.SnapshotValues, value => value.GetType().GetProperty("RegisterAddress") is not null);
        Assert.DoesNotContain(thresholdEvent.SnapshotValues, value => value.GetType().GetProperty("DeviceId") is not null);
    }

    /// <summary>
    /// 验证缺少 signalCode（信号编码）时使用 signalName（信号名）作为安全信号码，不回退到 Modbus address（地址）。
    /// </summary>
    [Fact]
    public async Task Monitor_UsesSignalNameAsSafeSignalCode_WhenSignalCodeMissing()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        var monitor = await CreateMonitorAsync(
            new SequenceReadModbusAdapter(5),
            hub,
            signalConfigJson: """{"signals":[{"signalName":"下压计数","registerAddress":12,"registerType":"1"}]}""");

        var thresholdTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountThresholdReached,
            TimeSpan.FromSeconds(3));
        await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);
        var thresholdEvent = await thresholdTask;

        var snapshot = Assert.Single(thresholdEvent.SnapshotValues);
        Assert.Equal("下压计数", snapshot.SignalCode);
        Assert.DoesNotContain("12", snapshot.SignalCode, StringComparison.Ordinal);
        Assert.DoesNotContain("signal-", snapshot.SignalCode, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证 signalCode（信号编码）命中 forbidden identifier（禁止标识）时 SSE payload（服务器发送事件载荷）回退到 signalName（信号名）。
    /// </summary>
    /// <author>PopoY</author>
    /// <param name="forbiddenSignalCode">禁止出现在事件载荷中的 signalCode（信号编码）。</param>
    [Theory]
    [InlineData("deviceId")]
    [InlineData("registerAddress")]
    [InlineData("ip")]
    [InlineData("port")]
    [InlineData("signalConfig")]
    [InlineData("signedLease")]
    [InlineData("signature")]
    [InlineData("sessionToken")]
    [InlineData("privateKey")]
    [InlineData("credential")]
    [InlineData("targetEndpoint")]
    [InlineData("writeValue")]
    public async Task Monitor_UsesSignalNameAsSafeSignalCode_WhenSignalCodeIsForbiddenIdentifier(string forbiddenSignalCode)
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        var signalConfigJson = $$"""{"signals":[{"signalName":"下压计数","signalCode":"{{forbiddenSignalCode}}","registerAddress":12,"registerType":"1"}]}""";
        var monitor = await CreateMonitorAsync(new SequenceReadModbusAdapter(5), hub, signalConfigJson: signalConfigJson);

        var thresholdTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountThresholdReached,
            TimeSpan.FromSeconds(3));
        await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);
        var thresholdEvent = await thresholdTask;

        var snapshot = Assert.Single(thresholdEvent.SnapshotValues);
        var payload = JsonSerializer.Serialize(thresholdEvent);
        Assert.Equal("下压计数", snapshot.SignalCode);
        Assert.DoesNotContain($"\"{forbiddenSignalCode}\"", payload, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证达到阈值后除了 threshold event（阈值事件）还会发送 stopped lifecycle event（停止生命周期事件）。
    /// </summary>
    [Fact]
    public async Task Monitor_EmitsStopped_AfterThresholdReached()
    {
        var hub = new DeviceEventHub(new DriverStateService(new CapturingStore(), NullLogger<DriverStateService>.Instance));
        var monitor = await CreateMonitorAsync(new SequenceReadModbusAdapter(5), hub);

        var thresholdTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountThresholdReached,
            TimeSpan.FromSeconds(3));
        var stoppedTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountMonitorStopped,
            TimeSpan.FromSeconds(3));
        await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, (await thresholdTask).ResultCode);
        Assert.Equal(DriverResultCode.Ok, (await stoppedTask).ResultCode);
    }

    /// <summary>
    /// 验证 active lease（活跃租约）被替换时按 lease loss（租约丢失）停止监测。
    /// </summary>
    [Fact]
    public async Task Monitor_Stops_WhenActiveLeaseIsReplaced()
    {
        var store = await CreateStoreWithActiveLeaseAsync(PressDownCountSignalConfigJson());
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        var monitor = new PressDownCountMonitorService(
            stateService,
            new SequenceReadModbusAdapter(0, 0, 0),
            hub,
            new DriverOptions { PressDownCountPollIntervalMs = 10, PressDownCountMaxDurationMs = 1000 },
            TimeProvider.System);

        var failedTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountMonitorFailed,
            TimeSpan.FromSeconds(3));
        var stoppedTask = ReadUntilAsync(
            hub.SubscribeAsync(CancellationToken.None),
            static item => item.EventName == DeviceEventNames.PressDownCountMonitorStopped,
            TimeSpan.FromSeconds(3));
        await monitor.StartAsync(CreateRequest("startPressDownCountMonitor"), CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-002",
            "press-002",
            "192.168.19.111:502",
            PressDownCountSignalConfigJson(),
            ["1-120"],
            11,
            DateTimeOffset.UtcNow.AddMinutes(10),
            LeaseState.Active,
            DeviceSessionState.Connected)
        {
            AllowedScopes = ["pressWorking.deviceActions"]
        }, CancellationToken.None);

        Assert.Equal(DriverResultCode.LeaseInvalid, (await failedTask).ResultCode);
        Assert.Equal(DriverResultCode.Ok, (await stoppedTask).ResultCode);
    }

    /// <summary>
    /// 创建默认监测请求。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <returns>返回设备命令请求。</returns>
    private static ExecuteDeviceCommandRequest CreateRequest(string commandName)
    {
        return new ExecuteDeviceCommandRequest
        {
            CorrelationId = $"cid-{commandName}",
            CommandName = commandName,
            LocalJobSessionId = "press-job-001",
            IdempotencyKey = $"idem-{commandName}",
            TimeoutMs = 5000
        };
    }

    /// <summary>
    /// 创建待测 monitor service（监测服务）。
    /// </summary>
    /// <param name="adapter">测试 Modbus adapter（通信适配器）。</param>
    /// <param name="hub">可选事件中心。</param>
    /// <param name="options">可选驱动配置。</param>
    /// <param name="signalConfigJson">可选信号配置 JSON。</param>
    /// <returns>返回待测服务。</returns>
    private static async Task<PressDownCountMonitorService> CreateMonitorAsync(
        IModbusAdapter adapter,
        DeviceEventHub? hub = null,
        DriverOptions? options = null,
        string? signalConfigJson = null)
    {
        var store = await CreateStoreWithActiveLeaseAsync(signalConfigJson ?? PressDownCountSignalConfigJson());
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        return new PressDownCountMonitorService(
            stateService,
            adapter,
            hub ?? new DeviceEventHub(stateService),
            options ?? new DriverOptions { PressDownCountPollIntervalMs = 5, PressDownCountMaxDurationMs = 500 },
            TimeProvider.System);
    }

    /// <summary>
    /// 创建包含 active lease（活跃租约）的临时状态存储。
    /// </summary>
    /// <param name="signalConfigJson">待保存的 signalConfig（信号配置）JSON。</param>
    /// <returns>返回 SQLite（轻量数据库）状态存储。</returns>
    private static async Task<SqliteDriverStateStore> CreateStoreWithActiveLeaseAsync(string signalConfigJson)
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-001",
            "press-001",
            "192.168.19.110:502",
            signalConfigJson,
            ["1-120"],
            10,
            DateTimeOffset.UtcNow.AddMinutes(10),
            LeaseState.Active,
            DeviceSessionState.Connected)
        {
            AllowedScopes = ["pressWorking.deviceActions"]
        }, CancellationToken.None);
        return store;
    }

    /// <summary>
    /// 生成包含 下压计数 signalName（信号名）的安全 signalConfig（信号配置）。
    /// </summary>
    /// <returns>返回 JSON 字符串。</returns>
    private static string PressDownCountSignalConfigJson()
    {
        return """{"signals":[{"name":"下压计数","signalName":"下压计数","signalCode":"PRESS_DOWN_COUNT","registerAddress":12,"registerType":"1","writable":false}]}""";
    }

    /// <summary>
    /// 从异步事件流读取直到匹配目标事件。
    /// </summary>
    /// <param name="events">事件流。</param>
    /// <param name="predicate">目标事件判断。</param>
    /// <param name="timeout">等待超时。</param>
    /// <returns>返回匹配事件。</returns>
    private static async Task<DeviceEventStreamItem> ReadUntilAsync(
        IAsyncEnumerable<DeviceEventStreamItem> events,
        Func<DeviceEventStreamItem, bool> predicate,
        TimeSpan timeout)
    {
        using var timeoutCts = new CancellationTokenSource(timeout);
        await foreach (var item in events.WithCancellation(timeoutCts.Token))
        {
            if (predicate(item))
            {
                return item;
            }
        }

        throw new TimeoutException("未收到预期设备事件。");
    }

    /// <summary>
    /// 提供按序返回下压计数的测试 Modbus adapter（通信适配器）。
    /// </summary>
    private sealed class SequenceReadModbusAdapter : IModbusAdapter
    {
        private readonly Queue<int> _counts;
        private int _last;

        /// <summary>
        /// 初始化计数序列。
        /// </summary>
        /// <param name="counts">按读取顺序返回的计数。</param>
        public SequenceReadModbusAdapter(params int[] counts)
        {
            _counts = new Queue<int>(counts);
            _last = counts.Length == 0 ? 0 : counts[^1];
        }

        /// <inheritdoc />
        public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <inheritdoc />
        public Task<IDictionary<string, object?>> ReadAsync(
            IReadOnlyList<SignalPoint> points,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            _last = _counts.Count > 0 ? _counts.Dequeue() : _last;
            IDictionary<string, object?> values = points.ToDictionary(
                static point => point.EffectiveKey(),
                _ => (object?)_last);
            return Task.FromResult(values);
        }

        /// <inheritdoc />
        public Task<object?> ReadIdentityAsync(
            SignalPoint identityProbe,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<object?>(null);
        }
    }

    /// <summary>
    /// 捕获 diagnostic log（诊断日志）的最小状态存储。
    /// </summary>
    private sealed class CapturingStore : IDriverStateStore
    {
        private DriverStateSnapshot _snapshot = new(null, 0, LeaseState.None, DeviceSessionState.Disconnected);

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

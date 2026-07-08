/**
 * @file SignalSnapshotPublisherServiceTests.cs - 信号快照后台发布服务测试。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 验证 SignalSnapshotPublisherService（信号快照发布服务）的读取门控、SSE 发布和失败诊断节流。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 覆盖 signal snapshot publisher（信号快照发布器）的最小后台读取契约。
/// </summary>
public sealed class SignalSnapshotPublisherServiceTests
{
    /// <summary>
    /// 验证存在 active lease（活跃租约）和 subscriber（订阅者）时发布 named SSE event（命名服务器发送事件）。
    /// </summary>
    [Fact]
    public async Task TickPublishesSignalSnapshotChangedWhenLeaseAndSubscriberExist()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await SaveActiveLeaseAsync(store);
        var adapter = new CountingModbusAdapter();
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        using var subscriberCts = new CancellationTokenSource();
        await using var enumerator = hub.SubscribeAsync(subscriberCts.Token).GetAsyncEnumerator();
        var readTask = enumerator.MoveNextAsync().AsTask();
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System, logger: NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, hub, stateService);

        await service.PublishOnceAsync(CancellationToken.None);
        var hasEvent = await readTask.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.True(hasEvent);
        Assert.Equal(DeviceEventNames.SignalSnapshotChanged, enumerator.Current.EventName);
        Assert.Equal("signalSnapshotPublisher", enumerator.Current.CommandName);
        Assert.Equal(DriverResultCode.Ok, enumerator.Current.ResultCode);
        Assert.Contains(enumerator.Current.SnapshotValues, item => item.SignalCode == "pressure" && Equals(item.Value, 100));
        Assert.Equal(1, adapter.ReadCount);
    }

    /// <summary>
    /// 验证没有 SSE subscriber（服务器发送事件订阅者）时不会访问设备。
    /// </summary>
    [Fact]
    public async Task TickSkipsReadWhenNoSubscriberExists()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await SaveActiveLeaseAsync(store);
        var adapter = new CountingModbusAdapter();
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System, logger: NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, new DeviceEventHub(stateService), stateService);

        await service.PublishOnceAsync(CancellationToken.None);

        Assert.Equal(0, adapter.ReadCount);
    }

    /// <summary>
    /// 验证没有 active lease（活跃租约）时不读取设备，也不写失败诊断日志。
    /// </summary>
    [Fact]
    public async Task TickSkipsReadWhenNoActiveLeaseExists()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        var adapter = new CountingModbusAdapter();
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        using var subscriberCts = new CancellationTokenSource();
        await using var enumerator = hub.SubscribeAsync(subscriberCts.Token).GetAsyncEnumerator();
        var readTask = enumerator.MoveNextAsync().AsTask();
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System, logger: NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, hub, stateService);

        await service.PublishOnceAsync(CancellationToken.None);

        var diagnosticLogs = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "all", null, 100), CancellationToken.None);
        Assert.Equal(0, adapter.ReadCount);
        Assert.DoesNotContain(diagnosticLogs, entry => entry.EventName == "SignalSnapshotPublisherReadFailed");
        Assert.False(readTask.IsCompleted);
        subscriberCts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => readTask);
    }

    /// <summary>
    /// 验证自动成功 tick（计时读取）不写审计日志，也不刷成功诊断日志。
    /// </summary>
    [Fact]
    public async Task SuccessTickDoesNotAppendAuditOrSuccessDiagnosticLogs()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await SaveActiveLeaseAsync(store);
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        await using var enumerator = hub.SubscribeAsync(CancellationToken.None).GetAsyncEnumerator();
        var readTask = enumerator.MoveNextAsync().AsTask();
        var manager = new DriverSessionManager(store, new CountingModbusAdapter(), TimeProvider.System, logger: NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, hub, stateService);

        await service.PublishOnceAsync(CancellationToken.None);
        await readTask.WaitAsync(TimeSpan.FromSeconds(2));

        var diagnosticLogs = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "all", null, 100), CancellationToken.None);
        var auditLogs = await store.ReadAuditLogsForTestsAsync(CancellationToken.None);
        Assert.Empty(diagnosticLogs);
        Assert.DoesNotContain(auditLogs, entry => entry.CommandName == "signalSnapshotPublisher");
    }

    /// <summary>
    /// 验证连续失败只按 throttle（节流）写一次发布器失败日志，底层失败日志不刷屏，恢复时只写一次恢复日志。
    /// </summary>
    /// <param name="failOnConnect">是否在 connect（连接）阶段失败。</param>
    /// <param name="suppressedEventName">应被发布器模式抑制的底层失败事件名。</param>
    [Theory]
    [InlineData(true, "DeviceConnectFailed")]
    [InlineData(false, "SignalReadFailed")]
    public async Task FailureLogsPublisherFailureOnlyWithThrottleAndRecovery(
        bool failOnConnect,
        string suppressedEventName)
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await SaveActiveLeaseAsync(store);
        var stateService = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var hub = new DeviceEventHub(stateService);
        await using var enumerator = hub.SubscribeAsync(CancellationToken.None).GetAsyncEnumerator();
        var readTask = enumerator.MoveNextAsync().AsTask();
        var adapter = new FailingThenRecoveringModbusAdapter(failOnConnect);
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System, logger: NullLogger<DriverSessionManager>.Instance);
        var service = CreateService(manager, hub, stateService);

        await service.PublishOnceAsync(CancellationToken.None);
        await service.PublishOnceAsync(CancellationToken.None);
        adapter.ShouldFail = false;
        await service.PublishOnceAsync(CancellationToken.None);
        await readTask.WaitAsync(TimeSpan.FromSeconds(2));

        var logs = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "device", null, 100), CancellationToken.None);
        Assert.Single(logs, entry => entry.EventName == "SignalSnapshotPublisherReadFailed");
        Assert.Single(logs, entry => entry.EventName == "SignalSnapshotPublisherRecovered");
        Assert.DoesNotContain(logs, entry => entry.EventName == suppressedEventName);
        Assert.DoesNotContain(string.Join('\n', logs.Select(entry => entry.Message)), "signalConfig", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 创建发布服务测试实例。
    /// </summary>
    /// <param name="manager">驱动会话管理器。</param>
    /// <param name="hub">设备事件中心。</param>
    /// <param name="stateService">驱动状态服务。</param>
    /// <returns>返回使用测试配置的发布服务。</returns>
    private static SignalSnapshotPublisherService CreateService(
        DriverSessionManager manager,
        DeviceEventHub hub,
        DriverStateService stateService)
    {
        return new SignalSnapshotPublisherService(
            manager,
            hub,
            stateService,
            new DriverOptions
            {
                SignalSnapshotPublisherIntervalMs = 10_000,
                SignalSnapshotPublisherFailureThrottleMs = 300_000
            },
            TimeProvider.System,
            NullLogger<SignalSnapshotPublisherService>.Instance);
    }

    /// <summary>
    /// 保存带授权信号点的 active lease（活跃租约）。
    /// </summary>
    /// <param name="store">状态存储。</param>
    /// <returns>返回保存任务。</returns>
    private static Task SaveActiveLeaseAsync(IDriverStateStore store)
    {
        return store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-snapshot-publisher-001",
            "press-001",
            "192.168.19.110:502",
            """
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["100-120"],
            10,
            DateTimeOffset.UtcNow.AddMinutes(10),
            LeaseState.Active,
            DeviceSessionState.Disconnected), CancellationToken.None);
    }

    /// <summary>
    /// 记录读取次数并返回固定信号值的 Modbus（通信协议）测试适配器。
    /// </summary>
    private sealed class CountingModbusAdapter : IModbusAdapter
    {
        /// <summary>
        /// 获取信号读取次数。
        /// </summary>
        public int ReadCount { get; private set; }

        /// <summary>
        /// 模拟设备连接成功。
        /// </summary>
        /// <param name="targetEndpoint">目标端点。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回已完成任务。</returns>
        public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        /// 模拟读取授权信号值并累计读取次数。
        /// </summary>
        /// <param name="points">授权信号点。</param>
        /// <param name="timeout">读取超时时间。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回固定值 100。</returns>
        public Task<IDictionary<string, object?>> ReadAsync(
            IReadOnlyList<SignalPoint> points,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            ReadCount++;
            IDictionary<string, object?> values = points.ToDictionary(point => point.EffectiveKey(), _ => (object?)100);
            return Task.FromResult(values);
        }

        /// <summary>
        /// 模拟 identity probe（身份探针）读取。
        /// </summary>
        /// <param name="identityProbe">身份探针点位。</param>
        /// <param name="timeout">读取超时时间。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回固定设备身份。</returns>
        public Task<object?> ReadIdentityAsync(
            SignalPoint identityProbe,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<object?>("PRESS-001");
        }
    }

    /// <summary>
    /// 先失败后恢复的 Modbus（通信协议）测试适配器。
    /// </summary>
    private sealed class FailingThenRecoveringModbusAdapter : IModbusAdapter
    {
        private readonly bool _failOnConnect;

        /// <summary>
        /// 初始化可控制失败阶段的 Modbus（通信协议）测试适配器。
        /// </summary>
        /// <param name="failOnConnect">true 表示连接失败，false 表示读取失败。</param>
        public FailingThenRecoveringModbusAdapter(bool failOnConnect)
        {
            _failOnConnect = failOnConnect;
        }

        /// <summary>
        /// 获取或设置当前操作是否失败。
        /// </summary>
        public bool ShouldFail { get; set; } = true;

        /// <summary>
        /// 根据 ShouldFail（失败开关）模拟连接结果。
        /// </summary>
        /// <param name="targetEndpoint">目标端点。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>成功时返回已完成任务。</returns>
        public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
        {
            if (ShouldFail && _failOnConnect)
            {
                throw new InvalidOperationException("设备通信失败");
            }

            return Task.CompletedTask;
        }

        /// <summary>
        /// 恢复后返回固定信号值。
        /// </summary>
        /// <param name="points">授权信号点。</param>
        /// <param name="timeout">读取超时时间。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回固定值 100。</returns>
        public Task<IDictionary<string, object?>> ReadAsync(
            IReadOnlyList<SignalPoint> points,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            if (ShouldFail && !_failOnConnect)
            {
                throw new InvalidOperationException("设备通信失败");
            }

            IDictionary<string, object?> values = points.ToDictionary(point => point.EffectiveKey(), _ => (object?)100);
            return Task.FromResult(values);
        }

        /// <summary>
        /// 模拟 identity probe（身份探针）读取。
        /// </summary>
        /// <param name="identityProbe">身份探针点位。</param>
        /// <param name="timeout">读取超时时间。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回固定设备身份。</returns>
        public Task<object?> ReadIdentityAsync(
            SignalPoint identityProbe,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<object?>("PRESS-001");
        }
    }
}

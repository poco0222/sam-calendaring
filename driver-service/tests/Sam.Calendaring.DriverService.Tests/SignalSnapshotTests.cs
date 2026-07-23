/**
 * @file Driver Service 信号快照测试。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 以 TDD（测试驱动开发）方式锁定 Task5 Step1 的信号快照、授权过滤与超时返回契约。
 */
using System.IO;
using System.Net.Sockets;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 Mock（模拟）模式信号快照、授权地址过滤与超时分支的最小行为契约。
/// </summary>
public sealed class SignalSnapshotTests
{
    /// <summary>
    /// 验证 Mock（模拟）模式会返回授权点位的 signalValues（信号值）。
    /// </summary>
    [Fact]
    public async Task MockModeReturnsAuthorizedSignalValues()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["100-120"]);

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("OK", result.ResultCode);
        Assert.True(result.SignalValues.ContainsKey("pressure"));
    }

    /// <summary>
    /// 验证 ERP ModbusSignals（ERP 信号配置）格式可直接驱动读取，并把配置元数据带回 signal snapshot（信号快照）。
    /// </summary>
    [Fact]
    public async Task ErpModbusSignalsConfigReturnsMetadataSnapshotRows()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"signals":[{"signalCode":"S-100","signalName":"压力","signalType":"read","registerType":"holdingRegister","registerAddress":100,"dataType":"int","registerCount":1,"scaleFactor":10,"offsetValue":0,"unit":"bar","description":"液压压力","plcAreaType":"DM","paramGroup":"液压"}]}
            """,
            ["100-120"]);

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-erp-config-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("OK", result.ResultCode);
        var row = Assert.IsType<Dictionary<string, object?>>(result.SignalValues["S-100"]);
        Assert.Equal("S-100", row["signalCode"]);
        Assert.Equal("压力", row["signalName"]);
        Assert.Equal("液压", row["paramGroup"]);
        Assert.Equal("bar", row["unit"]);
        Assert.Equal(100, row["value"]);
    }

    /// <summary>
    /// 验证真实读取返回 rawRegisters（原始寄存器）时，ERP metadata row（元数据行）保留诊断值。
    /// </summary>
    [Fact]
    public async Task ErpSnapshotRowsExposeRawRegisters()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"signals":[{"signalCode":"S-1100","signalName":"下压计数","signalType":"read","registerType":"3","registerAddress":411101,"dataType":"word","registerCount":2,"scaleFactor":1,"offsetValue":11100,"unit":"次","plcAreaType":"D","paramGroup":"4"}]}
            """,
            ["411101-411101"],
            adapter: new FixedReadResultModbusAdapter(new SignalReadResult(
                new ushort[] { 28, 100 },
                new ushort[] { 28, 100 })));

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-erp-raw-registers-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("OK", result.ResultCode);
        var row = Assert.IsType<Dictionary<string, object?>>(result.SignalValues["S-1100"]);
        Assert.Equal(new ushort[] { 28, 100 }, Assert.IsType<ushort[]>(row["value"]));
        Assert.Equal(new ushort[] { 28, 100 }, Assert.IsType<ushort[]>(row["rawRegisters"]));
    }

    /// <summary>
    /// 验证 applyLeaseAndConfig（应用租约与配置）已连接后，首个 signal snapshot（信号快照）复用当前连接而不是立刻重连。
    /// </summary>
    [Fact]
    public async Task SnapshotAfterApplyLeaseReusesActiveConnection()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-apply-then-snapshot",
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
        var adapter = new CountingConnectedModbusAdapter();
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System);

        var connectResult = await manager.ConnectActiveLeaseAsync(
            TimeSpan.FromSeconds(5),
            CancellationToken.None);
        var snapshotResult = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-after-apply-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, connectResult);
        Assert.Equal(DriverResultCode.Ok, snapshotResult.ResultCode);
        Assert.Equal(1, adapter.ConnectCount);
    }

    /// <summary>
    /// 验证已过期的 active lease（活跃租约）不能继续读取 signal snapshot（信号快照）。
    /// </summary>
    [Fact]
    public async Task ExpiredActiveLeaseReturnsLeaseExpired()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["100-120"],
            DateTimeOffset.UtcNow.AddMinutes(-1));

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-expired-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("LEASE_EXPIRED", result.ResultCode);
        Assert.Empty(result.SignalValues);
    }

    /// <summary>
    /// 验证 identityProbe（身份探测点位）期望值不匹配时返回 DEVICE_IDENTITY_MISMATCH。
    /// </summary>
    [Fact]
    public async Task IdentityProbeMismatchReturnsDeviceIdentityMismatch()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"identityProbe":{"name":"deviceIdentity","address":1,"expectedValue":"OTHER"},"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["1-120"]);

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-identity-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("DEVICE_IDENTITY_MISMATCH", result.ResultCode);
        Assert.Empty(result.SignalValues);
    }

    /// <summary>
    /// 验证非 timeout（超时）的设备异常会被收口为稳定的 DEVICE_REJECTED，而不是向端点抛出 500。
    /// </summary>
    [Fact]
    public async Task AdapterFailureReturnsDeviceRejected()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["100-120"],
            adapter: new ThrowingModbusAdapter());

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-device-failure-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("DEVICE_REJECTED", result.ResultCode);
        Assert.Empty(result.SignalValues);
    }

    /// <summary>
    /// 验证读取异常会使当前连接失效，下一次 signal snapshot（信号快照）必须重新连接后恢复读取。
    /// </summary>
    [Fact]
    public async Task ReadFailureForcesReconnectBeforeNextSnapshot()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-reconnect-after-read-failure",
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
        var adapter = new ReconnectRequiredAfterReadFailureModbusAdapter();
        var manager = new DriverSessionManager(store, adapter, TimeProvider.System);

        var failedResult = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-read-failure-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);
        var recoveredResult = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-read-recovery-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal(DriverResultCode.DeviceRejected, failedResult.ResultCode);
        Assert.Equal(DriverResultCode.Ok, recoveredResult.ResultCode);
        Assert.Equal(2, adapter.ConnectCount);
    }

    /// <summary>
    /// 验证当没有活跃租约时会返回 LEASE_INVALID。
    /// </summary>
    [Fact]
    public async Task SnapshotWithoutActiveLeaseReturnsLeaseInvalid()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithoutActiveLeaseAsync();

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-002",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("LEASE_INVALID", result.ResultCode);
        Assert.Empty(result.SignalValues);
    }

    /// <summary>
    /// 验证授权规划器只保留命中 allowed address ranges（允许地址范围）的点位。
    /// </summary>
    [Fact]
    public void PlannerKeepsOnlyAllowedAddressRanges()
    {
        var config = SignalConfig.Parse(
            """
            {"signals":[{"name":"allowed","address":100},{"name":"blocked","address":999}]}
            """);

        var points = AuthorizedSignalPlanner.Plan(config, ["100-120"]);

        Assert.Single(points);
        Assert.Equal("allowed", points[0].Name);
    }

    /// <summary>
    /// 验证读取超时会映射为 DEVICE_TIMEOUT。
    /// </summary>
    [Fact]
    public async Task TimeoutReturnsDeviceTimeout()
    {
        var manager = await TestDriverSessionManagerFactory.CreateTimeoutMockAsync();

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-003",
            TimeSpan.FromMilliseconds(1),
            CancellationToken.None);

        Assert.Equal("DEVICE_TIMEOUT", result.ResultCode);
    }

    /// <summary>
    /// 验证真实 NModbus（Modbus 通信库）常见 socket timeout（套接字超时）异常会映射为 DEVICE_TIMEOUT。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task SocketTimeoutReadExceptionReturnsDeviceTimeout()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync(
            """
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """,
            ["100-120"],
            adapter: new SocketTimeoutReadModbusAdapter());

        var result = await manager.GetSignalSnapshotAsync(
            "cid-snapshot-socket-timeout-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        Assert.Equal("DEVICE_TIMEOUT", result.ResultCode);
        Assert.Empty(result.SignalValues);
    }
}

/// <summary>
/// 统计连接次数的 Mock（模拟）Modbus 适配器，用于锁定启动后不重复重连的最小契约。
/// </summary>
internal sealed class CountingConnectedModbusAdapter : IModbusAdapter
{
    /// <summary>
    /// 获取 ConnectAsync（连接）被调用的次数。
    /// </summary>
    public int ConnectCount { get; private set; }

    /// <summary>
    /// 模拟建立设备连接并记录调用次数。
    /// </summary>
    /// <param name="targetEndpoint">目标设备端点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回已完成任务。</returns>
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        ConnectCount++;
        return Task.CompletedTask;
    }

    /// <summary>
    /// 模拟读取授权信号点。
    /// </summary>
    /// <param name="points">待读取的 signal points（信号点）。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回按名称索引的 signal values（信号值）。</returns>
    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        IDictionary<string, object?> values = points.ToDictionary(
            point => point.EffectiveKey(),
            point => (object?)point.EffectiveAddress());
        return Task.FromResult(values);
    }

    /// <summary>
    /// 模拟未配置 identity probe（身份探针）读取结果。
    /// </summary>
    /// <param name="identityProbe">身份探针点位。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回空身份值。</returns>
    public Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<object?>(null);
    }
}

/// <summary>
/// 模拟首次读取破坏连接、再次连接后恢复的 Modbus adapter（Modbus 适配器）。
/// </summary>
internal sealed class ReconnectRequiredAfterReadFailureModbusAdapter : IModbusAdapter
{
    private bool _connected;
    private int _readAttempts;

    /// <summary>
    /// 获取 ConnectAsync（连接）被调用的次数。
    /// </summary>
    public int ConnectCount { get; private set; }

    /// <summary>
    /// 模拟建立设备连接并记录调用次数。
    /// </summary>
    /// <param name="targetEndpoint">目标设备端点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回已完成任务。</returns>
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        _connected = true;
        ConnectCount++;
        return Task.CompletedTask;
    }

    /// <summary>
    /// 首次读取抛出设备通信异常，并要求调用方重新连接后才能恢复。
    /// </summary>
    /// <param name="points">待读取的 signal points（信号点）。</param>
    /// <param name="timeout">读取超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>重新连接后返回按名称索引的 signal values（信号值）。</returns>
    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        if (!_connected)
        {
            throw new InvalidOperationException("设备尚未连接。");
        }

        _readAttempts++;
        if (_readAttempts == 1)
        {
            _connected = false;
            throw new IOException("模拟首次设备读取失败。");
        }

        IDictionary<string, object?> values = points.ToDictionary(
            point => point.EffectiveKey(),
            point => (object?)point.EffectiveAddress());
        return Task.FromResult(values);
    }

    /// <summary>
    /// 模拟未配置 identity probe（身份探针）读取结果。
    /// </summary>
    /// <param name="identityProbe">身份探针点位。</param>
    /// <param name="timeout">读取超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回空身份值。</returns>
    public Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<object?>(null);
    }
}

/// <summary>
/// 返回固定 read result（读取结果）的测试适配器，用于验证快照行保留 rawRegisters（原始寄存器）。
/// </summary>
internal sealed class FixedReadResultModbusAdapter(SignalReadResult readResult) : IModbusAdapter
{
    /// <summary>
    /// 模拟设备连接成功。
    /// </summary>
    /// <param name="targetEndpoint">目标设备端点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回已完成任务。</returns>
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// 返回固定 raw read result（原始读取结果）。
    /// </summary>
    /// <param name="points">待读取的 signal points（信号点）。</param>
    /// <param name="timeout">读取超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回按信号 key（键）索引的读取结果。</returns>
    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        IDictionary<string, object?> values = points.ToDictionary(
            point => point.EffectiveKey(),
            _ => (object?)readResult);
        return Task.FromResult(values);
    }

    /// <summary>
    /// 模拟未配置 identity probe（身份探针）读取结果。
    /// </summary>
    /// <param name="identityProbe">身份探针点位。</param>
    /// <param name="timeout">读取超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回空身份值。</returns>
    public Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<object?>(null);
    }
}

/// <summary>
/// 模拟真实 socket timeout（套接字超时）读取异常的测试适配器。
/// </summary>
internal sealed class SocketTimeoutReadModbusAdapter : IModbusAdapter
{
    /// <summary>
    /// 模拟设备连接成功。
    /// </summary>
    /// <param name="targetEndpoint">目标设备端点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回已完成任务。</returns>
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// 抛出 NModbus（Modbus 通信库）真实 timeout（超时）常见的 IOException（输入输出异常）包装。
    /// </summary>
    /// <param name="points">待读取的 signal points（信号点）。</param>
    /// <param name="timeout">读取超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>永远抛出 timeout（超时）异常。</returns>
    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        throw new IOException(
            "模拟设备读取超时。",
            new SocketException((int)SocketError.TimedOut));
    }

    /// <summary>
    /// 模拟未配置 identity probe（身份探针）读取结果。
    /// </summary>
    /// <param name="identityProbe">身份探针点位。</param>
    /// <param name="timeout">读取超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回空身份值。</returns>
    public Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<object?>(null);
    }
}

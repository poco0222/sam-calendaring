/**
 * @file Driver Service 测试会话管理器工厂。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 为 Task5 Step1 的信号快照测试提供最小 DriverSessionManager（驱动会话管理器）构造辅助。
 */
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 提供 Task5 Step1 所需的最小测试工厂，负责构造不同状态下的会话管理器。
/// </summary>
internal static class TestDriverSessionManagerFactory
{
    /// <summary>
    /// 创建带活跃租约与 Mock（模拟）适配器的测试会话管理器。
    /// </summary>
    /// <param name="signalConfigJson">租约内保存的 signalConfig（信号配置）JSON。</param>
    /// <param name="allowedRanges">租约授权的 allowed address ranges（允许地址范围）。</param>
    /// <param name="expiresAt">租约失效时间；未传入时默认保持有效。</param>
    /// <param name="adapter">可选的测试 Modbus（通信协议）适配器。</param>
    /// <returns>返回用于快照测试的会话管理器。</returns>
    public static async Task<DriverSessionManager> CreateMockWithActiveLeaseAsync(
        string signalConfigJson,
        IReadOnlyList<string> allowedRanges,
        DateTimeOffset? expiresAt = null,
        IModbusAdapter? adapter = null)
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-001",
            "press-001",
            "192.168.19.110:502",
            signalConfigJson,
            allowedRanges,
            10,
            expiresAt ?? DateTimeOffset.UtcNow.AddMinutes(10),
            "Active",
            "Connected"), CancellationToken.None);

        return new DriverSessionManager(store, adapter ?? new MockModbusAdapter(), TimeProvider.System);
    }

    /// <summary>
    /// 创建没有活跃租约的 Mock（模拟）测试会话管理器。
    /// </summary>
    /// <returns>返回空租约状态下的会话管理器。</returns>
    public static async Task<DriverSessionManager> CreateMockWithoutActiveLeaseAsync()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        return new DriverSessionManager(store, new MockModbusAdapter(), TimeProvider.System);
    }

    /// <summary>
    /// 创建会在读取阶段超时的测试会话管理器。
    /// </summary>
    /// <returns>返回绑定超时适配器的会话管理器。</returns>
    public static async Task<DriverSessionManager> CreateTimeoutMockAsync()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-timeout",
            "press-001",
            "192.168.19.110:502",
            """{"signals":[{"name":"pressure","address":100}]}""",
            ["100-120"],
            10,
            DateTimeOffset.UtcNow.AddMinutes(10),
            "Active",
            "Connected"), CancellationToken.None);

        return new DriverSessionManager(store, new TimeoutModbusAdapter(), TimeProvider.System);
    }
}

/// <summary>
/// 提供一个可预测的超时读取适配器，用于锁定 DEVICE_TIMEOUT 分支。
/// </summary>
internal sealed class TimeoutModbusAdapter : IModbusAdapter
{
    /// <summary>
    /// 模拟连接成功，不额外引入连接失败分支。
    /// </summary>
    /// <param name="targetEndpoint">目标设备端点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回已完成任务。</returns>
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// 模拟一个足够长的读取操作，让调用侧命中超时控制。
    /// </summary>
    /// <param name="points">待读取的 signal points（信号点）。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回空的 signalValues（信号值）字典。</returns>
    public async Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        // PopoY: 这里故意等待远大于测试超时窗口，只验证调用侧的 timeout（超时）映射逻辑。
        await Task.Delay(TimeSpan.FromSeconds(30), cancellationToken);
        return new Dictionary<string, object?>();
    }

    /// <summary>
    /// 模拟未提供 identity probe（身份探针）读取结果。
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
/// 提供一个会抛出普通设备异常的适配器，用于锁定 non-timeout（非超时）错误映射。
/// </summary>
internal sealed class ThrowingModbusAdapter : IModbusAdapter
{
    /// <summary>
    /// 模拟设备连接阶段失败。
    /// </summary>
    /// <param name="targetEndpoint">目标设备端点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>永远抛出设备异常。</returns>
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        throw new InvalidOperationException("模拟设备连接失败。");
    }

    /// <summary>
    /// 模拟设备读取阶段失败。
    /// </summary>
    /// <param name="points">待读取的 signal points（信号点）。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>永远抛出设备异常。</returns>
    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        throw new InvalidOperationException("模拟设备读取失败。");
    }

    /// <summary>
    /// 模拟 identityProbe（身份探测）失败。
    /// </summary>
    /// <param name="identityProbe">身份探针点位。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>永远抛出设备异常。</returns>
    public Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        throw new InvalidOperationException("模拟设备身份读取失败。");
    }
}

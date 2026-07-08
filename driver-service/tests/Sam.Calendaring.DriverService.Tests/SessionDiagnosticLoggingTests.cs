/**
 * @file SessionDiagnosticLoggingTests.cs - 验证 session（会话）诊断日志链路。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 验证 DriverSessionManager（驱动会话管理器）写入 Device（设备）和 Execution（执行）过程诊断日志。
 */
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 覆盖 session manager（会话管理器）的过程型 diagnostic log（诊断日志）。
/// </summary>
public sealed class SessionDiagnosticLoggingTests
{
    /// <summary>
    /// 验证成功快照链路写入设备连接、身份探测、信号计划和读取完成事件。
    /// </summary>
    [Fact]
    public async Task SuccessfulSnapshotWritesDeviceTimelineEvents()
    {
        var store = await CreateStoreWithActiveLeaseAsync(
            """
            {"identityProbe":{"name":"deviceIdentity","address":1,"expectedValue":"PRESS-001"},"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """);
        var manager = new DriverSessionManager(store, new IdentityMatchModbusAdapter(), TimeProvider.System);

        var response = await manager.GetSignalSnapshotAsync(
            "cid-session-diagnostic-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);
        var logs = await store.QueryDiagnosticLogsAsync(
            new DiagnosticLogQuery("all", "all", "cid-session-diagnostic-001", 100),
            CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Contains(logs, entry => entry.EventName == "DeviceConnectStarted");
        Assert.Contains(logs, entry => entry.EventName == "DeviceConnectCompleted");
        Assert.Contains(logs, entry => entry.EventName == "IdentityProbeStarted");
        Assert.Contains(logs, entry => entry.EventName == "IdentityProbeCompleted");
        Assert.Contains(logs, entry => entry.EventName == "PlanSignalReadCompleted");
        Assert.Contains(logs, entry => entry.EventName == "SignalReadStarted");
        Assert.Contains(logs, entry => entry.EventName == "SignalReadCompleted");
    }

    /// <summary>
    /// 验证设备异常只记录 exceptionType（异常类型）和中文摘要，不记录完整堆栈。
    /// </summary>
    [Fact]
    public async Task DeviceFailureWritesExceptionTypeWithoutStackTrace()
    {
        var store = await CreateStoreWithActiveLeaseAsync(
            """
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """);
        var manager = new DriverSessionManager(store, new ThrowingModbusAdapter(), TimeProvider.System);

        var response = await manager.GetSignalSnapshotAsync(
            "cid-session-device-failed-001",
            TimeSpan.FromSeconds(5),
            CancellationToken.None);

        var logs = await store.QueryDiagnosticLogsAsync(
            new DiagnosticLogQuery("abnormal", "device", "cid-session-device-failed-001", 100),
            CancellationToken.None);
        var failure = Assert.Single(logs, entry =>
            entry.EventName == "DeviceConnectFailed"
            || entry.EventName == "SignalReadFailed");

        Assert.Equal(DriverResultCode.DeviceRejected, response.ResultCode);
        Assert.Equal(nameof(InvalidOperationException), failure.ExceptionType);
        Assert.Contains("设备通信失败", failure.Message);
        Assert.DoesNotContain(" at ", failure.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signedLease", failure.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 创建带 active lease（活跃租约）的测试 SQLite 状态存储。
    /// </summary>
    /// <param name="signalConfigJson">租约内保存的 signalConfig（信号配置）JSON。</param>
    /// <returns>返回已初始化并保存活跃租约的状态存储。</returns>
    private static async Task<SqliteDriverStateStore> CreateStoreWithActiveLeaseAsync(string signalConfigJson)
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-diagnostic-001",
            "press-001",
            "192.168.19.110:502",
            signalConfigJson,
            ["1-120"],
            10,
            DateTimeOffset.UtcNow.AddMinutes(10),
            LeaseState.Active,
            DeviceSessionState.Disconnected), CancellationToken.None);
        return store;
    }

    /// <summary>
    /// 提供身份探测成功的测试 Modbus（通信协议）适配器。
    /// </summary>
    private sealed class IdentityMatchModbusAdapter : IModbusAdapter
    {
        /// <summary>
        /// 模拟连接成功。
        /// </summary>
        /// <param name="targetEndpoint">目标设备端点。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回已完成任务。</returns>
        public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        /// 模拟读取授权信号值。
        /// </summary>
        /// <param name="points">授权后的 signal points（信号点）。</param>
        /// <param name="timeout">读取超时时间。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回按点位地址生成的信号值。</returns>
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
        /// 返回与 identityProbe（身份探测）期望值一致的设备身份。
        /// </summary>
        /// <param name="identityProbe">身份探测点位。</param>
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

/**
 * @file Driver Service（驱动服务）会话管理器。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 串行化设备连接与授权快照读取，并复用本地状态存储更新连接状态。
 */
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.State;
using System.Diagnostics;
using System.Globalization;
using System.Net.Sockets;

namespace Sam.Calendaring.DriverService.Sessions;

/// <summary>
/// 提供 Driver Service V1 的最小设备会话编排能力。
/// </summary>
public sealed class DriverSessionManager
{
    private readonly IDriverStateStore _stateStore;
    private readonly IModbusAdapter _adapter;
    private readonly TimeProvider _clock;
    private readonly DriverOptions _driverOptions;
    private readonly ILogger<DriverSessionManager> _logger;

    // ponytail: V1 只支持单设备活跃租约；若后续允许多设备并发，再拆成 per-device lock（按设备锁）。
    private readonly SemaphoreSlim _gate = new(1, 1);
    // ponytail: 只记当前进程内的一条连接；服务重启后必须重新连接，不能盲信持久化 Connected（已连接）状态。
    private string? _connectedLeaseKey;

    /// <summary>
    /// 初始化驱动会话管理器。
    /// </summary>
    /// <param name="stateStore">状态持久化接口。</param>
    /// <param name="adapter">Modbus（通信协议）读取适配器。</param>
    /// <param name="clock">用于判断租约过期的时间提供器。</param>
    /// <param name="driverOptions">Driver Service（驱动服务）运行模式配置。</param>
    /// <param name="logger">用于诊断日志失败摘要的日志抽象。</param>
    public DriverSessionManager(
        IDriverStateStore stateStore,
        IModbusAdapter adapter,
        TimeProvider clock,
        DriverOptions? driverOptions = null,
        ILogger<DriverSessionManager>? logger = null)
    {
        _stateStore = stateStore;
        _adapter = adapter;
        _clock = clock;
        _driverOptions = driverOptions ?? new DriverOptions();
        _logger = logger ?? NullLogger<DriverSessionManager>.Instance;
    }

    /// <summary>
    /// 对当前 active lease（活跃租约）执行最小连接，并在成功后把快照状态推进为 Connected。
    /// </summary>
    /// <param name="timeout">连接超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回稳定结果码，供后续端点复用。</returns>
    public async Task<string> ConnectActiveLeaseAsync(
        TimeSpan timeout,
        CancellationToken cancellationToken,
        string? correlationId = null)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);

        var lockAcquired = false;
        try
        {
            await _gate.WaitAsync(timeoutCts.Token).ConfigureAwait(false);
            lockAcquired = true;

            var snapshot = await _stateStore.LoadSnapshotAsync(timeoutCts.Token).ConfigureAwait(false);
            if (!HasActiveLease(snapshot, out var activeLease))
            {
                return DriverResultCode.LeaseInvalid;
            }

            if (IsExpired(activeLease))
            {
                return DriverResultCode.LeaseExpired;
            }

            await ConnectActiveLeaseCoreAsync(
                snapshot,
                correlationId,
                "applyLeaseAndConfig",
                timeoutCts.Token).ConfigureAwait(false);
            return DriverResultCode.Ok;
        }
        catch (OperationCanceledException)
        {
            return DriverResultCode.DeviceTimeout;
        }
        catch (Exception exception) when (IsDeviceTimeoutException(exception))
        {
            return DriverResultCode.DeviceTimeout;
        }
        catch (Exception)
        {
            return DriverResultCode.DeviceRejected;
        }
        finally
        {
            if (lockAcquired)
            {
                _gate.Release();
            }
        }
    }

    /// <summary>
    /// 获取当前活跃租约授权范围内的信号快照。
    /// </summary>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="timeout">本次读取超时时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <param name="diagnosticMode">@author PopoY 诊断日志写入模式，后台 tick（计时读取）使用 FailureOnly（仅异常）。</param>
    /// <returns>返回最小信号快照响应。</returns>
    public async Task<GetSignalSnapshotResponse> GetSignalSnapshotAsync(
        string correlationId,
        TimeSpan timeout,
        CancellationToken cancellationToken,
        SignalSnapshotDiagnosticMode diagnosticMode = SignalSnapshotDiagnosticMode.Full)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);

        var lockAcquired = false;
        try
        {
            await _gate.WaitAsync(timeoutCts.Token).ConfigureAwait(false);
            lockAcquired = true;

            var snapshot = await _stateStore.LoadSnapshotAsync(timeoutCts.Token).ConfigureAwait(false);
            if (!HasActiveLease(snapshot, out var activeLease))
            {
                return new GetSignalSnapshotResponse
                {
                    CorrelationId = correlationId,
                    ResultCode = DriverResultCode.LeaseInvalid,
                    Message = "当前没有可用租约",
                    SignalValues = new Dictionary<string, object?>()
                };
            }

            if (IsExpired(activeLease))
            {
                return new GetSignalSnapshotResponse
                {
                    CorrelationId = correlationId,
                    ResultCode = DriverResultCode.LeaseExpired,
                    Message = "租约已过期",
                    SignalValues = new Dictionary<string, object?>()
                };
            }

            await ConnectActiveLeaseCoreAsync(
                snapshot,
                correlationId,
                "getSignalSnapshot",
                timeoutCts.Token,
                diagnosticMode).ConfigureAwait(false);

            var config = SignalConfig.Parse(activeLease.SignalConfigJson);
            if (!await VerifyIdentityProbeAsync(
                config,
                activeLease,
                correlationId,
                "getSignalSnapshot",
                timeout,
                timeoutCts.Token,
                diagnosticMode).ConfigureAwait(false))
            {
                return new GetSignalSnapshotResponse
                {
                    CorrelationId = correlationId,
                    ResultCode = DriverResultCode.DeviceIdentityMismatch,
                    Message = "设备身份不匹配",
                    SignalValues = new Dictionary<string, object?>()
                };
            }

            var points = AuthorizedSignalPlanner.Plan(config, activeLease.AllowedAddressRanges);
            if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
            {
                await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                    level: "Information",
                    eventName: "PlanSignalReadCompleted",
                    message: "信号读取计划已生成。",
                    eventStage: "Completed",
                    correlationId: correlationId,
                    commandName: "getSignalSnapshot",
                    activeLease: activeLease,
                    resultCode: DriverResultCode.Ok,
                    deviceSessionState: DeviceSessionState.Connected), timeoutCts.Token).ConfigureAwait(false);
            }

            if (ShouldUseBootstrapMockSignals(activeLease, config, points))
            {
                // PopoY: ERP bootstrap placeholder has no point list yet; keep the local Mock snapshot visibly useful.
                points = [new SignalPoint { Name = "pressure", Address = 100 }];
            }

            if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
            {
                await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                    level: "Information",
                    eventName: "SignalReadStarted",
                    message: "开始读取授权信号。",
                    eventStage: "Start",
                    correlationId: correlationId,
                    commandName: "getSignalSnapshot",
                    activeLease: activeLease,
                    deviceSessionState: DeviceSessionState.Connected), timeoutCts.Token).ConfigureAwait(false);
            }

            IDictionary<string, object?> values;
            var readStartedAt = Stopwatch.GetTimestamp();
            try
            {
                values = await _adapter.ReadAsync(points, timeout, timeoutCts.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException exception)
            {
                if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
                {
                    await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                        level: "Warning",
                        eventName: "SignalReadFailed",
                        message: "设备通信超时",
                        eventStage: "Failed",
                        correlationId: correlationId,
                        commandName: "getSignalSnapshot",
                        activeLease: activeLease,
                        resultCode: DriverResultCode.DeviceTimeout,
                        durationMs: GetElapsedMilliseconds(readStartedAt),
                        deviceSessionState: DeviceSessionState.Connected,
                        exceptionType: exception.GetType().Name), CancellationToken.None).ConfigureAwait(false);
                }

                throw;
            }
            catch (Exception exception) when (IsDeviceTimeoutException(exception))
            {
                if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
                {
                    await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                        level: "Warning",
                        eventName: "SignalReadFailed",
                        message: "设备通信超时",
                        eventStage: "Failed",
                        correlationId: correlationId,
                        commandName: "getSignalSnapshot",
                        activeLease: activeLease,
                        resultCode: DriverResultCode.DeviceTimeout,
                        durationMs: GetElapsedMilliseconds(readStartedAt),
                        deviceSessionState: DeviceSessionState.Connected,
                        exceptionType: exception.GetType().Name), CancellationToken.None).ConfigureAwait(false);
                }

                throw;
            }
            catch (Exception exception)
            {
                if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
                {
                    await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                        level: "Warning",
                        eventName: "SignalReadFailed",
                        message: "设备通信失败",
                        eventStage: "Failed",
                        correlationId: correlationId,
                        commandName: "getSignalSnapshot",
                        activeLease: activeLease,
                        resultCode: DriverResultCode.DeviceRejected,
                        durationMs: GetElapsedMilliseconds(readStartedAt),
                        deviceSessionState: DeviceSessionState.Connected,
                        exceptionType: exception.GetType().Name), timeoutCts.Token).ConfigureAwait(false);
                }

                throw;
            }

            if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
            {
                await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                    level: "Information",
                    eventName: "SignalReadCompleted",
                    message: "授权信号读取完成。",
                    eventStage: "Completed",
                    correlationId: correlationId,
                    commandName: "getSignalSnapshot",
                    activeLease: activeLease,
                    resultCode: DriverResultCode.Ok,
                    durationMs: GetElapsedMilliseconds(readStartedAt),
                    deviceSessionState: DeviceSessionState.Connected), timeoutCts.Token).ConfigureAwait(false);
            }

            return new GetSignalSnapshotResponse
            {
                CorrelationId = correlationId,
                ResultCode = DriverResultCode.Ok,
                Message = "信号快照获取成功",
                SignalValues = BuildSignalValues(points, values)
            };
        }
        catch (OperationCanceledException)
        {
            return new GetSignalSnapshotResponse
            {
                CorrelationId = correlationId,
                ResultCode = DriverResultCode.DeviceTimeout,
                Message = "设备通信超时",
                SignalValues = new Dictionary<string, object?>()
            };
        }
        catch (Exception exception) when (IsDeviceTimeoutException(exception))
        {
            return new GetSignalSnapshotResponse
            {
                CorrelationId = correlationId,
                ResultCode = DriverResultCode.DeviceTimeout,
                Message = "设备通信超时",
                SignalValues = new Dictionary<string, object?>()
            };
        }
        catch (Exception)
        {
            return new GetSignalSnapshotResponse
            {
                CorrelationId = correlationId,
                ResultCode = DriverResultCode.DeviceRejected,
                Message = "设备通信失败",
                SignalValues = new Dictionary<string, object?>()
            };
        }
        finally
        {
            if (lockAcquired)
            {
                _gate.Release();
            }
        }
    }

    /// <summary>
    /// 判断当前快照是否存在可用的 active lease（活跃租约）。
    /// </summary>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="activeLease">输出活跃租约。</param>
    /// <returns>存在活跃租约时返回 true。</returns>
    private static bool HasActiveLease(
        DriverStateSnapshot snapshot,
        out ActiveLeaseSummary activeLease)
    {
        if (snapshot.ActiveLease is not null
            && string.Equals(snapshot.LeaseState, LeaseState.Active, StringComparison.Ordinal))
        {
            activeLease = snapshot.ActiveLease;
            return true;
        }

        activeLease = null!;
        return false;
    }

    /// <summary>
    /// 判断当前 active lease（活跃租约）是否已经过期。
    /// </summary>
    /// <param name="activeLease">待判断的活跃租约摘要。</param>
    /// <returns>当前时间达到或超过 expiresAt（失效时间）时返回 true。</returns>
    private bool IsExpired(ActiveLeaseSummary activeLease)
    {
        return _clock.GetUtcNow() >= activeLease.ExpiresAt;
    }

    /// <summary>
    /// 读取并校验可选 identityProbe（身份探测点位）。
    /// </summary>
    /// <param name="config">当前信号配置。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>未配置或期望值匹配时返回 true。</returns>
    private async Task<bool> VerifyIdentityProbeAsync(
        SignalConfig config,
        ActiveLeaseSummary activeLease,
        string correlationId,
        string commandName,
        TimeSpan timeout,
        CancellationToken cancellationToken,
        SignalSnapshotDiagnosticMode diagnosticMode = SignalSnapshotDiagnosticMode.Full)
    {
        if (config.IdentityProbe is null)
        {
            return true;
        }

        if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
        {
            await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                level: "Information",
                eventName: "IdentityProbeStarted",
                message: "开始读取设备身份。",
                eventStage: "Start",
                correlationId: correlationId,
                commandName: commandName,
                activeLease: activeLease,
                deviceSessionState: DeviceSessionState.Connected), cancellationToken).ConfigureAwait(false);
        }

        var startedAt = Stopwatch.GetTimestamp();
        object? actualValue;
        try
        {
            actualValue = await _adapter.ReadIdentityAsync(config.IdentityProbe, timeout, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException exception)
        {
            await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                level: "Warning",
                eventName: "IdentityProbeFailed",
                message: "设备身份探测超时",
                eventStage: "Failed",
                correlationId: correlationId,
                commandName: commandName,
                activeLease: activeLease,
                resultCode: DriverResultCode.DeviceTimeout,
                durationMs: GetElapsedMilliseconds(startedAt),
                deviceSessionState: DeviceSessionState.Connected,
                exceptionType: exception.GetType().Name), CancellationToken.None).ConfigureAwait(false);
            throw;
        }
        catch (Exception exception) when (IsDeviceTimeoutException(exception))
        {
            await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                level: "Warning",
                eventName: "IdentityProbeFailed",
                message: "设备身份探测超时",
                eventStage: "Failed",
                correlationId: correlationId,
                commandName: commandName,
                activeLease: activeLease,
                resultCode: DriverResultCode.DeviceTimeout,
                durationMs: GetElapsedMilliseconds(startedAt),
                deviceSessionState: DeviceSessionState.Connected,
                exceptionType: exception.GetType().Name), CancellationToken.None).ConfigureAwait(false);
            throw;
        }
        catch (Exception exception)
        {
            await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                level: "Warning",
                eventName: "IdentityProbeFailed",
                message: "设备身份探测失败",
                eventStage: "Failed",
                correlationId: correlationId,
                commandName: commandName,
                activeLease: activeLease,
                resultCode: DriverResultCode.DeviceRejected,
                durationMs: GetElapsedMilliseconds(startedAt),
                deviceSessionState: DeviceSessionState.Connected,
                exceptionType: exception.GetType().Name), cancellationToken).ConfigureAwait(false);
            throw;
        }

        if (string.IsNullOrWhiteSpace(config.IdentityProbe.ExpectedValue))
        {
            var hasValue = actualValue is not null;
            await AppendIdentityProbeCompletedAsync(
                activeLease,
                correlationId,
                commandName,
                hasValue,
                startedAt,
                cancellationToken,
                diagnosticMode).ConfigureAwait(false);
            return hasValue;
        }

        var matched = string.Equals(
            Convert.ToString(actualValue, CultureInfo.InvariantCulture),
            config.IdentityProbe.ExpectedValue,
            StringComparison.Ordinal);
        await AppendIdentityProbeCompletedAsync(
            activeLease,
            correlationId,
            commandName,
            matched,
            startedAt,
            cancellationToken,
            diagnosticMode).ConfigureAwait(false);
        return matched;
    }

    /// <summary>
    /// 建立当前活跃租约的设备连接，并在成功后把持久化状态推进为 Connected。
    /// </summary>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private async Task ConnectActiveLeaseCoreAsync(
        DriverStateSnapshot snapshot,
        string? correlationId,
        string commandName,
        CancellationToken cancellationToken,
        SignalSnapshotDiagnosticMode diagnosticMode = SignalSnapshotDiagnosticMode.Full)
    {
        var activeLease = snapshot.ActiveLease
            ?? throw new InvalidOperationException("当前没有可连接的活跃租约。");
        var connectionKey = BuildConnectionKey(activeLease);

        if (string.Equals(snapshot.DeviceSessionState, DeviceSessionState.Connected, StringComparison.Ordinal)
            && string.Equals(activeLease.DeviceSessionState, DeviceSessionState.Connected, StringComparison.Ordinal)
            && string.Equals(_connectedLeaseKey, connectionKey, StringComparison.Ordinal))
        {
            return;
        }

        if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
        {
            await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                level: "Information",
                eventName: "DeviceConnectStarted",
                message: "开始连接活跃租约设备。",
                eventStage: "Start",
                correlationId: correlationId,
                commandName: commandName,
                activeLease: activeLease,
                deviceSessionState: snapshot.DeviceSessionState), cancellationToken).ConfigureAwait(false);
        }

        var startedAt = Stopwatch.GetTimestamp();
        try
        {
            await _adapter.ConnectAsync(activeLease.TargetEndpoint, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException exception)
        {
            if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
            {
                await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                    level: "Warning",
                    eventName: "DeviceConnectFailed",
                    message: "设备通信超时",
                    eventStage: "Failed",
                    correlationId: correlationId,
                    commandName: commandName,
                    activeLease: activeLease,
                    resultCode: DriverResultCode.DeviceTimeout,
                    durationMs: GetElapsedMilliseconds(startedAt),
                    deviceSessionState: snapshot.DeviceSessionState,
                    exceptionType: exception.GetType().Name), CancellationToken.None).ConfigureAwait(false);
            }

            throw;
        }
        catch (Exception exception) when (IsDeviceTimeoutException(exception))
        {
            if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
            {
                await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                    level: "Warning",
                    eventName: "DeviceConnectFailed",
                    message: "设备通信超时",
                    eventStage: "Failed",
                    correlationId: correlationId,
                    commandName: commandName,
                    activeLease: activeLease,
                    resultCode: DriverResultCode.DeviceTimeout,
                    durationMs: GetElapsedMilliseconds(startedAt),
                    deviceSessionState: snapshot.DeviceSessionState,
                    exceptionType: exception.GetType().Name), CancellationToken.None).ConfigureAwait(false);
            }

            throw;
        }
        catch (Exception exception)
        {
            if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
            {
                await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                    level: "Warning",
                    eventName: "DeviceConnectFailed",
                    message: "设备通信失败",
                    eventStage: "Failed",
                    correlationId: correlationId,
                    commandName: commandName,
                    activeLease: activeLease,
                    resultCode: DriverResultCode.DeviceRejected,
                    durationMs: GetElapsedMilliseconds(startedAt),
                    deviceSessionState: snapshot.DeviceSessionState,
                    exceptionType: exception.GetType().Name), cancellationToken).ConfigureAwait(false);
            }

            throw;
        }

        _connectedLeaseKey = connectionKey;

        var connectedLease = activeLease with
        {
            DeviceSessionState = DeviceSessionState.Connected
        };

        await _stateStore.SaveSnapshotAsync(
            new DriverStateSnapshot(
                connectedLease,
                snapshot.MaxSeenFencingToken,
                snapshot.LeaseState,
                DeviceSessionState.Connected),
            cancellationToken).ConfigureAwait(false);
        if (diagnosticMode == SignalSnapshotDiagnosticMode.Full)
        {
            await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
                level: "Information",
                eventName: "DeviceConnectCompleted",
                message: "活跃租约设备连接完成。",
                eventStage: "Completed",
                correlationId: correlationId,
                commandName: commandName,
                activeLease: connectedLease,
                resultCode: DriverResultCode.Ok,
                durationMs: GetElapsedMilliseconds(startedAt),
                deviceSessionState: DeviceSessionState.Connected), cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// 写入 identity probe（身份探测）完成诊断事件。
    /// </summary>
    /// <param name="activeLease">当前活跃租约摘要。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="matched">身份是否匹配。</param>
    /// <param name="startedAt">开始时间戳。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private async Task AppendIdentityProbeCompletedAsync(
        ActiveLeaseSummary activeLease,
        string correlationId,
        string commandName,
        bool matched,
        long startedAt,
        CancellationToken cancellationToken,
        SignalSnapshotDiagnosticMode diagnosticMode = SignalSnapshotDiagnosticMode.Full)
    {
        if (matched && diagnosticMode != SignalSnapshotDiagnosticMode.Full)
        {
            return;
        }

        await TryAppendDiagnosticLogAsync(CreateSessionDiagnosticLog(
            level: matched ? "Information" : "Warning",
            eventName: "IdentityProbeCompleted",
            message: matched ? "设备身份探测完成。" : "设备身份不匹配。",
            eventStage: matched ? "Completed" : "Failed",
            correlationId: correlationId,
            commandName: commandName,
            activeLease: activeLease,
            resultCode: matched ? DriverResultCode.Ok : DriverResultCode.DeviceIdentityMismatch,
            durationMs: GetElapsedMilliseconds(startedAt),
            deviceSessionState: DeviceSessionState.Connected), cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 尝试写入 diagnostic log（诊断日志）；失败时只输出中文 ILogger（日志抽象）摘要。
    /// </summary>
    /// <param name="entry">待写入的诊断日志条目。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private async Task TryAppendDiagnosticLogAsync(
        DiagnosticLogEntry entry,
        CancellationToken cancellationToken)
    {
        try
        {
            await _stateStore.AppendDiagnosticLogAsync(entry, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                "会话诊断日志写入失败，业务响应不受影响。事件：{EventName}，异常类型：{ExceptionType}",
                entry.EventName,
                exception.GetType().Name);
        }
    }

    /// <summary>
    /// 创建 session manager（会话管理器）使用的 Device（设备）诊断事件。
    /// </summary>
    /// <param name="level">日志级别。</param>
    /// <param name="eventName">稳定事件名。</param>
    /// <param name="message">中文说明。</param>
    /// <param name="eventStage">事件阶段。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="activeLease">当前活跃租约摘要。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="durationMs">耗时毫秒数。</param>
    /// <param name="deviceSessionState">设备会话状态。</param>
    /// <param name="exceptionType">异常类型。</param>
    /// <returns>返回白名单诊断日志条目。</returns>
    private static DiagnosticLogEntry CreateSessionDiagnosticLog(
        string level,
        string eventName,
        string message,
        string eventStage,
        string? correlationId,
        string commandName,
        ActiveLeaseSummary activeLease,
        string? resultCode = null,
        long? durationMs = null,
        string? deviceSessionState = null,
        string? exceptionType = null)
    {
        return DiagnosticLogEntry.Create(
            level: level,
            category: eventName == "PlanSignalReadCompleted" ? "Execution" : "Device",
            eventName: eventName,
            message: message,
            eventStage: eventStage,
            correlationId: correlationId,
            commandName: commandName,
            resultCode: resultCode,
            durationMs: durationMs,
            leaseState: activeLease.LeaseState,
            deviceSessionState: deviceSessionState ?? activeLease.DeviceSessionState,
            leaseId: activeLease.LeaseId,
            targetDeviceId: activeLease.TargetDeviceId,
            fencingToken: activeLease.FencingToken,
            exceptionType: exceptionType);
    }

    /// <summary>
    /// 生成当前进程内连接复用用的 active lease（活跃租约）标识。
    /// </summary>
    /// <param name="activeLease">当前活跃租约摘要。</param>
    /// <returns>返回租约、端点与隔离令牌组合成的连接标识。</returns>
    private static string BuildConnectionKey(ActiveLeaseSummary activeLease)
    {
        return string.Create(
            CultureInfo.InvariantCulture,
            $"{activeLease.LeaseId}|{activeLease.TargetEndpoint}|{activeLease.FencingToken}");
    }

    /// <summary>
    /// 计算从开始时间戳到当前时刻的耗时毫秒数。
    /// </summary>
    /// <param name="startedAt">开始计时的高精度时间戳。</param>
    /// <returns>返回非负耗时毫秒数。</returns>
    private static long GetElapsedMilliseconds(long startedAt)
    {
        return Math.Max(0L, (long)Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
    }

    /// <summary>
    /// 判断异常是否表示真实设备 socket timeout（套接字超时）。
    /// </summary>
    /// <param name="exception">设备适配器抛出的异常。</param>
    /// <returns>可稳定映射为 DEVICE_TIMEOUT（设备超时）时返回 true。</returns>
    /// <remarks>@author PopoY</remarks>
    private static bool IsDeviceTimeoutException(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is TimeoutException)
            {
                return true;
            }

            if (current is SocketException socketException
                && socketException.SocketErrorCode is SocketError.TimedOut)
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// 判断是否需要为 ERP bootstrap（启动引导）占位租约补本地 Mock（模拟）信号。
    /// </summary>
    /// <param name="activeLease">当前活跃租约摘要。</param>
    /// <param name="config">当前信号配置。</param>
    /// <param name="plannedPoints">已按授权规划出的点位。</param>
    /// <returns>需要补默认 Mock（模拟）点位时返回 true。</returns>
    private bool ShouldUseBootstrapMockSignals(
        ActiveLeaseSummary activeLease,
        SignalConfig config,
        IReadOnlyList<SignalPoint> plannedPoints)
    {
        return plannedPoints.Count == 0
            && string.Equals(_driverOptions.Mode, "Mock", StringComparison.OrdinalIgnoreCase)
            && string.Equals(config.Mode, "bootstrap-minimal", StringComparison.Ordinal)
            && string.Equals(activeLease.TargetEndpoint, "driver://pending", StringComparison.Ordinal);
    }

    /// <summary>
    /// 将设备读取值合并为 signal snapshot（信号快照）响应载荷。
    /// </summary>
    /// <param name="points">已授权的 signal points（信号点）。</param>
    /// <param name="rawValues">适配器返回的原始读取值。</param>
    /// <returns>旧简化点位返回 scalar（标量），ERP 点位返回带元数据的 object（对象）。</returns>
    private static IReadOnlyDictionary<string, object?> BuildSignalValues(
        IReadOnlyList<SignalPoint> points,
        IDictionary<string, object?> rawValues)
    {
        var result = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var point in points)
        {
            var key = point.EffectiveKey();
            rawValues.TryGetValue(key, out var value);
            result[key] = point.HasErpMetadata()
                ? BuildErpSignalSnapshotRow(point, value)
                : UnwrapReadResult(value);
        }

        return result;
    }

    /// <summary>
    /// 为 ERP ModbusSignals（信号配置）点位生成现有快照表可展示的 object（对象）行。
    /// </summary>
    /// <param name="point">ERP 信号点元数据。</param>
    /// <param name="value">设备读取到的当前值。</param>
    /// <returns>包含 ERP 字段与 value（数值）的快照行。</returns>
    private static Dictionary<string, object?> BuildErpSignalSnapshotRow(
        SignalPoint point,
        object? value)
    {
        var readResult = value as SignalReadResult;
        var row = point.ExtraFields.ToDictionary(
            entry => entry.Key,
            entry => (object?)entry.Value.Clone(),
            StringComparer.Ordinal);

        AddIfNotEmpty(row, "signalCode", point.SignalCode);
        AddIfNotEmpty(row, "signalName", point.SignalName);
        AddIfNotEmpty(row, "signalType", point.SignalType);
        AddIfNotEmpty(row, "registerType", point.RegisterType);
        row["registerAddress"] = point.EffectiveAddress();
        AddIfNotEmpty(row, "dataType", point.DataType);
        AddIfNotNull(row, "registerCount", point.RegisterCount);
        AddIfNotNull(row, "scaleFactor", point.ScaleFactor);
        AddIfNotNull(row, "offsetValue", point.OffsetValue);
        AddIfNotEmpty(row, "unit", point.Unit);
        AddIfNotEmpty(row, "description", point.Description);
        AddIfNotNull(row, "isActive", point.IsActive);
        AddIfNotEmpty(row, "plcAreaType", point.PlcAreaType);
        AddIfNotEmpty(row, "paramGroup", point.ParamGroup);
        row["value"] = UnwrapReadResult(value);
        if (readResult?.RawRegisters is { Count: > 0 })
        {
            row["rawRegisters"] = readResult.RawRegisters;
        }

        return row;
    }

    /// <summary>
    /// 从 SignalReadResult（信号读取结果）中取出 dashboard（仪表盘）直接展示的 value（值）。
    /// </summary>
    /// <param name="value">适配器返回的原始结果。</param>
    /// <returns>返回可直接放入 snapshot（快照）的值。</returns>
    private static object? UnwrapReadResult(object? value)
    {
        return value is SignalReadResult readResult
            ? readResult.Value
            : value;
    }

    /// <summary>
    /// 在值非空白时写入快照行字段。
    /// </summary>
    /// <param name="row">待写入的快照行。</param>
    /// <param name="key">字段名。</param>
    /// <param name="value">字段值。</param>
    private static void AddIfNotEmpty(
        IDictionary<string, object?> row,
        string key,
        string value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            row[key] = value;
        }
    }

    /// <summary>
    /// 在值非 null（空值）时写入快照行字段。
    /// </summary>
    /// <param name="row">待写入的快照行。</param>
    /// <param name="key">字段名。</param>
    /// <param name="value">字段值。</param>
    private static void AddIfNotNull(
        IDictionary<string, object?> row,
        string key,
        int? value)
    {
        if (value is not null)
        {
            row[key] = value.Value;
        }
    }
}

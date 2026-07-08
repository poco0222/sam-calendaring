/**
 * @file PressDownCountMonitorService.cs - 实现 pressDownCountMonitor（下压计数监测）。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 由 Driver Service（驱动服务）持有有界轮询、阈值判断和安全设备事件输出，禁止 QT App（Qt 应用）传入裸设备字段。
 */
using System.Collections.Concurrent;
using System.Globalization;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Monitoring;

/// <summary>
/// 提供 Driver-owned pressDownCountMonitor（驱动侧下压计数监测）能力。
/// </summary>
public sealed class PressDownCountMonitorService
{
    public const int Threshold = 5;

    private readonly DriverStateService _driverStateService;
    private readonly IModbusAdapter _adapter;
    private readonly ModbusDeviceGate _deviceGate;
    private readonly DeviceEventHub _eventHub;
    private readonly DriverOptions _options;
    private readonly TimeProvider _clock;
    private readonly ConcurrentDictionary<string, MonitorRegistration> _running = new(StringComparer.Ordinal);

    /// <summary>
    /// 初始化下压计数监测服务。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="adapter">Modbus（工业通信协议）适配器。</param>
    /// <param name="eventHub">设备事件中心。</param>
    /// <param name="options">Driver Service（驱动服务）本地配置。</param>
    /// <param name="clock">时间提供器。</param>
    public PressDownCountMonitorService(
        DriverStateService driverStateService,
        IModbusAdapter adapter,
        DeviceEventHub eventHub,
        DriverOptions options,
        TimeProvider clock)
        : this(driverStateService, adapter, new ModbusDeviceGate(), eventHub, options, clock)
    {
    }

    /// <summary>
    /// 初始化下压计数监测服务，并复用共享 Modbus gate（工业通信门闩）。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="adapter">Modbus（工业通信协议）适配器。</param>
    /// <param name="deviceGate">共享设备访问门闩。</param>
    /// <param name="eventHub">设备事件中心。</param>
    /// <param name="options">Driver Service（驱动服务）本地配置。</param>
    /// <param name="clock">时间提供器。</param>
    public PressDownCountMonitorService(
        DriverStateService driverStateService,
        IModbusAdapter adapter,
        ModbusDeviceGate deviceGate,
        DeviceEventHub eventHub,
        DriverOptions options,
        TimeProvider clock)
    {
        _driverStateService = driverStateService;
        _adapter = adapter;
        _deviceGate = deviceGate;
        _eventHub = eventHub;
        _options = options;
        _clock = clock;
    }

    /// <summary>
    /// 启动下压计数监测；该动作只读设备，不写设备。
    /// </summary>
    /// <param name="request">白名单设备命令请求。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回启动结果。</returns>
    public async Task<ExecuteDeviceCommandResponse> StartAsync(
        ExecuteDeviceCommandRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedRequest = NormalizeRequest(request);
        var snapshot = await _driverStateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
        if (!TryGetActiveLease(snapshot, out var activeLease))
        {
            return CreateResponse(normalizedRequest, DriverResultCode.LeaseInvalid, "当前没有可用租约。", snapshot);
        }

        if (_clock.GetUtcNow() >= activeLease.ExpiresAt)
        {
            return CreateResponse(normalizedRequest, DriverResultCode.LeaseExpired, "租约已过期。", snapshot, LeaseState.Expired);
        }

        if (!TryResolvePressDownCount(activeLease, out var point))
        {
            return CreateResponse(normalizedRequest, DriverResultCode.SignalNotConfigured, "下压计数信号未配置。", snapshot);
        }

        cancellationToken.ThrowIfCancellationRequested();
        var registration = new MonitorRegistration(normalizedRequest, activeLease, point, new CancellationTokenSource());
        if (!_running.TryAdd(normalizedRequest.LocalJobSessionId, registration))
        {
            return CreateResponse(
                normalizedRequest,
                DriverResultCode.MonitorAlreadyRunning,
                "下压计数监测已在运行。",
                snapshot,
                completedSteps: [],
                failedSteps: [normalizedRequest.CommandName]);
        }

        try
        {
            _ = Task.Run(() => RunMonitorAsync(registration), CancellationToken.None);
            await _eventHub.PublishAsync(
                CreateEvent(registration, DeviceEventNames.PressDownCountMonitorStarted, DriverResultCode.Ok),
                CancellationToken.None).ConfigureAwait(false);
        }
        catch
        {
            _running.TryRemove(normalizedRequest.LocalJobSessionId, out _);
            registration.StopCts.Cancel();
            registration.StopCts.Dispose();
            throw;
        }

        return CreateResponse(
            normalizedRequest,
            DriverResultCode.Ok,
            "下压计数监测已启动。",
            snapshot,
            completedSteps: [normalizedRequest.CommandName],
            failedSteps: []);
    }

    /// <summary>
    /// 显式停止下压计数监测。
    /// </summary>
    /// <param name="request">白名单设备命令请求。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回停止结果。</returns>
    public async Task<ExecuteDeviceCommandResponse> StopAsync(
        ExecuteDeviceCommandRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedRequest = NormalizeRequest(request);
        var snapshot = await _driverStateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
        var resultCode = await StopForLocalJobSessionAsync(
            normalizedRequest.LocalJobSessionId,
            normalizedRequest.CorrelationId,
            normalizedRequest.CommandName,
            CancellationToken.None).ConfigureAwait(false);

        return CreateResponse(
            normalizedRequest,
            resultCode,
            string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)
                ? "下压计数监测已停止。"
                : "下压计数监测未运行。",
            snapshot,
            completedSteps: string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)
                ? [normalizedRequest.CommandName]
                : [],
            failedSteps: string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)
                ? []
                : [normalizedRequest.CommandName]);
    }

    /// <summary>
    /// 按 localJobSessionId（本地作业会话 ID）停止监测，供 rollback/cleanup（回滚/收尾）复用。
    /// </summary>
    /// <param name="localJobSessionId">本地作业会话 ID。</param>
    /// <param name="correlationId">关联 ID。</param>
    /// <param name="commandName">触发停止的命令名。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回停止结果码。</returns>
    public async Task<string> StopForLocalJobSessionAsync(
        string localJobSessionId,
        string correlationId,
        string commandName,
        CancellationToken cancellationToken)
    {
        if (!_running.TryRemove(localJobSessionId, out var registration))
        {
            return DriverResultCode.MonitorNotRunning;
        }

        registration.StopCts.Cancel();
        await _eventHub.PublishAsync(
            CreateEvent(
                registration with { Request = registration.Request with { CorrelationId = correlationId, CommandName = commandName } },
                DeviceEventNames.PressDownCountMonitorStopped,
                DriverResultCode.Ok),
            cancellationToken).ConfigureAwait(false);
        return DriverResultCode.Ok;
    }

    /// <summary>
    /// 执行后台有界轮询，直到阈值、超时或停止。
    /// </summary>
    /// <param name="registration">监测注册信息。</param>
    private async Task RunMonitorAsync(MonitorRegistration registration)
    {
        var token = registration.StopCts.Token;
        var startedAt = _clock.GetUtcNow();
        int? lastCount = null;

        try
        {
            while (!token.IsCancellationRequested)
            {
                var snapshot = await _driverStateService.LoadSnapshotAsync(token).ConfigureAwait(false);
                if (!TryGetActiveLease(snapshot, out var currentLease)
                    || _clock.GetUtcNow() >= currentLease.ExpiresAt)
                {
                    await PublishFailureAsync(registration, DriverResultCode.LeaseExpired, token).ConfigureAwait(false);
                    await PublishStoppedAsync(registration, token).ConfigureAwait(false);
                    return;
                }

                if (!IsSameLease(registration.ActiveLease, currentLease))
                {
                    await PublishFailureAsync(registration, DriverResultCode.LeaseInvalid, token).ConfigureAwait(false);
                    await PublishStoppedAsync(registration, token).ConfigureAwait(false);
                    return;
                }

                var count = await ReadPressDownCountAsync(registration.ActiveLease, registration.Point, token).ConfigureAwait(false);
                if (lastCount != count)
                {
                    lastCount = count;
                    await _eventHub.PublishAsync(
                        CreateEvent(registration, DeviceEventNames.PressDownCountChanged, DriverResultCode.Ok, count),
                        token).ConfigureAwait(false);
                }

                if (count >= Threshold)
                {
                    await _eventHub.PublishAsync(
                        CreateEvent(
                            registration,
                            DeviceEventNames.PressDownCountThresholdReached,
                            DriverResultCode.Ok,
                            count,
                            CreateParameterIdempotencyKey(registration.Request.LocalJobSessionId)),
                        token).ConfigureAwait(false);
                    await PublishStoppedAsync(registration, token).ConfigureAwait(false);
                    return;
                }

                if (_clock.GetUtcNow() - startedAt >= TimeSpan.FromMilliseconds(MaxDurationMs()))
                {
                    await PublishFailureAsync(registration, DriverResultCode.MonitorTimeout, token).ConfigureAwait(false);
                    await PublishStoppedAsync(registration, token).ConfigureAwait(false);
                    return;
                }

                await Task.Delay(TimeSpan.FromMilliseconds(PollIntervalMs()), token).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException)
        {
            // PopoY: 显式停止路径已发送 stopped（已停止）事件，这里只安静退出。
        }
        catch (Exception)
        {
            await PublishFailureAsync(registration, DriverResultCode.DeviceRejected, CancellationToken.None).ConfigureAwait(false);
            await PublishStoppedAsync(registration, CancellationToken.None).ConfigureAwait(false);
        }
        finally
        {
            _running.TryRemove(registration.Request.LocalJobSessionId, out _);
            registration.StopCts.Dispose();
        }
    }

    /// <summary>
    /// 读取并转换 pressDownCount（下压计数）。
    /// </summary>
    /// <param name="point">已授权信号点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回整数计数。</returns>
    private async Task<int> ReadPressDownCountAsync(
        ActiveLeaseSummary activeLease,
        SignalPoint point,
        CancellationToken cancellationToken)
    {
        await _deviceGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        object? value;
        try
        {
            await _adapter.ConnectAsync(activeLease.TargetEndpoint, cancellationToken).ConfigureAwait(false);
            var values = await _adapter.ReadAsync([point], TimeSpan.FromMilliseconds(PollIntervalMs()), cancellationToken)
                .ConfigureAwait(false);
            value = values.TryGetValue(point.EffectiveKey(), out var raw)
                ? raw
                : null;
            value = value is SignalReadResult result ? result.Value : value;
        }
        finally
        {
            _deviceGate.Release();
        }

        return value switch
        {
            int number => number,
            long number => checked((int)number),
            short number => number,
            ushort number => number,
            byte number => number,
            string text when int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => 0
        };
    }

    /// <summary>
    /// 发布监测失败事件。
    /// </summary>
    /// <param name="registration">监测注册信息。</param>
    /// <param name="resultCode">失败结果码。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private async Task PublishFailureAsync(
        MonitorRegistration registration,
        string resultCode,
        CancellationToken cancellationToken)
    {
        await _eventHub.PublishAsync(
            CreateEvent(registration, DeviceEventNames.PressDownCountMonitorFailed, resultCode),
            cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 发布自然结束的 stopped lifecycle event（停止生命周期事件）。
    /// </summary>
    /// <param name="registration">监测注册信息。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private async Task PublishStoppedAsync(
        MonitorRegistration registration,
        CancellationToken cancellationToken)
    {
        await _eventHub.PublishAsync(
            CreateEvent(registration, DeviceEventNames.PressDownCountMonitorStopped, DriverResultCode.Ok),
            cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 从 active lease（活跃租约）解析 下压计数 signalName（信号名）。
    /// </summary>
    /// <param name="activeLease">活跃租约摘要。</param>
    /// <param name="point">输出信号点。</param>
    /// <returns>成功解析且在授权范围内时返回 true。</returns>
    private static bool TryResolvePressDownCount(ActiveLeaseSummary activeLease, out SignalPoint point)
    {
        var config = SignalConfig.Parse(activeLease.SignalConfigJson);
        point = config.Signals.FirstOrDefault(signal =>
            string.Equals(signal.SignalName, "下压计数", StringComparison.Ordinal)
            || string.Equals(signal.Name, "下压计数", StringComparison.Ordinal)
            || string.Equals(signal.SignalCode, "下压计数", StringComparison.Ordinal)
            || string.Equals(signal.SemanticKey, "下压计数", StringComparison.Ordinal))!;

        if (point is null)
        {
            return false;
        }

        try
        {
            var plan = SignalReadPlanner.Create(point);
            return AuthorizedSignalPlanner.IsAddressAllowed(plan.Address, activeLease.AllowedAddressRanges);
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <summary>
    /// 判断快照是否存在 active lease（活跃租约）。
    /// </summary>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="activeLease">输出活跃租约。</param>
    /// <returns>存在活跃租约时返回 true。</returns>
    private static bool TryGetActiveLease(DriverStateSnapshot snapshot, out ActiveLeaseSummary activeLease)
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
    /// 判断后台监测启动时的 lease（租约）是否仍是当前活跃租约。
    /// </summary>
    /// <param name="startedLease">启动时租约。</param>
    /// <param name="currentLease">当前租约。</param>
    /// <returns>仍是同一租约时返回 true。</returns>
    private static bool IsSameLease(ActiveLeaseSummary startedLease, ActiveLeaseSummary currentLease)
    {
        return string.Equals(startedLease.LeaseId, currentLease.LeaseId, StringComparison.Ordinal)
            && string.Equals(startedLease.TargetDeviceId, currentLease.TargetDeviceId, StringComparison.Ordinal)
            && string.Equals(startedLease.TargetEndpoint, currentLease.TargetEndpoint, StringComparison.Ordinal)
            && startedLease.FencingToken == currentLease.FencingToken;
    }

    /// <summary>
    /// 创建安全设备事件。
    /// </summary>
    /// <param name="registration">监测注册信息。</param>
    /// <param name="eventName">事件名。</param>
    /// <param name="resultCode">结果码。</param>
    /// <param name="pressDownCount">可选下压计数。</param>
    /// <param name="parameterIdempotencyKey">可选参数幂等键。</param>
    /// <returns>返回事件载荷。</returns>
    private DeviceEventStreamItem CreateEvent(
        MonitorRegistration registration,
        string eventName,
        string resultCode,
        int? pressDownCount = null,
        string? parameterIdempotencyKey = null)
    {
        return new DeviceEventStreamItem
        {
            EventId = $"evt-{Guid.NewGuid():N}",
            CorrelationId = registration.Request.CorrelationId,
            LocalJobSessionId = registration.Request.LocalJobSessionId,
            EventName = eventName,
            CommandName = registration.Request.CommandName,
            ResultCode = resultCode,
            PressDownCount = pressDownCount,
            Threshold = Threshold,
            ParameterIdempotencyKey = parameterIdempotencyKey,
            OccurredAt = _clock.GetUtcNow(),
            SnapshotValues = pressDownCount.HasValue
                ? [new DeviceEventSnapshotValue(SafeSignalCode(registration.Point), pressDownCount.Value)]
                : []
        };
    }

    /// <summary>
    /// 获取事件快照允许暴露的 safe signal code（安全信号码），不得回退到 Modbus address（地址）。
    /// </summary>
    /// <author>PopoY</author>
    /// <param name="point">信号点。</param>
    /// <returns>返回安全信号码。</returns>
    private static string SafeSignalCode(SignalPoint point)
    {
        if (!string.IsNullOrWhiteSpace(point.SignalCode) && !IsForbiddenSnapshotIdentifier(point.SignalCode))
        {
            return point.SignalCode;
        }

        if (!string.IsNullOrWhiteSpace(point.SemanticKey))
        {
            return point.SemanticKey;
        }

        if (!string.IsNullOrWhiteSpace(point.Name))
        {
            return point.Name;
        }

        return !string.IsNullOrWhiteSpace(point.SignalName)
            ? point.SignalName
            : "pressDownCount";
    }

    /// <summary>
    /// 判断 signalCode（信号编码）是否命中 SSE snapshot（服务器发送事件快照）禁止标识。
    /// </summary>
    /// <author>PopoY</author>
    /// <param name="value">待判断的 signalCode（信号编码）。</param>
    /// <returns>命中禁止标识时返回 true。</returns>
    private static bool IsForbiddenSnapshotIdentifier(string value)
    {
        return string.Equals(value, "signedLease", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "signature", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "signalConfig", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "privateKey", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "credential", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "sessionToken", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "targetEndpoint", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "deviceId", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "registerAddress", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "writeValue", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "ip", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "port", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 创建稳定响应。
    /// </summary>
    /// <param name="request">白名单请求。</param>
    /// <param name="resultCode">结果码。</param>
    /// <param name="message">中文消息。</param>
    /// <param name="snapshot">状态快照。</param>
    /// <param name="leaseStateOverride">可选租约状态覆盖。</param>
    /// <param name="completedSteps">完成步骤。</param>
    /// <param name="failedSteps">失败步骤。</param>
    /// <returns>返回设备命令响应。</returns>
    private static ExecuteDeviceCommandResponse CreateResponse(
        ExecuteDeviceCommandRequest request,
        string resultCode,
        string message,
        DriverStateSnapshot snapshot,
        string? leaseStateOverride = null,
        IReadOnlyList<string>? completedSteps = null,
        IReadOnlyList<string>? failedSteps = null)
    {
        return new ExecuteDeviceCommandResponse
        {
            CorrelationId = request.CorrelationId,
            CommandName = request.CommandName,
            LocalJobSessionId = request.LocalJobSessionId,
            IdempotencyKey = request.IdempotencyKey,
            ResultCode = resultCode,
            Message = message,
            LeaseState = leaseStateOverride ?? snapshot.LeaseState,
            DeviceSessionState = snapshot.DeviceSessionState,
            CompletedSteps = completedSteps ?? [],
            FailedSteps = failedSteps ?? []
        };
    }

    /// <summary>
    /// 规范化请求文本字段。
    /// </summary>
    /// <param name="request">原始请求。</param>
    /// <returns>返回规范化请求。</returns>
    private static ExecuteDeviceCommandRequest NormalizeRequest(ExecuteDeviceCommandRequest request)
    {
        return request with
        {
            CorrelationId = request.CorrelationId.Trim(),
            CommandName = request.CommandName.Trim(),
            LocalJobSessionId = request.LocalJobSessionId.Trim(),
            IdempotencyKey = request.IdempotencyKey.Trim()
        };
    }

    /// <summary>
    /// 生成阈值事件使用的参数幂等键。
    /// </summary>
    /// <param name="localJobSessionId">本地作业会话 ID。</param>
    /// <returns>返回稳定参数幂等键。</returns>
    private static string CreateParameterIdempotencyKey(string localJobSessionId)
    {
        return $"press-start-parameter-{localJobSessionId}";
    }

    /// <summary>
    /// 获取有效轮询间隔。
    /// </summary>
    /// <returns>返回毫秒数。</returns>
    private int PollIntervalMs()
    {
        return _options.PressDownCountPollIntervalMs > 0
            ? _options.PressDownCountPollIntervalMs
            : 1000;
    }

    /// <summary>
    /// 获取有效最长运行时间。
    /// </summary>
    /// <returns>返回毫秒数。</returns>
    private int MaxDurationMs()
    {
        return _options.PressDownCountMaxDurationMs > 0
            ? _options.PressDownCountMaxDurationMs
            : 300000;
    }

    /// <summary>
    /// 表示一条运行中的监测注册。
    /// </summary>
    /// <param name="Request">启动请求。</param>
    /// <param name="ActiveLease">启动时的活跃租约。</param>
    /// <param name="Point">下压计数信号点。</param>
    /// <param name="StopCts">停止令牌源。</param>
    private sealed record MonitorRegistration(
        ExecuteDeviceCommandRequest Request,
        ActiveLeaseSummary ActiveLease,
        SignalPoint Point,
        CancellationTokenSource StopCts);
}

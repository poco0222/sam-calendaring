/**
 * @file PressDeviceCommandExecutor.cs - 执行 press working device command（压机作业设备命令）。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 从 active lease（活跃租约）和 signalConfig（信号配置）解析 ERP legacy signalName（旧信号名），完成 Modbus write（写入）与 read-back confirmation（回读确认）。
 */
using System.Globalization;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Monitoring;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Commands;

/// <summary>
/// 提供压机设备 command（命令）的最小执行能力。
/// </summary>
public sealed class PressDeviceCommandExecutor
{
    private readonly DriverStateService _driverStateService;
    private readonly IModbusAdapter _adapter;
    private readonly PressDeviceIdempotencyStore _idempotencyStore;
    private readonly TimeProvider _clock;
    private readonly PressDownCountMonitorService? _monitorService;
    private readonly ModbusDeviceGate _deviceGate;

    /// <summary>
    /// 初始化设备命令执行器。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="adapter">Modbus（工业通信协议）适配器。</param>
    /// <param name="idempotencyStore">幂等结果存储。</param>
    /// <param name="clock">时间提供器。</param>
    public PressDeviceCommandExecutor(
        DriverStateService driverStateService,
        IModbusAdapter adapter,
        PressDeviceIdempotencyStore idempotencyStore,
        TimeProvider clock)
        : this(driverStateService, adapter, idempotencyStore, clock, null, new ModbusDeviceGate())
    {
    }

    /// <summary>
    /// 初始化设备命令执行器，并复用共享 Modbus gate（工业通信门闩）。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="adapter">Modbus（工业通信协议）适配器。</param>
    /// <param name="idempotencyStore">幂等结果存储。</param>
    /// <param name="clock">时间提供器。</param>
    /// <param name="monitorService">下压计数监测服务。</param>
    /// <param name="deviceGate">共享设备访问门闩。</param>
    public PressDeviceCommandExecutor(
        DriverStateService driverStateService,
        IModbusAdapter adapter,
        PressDeviceIdempotencyStore idempotencyStore,
        TimeProvider clock,
        PressDownCountMonitorService? monitorService,
        ModbusDeviceGate deviceGate)
    {
        _driverStateService = driverStateService;
        _adapter = adapter;
        _idempotencyStore = idempotencyStore;
        _clock = clock;
        _monitorService = monitorService;
        _deviceGate = deviceGate;
    }

    /// <summary>
    /// 执行设备命令。
    /// </summary>
    /// <param name="request">白名单请求。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回稳定命令响应。</returns>
    public async Task<ExecuteDeviceCommandResponse> ExecuteAsync(
        ExecuteDeviceCommandRequest request,
        CancellationToken cancellationToken)
    {
        var commandName = request.CommandName.Trim();
        var idempotencyKey = request.IdempotencyKey.Trim();
        if (_idempotencyStore.TryGetCompleted(idempotencyKey, out var cached))
        {
            return cached with
            {
                ResultCode = DriverResultCode.IdempotencyReplay,
                Message = "幂等请求已重放。"
            };
        }

        var snapshot = await _driverStateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
        if (!TryGetActiveLease(snapshot, out var activeLease))
        {
            return CreateResponse(request, DriverResultCode.LeaseInvalid, "租约无效或字段不完整。", snapshot);
        }

        if (_clock.GetUtcNow() >= activeLease.ExpiresAt)
        {
            return CreateResponse(request, DriverResultCode.LeaseExpired, "租约已过期。", snapshot, LeaseState.Expired);
        }

        if (!PressDeviceCommandCatalog.TryGet(commandName, out var definition))
        {
            return CreateResponse(request, DriverResultCode.CommandNotAllowed, "命令不在 Driver Service 命令目录中，当前版本不支持该命令。", snapshot);
        }

        if (!PressDeviceCommandCatalog.IsScopeAllowed(commandName, activeLease.AllowedScopes))
        {
            return CreateResponse(request, DriverResultCode.CommandNotAllowed, "命令不在租约授权范围内。", snapshot);
        }

        if (IsStartBlockedByCleanup(commandName, snapshot))
        {
            return CreateResponse(request, DriverResultCode.CleanupPending, "上次清理未完成，禁止开始加工。", snapshot);
        }

        if (IsMonitorCommand(commandName))
        {
            var monitorResponse = await ExecuteMonitorCommandAsync(request, commandName, snapshot, cancellationToken)
                .ConfigureAwait(false);
            if (IsConfirmed(monitorResponse.ResultCode))
            {
                _idempotencyStore.StoreCompleted(idempotencyKey, monitorResponse);
            }

            return monitorResponse;
        }

        await _deviceGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_idempotencyStore.TryGetCompleted(idempotencyKey, out cached))
            {
                return cached with
                {
                    ResultCode = DriverResultCode.IdempotencyReplay,
                    Message = "幂等请求已重放。"
                };
            }

            var response = await ExecuteCoreAsync(request, definition, snapshot, activeLease, cancellationToken)
                .ConfigureAwait(false);
            if (ShouldStopMonitor(commandName) && _monitorService is not null)
            {
                await _monitorService.StopForLocalJobSessionAsync(
                    request.LocalJobSessionId,
                    request.CorrelationId,
                    commandName,
                    cancellationToken).ConfigureAwait(false);
            }

            if (IsConfirmed(response.ResultCode))
            {
                _idempotencyStore.StoreCompleted(idempotencyKey, response);
            }

            return response;
        }
        finally
        {
            _deviceGate.Release();
        }
    }

    /// <summary>
    /// 预校验设备命令的 lease（租约）、scope（作用域）和 signal write authorization（信号写入授权），不连接或写入设备。
    /// </summary>
    /// <param name="request">白名单请求。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回稳定命令响应。</returns>
    public async Task<ExecuteDeviceCommandResponse> PrecheckAsync(
        ExecuteDeviceCommandRequest request,
        CancellationToken cancellationToken)
    {
        var commandName = request.CommandName.Trim();
        var snapshot = await _driverStateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
        if (!TryGetActiveLease(snapshot, out var activeLease))
        {
            return CreateResponse(request, DriverResultCode.LeaseInvalid, "租约无效或字段不完整。", snapshot);
        }

        if (_clock.GetUtcNow() >= activeLease.ExpiresAt)
        {
            return CreateResponse(request, DriverResultCode.LeaseExpired, "租约已过期。", snapshot, LeaseState.Expired);
        }

        if (!PressDeviceCommandCatalog.TryGet(commandName, out var definition))
        {
            return CreateResponse(request, DriverResultCode.CommandNotAllowed, "命令不在 Driver Service 命令目录中，当前版本不支持该命令。", snapshot);
        }

        if (!PressDeviceCommandCatalog.IsScopeAllowed(commandName, activeLease.AllowedScopes))
        {
            return CreateResponse(request, DriverResultCode.CommandNotAllowed, "命令不在租约授权范围内。", snapshot);
        }

        if (IsStartBlockedByCleanup(commandName, snapshot))
        {
            return CreateResponse(request, DriverResultCode.CleanupPending, "上次清理未完成，禁止开始加工。", snapshot);
        }

        var config = SignalConfig.Parse(activeLease.SignalConfigJson);
        var failedSteps = new List<string>();
        foreach (var step in definition.RequiredSteps)
        {
            var resultCode = ValidateStepAuthorization(step, config, activeLease, failedSteps);
            if (!string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal))
            {
                return CreateResponse(request, resultCode, MessageFor(resultCode), snapshot, failedSteps: failedSteps);
            }
        }

        foreach (var step in definition.OptionalSteps)
        {
            var resultCode = ValidateStepAuthorization(step, config, activeLease, failedSteps, optional: true);
            if (!string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal))
            {
                return CreateResponse(request, resultCode, MessageFor(resultCode), snapshot, failedSteps: failedSteps);
            }
        }

        return CreateResponse(
            request,
            DriverResultCode.Ok,
            "设备命令前置校验通过。",
            snapshot,
            completedSteps: [definition.CommandName]);
    }

    /// <summary>
    /// 执行已通过前置校验的命令。
    /// </summary>
    /// <param name="request">白名单请求。</param>
    /// <param name="definition">命令定义。</param>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="activeLease">当前活跃租约。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回命令响应。</returns>
    private async Task<ExecuteDeviceCommandResponse> ExecuteCoreAsync(
        ExecuteDeviceCommandRequest request,
        PressDeviceCommandDefinition definition,
        DriverStateSnapshot snapshot,
        ActiveLeaseSummary activeLease,
        CancellationToken cancellationToken)
    {
        var timeout = TimeSpan.FromMilliseconds(request.TimeoutMs);
        var config = SignalConfig.Parse(activeLease.SignalConfigJson);
        var completedSteps = new List<string>();
        var failedSteps = new List<string>();

        if (definition.RequiredSteps.Count == 0 && definition.OptionalSteps.Count == 0)
        {
            var precheckState = definition.CommandName == "precheckForStart"
                ? DeviceSessionState.Prechecked
                : snapshot.DeviceSessionState;
            await SaveDeviceSessionStateAsync(snapshot, precheckState, cancellationToken).ConfigureAwait(false);
            return CreateResponse(
                request,
                DriverResultCode.Ok,
                "设备命令执行成功。",
                snapshot,
                deviceSessionStateOverride: precheckState,
                completedSteps: [definition.CommandName],
                failedSteps: []);
        }

        try
        {
            await _adapter.ConnectAsync(activeLease.TargetEndpoint, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            failedSteps.Add(definition.CommandName);
            return await CreateFailedWriteResponseAsync(
                request,
                DriverResultCode.DeviceTimeout,
                snapshot,
                definition,
                completedSteps,
                failedSteps,
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception)
        {
            failedSteps.Add(definition.CommandName);
            return await CreateFailedWriteResponseAsync(
                request,
                DriverResultCode.DeviceRejected,
                snapshot,
                definition,
                completedSteps,
                failedSteps,
                cancellationToken).ConfigureAwait(false);
        }

        foreach (var step in definition.RequiredSteps)
        {
            var resultCode = await ExecuteStepAsync(
                step,
                config,
                activeLease,
                timeout,
                completedSteps,
                failedSteps,
                cancellationToken).ConfigureAwait(false);
            if (!string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal))
            {
                return await CreateFailedWriteResponseAsync(
                    request,
                    resultCode,
                    snapshot,
                    definition,
                    completedSteps,
                    failedSteps,
                    cancellationToken).ConfigureAwait(false);
            }
        }

        foreach (var step in definition.OptionalSteps)
        {
            var resultCode = await ExecuteStepAsync(
                step,
                config,
                activeLease,
                timeout,
                completedSteps,
                failedSteps,
                cancellationToken,
                optional: true).ConfigureAwait(false);
            if (!string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)
                && definition.CommandName == "cleanupDeviceSession")
            {
                return await CreateFailedWriteResponseAsync(
                    request,
                    DriverResultCode.CleanupPending,
                    snapshot,
                    definition,
                    completedSteps,
                    failedSteps,
                    cancellationToken).ConfigureAwait(false);
            }
        }

        var hasOptionalFailure = failedSteps.Count > 0;
        var successState = NextSuccessState(definition.CommandName, snapshot.DeviceSessionState);
        await SaveDeviceSessionStateAsync(snapshot, successState, cancellationToken).ConfigureAwait(false);
        return CreateResponse(
            request,
            hasOptionalFailure ? DriverResultCode.PartialOk : DriverResultCode.Ok,
            hasOptionalFailure ? "主动作成功，附属步骤需要关注。" : "设备命令执行成功。",
            snapshot,
            deviceSessionStateOverride: successState,
            completedSteps: completedSteps,
            failedSteps: failedSteps);
    }

    /// <summary>
    /// 执行单个写入步骤并验证回读结果。
    /// </summary>
    /// <param name="step">命令步骤。</param>
    /// <param name="config">信号配置。</param>
    /// <param name="activeLease">当前活跃租约。</param>
    /// <param name="timeout">单步超时。</param>
    /// <param name="completedSteps">已完成步骤集合。</param>
    /// <param name="failedSteps">失败步骤集合。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <param name="optional">当前步骤是否可选。</param>
    /// <returns>返回稳定结果码。</returns>
    private async Task<string> ExecuteStepAsync(
        PressDeviceCommandStep step,
        SignalConfig config,
        ActiveLeaseSummary activeLease,
        TimeSpan timeout,
        List<string> completedSteps,
        List<string> failedSteps,
        CancellationToken cancellationToken,
        bool optional = false)
    {
        var resultCode = ValidateStepAuthorization(step, config, activeLease, failedSteps, optional);
        if (!string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal))
        {
            return resultCode;
        }

        if (!TryResolveSignal(config, step.SignalName, out var point))
        {
            return DriverResultCode.Ok;
        }

        try
        {
            await _adapter.WriteAsync(point, step.WriteValue, timeout, cancellationToken).ConfigureAwait(false);
            var values = await _adapter.ReadAsync([point], timeout, cancellationToken).ConfigureAwait(false);
            if (values.TryGetValue(point.EffectiveKey(), out var actualValue)
                && ValuesMatch(step.WriteValue, actualValue))
            {
                completedSteps.Add(step.ResultStepKey);
                return DriverResultCode.Ok;
            }
        }
        catch (OperationCanceledException)
        {
            failedSteps.Add(step.ResultStepKey);
            return DriverResultCode.DeviceTimeout;
        }
        catch (Exception)
        {
            failedSteps.Add(step.ResultStepKey);
            return DriverResultCode.DeviceRejected;
        }

        failedSteps.Add(step.ResultStepKey);
        return DriverResultCode.DeviceRejected;
    }

    /// <summary>
    /// 校验单个 write step（写入步骤）的 signal（信号）和授权边界。
    /// </summary>
    /// <param name="step">命令步骤。</param>
    /// <param name="config">信号配置。</param>
    /// <param name="activeLease">当前活跃租约。</param>
    /// <param name="failedSteps">失败步骤集合。</param>
    /// <param name="optional">当前步骤是否可选。</param>
    /// <returns>返回稳定结果码。</returns>
    private static string ValidateStepAuthorization(
        PressDeviceCommandStep step,
        SignalConfig config,
        ActiveLeaseSummary activeLease,
        List<string> failedSteps,
        bool optional = false)
    {
        if (!TryResolveSignal(config, step.SignalName, out var point))
        {
            if (!optional)
            {
                failedSteps.Add(step.ResultStepKey);
            }

            return optional ? DriverResultCode.Ok : DriverResultCode.SignalNotConfigured;
        }

        if (!point.IsWriteCapable()
            || !TryCreateWritePlan(point, out var plan)
            || !AuthorizedSignalPlanner.IsAddressAllowed(plan.Address, activeLease.AllowedAddressRanges))
        {
            failedSteps.Add(step.ResultStepKey);
            return DriverResultCode.SignalNotWritable;
        }

        return DriverResultCode.Ok;
    }

    /// <summary>
    /// 创建写入失败响应，cleanup（收尾）失败时同步写入 CleanupPending（清理待完成）。
    /// </summary>
    /// <param name="request">白名单请求。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="definition">命令定义。</param>
    /// <param name="completedSteps">已完成步骤。</param>
    /// <param name="failedSteps">失败步骤。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回失败响应。</returns>
    private async Task<ExecuteDeviceCommandResponse> CreateFailedWriteResponseAsync(
        ExecuteDeviceCommandRequest request,
        string resultCode,
        DriverStateSnapshot snapshot,
        PressDeviceCommandDefinition definition,
        IReadOnlyList<string> completedSteps,
        IReadOnlyList<string> failedSteps,
        CancellationToken cancellationToken)
    {
        var nextState = definition.CommandName == "cleanupDeviceSession"
            ? DeviceSessionState.CleanupPending
            : snapshot.DeviceSessionState;
        if (definition.CommandName == "cleanupDeviceSession")
        {
            await SaveDeviceSessionStateAsync(snapshot, DeviceSessionState.CleanupPending, cancellationToken)
                .ConfigureAwait(false);
            resultCode = DriverResultCode.CleanupPending;
        }

        return CreateResponse(
            request,
            resultCode,
            MessageFor(resultCode),
            snapshot,
            deviceSessionStateOverride: nextState,
            completedSteps: completedSteps,
            failedSteps: failedSteps);
    }

    /// <summary>
    /// 尝试解析 signalName（信号名）对应的 signal point（信号点）。
    /// </summary>
    /// <param name="config">信号配置。</param>
    /// <param name="signalName">ERP legacy signalName（旧信号名）。</param>
    /// <param name="point">输出信号点。</param>
    /// <returns>命中时返回 true。</returns>
    private static bool TryResolveSignal(SignalConfig config, string signalName, out SignalPoint point)
    {
        var resolved = config.Signals.FirstOrDefault(signal =>
            string.Equals(signal.SignalName, signalName, StringComparison.Ordinal))
            ?? config.Signals.FirstOrDefault(signal =>
                string.Equals(signal.Name, signalName, StringComparison.Ordinal)
                || string.Equals(signal.SignalCode, signalName, StringComparison.Ordinal)
                || string.Equals(signal.SemanticKey, signalName, StringComparison.Ordinal));

        if (resolved is null)
        {
            point = null!;
            return false;
        }

        point = resolved;
        return true;
    }

    /// <summary>
    /// 判断信号点是否属于 Task2 支持的写入类型。
    /// </summary>
    /// <param name="point">信号点。</param>
    /// <returns>支持写入时返回 true。</returns>
    private static bool TryCreateWritePlan(SignalPoint point, out SignalReadPlan plan)
    {
        try
        {
            plan = SignalReadPlanner.Create(point);
            return true;
        }
        catch (NotSupportedException)
        {
            plan = null!;
            return false;
        }
        catch (InvalidOperationException)
        {
            plan = null!;
            return false;
        }
    }

    /// <summary>
    /// 判断写入值和回读值是否一致。
    /// </summary>
    /// <param name="expected">期望写入值。</param>
    /// <param name="actual">实际回读值。</param>
    /// <returns>一致时返回 true。</returns>
    private static bool ValuesMatch(object expected, object? actual)
    {
        actual = actual is SignalReadResult readResult
            ? readResult.Value
            : actual;

        if (expected is bool expectedBoolean)
        {
            return actual switch
            {
                bool actualBoolean => actualBoolean == expectedBoolean,
                byte number => (number != 0) == expectedBoolean,
                short number => (number != 0) == expectedBoolean,
                int number => (number != 0) == expectedBoolean,
                ushort number => (number != 0) == expectedBoolean,
                string text when bool.TryParse(text, out var parsed) => parsed == expectedBoolean,
                string text when ushort.TryParse(text, CultureInfo.InvariantCulture, out var parsed) => (parsed != 0) == expectedBoolean,
                _ => false
            };
        }

        return string.Equals(
            Convert.ToString(expected, CultureInfo.InvariantCulture),
            Convert.ToString(actual, CultureInfo.InvariantCulture),
            StringComparison.Ordinal);
    }

    /// <summary>
    /// 保存新的 device session state（设备会话状态）。
    /// </summary>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="deviceSessionState">新设备会话状态。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private Task SaveDeviceSessionStateAsync(
        DriverStateSnapshot snapshot,
        string deviceSessionState,
        CancellationToken cancellationToken)
    {
        if (snapshot.ActiveLease is null)
        {
            return Task.CompletedTask;
        }

        var activeLease = snapshot.ActiveLease with { DeviceSessionState = deviceSessionState };
        return _driverStateService.SaveSnapshotAsync(
            new DriverStateSnapshot(activeLease, snapshot.MaxSeenFencingToken, snapshot.LeaseState, deviceSessionState),
            cancellationToken);
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
    /// 判断 CleanupPending（清理待完成）是否阻止开始类命令。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <param name="snapshot">当前状态快照。</param>
    /// <returns>需要阻止时返回 true。</returns>
    private static bool IsStartBlockedByCleanup(string commandName, DriverStateSnapshot snapshot)
    {
        return (string.Equals(commandName, "precheckForStart", StringComparison.Ordinal)
                || string.Equals(commandName, "startDeviceSession", StringComparison.Ordinal)
                || string.Equals(commandName, "startPressDownCountMonitor", StringComparison.Ordinal))
            && string.Equals(snapshot.DeviceSessionState, DeviceSessionState.CleanupPending, StringComparison.Ordinal);
    }

    /// <summary>
    /// 判断当前命令是否由 monitor service（监测服务）执行。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <returns>监测命令返回 true。</returns>
    private static bool IsMonitorCommand(string commandName)
    {
        return string.Equals(commandName, "startPressDownCountMonitor", StringComparison.Ordinal)
            || string.Equals(commandName, "stopPressDownCountMonitor", StringComparison.Ordinal);
    }

    /// <summary>
    /// 判断当前命令成功或失败后是否都要停止 monitor（监测）。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <returns>需要停止时返回 true。</returns>
    private static bool ShouldStopMonitor(string commandName)
    {
        return string.Equals(commandName, "rollbackStartSignal", StringComparison.Ordinal)
            || string.Equals(commandName, "cleanupDeviceSession", StringComparison.Ordinal);
    }

    /// <summary>
    /// 执行 monitor command（监测命令）。
    /// </summary>
    /// <param name="request">白名单请求。</param>
    /// <param name="commandName">命令名。</param>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回设备命令响应。</returns>
    private Task<ExecuteDeviceCommandResponse> ExecuteMonitorCommandAsync(
        ExecuteDeviceCommandRequest request,
        string commandName,
        DriverStateSnapshot snapshot,
        CancellationToken cancellationToken)
    {
        if (_monitorService is null)
        {
            return Task.FromResult(CreateResponse(
                request,
                DriverResultCode.EventStreamUnavailable,
                "设备事件流暂不可用。",
                snapshot,
                failedSteps: [commandName]));
        }

        return string.Equals(commandName, "startPressDownCountMonitor", StringComparison.Ordinal)
            ? _monitorService.StartAsync(request, cancellationToken)
            : _monitorService.StopAsync(request, cancellationToken);
    }

    /// <summary>
    /// 计算命令成功后的 device session state（设备会话状态）。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <param name="currentState">当前状态。</param>
    /// <returns>返回新状态。</returns>
    private static string NextSuccessState(string commandName, string currentState)
    {
        return commandName switch
        {
            "connectMes" => DeviceSessionState.Connected,
            "precheckForStart" => DeviceSessionState.Prechecked,
            "startDeviceSession" => DeviceSessionState.Running,
            "cleanupDeviceSession" => DeviceSessionState.Connected,
            _ => currentState
        };
    }

    /// <summary>
    /// 判断结果是否可作为幂等重放结果保存。
    /// </summary>
    /// <param name="resultCode">稳定结果码。</param>
    /// <returns>可保存时返回 true。</returns>
    private static bool IsConfirmed(string resultCode)
    {
        return string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)
            || string.Equals(resultCode, DriverResultCode.PartialOk, StringComparison.Ordinal);
    }

    /// <summary>
    /// 创建稳定响应。
    /// </summary>
    /// <param name="request">白名单请求。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="message">中文消息。</param>
    /// <param name="snapshot">当前状态快照。</param>
    /// <param name="leaseStateOverride">可选租约状态覆盖。</param>
    /// <param name="deviceSessionStateOverride">可选设备状态覆盖。</param>
    /// <param name="completedSteps">已完成步骤。</param>
    /// <param name="failedSteps">失败步骤。</param>
    /// <returns>返回响应。</returns>
    private static ExecuteDeviceCommandResponse CreateResponse(
        ExecuteDeviceCommandRequest request,
        string resultCode,
        string message,
        DriverStateSnapshot snapshot,
        string? leaseStateOverride = null,
        string? deviceSessionStateOverride = null,
        IReadOnlyList<string>? completedSteps = null,
        IReadOnlyList<string>? failedSteps = null)
    {
        return new ExecuteDeviceCommandResponse
        {
            CorrelationId = request.CorrelationId.Trim(),
            CommandName = request.CommandName.Trim(),
            LocalJobSessionId = request.LocalJobSessionId.Trim(),
            IdempotencyKey = request.IdempotencyKey.Trim(),
            ResultCode = resultCode,
            Message = message,
            LeaseState = leaseStateOverride ?? snapshot.LeaseState,
            DeviceSessionState = deviceSessionStateOverride ?? snapshot.DeviceSessionState,
            CompletedSteps = completedSteps ?? Array.Empty<string>(),
            FailedSteps = failedSteps ?? Array.Empty<string>()
        };
    }

    /// <summary>
    /// 根据 resultCode（结果码）生成中文消息。
    /// </summary>
    /// <param name="resultCode">稳定结果码。</param>
    /// <returns>返回中文说明。</returns>
    private static string MessageFor(string resultCode)
    {
        return resultCode switch
        {
            DriverResultCode.SignalNotConfigured => "信号未配置。",
            DriverResultCode.SignalNotWritable => "信号不可写。",
            DriverResultCode.DeviceTimeout => "设备通信超时。",
            DriverResultCode.CleanupPending => "清理动作未完成，已进入清理待完成状态。",
            _ => "设备拒绝执行或回读校验失败。"
        };
    }
}

/**
 * @file SignalSnapshotPublisherService.cs - 后台发布授权信号快照。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 在存在 active lease（活跃租约）和 SSE subscriber（订阅者）时，定期读取 signal snapshot（信号快照）并发布 signalSnapshotChanged（信号快照变化）。
 */
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Sessions;

/// <summary>
/// 后台读取并广播授权 signal snapshot（信号快照）。
/// </summary>
public sealed class SignalSnapshotPublisherService : BackgroundService
{
    private readonly DriverSessionManager _sessionManager;
    private readonly DeviceEventHub _eventHub;
    private readonly DriverStateService _stateService;
    private readonly DriverOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<SignalSnapshotPublisherService> _logger;
    private string? _lastFailureKey;
    private DateTimeOffset? _lastFailureLoggedAt;
    private bool _hasConsecutiveFailure;

    /// <summary>
    /// 初始化 signal snapshot publisher（信号快照发布器）。
    /// </summary>
    /// <param name="sessionManager">驱动会话管理器。</param>
    /// <param name="eventHub">设备事件中心。</param>
    /// <param name="stateService">驱动状态服务。</param>
    /// <param name="options">驱动配置。</param>
    /// <param name="timeProvider">时间提供器。</param>
    /// <param name="logger">日志抽象。</param>
    public SignalSnapshotPublisherService(
        DriverSessionManager sessionManager,
        DeviceEventHub eventHub,
        DriverStateService stateService,
        DriverOptions options,
        TimeProvider timeProvider,
        ILogger<SignalSnapshotPublisherService> logger)
    {
        _sessionManager = sessionManager;
        _eventHub = eventHub;
        _stateService = stateService;
        _options = options;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    /// <summary>
    /// 运行后台发布循环。
    /// </summary>
    /// <param name="stoppingToken">服务停止令牌。</param>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _stateService.TryAppendDiagnosticLogAsync(CreateLifecycleLog("SignalSnapshotPublisherStarted", "信号快照发布服务已启动。"), stoppingToken).ConfigureAwait(false);
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await PublishOnceAsync(stoppingToken).ConfigureAwait(false);
                await Task.Delay(TimeSpan.FromMilliseconds(_options.SignalSnapshotPublisherIntervalMs), _timeProvider, stoppingToken).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogDebug("信号快照发布服务收到停止请求。");
        }
        finally
        {
            await _stateService.TryAppendDiagnosticLogAsync(CreateLifecycleLog("SignalSnapshotPublisherStopped", "信号快照发布服务已停止。"), CancellationToken.None).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// 执行一次 gated read（门控读取）与 SSE publish（服务器发送事件发布）。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    public async Task PublishOnceAsync(CancellationToken cancellationToken)
    {
        if (!_eventHub.HasSubscribers)
        {
            _logger.LogDebug("无 SSE 订阅者，跳过信号快照后台读取。");
            return;
        }

        var stateSnapshot = await _stateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
        if (stateSnapshot.ActiveLease is null
            || !string.Equals(stateSnapshot.LeaseState, LeaseState.Active, StringComparison.Ordinal))
        {
            _logger.LogDebug("无 active lease（活跃租约），跳过信号快照后台读取。");
            return;
        }

        var now = _timeProvider.GetUtcNow();
        var correlationId = $"signal-snapshot-publisher-{now:yyyyMMddHHmmssfff}";
        if (stateSnapshot.ActiveLease.ExpiresAt <= now)
        {
            await AppendFailureAsync(correlationId, DriverResultCode.LeaseExpired, null, cancellationToken).ConfigureAwait(false);
            return;
        }

        var response = await _sessionManager.GetSignalSnapshotAsync(
            correlationId,
            TimeSpan.FromSeconds(10),
            cancellationToken,
            SignalSnapshotDiagnosticMode.FailureOnly).ConfigureAwait(false);

        if (!string.Equals(response.ResultCode, DriverResultCode.Ok, StringComparison.Ordinal))
        {
            await AppendFailureAsync(correlationId, response.ResultCode, null, cancellationToken).ConfigureAwait(false);
            return;
        }

        await _eventHub.PublishAsync(new DeviceEventStreamItem
        {
            EventId = Guid.NewGuid().ToString("N"),
            CorrelationId = response.CorrelationId,
            EventName = DeviceEventNames.SignalSnapshotChanged,
            CommandName = "signalSnapshotPublisher",
            ResultCode = DriverResultCode.Ok,
            OccurredAt = _timeProvider.GetUtcNow(),
            SnapshotValues = response.SignalValues
                .Where(item => IsSafeSignalCode(item.Key))
                .Select(item => new DeviceEventSnapshotValue(item.Key, UnwrapSafeValue(item.Value)))
                .ToArray()
        }, cancellationToken).ConfigureAwait(false);

        if (_hasConsecutiveFailure)
        {
            await _stateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
                level: "Information",
                category: "Device",
                eventName: "SignalSnapshotPublisherRecovered",
                message: "信号快照后台读取已恢复。",
                eventStage: "Completed",
                correlationId: response.CorrelationId,
                commandName: "signalSnapshotPublisher",
                resultCode: DriverResultCode.Ok), cancellationToken).ConfigureAwait(false);
        }

        _hasConsecutiveFailure = false;
        _lastFailureKey = null;
        _lastFailureLoggedAt = null;
    }

    /// <summary>
    /// 创建 service lifecycle（服务生命周期）诊断日志。
    /// </summary>
    /// <param name="eventName">事件名。</param>
    /// <param name="message">中文说明。</param>
    /// <returns>返回诊断日志条目。</returns>
    private static DiagnosticLogEntry CreateLifecycleLog(string eventName, string message)
    {
        return DiagnosticLogEntry.Create(
            level: "Information",
            category: "Startup",
            eventName: eventName,
            message: message,
            eventStage: "Completed",
            commandName: "signalSnapshotPublisher",
            resultCode: DriverResultCode.Ok);
    }

    /// <summary>
    /// 按 failure key（失败键）节流写入 publisher 失败诊断日志。
    /// </summary>
    /// <param name="correlationId">关联 ID。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="exceptionType">异常类型。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private async Task AppendFailureAsync(
        string correlationId,
        string resultCode,
        string? exceptionType,
        CancellationToken cancellationToken)
    {
        var failureKey = $"{resultCode}:{exceptionType ?? string.Empty}";
        if (!ShouldLogFailure(failureKey))
        {
            _hasConsecutiveFailure = true;
            return;
        }

        await _stateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Warning",
            category: "Device",
            eventName: "SignalSnapshotPublisherReadFailed",
            message: "信号快照后台读取失败。",
            eventStage: "Failed",
            correlationId: correlationId,
            commandName: "signalSnapshotPublisher",
            resultCode: resultCode,
            exceptionType: exceptionType), cancellationToken).ConfigureAwait(false);
        _hasConsecutiveFailure = true;
        _lastFailureKey = failureKey;
        _lastFailureLoggedAt = _timeProvider.GetUtcNow();
    }

    /// <summary>
    /// 判断当前 failure key（失败键）是否允许写日志。
    /// </summary>
    /// <param name="failureKey">失败键。</param>
    /// <returns>允许写入时返回 true。</returns>
    private bool ShouldLogFailure(string failureKey)
    {
        if (!string.Equals(_lastFailureKey, failureKey, StringComparison.Ordinal))
        {
            return true;
        }

        if (_lastFailureLoggedAt is null)
        {
            return true;
        }

        var throttle = TimeSpan.FromMilliseconds(_options.SignalSnapshotPublisherFailureThrottleMs);
        return _timeProvider.GetUtcNow() - _lastFailureLoggedAt >= throttle;
    }

    /// <summary>
    /// 判断 signal code（信号码）是否允许进入 SSE payload（服务器发送事件载荷）。
    /// </summary>
    /// <param name="signalCode">待判断信号码。</param>
    /// <returns>安全时返回 true。</returns>
    private static bool IsSafeSignalCode(string signalCode)
    {
        return !string.IsNullOrWhiteSpace(signalCode)
            && !string.Equals(signalCode, "signedLease", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "signature", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "signaturePayload", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "signalConfig", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "privateKey", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "credential", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "sessionToken", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "targetEndpoint", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "ip", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "port", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "deviceId", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "registerAddress", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "writeValue", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(signalCode, "rawRegisters", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 从 ERP metadata row（元数据行）中只取安全 value（值），避免携带 rawRegisters（原始寄存器）。
    /// </summary>
    /// <param name="value">原始信号值。</param>
    /// <returns>返回可发布的安全值。</returns>
    private static object? UnwrapSafeValue(object? value)
    {
        if (value is IReadOnlyDictionary<string, object?> readOnlyRow
            && readOnlyRow.TryGetValue("value", out var readOnlyValue))
        {
            return readOnlyValue;
        }

        if (value is IDictionary<string, object?> row
            && row.TryGetValue("value", out var rowValue))
        {
            return rowValue;
        }

        return value;
    }
}

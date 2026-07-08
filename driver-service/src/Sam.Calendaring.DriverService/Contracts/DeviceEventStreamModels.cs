/**
 * @file DeviceEventStreamModels.cs - 定义 Driver device event stream（设备事件流）模型。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 固化 SSE（服务器发送事件）对外 payload（载荷）白名单，避免暴露原始 signalConfig（信号配置）和设备网络字段。
 */
namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 提供设备事件流使用的稳定事件名。
/// </summary>
public static class DeviceEventNames
{
    /// <summary>
    /// pressDownCountMonitor（下压计数监测）已启动。
    /// </summary>
    public const string PressDownCountMonitorStarted = "pressDownCountMonitorStarted";

    /// <summary>
    /// pressDownCount（下压计数）已变化。
    /// </summary>
    public const string PressDownCountChanged = "pressDownCountChanged";

    /// <summary>
    /// pressDownCount（下压计数）已达到阈值。
    /// </summary>
    public const string PressDownCountThresholdReached = "pressDownCountThresholdReached";

    /// <summary>
    /// pressDownCountMonitor（下压计数监测）失败。
    /// </summary>
    public const string PressDownCountMonitorFailed = "pressDownCountMonitorFailed";

    /// <summary>
    /// pressDownCountMonitor（下压计数监测）已停止。
    /// </summary>
    public const string PressDownCountMonitorStopped = "pressDownCountMonitorStopped";

    /// <summary>
    /// @author PopoY
    /// signal snapshot（信号快照）已由后台发布器读取并变化。
    /// </summary>
    public const string SignalSnapshotChanged = "signalSnapshotChanged";
}

/// <summary>
/// 表示单条 device event stream（设备事件流）事件。
/// </summary>
public sealed record DeviceEventStreamItem
{
    /// <summary>
    /// 获取 Driver Service（驱动服务）生成的事件 ID。
    /// </summary>
    public string EventId { get; init; } = string.Empty;

    /// <summary>
    /// 获取串联请求与事件处理的 correlationId（关联 ID）。
    /// </summary>
    public string CorrelationId { get; init; } = string.Empty;

    /// <summary>
    /// 获取 QT App（Qt 应用）侧本地作业会话 ID。
    /// </summary>
    public string LocalJobSessionId { get; init; } = string.Empty;

    /// <summary>
    /// 获取稳定事件名。
    /// </summary>
    public string EventName { get; init; } = string.Empty;

    /// <summary>
    /// 获取触发该事件的 commandName（命令名）。
    /// </summary>
    public string CommandName { get; init; } = string.Empty;

    /// <summary>
    /// 获取稳定 result code（结果码）。
    /// </summary>
    public string ResultCode { get; init; } = string.Empty;

    /// <summary>
    /// 获取安全转换后的 pressDownCount（下压计数）。
    /// </summary>
    public int? PressDownCount { get; init; }

    /// <summary>
    /// 获取 Driver Service（驱动服务）持有的固定阈值。
    /// </summary>
    public int? Threshold { get; init; }

    /// <summary>
    /// 获取阈值事件携带的参数落库幂等键。
    /// </summary>
    public string? ParameterIdempotencyKey { get; init; }

    /// <summary>
    /// 获取事件发生时间。
    /// </summary>
    public DateTimeOffset OccurredAt { get; init; }

    /// <summary>
    /// 获取只包含 safe signal code（安全信号码）和值的收窄快照。
    /// </summary>
    public IReadOnlyList<DeviceEventSnapshotValue> SnapshotValues { get; init; } = Array.Empty<DeviceEventSnapshotValue>();
}

/// <summary>
/// 表示事件中的安全信号快照值。
/// </summary>
/// <param name="SignalCode">safe signal code（安全信号码），不得是 Modbus address（地址）。</param>
/// <param name="Value">当前读取值。</param>
public sealed record DeviceEventSnapshotValue(string SignalCode, object? Value);

/**
 * @file DriverOptions.cs - 定义 Driver Service（驱动服务）运行模式和本地监听配置。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service 本地运行模式与监听端口配置。
 */
namespace Sam.Calendaring.DriverService.Options;

public sealed class DriverOptions
{
    /// <summary>
    /// Driver Service 当前使用的驱动模式。
    /// </summary>
    public string Mode { get; init; } = "Mock";

    /// <summary>
    /// QT App 调用 Driver Service 的本机回环端口。
    /// </summary>
    public int Port { get; init; } = 5096;

    /// <summary>
    /// pressDownCountMonitor（下压计数监测）的本地轮询间隔，单位毫秒。
    /// </summary>
    public int PressDownCountPollIntervalMs { get; init; } = 1000;

    /// <summary>
    /// pressDownCountMonitor（下压计数监测）的最长运行时间，单位毫秒。
    /// </summary>
    public int PressDownCountMaxDurationMs { get; init; } = 300000;

    /// <summary>
    /// @author PopoY
    /// signal snapshot publisher（信号快照发布器）读取间隔，单位毫秒。
    /// </summary>
    public int SignalSnapshotPublisherIntervalMs { get; init; } = 10000;

    /// <summary>
    /// @author PopoY
    /// signal snapshot publisher（信号快照发布器）同一失败键的诊断日志节流窗口，单位毫秒。
    /// </summary>
    public int SignalSnapshotPublisherFailureThrottleMs { get; init; } = 300000;

    /// <summary>
    /// @author PopoY
    /// diagnostic log（诊断日志）默认保留天数。
    /// </summary>
    public int DiagnosticLogRetentionDays { get; init; } = 7;

    /// <summary>
    /// @author PopoY
    /// diagnostic log cleanup（诊断日志清理）周期，单位毫秒。
    /// </summary>
    public int DiagnosticLogCleanupIntervalMs { get; init; } = 86_400_000;
}

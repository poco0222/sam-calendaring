/**
 * @file DriverResultCode.cs - 定义 Driver Service（驱动服务）稳定 result code（结果码）。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 对外暴露的稳定结果码常量。
 */
namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 提供 Driver Service V1 统一使用的稳定结果码常量。
/// </summary>
public static class DriverResultCode
{
    /// <summary>
    /// 表示请求执行成功。
    /// </summary>
    public const string Ok = "OK";

    /// <summary>
    /// 表示主动作成功但附属步骤失败。
    /// </summary>
    public const string PartialOk = "PARTIAL_OK";

    /// <summary>
    /// 表示租约无效、字段缺失或请求边界不符合要求。
    /// </summary>
    public const string LeaseInvalid = "LEASE_INVALID";

    /// <summary>
    /// 表示租约已经过期。
    /// </summary>
    public const string LeaseExpired = "LEASE_EXPIRED";

    /// <summary>
    /// 表示当前主机身份与租约声明不匹配。
    /// </summary>
    public const string HostMismatch = "HOST_MISMATCH";

    /// <summary>
    /// 表示信号配置哈希与租约声明不匹配。
    /// </summary>
    public const string SignalConfigMismatch = "SIGNAL_CONFIG_MISMATCH";

    /// <summary>
    /// 表示请求的设备命令不在允许列表中。
    /// </summary>
    public const string CommandNotAllowed = "COMMAND_NOT_ALLOWED";

    /// <summary>
    /// 表示信号未在本地 signalConfig（信号配置）中配置。
    /// </summary>
    public const string SignalNotConfigured = "SIGNAL_NOT_CONFIGURED";

    /// <summary>
    /// 表示信号未声明为 writable（可写）。
    /// </summary>
    public const string SignalNotWritable = "SIGNAL_NOT_WRITABLE";

    /// <summary>
    /// 表示隔离令牌版本已落后于当前已见最大值。
    /// </summary>
    public const string FencingTokenStale = "FENCING_TOKEN_STALE";

    /// <summary>
    /// 表示设备身份与租约期望不匹配。
    /// </summary>
    public const string DeviceIdentityMismatch = "DEVICE_IDENTITY_MISMATCH";

    /// <summary>
    /// 表示设备通信超时。
    /// </summary>
    public const string DeviceTimeout = "DEVICE_TIMEOUT";

    /// <summary>
    /// 表示设备拒绝执行或回读校验失败。
    /// </summary>
    public const string DeviceRejected = "DEVICE_REJECTED";

    /// <summary>
    /// 表示设备当前忙碌，暂时无法处理请求。
    /// </summary>
    public const string DeviceBusy = "DEVICE_BUSY";

    /// <summary>
    /// 表示清理动作尚未完成，后续操作应等待。
    /// </summary>
    public const string CleanupPending = "CLEANUP_PENDING";

    /// <summary>
    /// 表示回滚动作执行失败。
    /// </summary>
    public const string RollbackFailed = "ROLLBACK_FAILED";

    /// <summary>
    /// 表示幂等键命中已完成的历史执行。
    /// </summary>
    public const string IdempotencyReplay = "IDEMPOTENCY_REPLAY";

    /// <summary>
    /// 表示 pressDownCountMonitor（下压计数监测）已经运行。
    /// </summary>
    public const string MonitorAlreadyRunning = "MONITOR_ALREADY_RUNNING";

    /// <summary>
    /// 表示 pressDownCountMonitor（下压计数监测）当前未运行。
    /// </summary>
    public const string MonitorNotRunning = "MONITOR_NOT_RUNNING";

    /// <summary>
    /// 表示 pressDownCountMonitor（下压计数监测）等待超时。
    /// </summary>
    public const string MonitorTimeout = "MONITOR_TIMEOUT";

    /// <summary>
    /// 表示 device event stream（设备事件流）暂不可用。
    /// </summary>
    public const string EventStreamUnavailable = "EVENT_STREAM_UNAVAILABLE";

    /// <summary>
    /// 将 stable resultCode（稳定结果码）转换为诊断日志使用的中文说明。
    /// </summary>
    /// <param name="resultCode">待展示的 stable resultCode（稳定结果码）。</param>
    /// <returns>返回现场操作员可读的中文结果码说明。</returns>
    /// <remarks>@author PopoY</remarks>
    public static string ToChineseText(string? resultCode)
    {
        return resultCode switch
        {
            Ok => "请求执行成功",
            PartialOk => "请求主体执行成功，附属步骤需要关注",
            LeaseInvalid => "租约无效或字段不完整",
            LeaseExpired => "租约已过期",
            HostMismatch => "本机身份不匹配",
            SignalConfigMismatch => "信号配置哈希不匹配",
            CommandNotAllowed => "命令未获授权或不在白名单",
            SignalNotConfigured => "信号未配置",
            SignalNotWritable => "信号不可写",
            FencingTokenStale => "隔离令牌过旧",
            DeviceIdentityMismatch => "设备身份不匹配",
            DeviceTimeout => "设备通信超时",
            DeviceRejected => "设备拒绝执行",
            DeviceBusy => "设备忙碌，请稍后重试",
            CleanupPending => "上次清理未完成，禁止执行新请求",
            RollbackFailed => "回滚失败，需要人工确认",
            IdempotencyReplay => "幂等请求已重放",
            MonitorAlreadyRunning => "下压计数监测已运行",
            MonitorNotRunning => "下压计数监测未运行",
            MonitorTimeout => "下压计数监测超时",
            EventStreamUnavailable => "设备事件流不可用",
            _ => "请求处理失败"
        };
    }
}

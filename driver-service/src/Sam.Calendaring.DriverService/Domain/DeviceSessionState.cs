/**
 * @file DeviceSessionState.cs - 定义 device session（设备会话）状态常量。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 支持的最小设备会话状态常量。
 */
namespace Sam.Calendaring.DriverService.Domain;

/// <summary>
/// 提供 Driver Service V1 使用的设备会话状态常量。
/// </summary>
public static class DeviceSessionState
{
    /// <summary>
    /// 表示当前没有已建立的设备会话。
    /// </summary>
    public const string Disconnected = "Disconnected";

    /// <summary>
    /// 表示正在建立设备会话。
    /// </summary>
    public const string Connecting = "Connecting";

    /// <summary>
    /// 表示设备会话已建立。
    /// </summary>
    public const string Connected = "Connected";

    /// <summary>
    /// 表示设备已通过预检查。
    /// </summary>
    public const string Prechecked = "Prechecked";

    /// <summary>
    /// 表示设备处于运行中。
    /// </summary>
    public const string Running = "Running";

    /// <summary>
    /// 表示上次清理尚未完成。
    /// </summary>
    public const string CleanupPending = "CleanupPending";

    /// <summary>
    /// 表示设备会话进入故障状态。
    /// </summary>
    public const string Faulted = "Faulted";
}

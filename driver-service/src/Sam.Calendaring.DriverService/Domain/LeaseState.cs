/**
 * @file LeaseState.cs - 定义 lease（租约）状态常量。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 支持的最小租约状态常量。
 */
namespace Sam.Calendaring.DriverService.Domain;

/// <summary>
/// 提供 Driver Service V1 使用的租约状态常量。
/// </summary>
public static class LeaseState
{
    /// <summary>
    /// 表示当前没有可用租约。
    /// </summary>
    public const string None = "None";

    /// <summary>
    /// 表示租约已进入待生效阶段。
    /// </summary>
    public const string Pending = "Pending";

    /// <summary>
    /// 表示租约当前处于激活状态。
    /// </summary>
    public const string Active = "Active";

    /// <summary>
    /// 表示租约已被更新租约替代。
    /// </summary>
    public const string Superseded = "Superseded";

    /// <summary>
    /// 表示租约已经过期。
    /// </summary>
    public const string Expired = "Expired";

    /// <summary>
    /// 表示租约已释放。
    /// </summary>
    public const string Released = "Released";
}

/**
 * @file Driver Service 租约声明模型。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 描述签名租约载荷中的业务声明字段。
 */
namespace Sam.Calendaring.DriverService.Domain;

/// <summary>
/// 表示签名租约 payload（载荷）中的声明集合。
/// </summary>
public sealed record LeaseClaims
{
    /// <summary>
    /// 获取租约标识。
    /// </summary>
    public string LeaseId { get; init; } = string.Empty;

    /// <summary>
    /// 获取目标设备标识。
    /// </summary>
    public string TargetDeviceId { get; init; } = string.Empty;

    /// <summary>
    /// 获取目标设备端点。
    /// </summary>
    public string TargetEndpoint { get; init; } = string.Empty;

    /// <summary>
    /// 获取被授权主机标识。
    /// </summary>
    public string GranteeHostId { get; init; } = string.Empty;

    /// <summary>
    /// 获取 signalConfig（信号配置）的规范化哈希。
    /// </summary>
    public string SignalConfigHash { get; init; } = string.Empty;

    /// <summary>
    /// 获取授权 scope（作用域）列表。
    /// </summary>
    public IReadOnlyList<string> AllowedScopes { get; init; } = Array.Empty<string>();

    /// <summary>
    /// 获取授权地址范围列表。
    /// </summary>
    public IReadOnlyList<string> AllowedAddressRanges { get; init; } = Array.Empty<string>();

    /// <summary>
    /// 获取租约生效起始时间。
    /// </summary>
    public DateTimeOffset? NotBefore { get; init; }

    /// <summary>
    /// 获取租约失效时间。
    /// </summary>
    public DateTimeOffset? ExpiresAt { get; init; }

    /// <summary>
    /// 获取 fencing token（隔离令牌）。
    /// </summary>
    public long? FencingToken { get; init; }
}

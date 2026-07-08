/**
 * @file ApplyLeaseAndConfigResponse.cs - 定义 applyLeaseAndConfig（应用租约与配置）响应契约。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 /applyLeaseAndConfig 的最小响应边界，固定返回字段名称。
 */
namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 表示 /applyLeaseAndConfig 的最小响应契约。
/// </summary>
public sealed record ApplyLeaseAndConfigResponse
{
    /// <summary>
    /// 获取请求链路追踪使用的关联 ID。
    /// </summary>
    public string CorrelationId { get; init; } = string.Empty;

    /// <summary>
    /// 获取本次请求对应的稳定结果码。
    /// </summary>
    public string ResultCode { get; init; } = string.Empty;

    /// <summary>
    /// 获取本次请求返回的说明消息。
    /// </summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>
    /// 获取当前租约状态。
    /// </summary>
    public string LeaseState { get; init; } = string.Empty;

    /// <summary>
    /// 获取当前设备会话状态。
    /// </summary>
    public string DeviceSessionState { get; init; } = string.Empty;

    /// <summary>
    /// 获取当前生效租约的租约 ID。
    /// </summary>
    public string? LeaseId { get; init; }

    /// <summary>
    /// 获取当前租约指向的目标设备 ID。
    /// </summary>
    public string? TargetDeviceId { get; init; }

    /// <summary>
    /// 获取当前租约使用的隔离令牌。
    /// </summary>
    public string? FencingToken { get; init; }
}

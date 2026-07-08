/**
 * @file ActiveLeaseSummary.cs - 定义已落库 active lease（活跃租约）摘要。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 需要持久化的最小活跃租约摘要。
 */
namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 表示本地持久化的最小活跃租约摘要。
/// </summary>
/// <param name="LeaseId">当前活跃租约 ID。</param>
/// <param name="TargetDeviceId">租约绑定的目标设备 ID。</param>
/// <param name="TargetEndpoint">租约声明中的目标设备端点。</param>
/// <param name="SignalConfigJson">已验证通过的信号配置原始 JSON。</param>
/// <param name="AllowedAddressRanges">当前租约授权的可读地址范围。</param>
/// <param name="FencingToken">当前租约的 fencing token（隔离令牌）。</param>
/// <param name="ExpiresAt">当前租约的失效时间。</param>
/// <param name="LeaseState">当前持久化的租约状态。</param>
/// <param name="DeviceSessionState">当前持久化的设备会话状态。</param>
public sealed record ActiveLeaseSummary(
    string LeaseId,
    string TargetDeviceId,
    string TargetEndpoint,
    string SignalConfigJson,
    IReadOnlyList<string> AllowedAddressRanges,
    long FencingToken,
    DateTimeOffset ExpiresAt,
    string LeaseState,
    string DeviceSessionState)
{
    /// <summary>
    /// 获取当前租约授权的 scope（作用域）列表，供 semantic command（语义命令）写入校验。
    /// </summary>
    public IReadOnlyList<string> AllowedScopes { get; init; } = Array.Empty<string>();
}

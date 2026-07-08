/**
 * @file DriverStateSnapshot.cs - 定义 Driver Service（驱动服务）状态快照。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 当前最小可恢复状态快照。
 */
namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 表示 Driver Service V1 的最小状态快照。
/// </summary>
/// <param name="ActiveLease">当前活跃租约摘要；不存在时为 null。</param>
/// <param name="MaxSeenFencingToken">当前已见最大 fencing token（隔离令牌）。</param>
/// <param name="LeaseState">当前租约状态。</param>
/// <param name="DeviceSessionState">当前设备会话状态。</param>
public sealed record DriverStateSnapshot(
    ActiveLeaseSummary? ActiveLease,
    long MaxSeenFencingToken,
    string LeaseState,
    string DeviceSessionState);

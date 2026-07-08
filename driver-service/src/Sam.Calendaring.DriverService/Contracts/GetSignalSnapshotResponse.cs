/**
 * @file GetSignalSnapshotResponse.cs - 定义 getSignalSnapshot（获取信号快照）响应契约。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 /getSignalSnapshot 的最小响应边界，固定返回字段名称。
 */
namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 表示 /getSignalSnapshot 的最小响应契约。
/// </summary>
public sealed record GetSignalSnapshotResponse
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
    /// 获取当前快照返回的信号值集合。
    /// </summary>
    public IReadOnlyDictionary<string, object?> SignalValues { get; init; } =
        new Dictionary<string, object?>();
}

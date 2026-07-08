/**
 * @file GetSignalSnapshotRequest.cs - 定义 getSignalSnapshot（获取信号快照）请求契约。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 /getSignalSnapshot 的严格请求边界，拒绝未声明字段。
 */
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 表示 /getSignalSnapshot 的最小请求契约。
/// </summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record GetSignalSnapshotRequest
{
    /// <summary>
    /// 获取请求链路追踪使用的关联 ID。
    /// </summary>
    public string CorrelationId { get; init; } = string.Empty;

    /// <summary>
    /// 获取本次请求允许的超时时间，单位为毫秒。
    /// </summary>
    public int TimeoutMs { get; init; }
}

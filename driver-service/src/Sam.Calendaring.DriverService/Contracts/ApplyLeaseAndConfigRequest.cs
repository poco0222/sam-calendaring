/**
 * @file ApplyLeaseAndConfigRequest.cs - 定义 applyLeaseAndConfig（应用租约与配置）请求契约。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 /applyLeaseAndConfig 的严格请求边界，拒绝未声明字段。
 */
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 表示 /applyLeaseAndConfig 的最小请求契约。
/// </summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ApplyLeaseAndConfigRequest
{
    /// <summary>
    /// 获取请求链路追踪使用的关联 ID。
    /// </summary>
    public string CorrelationId { get; init; } = string.Empty;

    /// <summary>
    /// 获取本次请求允许的超时时间，单位为毫秒。
    /// </summary>
    public int TimeoutMs { get; init; }

    /// <summary>
    /// 获取签名租约的原始 JSON 载荷。
    /// </summary>
    public JsonElement SignedLease { get; init; }

    /// <summary>
    /// 获取信号配置的原始 JSON 载荷。
    /// </summary>
    public JsonElement SignalConfig { get; init; }
}

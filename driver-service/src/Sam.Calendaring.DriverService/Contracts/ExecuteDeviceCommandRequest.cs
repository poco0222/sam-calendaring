/**
 * @file ExecuteDeviceCommandRequest.cs - 定义 executeDeviceCommand（执行设备命令）请求契约。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 定义 /executeDeviceCommand 的严格白名单请求边界，拒绝裸设备与网络字段。
 */
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 表示 /executeDeviceCommand 的最小请求契约。
/// </summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ExecuteDeviceCommandRequest
{
    /// <summary>
    /// 获取请求链路追踪使用的 correlationId（关联 ID）。
    /// </summary>
    public string CorrelationId { get; init; } = string.Empty;

    /// <summary>
    /// 获取允许执行的 semantic command（语义命令）名称。
    /// </summary>
    public string CommandName { get; init; } = string.Empty;

    /// <summary>
    /// 获取 QT App（Qt 应用）生成的本地作业会话 ID。
    /// </summary>
    public string LocalJobSessionId { get; init; } = string.Empty;

    /// <summary>
    /// 获取幂等重放识别使用的 idempotency key（幂等键）。
    /// </summary>
    public string IdempotencyKey { get; init; } = string.Empty;

    /// <summary>
    /// 获取本次命令允许的超时时间，单位为毫秒。
    /// </summary>
    public int TimeoutMs { get; init; }
}

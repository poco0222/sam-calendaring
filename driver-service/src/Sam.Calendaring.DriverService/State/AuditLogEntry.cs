/**
 * @file AuditLogEntry.cs - 定义脱敏 audit log（审计日志）条目。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 持久化的最小脱敏审计日志结构。
 */
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 表示一条最小脱敏审计日志记录。
/// </summary>
/// <param name="CorrelationId">请求链路追踪使用的关联 ID。</param>
/// <param name="LeaseId">相关租约 ID。</param>
/// <param name="TargetDeviceId">相关目标设备 ID。</param>
/// <param name="FencingToken">相关 fencing token（隔离令牌）。</param>
/// <param name="CommandName">命令名称。</param>
/// <param name="DurationMs">命令耗时，单位毫秒。</param>
/// <param name="ResultCode">稳定结果码。</param>
/// <param name="LeaseState">当次命令结束后的租约状态。</param>
/// <param name="DeviceSessionState">当次命令结束后的设备会话状态。</param>
/// <param name="Message">中文审计说明。</param>
public sealed record AuditLogEntry(
    string CorrelationId,
    string? LeaseId,
    string? TargetDeviceId,
    long? FencingToken,
    string CommandName,
    long DurationMs,
    string ResultCode,
    string LeaseState,
    string DeviceSessionState,
    string Message)
{
    /// <summary>
    /// 创建一条带中文脱敏消息的审计日志记录。
    /// </summary>
    /// <param name="correlationId">请求链路追踪使用的关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="durationMs">命令耗时，单位毫秒。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="leaseState">命令结束后的租约状态。</param>
    /// <param name="deviceSessionState">命令结束后的设备会话状态。</param>
    /// <param name="message">待脱敏的原始消息。</param>
    /// <param name="leaseId">相关租约 ID。</param>
    /// <param name="targetDeviceId">相关目标设备 ID。</param>
    /// <param name="fencingToken">相关 fencing token（隔离令牌）。</param>
    /// <returns>返回脱敏后的审计日志记录。</returns>
    public static AuditLogEntry CreateSanitized(
        string correlationId,
        string commandName,
        long durationMs,
        string resultCode,
        string leaseState,
        string deviceSessionState,
        string? message,
        string? leaseId = null,
        string? targetDeviceId = null,
        long? fencingToken = null)
    {
        return new AuditLogEntry(
            correlationId,
            leaseId,
            null,
            null,
            commandName,
            durationMs,
            resultCode,
            leaseState,
            deviceSessionState,
            SanitizeMessage(resultCode, message));
    }

    /// <summary>
    /// 将可能泄露敏感字段或底层异常的原始消息收敛为中文安全消息。
    /// </summary>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="message">待处理的原始消息。</param>
    /// <returns>返回脱敏后的中文消息。</returns>
    private static string SanitizeMessage(string resultCode, string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return GetDefaultMessage(resultCode);
        }

        if (ContainsSensitiveContent(message))
        {
            return GetDefaultMessage(resultCode);
        }

        return message;
    }

    /// <summary>
    /// 判断原始消息是否包含敏感字段或英文异常细节。
    /// </summary>
    /// <param name="message">待判断的消息内容。</param>
    /// <returns>包含敏感内容时返回 true。</returns>
    private static bool ContainsSensitiveContent(string message)
    {
        return message.Contains("signedLease", StringComparison.OrdinalIgnoreCase)
            || message.Contains("signature", StringComparison.OrdinalIgnoreCase)
            || message.Contains("signalConfig", StringComparison.OrdinalIgnoreCase)
            || message.Contains("privateKey", StringComparison.OrdinalIgnoreCase)
            || message.Contains("credential", StringComparison.OrdinalIgnoreCase)
            || message.Contains("sessionToken", StringComparison.OrdinalIgnoreCase)
            || ContainsSensitiveFieldName(message, "registerAddress")
            || ContainsSensitiveFieldName(message, "writeValue")
            || ContainsSensitiveFieldName(message, "signalValues")
            || ContainsSensitiveFieldName(message, "snapshotValues")
            || ContainsSensitiveFieldName(message, "targetEndpoint")
            || ContainsSensitiveFieldName(message, "targetDeviceId")
            || ContainsSensitiveFieldName(message, "fencingToken")
            || ContainsSensitiveFieldName(message, "ip")
            || ContainsSensitiveFieldName(message, "port")
            || ContainsSensitiveFieldName(message, "deviceId")
            || message.Contains("Exception", StringComparison.OrdinalIgnoreCase)
            || message.Contains("failed", StringComparison.OrdinalIgnoreCase)
            || message.Contains("invalid", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 判断消息是否包含常见 key=value、JSON key 或 key: value 形式的敏感字段名。
    /// </summary>
    /// <param name="message">待判断的消息内容。</param>
    /// <param name="fieldName">敏感字段名。</param>
    /// <returns>命中敏感字段名时返回 true。</returns>
    private static bool ContainsSensitiveFieldName(string message, string fieldName)
    {
        return message.Contains(fieldName + "=", StringComparison.OrdinalIgnoreCase)
            || message.Contains(fieldName + ":", StringComparison.OrdinalIgnoreCase)
            || message.Contains("\"" + fieldName + "\"", StringComparison.OrdinalIgnoreCase)
            || message.Contains(fieldName + " {", StringComparison.OrdinalIgnoreCase)
            || message.Contains(fieldName + " ", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 根据稳定结果码返回默认中文审计消息。
    /// </summary>
    /// <param name="resultCode">稳定结果码。</param>
    /// <returns>返回对应的中文默认消息。</returns>
    private static string GetDefaultMessage(string resultCode)
    {
        return DriverResultCode.ToChineseText(resultCode);
    }
}

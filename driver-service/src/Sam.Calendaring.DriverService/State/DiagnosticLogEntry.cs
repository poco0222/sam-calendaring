/**
 * @file DiagnosticLogEntry.cs - 定义脱敏 diagnostic log（诊断日志）条目。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 定义 diagnostic_log（诊断日志表）的白名单字段模型。
 */
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 表示可写入 diagnostic_log（诊断日志表）的单条白名单事件。
/// </summary>
public sealed record DiagnosticLogEntry(
    DateTimeOffset CreatedAt,
    string Level,
    string Category,
    string StatusClass,
    string EventName,
    string? EventStage,
    string? CorrelationId,
    string? CommandName,
    string? ResultCode,
    int? HttpStatusCode,
    long? DurationMs,
    string? LeaseState,
    string? DeviceSessionState,
    string? LeaseId,
    string? TargetDeviceId,
    long? FencingToken,
    string? ExceptionType,
    string Message)
{
    /// <summary>
    /// 创建诊断日志并按 level（级别）与 resultCode（结果码）推导 statusClass（状态分类）。
    /// </summary>
    /// <param name="level">日志级别。</param>
    /// <param name="category">日志分类。</param>
    /// <param name="eventName">稳定事件名。</param>
    /// <param name="message">中文说明。</param>
    /// <param name="eventStage">事件阶段。</param>
    /// <param name="correlationId">关联 ID。</param>
    /// <param name="commandName">命令名。</param>
    /// <param name="resultCode">结果码。</param>
    /// <param name="httpStatusCode">HTTP 状态码。</param>
    /// <param name="durationMs">耗时毫秒数。</param>
    /// <param name="leaseState">租约状态。</param>
    /// <param name="deviceSessionState">设备会话状态。</param>
    /// <param name="leaseId">租约 ID。</param>
    /// <param name="targetDeviceId">目标设备 ID。</param>
    /// <param name="fencingToken">隔离令牌。</param>
    /// <param name="exceptionType">异常类型。</param>
    /// <returns>返回白名单诊断日志条目。</returns>
    public static DiagnosticLogEntry Create(
        string level,
        string category,
        string eventName,
        string message,
        string? eventStage = null,
        string? correlationId = null,
        string? commandName = null,
        string? resultCode = null,
        int? httpStatusCode = null,
        long? durationMs = null,
        string? leaseState = null,
        string? deviceSessionState = null,
        string? leaseId = null,
        string? targetDeviceId = null,
        long? fencingToken = null,
        string? exceptionType = null)
    {
        return new DiagnosticLogEntry(
            DateTimeOffset.UtcNow,
            level,
            category,
            DetermineStatusClass(level, resultCode),
            eventName,
            eventStage,
            correlationId,
            commandName,
            resultCode,
            httpStatusCode,
            durationMs,
            leaseState,
            deviceSessionState,
            leaseId,
            null,
            null,
            exceptionType,
            SanitizeMessage(message));
    }

    /// <summary>
    /// 根据日志级别和结果码计算 Normal（正常）或 Abnormal（异常）。
    /// </summary>
    /// <param name="level">日志级别。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <returns>返回状态分类。</returns>
    private static string DetermineStatusClass(string level, string? resultCode)
    {
        if (string.Equals(level, "Warning", StringComparison.Ordinal)
            || string.Equals(level, "Error", StringComparison.Ordinal)
            || (!string.IsNullOrWhiteSpace(resultCode)
                && !string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)))
        {
            return "Abnormal";
        }

        return "Normal";
    }

    /// <summary>
    /// 拦截诊断日志正文中的敏感字段名，避免上游误传原始请求片段。
    /// </summary>
    /// <param name="message">原始中文说明。</param>
    /// <returns>返回可落库的安全中文说明。</returns>
    private static string SanitizeMessage(string message)
    {
        if (ContainsSensitiveContent(message))
        {
            return "诊断事件已记录，原始说明包含敏感字段，已脱敏。";
        }

        return message;
    }

    /// <summary>
    /// 判断日志正文是否包含禁止落库的敏感字段标识。
    /// </summary>
    /// <param name="message">待检查的日志正文。</param>
    /// <returns>包含敏感标识时返回 true。</returns>
    private static bool ContainsSensitiveContent(string message)
    {
        return message.Contains("signedLease", StringComparison.OrdinalIgnoreCase)
            || message.Contains("signature", StringComparison.OrdinalIgnoreCase)
            || message.Contains("signature payload", StringComparison.OrdinalIgnoreCase)
            || message.Contains("signaturePayload", StringComparison.OrdinalIgnoreCase)
            || message.Contains("signalConfig", StringComparison.OrdinalIgnoreCase)
            || message.Contains("privateKey", StringComparison.OrdinalIgnoreCase)
            || message.Contains("credential", StringComparison.OrdinalIgnoreCase)
            || message.Contains("sessionToken", StringComparison.OrdinalIgnoreCase)
            || message.Contains("raw request", StringComparison.OrdinalIgnoreCase)
            || message.Contains("rawRequestBody", StringComparison.OrdinalIgnoreCase)
            || message.Contains("raw response", StringComparison.OrdinalIgnoreCase)
            || message.Contains("rawResponseBody", StringComparison.OrdinalIgnoreCase)
            || message.Contains("raw endpoint", StringComparison.OrdinalIgnoreCase)
            || message.Contains("targetEndpoint", StringComparison.OrdinalIgnoreCase)
            || ContainsSensitiveFieldName(message, "ip")
            || ContainsSensitiveFieldName(message, "port")
            || ContainsSensitiveFieldName(message, "deviceId")
            || ContainsSensitiveFieldName(message, "registerAddress")
            || ContainsSensitiveFieldName(message, "writeValue")
            || ContainsSensitiveFieldName(message, "signalValues")
            || ContainsSensitiveFieldName(message, "snapshotValues")
            || ContainsSensitiveFieldName(message, "targetDeviceId")
            || ContainsSensitiveFieldName(message, "fencingToken")
            || message.Contains("raw ip", StringComparison.OrdinalIgnoreCase)
            || message.Contains("raw port", StringComparison.OrdinalIgnoreCase)
            || message.Contains("deviceId override", StringComparison.OrdinalIgnoreCase);
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
}

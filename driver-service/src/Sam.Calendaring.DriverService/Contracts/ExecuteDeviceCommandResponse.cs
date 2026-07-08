/**
 * @file ExecuteDeviceCommandResponse.cs - 定义 executeDeviceCommand（执行设备命令）响应契约。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 定义 /executeDeviceCommand 的稳定响应结构，不暴露裸设备与 Modbus（工业通信协议）字段。
 */
namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 表示 /executeDeviceCommand 返回给 QT App（Qt 应用）的最小稳定响应。
/// </summary>
public sealed record ExecuteDeviceCommandResponse
{
    /// <summary>
    /// 获取请求链路追踪使用的 correlationId（关联 ID）。
    /// </summary>
    public string CorrelationId { get; init; } = string.Empty;

    /// <summary>
    /// 获取本次执行的 semantic command（语义命令）名称。
    /// </summary>
    public string CommandName { get; init; } = string.Empty;

    /// <summary>
    /// 获取 QT App（Qt 应用）侧本地作业会话 ID。
    /// </summary>
    public string LocalJobSessionId { get; init; } = string.Empty;

    /// <summary>
    /// 获取幂等重放识别使用的 idempotency key（幂等键）。
    /// </summary>
    public string IdempotencyKey { get; init; } = string.Empty;

    /// <summary>
    /// 获取稳定 result code（结果码）。
    /// </summary>
    public string ResultCode { get; init; } = string.Empty;

    /// <summary>
    /// 获取中文结果说明。
    /// </summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>
    /// 获取命令完成后的 lease state（租约状态）。
    /// </summary>
    public string LeaseState { get; init; } = string.Empty;

    /// <summary>
    /// 获取命令完成后的 device session state（设备会话状态）。
    /// </summary>
    public string DeviceSessionState { get; init; } = string.Empty;

    /// <summary>
    /// 获取已完成的稳定步骤名。
    /// </summary>
    public IReadOnlyList<string> CompletedSteps { get; init; } = Array.Empty<string>();

    /// <summary>
    /// 获取失败的稳定步骤名。
    /// </summary>
    public IReadOnlyList<string> FailedSteps { get; init; } = Array.Empty<string>();
}

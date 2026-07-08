/**
 * @file DriverResponseWriter.cs - 封装 Driver Service（驱动服务）响应写入逻辑。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供 Driver Service V1 响应状态码的最小公共映射。
 */
using Microsoft.AspNetCore.Http;
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService;

/// <summary>
/// 提供 Driver Service 响应写回时复用的最小公共映射能力。
/// </summary>
public static class DriverResponseWriter
{
    /// <summary>
    /// 根据稳定 resultCode（结果码）返回约定的 HTTP 状态码。
    /// </summary>
    /// <param name="resultCode">待映射的稳定结果码。</param>
    /// <returns>返回对应的 HTTP 状态码。</returns>
    public static int GetHttpStatus(string resultCode)
    {
        return resultCode switch
        {
            DriverResultCode.Ok => StatusCodes.Status200OK,
            DriverResultCode.PartialOk => StatusCodes.Status200OK,
            DriverResultCode.IdempotencyReplay => StatusCodes.Status200OK,
            DriverResultCode.LeaseInvalid => StatusCodes.Status400BadRequest,
            DriverResultCode.CommandNotAllowed => StatusCodes.Status400BadRequest,
            DriverResultCode.SignalNotConfigured => StatusCodes.Status400BadRequest,
            DriverResultCode.SignalNotWritable => StatusCodes.Status400BadRequest,
            DriverResultCode.HostMismatch => StatusCodes.Status403Forbidden,
            DriverResultCode.LeaseExpired => StatusCodes.Status409Conflict,
            DriverResultCode.FencingTokenStale => StatusCodes.Status409Conflict,
            DriverResultCode.CleanupPending => StatusCodes.Status409Conflict,
            DriverResultCode.RollbackFailed => StatusCodes.Status409Conflict,
            DriverResultCode.MonitorAlreadyRunning => StatusCodes.Status409Conflict,
            DriverResultCode.MonitorNotRunning => StatusCodes.Status409Conflict,
            DriverResultCode.DeviceBusy => StatusCodes.Status409Conflict,
            DriverResultCode.DeviceTimeout => StatusCodes.Status504GatewayTimeout,
            DriverResultCode.MonitorTimeout => StatusCodes.Status504GatewayTimeout,
            DriverResultCode.DeviceIdentityMismatch => StatusCodes.Status409Conflict,
            DriverResultCode.DeviceRejected => StatusCodes.Status502BadGateway,
            DriverResultCode.EventStreamUnavailable => StatusCodes.Status503ServiceUnavailable,
            DriverResultCode.SignalConfigMismatch => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };
    }
}

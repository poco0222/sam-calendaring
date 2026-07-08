/**
 * @file ErrorAndLoggingBoundaryTests.cs - 验证错误响应和日志边界。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 锁定 Task6 的状态码映射与审计日志脱敏边界。
 */
using Microsoft.AspNetCore.Http;
using Sam.Calendaring.DriverService;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证响应状态码映射与审计日志脱敏逻辑的边界行为。
/// </summary>
public sealed class ErrorAndLoggingBoundaryTests
{
    /// <summary>
    /// 验证稳定 resultCode（结果码）会映射到约定的 HTTP 状态码。
    /// </summary>
    /// <param name="resultCode">待映射的稳定结果码。</param>
    /// <param name="expectedStatusCode">期望的 HTTP 状态码。</param>
    [Theory]
    [InlineData(DriverResultCode.Ok, StatusCodes.Status200OK)]
    [InlineData(DriverResultCode.LeaseInvalid, StatusCodes.Status400BadRequest)]
    [InlineData(DriverResultCode.LeaseExpired, StatusCodes.Status409Conflict)]
    [InlineData(DriverResultCode.HostMismatch, StatusCodes.Status403Forbidden)]
    [InlineData(DriverResultCode.SignalConfigMismatch, StatusCodes.Status400BadRequest)]
    [InlineData(DriverResultCode.FencingTokenStale, StatusCodes.Status409Conflict)]
    [InlineData(DriverResultCode.DeviceIdentityMismatch, StatusCodes.Status409Conflict)]
    [InlineData(DriverResultCode.DeviceTimeout, StatusCodes.Status504GatewayTimeout)]
    [InlineData(DriverResultCode.DeviceRejected, StatusCodes.Status502BadGateway)]
    [InlineData(DriverResultCode.DeviceBusy, StatusCodes.Status409Conflict)]
    [InlineData(DriverResultCode.CleanupPending, StatusCodes.Status409Conflict)]
    public void GetHttpStatusReturnsExpectedStatusCode(string resultCode, int expectedStatusCode)
    {
        var statusCode = DriverResponseWriter.GetHttpStatus(resultCode);

        Assert.Equal(expectedStatusCode, statusCode);
    }

    /// <summary>
    /// 验证审计日志会把敏感字段和底层英文异常收敛为中文脱敏消息。
    /// </summary>
    [Fact]
    public void CreateSanitizedRemovesSensitiveFieldsAndEnglishExceptionDetails()
    {
        var entry = AuditLogEntry.CreateSanitized(
            correlationId: "cid-audit-task6-001",
            commandName: "applyLeaseAndConfig",
            durationMs: 37,
            resultCode: DriverResultCode.LeaseInvalid,
            leaseState: LeaseState.None,
            deviceSessionState: DeviceSessionState.Disconnected,
            message: "signedLease.signature invalid: InvalidOperationException: signature check failed",
            leaseId: "lease-001",
            targetDeviceId: "press-001",
            fencingToken: 11);

        Assert.Equal("cid-audit-task6-001", entry.CorrelationId);
        Assert.Equal("applyLeaseAndConfig", entry.CommandName);
        Assert.Equal(DriverResultCode.LeaseInvalid, entry.ResultCode);
        Assert.Contains("租约", entry.Message);
        Assert.DoesNotContain("signedLease", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signature", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("InvalidOperationException", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("check failed", entry.Message, StringComparison.OrdinalIgnoreCase);
    }
}

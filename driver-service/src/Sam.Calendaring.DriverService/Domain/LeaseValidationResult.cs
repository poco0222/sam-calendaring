/**
 * @file Driver Service 租约校验结果模型。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 统一表达租约校验成功或失败后的结果。
 */
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.Domain;

/// <summary>
/// 表示租约校验结果。
/// </summary>
public sealed record LeaseValidationResult
{
    /// <summary>
    /// 获取一个值，指示租约是否有效。
    /// </summary>
    public bool IsValid { get; init; }

    /// <summary>
    /// 获取稳定结果码。
    /// </summary>
    public string ResultCode { get; init; } = string.Empty;

    /// <summary>
    /// 获取中文说明消息。
    /// </summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>
    /// 获取租约状态。
    /// </summary>
    public string LeaseState { get; init; } = global::Sam.Calendaring.DriverService.Domain.LeaseState.None;

    /// <summary>
    /// 获取解析后的租约声明。
    /// </summary>
    public LeaseClaims? Claims { get; init; }

    /// <summary>
    /// 创建失败结果。
    /// </summary>
    /// <param name="resultCode">失败结果码。</param>
    /// <param name="message">中文错误消息。</param>
    /// <param name="leaseState">失败时的租约状态。</param>
    /// <returns>返回失败结果对象。</returns>
    public static LeaseValidationResult Fail(
        string resultCode,
        string message,
        string leaseState = global::Sam.Calendaring.DriverService.Domain.LeaseState.None)
    {
        return new LeaseValidationResult
        {
            IsValid = false,
            ResultCode = resultCode,
            Message = message,
            LeaseState = leaseState,
            Claims = null
        };
    }

    /// <summary>
    /// 创建成功结果。
    /// </summary>
    /// <param name="claims">校验后的租约声明。</param>
    /// <returns>返回成功结果对象。</returns>
    public static LeaseValidationResult Ok(LeaseClaims claims)
    {
        return new LeaseValidationResult
        {
            IsValid = true,
            ResultCode = DriverResultCode.Ok,
            Message = "租约校验通过",
            LeaseState = global::Sam.Calendaring.DriverService.Domain.LeaseState.Active,
            Claims = claims
        };
    }
}

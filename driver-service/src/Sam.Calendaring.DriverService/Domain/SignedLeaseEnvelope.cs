/**
 * @file Driver Service 签名租约信封模型。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 描述 /applyLeaseAndConfig 接收的 signedLease（签名租约）外层结构。
 */
namespace Sam.Calendaring.DriverService.Domain;

/// <summary>
/// 表示 Driver Service V1 接收的签名租约信封。
/// </summary>
public sealed record SignedLeaseEnvelope
{
    /// <summary>
    /// 获取签名算法标识。
    /// </summary>
    public string Alg { get; init; } = string.Empty;

    /// <summary>
    /// 获取签名密钥标识。
    /// </summary>
    public string Kid { get; init; } = string.Empty;

    /// <summary>
    /// 获取待验签的原始 payload JSON（载荷 JSON 字符串）。
    /// </summary>
    public string PayloadJson { get; init; } = string.Empty;

    /// <summary>
    /// 获取 Base64Url（URL 安全 Base64）编码的签名值。
    /// </summary>
    public string Signature { get; init; } = string.Empty;
}

/**
 * @file HostIdentityOptions.cs - 定义本机 host identity（主机身份）配置。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义后续租约校验所需的本机身份和公钥配置。
 */
namespace Sam.Calendaring.DriverService.Options;

public sealed class HostIdentityOptions
{
    /// <summary>
    /// 租约中的被授权主机标识。
    /// </summary>
    public string GranteeHostId { get; init; } = "SAM-LOCAL-HOST";

    /// <summary>
    /// 用于离线验签的公钥 PEM 文本。
    /// </summary>
    public string PublicKeyPem { get; init; } = string.Empty;
}

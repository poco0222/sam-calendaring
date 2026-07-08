/**
 * @file Driver Service Base64Url 帮助类。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供签名与哈希使用的 Base64Url 编解码能力。
 */
namespace Sam.Calendaring.DriverService.Security;

/// <summary>
/// 提供 Base64Url（URL 安全 Base64）编码与解码能力。
/// </summary>
public static class Base64Url
{
    /// <summary>
    /// 将 Base64Url（URL 安全 Base64）字符串解码为字节数组。
    /// </summary>
    /// <param name="value">待解码的 Base64Url 字符串。</param>
    /// <returns>返回解码后的字节数组。</returns>
    public static byte[] Decode(string value)
    {
        var normalized = value.Replace('-', '+').Replace('_', '/');
        var paddingLength = (4 - (normalized.Length % 4)) % 4;

        if (paddingLength > 0)
        {
            normalized = normalized.PadRight(normalized.Length + paddingLength, '=');
        }

        return Convert.FromBase64String(normalized);
    }

    /// <summary>
    /// 将字节数组编码为 Base64Url（URL 安全 Base64）字符串。
    /// </summary>
    /// <param name="value">待编码的字节数组。</param>
    /// <returns>返回 Base64Url 编码字符串。</returns>
    public static string Encode(byte[] value)
    {
        return Convert.ToBase64String(value)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}

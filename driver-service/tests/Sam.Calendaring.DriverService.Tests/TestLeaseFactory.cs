/**
 * @file Driver Service 测试租约工厂。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 为 Lease Validation（租约校验）测试生成签名租约、公钥和可控时钟。
 */
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.Security;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 提供 Lease Validation（租约校验）测试所需的签名租约与验证器构造能力。
/// </summary>
internal static class TestLeaseFactory
{
    /// <summary>
    /// 创建使用固定时钟的租约校验器。
    /// </summary>
    /// <param name="publicKeyPem">用于离线验签的 RSA（Rivest-Shamir-Adleman）公钥 PEM。</param>
    /// <param name="hostId">当前测试主机身份。</param>
    /// <param name="utcNow">校验时使用的当前 UTC（协调世界时）时间。</param>
    /// <returns>返回用于测试的租约校验器。</returns>
    public static LeaseValidator CreateValidator(string publicKeyPem, string hostId, DateTimeOffset utcNow)
    {
        return new LeaseValidator(
            new HostIdentityOptions
            {
                PublicKeyPem = publicKeyPem,
                GranteeHostId = hostId
            },
            new FixedTimeProvider(utcNow));
    }

    /// <summary>
    /// 创建一个处于有效时间窗内的测试租约。
    /// </summary>
    /// <param name="fencingToken">租约内的 fencing token（隔离令牌）。</param>
    /// <param name="missingEnvelopeField">可选的缺失签名信封字段名。</param>
    /// <param name="missingClaimField">可选的缺失租约声明字段名。</param>
    /// <param name="tamperSignature">是否在签名生成后故意篡改签名内容。</param>
    /// <param name="referenceNow">用于生成时间窗的参考时间；未传入时使用固定测试时间。</param>
    /// <param name="allowedScopes">可选的授权 scope（作用域）覆盖值。</param>
    /// <param name="allowedAddressRanges">可选的授权地址范围覆盖值。</param>
    /// <param name="signalConfig">可选的 signalConfig（信号配置）JSON 覆盖值。</param>
    /// <param name="signalConfigHash">可选的 signalConfigHash（信号配置哈希）覆盖值。</param>
    /// <returns>返回带签名租约、配置与公钥的测试夹具。</returns>
    public static TestLeaseFixture CreateValidLease(
        long fencingToken = 10,
        string? missingEnvelopeField = null,
        string? missingClaimField = null,
        bool tamperSignature = false,
        DateTimeOffset? referenceNow = null,
        IReadOnlyList<string>? allowedScopes = null,
        IReadOnlyList<string>? allowedAddressRanges = null,
        string? signalConfig = null,
        string? signalConfigHash = null)
    {
        var now = referenceNow ?? TestNow;

        return CreateLease(
            fencingToken,
            notBefore: now.AddMinutes(-1),
            expiresAt: now.AddMinutes(10),
            missingEnvelopeField,
            missingClaimField,
            tamperSignature,
            allowedScopes,
            allowedAddressRanges,
            signalConfig,
            signalConfigHash);
    }

    /// <summary>
    /// 创建一个已经过期的测试租约。
    /// </summary>
    /// <param name="referenceNow">用于生成时间窗的参考时间；未传入时使用固定测试时间。</param>
    /// <param name="missingClaimField">可选的缺失租约声明字段名。</param>
    /// <returns>返回过期租约夹具。</returns>
    public static TestLeaseFixture CreateExpiredLease(
        DateTimeOffset? referenceNow = null,
        string? missingClaimField = null)
    {
        var now = referenceNow ?? TestNow;

        return CreateLease(
            fencingToken: 10,
            notBefore: now.AddMinutes(-20),
            expiresAt: now.AddMinutes(-10),
            missingEnvelopeField: null,
            missingClaimField: missingClaimField,
            tamperSignature: false,
            allowedScopes: null,
            allowedAddressRanges: null,
            signalConfigOverride: null,
            signalConfigHashOverride: null);
    }

    /// <summary>
    /// 获取测试统一使用的当前时间。
    /// </summary>
    internal static DateTimeOffset TestNow { get; } = new(2026, 6, 26, 10, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// 创建带签名的租约夹具。
    /// </summary>
    /// <param name="fencingToken">租约内的 fencing token（隔离令牌）。</param>
    /// <param name="notBefore">租约起始生效时间。</param>
    /// <param name="expiresAt">租约失效时间。</param>
    /// <param name="missingEnvelopeField">可选的缺失签名信封字段名。</param>
    /// <param name="missingClaimField">可选的缺失租约声明字段名。</param>
    /// <param name="tamperSignature">是否篡改签名。</param>
    /// <param name="allowedScopes">可选的授权 scope（作用域）覆盖值。</param>
    /// <param name="allowedAddressRanges">可选的授权地址范围覆盖值。</param>
    /// <param name="signalConfigOverride">可选的 signalConfig（信号配置）JSON 覆盖值。</param>
    /// <param name="signalConfigHashOverride">可选的 signalConfigHash（信号配置哈希）覆盖值。</param>
    /// <returns>返回测试夹具。</returns>
    private static TestLeaseFixture CreateLease(
        long fencingToken,
        DateTimeOffset notBefore,
        DateTimeOffset expiresAt,
        string? missingEnvelopeField,
        string? missingClaimField,
        bool tamperSignature,
        IReadOnlyList<string>? allowedScopes,
        IReadOnlyList<string>? allowedAddressRanges,
        string? signalConfigOverride,
        string? signalConfigHashOverride)
    {
        using var rsa = RSA.Create(2048);
        var signalConfig = signalConfigOverride ?? """{"signals":[{"address":100,"name":"pressure"}]}""";
        var claims = new LeaseClaims
        {
            LeaseId = "lease-001",
            TargetDeviceId = "press-001",
            TargetEndpoint = "192.168.19.110:502",
            GranteeHostId = "SAM-LOCAL-HOST",
            SignalConfigHash = signalConfigHashOverride ?? CanonicalJsonHasher.Sha256Base64Url(signalConfig),
            AllowedScopes = allowedScopes ?? ["read"],
            AllowedAddressRanges = allowedAddressRanges ?? ["100-120"],
            NotBefore = notBefore,
            ExpiresAt = expiresAt,
            FencingToken = fencingToken
        };

        var payload = new Dictionary<string, object?>
        {
            ["leaseId"] = claims.LeaseId,
            ["targetDeviceId"] = claims.TargetDeviceId,
            ["targetEndpoint"] = claims.TargetEndpoint,
            ["granteeHostId"] = claims.GranteeHostId,
            ["signalConfigHash"] = claims.SignalConfigHash,
            ["allowedScopes"] = claims.AllowedScopes,
            ["allowedAddressRanges"] = claims.AllowedAddressRanges,
            ["notBefore"] = claims.NotBefore,
            ["expiresAt"] = claims.ExpiresAt,
            ["fencingToken"] = claims.FencingToken
        };

        if (!string.IsNullOrWhiteSpace(missingClaimField))
        {
            payload.Remove(missingClaimField);
        }

        var payloadJson = JsonSerializer.Serialize(payload, DriverJson.Options);
        var signatureBytes = rsa.SignData(
            Encoding.UTF8.GetBytes(payloadJson),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        var signature = Base64Url.Encode(signatureBytes);

        if (tamperSignature)
        {
            // PopoY: 先解码再翻转中间有效字节，确保篡改一定改变签名字节本身，而不是只改到 Base64Url 尾部的无效编码位。
            var tamperedSignatureBytes = Base64Url.Decode(signature);
            var tamperIndex = tamperedSignatureBytes.Length / 2;
            tamperedSignatureBytes[tamperIndex] ^= 0x01;
            signature = Base64Url.Encode(tamperedSignatureBytes);
        }

        var envelope = new Dictionary<string, object?>
        {
            ["alg"] = "RS256",
            ["kid"] = "test-key",
            ["payloadJson"] = payloadJson,
            ["signature"] = signature
        };

        if (!string.IsNullOrWhiteSpace(missingEnvelopeField))
        {
            envelope.Remove(missingEnvelopeField);
        }

        return new TestLeaseFixture(
            SignedLease: JsonSerializer.Serialize(envelope, DriverJson.Options),
            SignalConfig: signalConfig,
            PublicKeyPem: rsa.ExportRSAPublicKeyPem());
    }

    /// <summary>
    /// 为测试提供固定时间的 TimeProvider（时间提供器）。
    /// </summary>
    /// <param name="utcNow">固定返回的 UTC（协调世界时）时间。</param>
    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        /// <summary>
        /// 获取固定的 UTC（协调世界时）时间。
        /// </summary>
        /// <returns>返回测试指定的固定时间。</returns>
        public override DateTimeOffset GetUtcNow()
        {
            return utcNow;
        }
    }
}

/// <summary>
/// 表示测试用的租约签名夹具。
/// </summary>
/// <param name="SignedLease">签名租约 JSON。</param>
/// <param name="SignalConfig">对应的信号配置 JSON。</param>
/// <param name="PublicKeyPem">用于验签的公钥 PEM。</param>
internal sealed record TestLeaseFixture(
    string SignedLease,
    string SignalConfig,
    string PublicKeyPem);

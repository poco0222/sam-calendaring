/**
 * @file Driver Service 租约校验器。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 按 spec（规格）顺序执行签名租约的离线校验。
 */
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Options;

namespace Sam.Calendaring.DriverService.Security;

/// <summary>
/// 提供 signedLease（签名租约）的离线校验能力。
/// </summary>
public sealed class LeaseValidator
{
    private const string MockUnsignedBootstrapSignature = "UNSIGNED_BOOTSTRAP_PLACEHOLDER";

    private readonly HostIdentityOptions _hostOptions;
    private readonly TimeProvider _clock;
    private readonly DriverOptions _driverOptions;

    /// <summary>
    /// 初始化租约校验器。
    /// </summary>
    /// <param name="hostOptions">本机身份与验签公钥配置。</param>
    /// <param name="clock">当前时间提供器。</param>
    /// <param name="driverOptions">Driver Service（驱动服务）运行模式配置。</param>
    public LeaseValidator(HostIdentityOptions hostOptions, TimeProvider clock, DriverOptions? driverOptions = null)
    {
        _hostOptions = hostOptions;
        _clock = clock;
        _driverOptions = driverOptions ?? new DriverOptions();
    }

    /// <summary>
    /// 校验签名租约、信号配置哈希与 fencing token（隔离令牌）。
    /// </summary>
    /// <param name="signedLeaseJson">signedLease（签名租约）原始 JSON。</param>
    /// <param name="signalConfigJson">signalConfig（信号配置）原始 JSON。</param>
    /// <param name="maxSeenFencingToken">当前已见的最大 fencing token（隔离令牌）。</param>
    /// <returns>返回校验结果。</returns>
    public LeaseValidationResult Validate(string signedLeaseJson, string signalConfigJson, long maxSeenFencingToken)
    {
        if (!TryDeserializeEnvelope(signedLeaseJson, out var envelope))
        {
            if (IsMockMode()
                && TryDeserializeMockUnsignedBootstrapLease(signedLeaseJson, out var mockClaims, out var signature)
                && string.Equals(signature, MockUnsignedBootstrapSignature, StringComparison.Ordinal))
            {
                return ValidateMockUnsignedBootstrapClaims(mockClaims, maxSeenFencingToken);
            }

            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        if (!StringComparer.Ordinal.Equals(envelope.Alg, "RS256"))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约签名算法不受支持");
        }

        if (!TryVerifySignature(envelope.PayloadJson, envelope.Signature))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约签名无效");
        }

        if (!TryDeserializeClaims(envelope.PayloadJson, out var claims))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        if (claims.NotBefore is null || claims.ExpiresAt is null)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        var now = _clock.GetUtcNow();
        if (now < claims.NotBefore.Value || now >= claims.ExpiresAt.Value)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseExpired, "租约已过期", "Expired");
        }

        if (string.IsNullOrWhiteSpace(claims.GranteeHostId))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        if (!StringComparer.Ordinal.Equals(claims.GranteeHostId, _hostOptions.GranteeHostId))
        {
            return LeaseValidationResult.Fail(DriverResultCode.HostMismatch, "本机身份不匹配");
        }

        if (string.IsNullOrWhiteSpace(claims.LeaseId)
            || string.IsNullOrWhiteSpace(claims.TargetDeviceId)
            || string.IsNullOrWhiteSpace(claims.TargetEndpoint))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        if (string.IsNullOrWhiteSpace(claims.SignalConfigHash))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        string signalConfigHash;
        try
        {
            signalConfigHash = CanonicalJsonHasher.Sha256Base64Url(signalConfigJson);
        }
        catch (JsonException)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "信号配置格式不正确");
        }
        catch (InvalidOperationException)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "信号配置格式不正确");
        }

        if (!StringComparer.Ordinal.Equals(claims.SignalConfigHash, signalConfigHash))
        {
            return LeaseValidationResult.Fail(DriverResultCode.SignalConfigMismatch, "信号配置哈希不匹配");
        }

        if (claims.FencingToken is null)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        // ponytail: Task3 先用调用方传入的 maxSeenFencingToken，持久化读取放到 Task4 再接入。
        if (claims.FencingToken.Value < maxSeenFencingToken)
        {
            return LeaseValidationResult.Fail(DriverResultCode.FencingTokenStale, "隔离令牌过旧");
        }

        if (!HasValidAllowedScopes(claims.AllowedScopes) || !HasValidAllowedAddressRanges(claims.AllowedAddressRanges))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        return LeaseValidationResult.Ok(claims);
    }

    /// <summary>
    /// 判断当前是否为 Mock Mode（模拟模式）。
    /// </summary>
    /// <returns>配置为 Mock 时返回 true。</returns>
    private bool IsMockMode()
    {
        return string.Equals(_driverOptions.Mode, "Mock", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 尝试解析 ERP bootstrap（启动引导）阶段遗留的未签名占位租约。
    /// </summary>
    /// <param name="signedLeaseJson">signedLease（签名租约）原始 JSON。</param>
    /// <param name="claims">成功时输出转换后的租约声明。</param>
    /// <param name="signature">成功时输出占位签名标记。</param>
    /// <returns>结构可解析时返回 true。</returns>
    private static bool TryDeserializeMockUnsignedBootstrapLease(
        string signedLeaseJson,
        out LeaseClaims claims,
        out string signature)
    {
        try
        {
            var lease = JsonSerializer.Deserialize<MockUnsignedBootstrapLease>(
                signedLeaseJson,
                new JsonSerializerOptions(JsonSerializerDefaults.Web))
                ?? new MockUnsignedBootstrapLease();
            signature = lease.Signature;
            claims = new LeaseClaims
            {
                LeaseId = lease.LeaseId,
                TargetDeviceId = lease.TargetDeviceId,
                TargetEndpoint = lease.TargetEndpoint,
                GranteeHostId = lease.GranteeHostId,
                SignalConfigHash = lease.SignalConfigHash,
                AllowedScopes = lease.AllowedScopes,
                AllowedAddressRanges = lease.AllowedAddressRanges,
                NotBefore = lease.NotBefore,
                ExpiresAt = lease.ExpiresAt,
                FencingToken = lease.FencingToken
            };

            return true;
        }
        catch (JsonException)
        {
            signature = string.Empty;
            claims = new LeaseClaims();
            return false;
        }
    }

    /// <summary>
    /// 校验 Mock Mode（模拟模式）下 ERP 占位租约的最小字段与时间窗。
    /// </summary>
    /// <param name="claims">从占位租约转换出的租约声明。</param>
    /// <param name="maxSeenFencingToken">当前已见的最大 fencing token（隔离令牌）。</param>
    /// <returns>返回校验结果。</returns>
    private LeaseValidationResult ValidateMockUnsignedBootstrapClaims(
        LeaseClaims claims,
        long maxSeenFencingToken)
    {
        if (claims.NotBefore is null || claims.ExpiresAt is null)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        var now = _clock.GetUtcNow();
        if (now < claims.NotBefore.Value || now >= claims.ExpiresAt.Value)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseExpired, "租约已过期", "Expired");
        }

        if (string.IsNullOrWhiteSpace(claims.LeaseId)
            || string.IsNullOrWhiteSpace(claims.TargetDeviceId)
            || string.IsNullOrWhiteSpace(claims.TargetEndpoint)
            || string.IsNullOrWhiteSpace(claims.GranteeHostId)
            || string.IsNullOrWhiteSpace(claims.SignalConfigHash)
            || claims.FencingToken is null
            || !HasValidAllowedScopes(claims.AllowedScopes))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        // PopoY: Mock bootstrap 只解本地联调卡死；Real mode 仍必须走 RS256 envelope（签名信封）校验。
        if (claims.FencingToken.Value < maxSeenFencingToken)
        {
            return LeaseValidationResult.Fail(DriverResultCode.FencingTokenStale, "隔离令牌过旧");
        }

        return LeaseValidationResult.Ok(claims);
    }

    /// <summary>
    /// 尝试反序列化租约信封并验证关键字段存在。
    /// </summary>
    /// <param name="signedLeaseJson">signedLease（签名租约）原始 JSON。</param>
    /// <param name="envelope">成功时输出反序列化后的租约信封。</param>
    /// <returns>字段齐全且结构正确时返回 true。</returns>
    private static bool TryDeserializeEnvelope(string signedLeaseJson, out SignedLeaseEnvelope envelope)
    {
        try
        {
            envelope = JsonSerializer.Deserialize<SignedLeaseEnvelope>(signedLeaseJson, DriverJson.Options)
                ?? new SignedLeaseEnvelope();
        }
        catch (JsonException)
        {
            envelope = new SignedLeaseEnvelope();
            return false;
        }

        return !(string.IsNullOrWhiteSpace(envelope.Alg)
            || string.IsNullOrWhiteSpace(envelope.Kid)
            || string.IsNullOrWhiteSpace(envelope.PayloadJson)
            || string.IsNullOrWhiteSpace(envelope.Signature));
    }

    /// <summary>
    /// 尝试反序列化租约声明并验证 JSON 结构可解析。
    /// </summary>
    /// <param name="payloadJson">待解析的租约载荷 JSON。</param>
    /// <param name="claims">成功时输出租约声明。</param>
    /// <returns>JSON 结构可解析时返回 true。</returns>
    private static bool TryDeserializeClaims(string payloadJson, out LeaseClaims claims)
    {
        try
        {
            claims = JsonSerializer.Deserialize<LeaseClaims>(payloadJson, DriverJson.Options)
                ?? new LeaseClaims();
        }
        catch (JsonException)
        {
            claims = new LeaseClaims();
            return false;
        }

        return true;
    }

    /// <summary>
    /// 使用配置中的公钥验证 payload（载荷）签名。
    /// </summary>
    /// <param name="payloadJson">原始 payload JSON（载荷 JSON 字符串）。</param>
    /// <param name="signature">Base64Url（URL 安全 Base64）编码的签名值。</param>
    /// <returns>验签通过时返回 true。</returns>
    private bool TryVerifySignature(string payloadJson, string signature)
    {
        try
        {
            using var rsa = RSA.Create();
            rsa.ImportFromPem(_hostOptions.PublicKeyPem);

            return rsa.VerifyData(
                Encoding.UTF8.GetBytes(payloadJson),
                Base64Url.Decode(signature),
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1);
        }
        catch (ArgumentException)
        {
            return false;
        }
        catch (CryptographicException)
        {
            return false;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    /// <summary>
    /// 判断授权 scope（作用域）集合是否全部为可解释的非空白值。
    /// </summary>
    /// <param name="allowedScopes">待校验的授权 scope（作用域）集合。</param>
    /// <returns>全部为非空白项时返回 true。</returns>
    private static bool HasValidAllowedScopes(IReadOnlyList<string>? allowedScopes)
    {
        return allowedScopes is not null
            && allowedScopes.Count > 0
            && allowedScopes.All(scope => !string.IsNullOrWhiteSpace(scope));
    }

    /// <summary>
    /// 判断授权地址范围集合是否全部为可解析的 `start-end`（起始-结束）整数区间。
    /// </summary>
    /// <param name="allowedAddressRanges">待校验的授权地址范围集合。</param>
    /// <returns>全部可解析时返回 true。</returns>
    private static bool HasValidAllowedAddressRanges(IReadOnlyList<string>? allowedAddressRanges)
    {
        return allowedAddressRanges is not null
            && allowedAddressRanges.Count > 0
            && allowedAddressRanges.All(IsValidAddressRange);
    }

    /// <summary>
    /// 判断单个地址范围是否符合 `start-end`（起始-结束）整数区间格式。
    /// </summary>
    /// <param name="addressRange">待校验的地址范围文本。</param>
    /// <returns>格式正确且起始值不大于结束值时返回 true。</returns>
    private static bool IsValidAddressRange(string addressRange)
    {
        if (string.IsNullOrWhiteSpace(addressRange))
        {
            return false;
        }

        var segments = addressRange.Split('-', StringSplitOptions.TrimEntries);
        if (segments.Length != 2)
        {
            return false;
        }

        return int.TryParse(segments[0], out var start)
            && int.TryParse(segments[1], out var end)
            && start <= end;
    }

    /// <summary>
    /// 表示 ERP bootstrap（启动引导）阶段的未签名占位租约结构。
    /// </summary>
    private sealed record MockUnsignedBootstrapLease
    {
        /// <summary>租约标识。</summary>
        public string LeaseId { get; init; } = string.Empty;

        /// <summary>目标设备标识。</summary>
        public string TargetDeviceId { get; init; } = string.Empty;

        /// <summary>目标设备端点。</summary>
        public string TargetEndpoint { get; init; } = string.Empty;

        /// <summary>被授权主机标识。</summary>
        public string GranteeHostId { get; init; } = string.Empty;

        /// <summary>signalConfig（信号配置）哈希。</summary>
        public string SignalConfigHash { get; init; } = string.Empty;

        /// <summary>授权 scope（作用域）列表。</summary>
        public IReadOnlyList<string> AllowedScopes { get; init; } = Array.Empty<string>();

        /// <summary>授权地址范围列表。</summary>
        public IReadOnlyList<string> AllowedAddressRanges { get; init; } = Array.Empty<string>();

        /// <summary>租约生效起始时间。</summary>
        public DateTimeOffset? NotBefore { get; init; }

        /// <summary>租约失效时间。</summary>
        public DateTimeOffset? ExpiresAt { get; init; }

        /// <summary>fencing token（隔离令牌）。</summary>
        public long? FencingToken { get; init; }

        /// <summary>未签名占位标记。</summary>
        public string Signature { get; init; } = string.Empty;
    }
}

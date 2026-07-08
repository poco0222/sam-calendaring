/**
 * @file Driver Service 租约校验测试。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 以 TDD（测试驱动开发）方式锁定 Lease Validation（租约校验）各分支行为。
 */
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 LeaseValidator（租约校验器）对签名、时间窗、主机身份、配置哈希与 fencing token（隔离令牌）的处理。
/// </summary>
public sealed class LeaseValidationTests
{
    /// <summary>
    /// 验证有效租约会返回 Active（激活）状态与解析后的 claims（声明）。
    /// </summary>
    [Fact]
    public void ValidLeaseReturnsActiveClaims()
    {
        var fixture = TestLeaseFactory.CreateValidLease();
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.Equal(DriverResultCode.Ok, result.ResultCode);
        Assert.True(result.IsValid);
        Assert.Equal("Active", result.LeaseState);
        Assert.Equal("lease-001", result.Claims?.LeaseId);
        Assert.Equal("press-001", result.Claims?.TargetDeviceId);
        Assert.Equal("192.168.19.110:502", result.Claims?.TargetEndpoint);
    }

    /// <summary>
    /// 验证缺失签名信封关键字段时返回 LEASE_INVALID。
    /// </summary>
    /// <param name="missingField">被移除的信封字段名。</param>
    [Theory]
    [InlineData("alg")]
    [InlineData("kid")]
    [InlineData("payloadJson")]
    [InlineData("signature")]
    public void MissingSignatureEnvelopeFieldsReturnLeaseInvalid(string missingField)
    {
        var fixture = TestLeaseFactory.CreateValidLease(missingEnvelopeField: missingField);
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
        Assert.Equal("租约无效或字段不完整", result.Message);
    }

    /// <summary>
    /// 验证缺失 notBefore（生效起始时间）时返回 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void MissingNotBeforeReturnsLeaseInvalid()
    {
        var fixture = TestLeaseFactory.CreateValidLease(missingClaimField: "notBefore");
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
    }

    /// <summary>
    /// 验证缺失 expiresAt（失效时间）时返回 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void MissingExpiresAtReturnsLeaseInvalid()
    {
        var fixture = TestLeaseFactory.CreateValidLease(missingClaimField: "expiresAt");
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
    }

    /// <summary>
    /// 验证缺失 fencingToken（隔离令牌）时返回 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void MissingFencingTokenReturnsLeaseInvalid()
    {
        var fixture = TestLeaseFactory.CreateValidLease(missingClaimField: "fencingToken");
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
    }

    /// <summary>
    /// 验证签名被篡改时返回 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void InvalidSignatureReturnsLeaseInvalid()
    {
        var fixture = TestLeaseFactory.CreateValidLease(tamperSignature: true);
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
        Assert.Equal("租约签名无效", result.Message);
    }

    /// <summary>
    /// 验证过期租约返回 LEASE_EXPIRED。
    /// </summary>
    [Fact]
    public void ExpiredLeaseReturnsLeaseExpired()
    {
        var fixture = TestLeaseFactory.CreateExpiredLease();
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseExpired, result.ResultCode);
        Assert.Equal("Expired", result.LeaseState);
    }

    /// <summary>
    /// 验证“过期 + 缺失 targetDeviceId（目标设备标识）”时，仍按 spec（规格）顺序优先返回 LEASE_EXPIRED。
    /// </summary>
    [Fact]
    public void ExpiredLeaseStillReturnsLeaseExpiredBeforeTargetValidation()
    {
        var fixture = TestLeaseFactory.CreateExpiredLease(missingClaimField: "targetDeviceId");
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseExpired, result.ResultCode);
    }

    /// <summary>
    /// 验证主机身份不匹配时返回 HOST_MISMATCH。
    /// </summary>
    [Fact]
    public void HostMismatchReturnsHostMismatch()
    {
        var fixture = TestLeaseFactory.CreateValidLease();
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "OTHER-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.HostMismatch, result.ResultCode);
    }

    /// <summary>
    /// 验证信号配置哈希不匹配时返回 SIGNAL_CONFIG_MISMATCH。
    /// </summary>
    [Fact]
    public void SignalConfigHashMismatchReturnsSignalConfigMismatch()
    {
        var fixture = TestLeaseFactory.CreateValidLease();
        const string changedConfig = """{"signals":[{"address":101,"name":"pressure"}]}""";
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, changedConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.SignalConfigMismatch, result.ResultCode);
    }

    /// <summary>
    /// 验证 ERP FastJSON（快速 JSON）风格的中文 signalConfigHash（信号配置哈希）可通过 Driver 校验。
    /// </summary>
    [Fact]
    public void ErpUnicodeSignalConfigHashReturnsActiveClaims()
    {
        const string signalConfig = """{"signals":[{"signalCode":"S-100","signalName":"温度值"}]}""";
        const string erpSignalConfigHash = "aISb9Qy8NNDKicfUpCTjfzsslh_isiCIMlvsyXhU0ec";
        var fixture = TestLeaseFactory.CreateValidLease(
            signalConfig: signalConfig,
            signalConfigHash: erpSignalConfigHash);
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, signalConfig, maxSeenFencingToken: 0L);

        Assert.Equal(DriverResultCode.Ok, result.ResultCode);
        Assert.True(result.IsValid);
    }

    /// <summary>
    /// 验证缺失 targetDeviceId（目标设备标识）时，会先于 signalConfigHash（信号配置哈希）不匹配返回 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void MissingTargetDeviceIdReturnsLeaseInvalidBeforeSignalConfigHashMismatch()
    {
        var fixture = TestLeaseFactory.CreateValidLease(missingClaimField: "targetDeviceId");
        const string changedConfig = """{"signals":[{"address":101,"name":"pressure"}]}""";
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, changedConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
    }

    /// <summary>
    /// 验证落后于已见最大值的 fencing token（隔离令牌）返回 FENCING_TOKEN_STALE。
    /// </summary>
    [Fact]
    public void StaleFencingTokenReturnsFencingTokenStale()
    {
        var fixture = TestLeaseFactory.CreateValidLease(fencingToken: 9);
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 10L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.FencingTokenStale, result.ResultCode);
    }

    /// <summary>
    /// 验证缺失 targetEndpoint（目标设备端点）时，会先于 stale fencing token（过旧隔离令牌）返回 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void MissingTargetEndpointReturnsLeaseInvalidBeforeStaleFencingToken()
    {
        var fixture = TestLeaseFactory.CreateValidLease(
            fencingToken: 9,
            missingClaimField: "targetEndpoint");
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 10L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
    }

    /// <summary>
    /// 验证空白 scope（作用域）项会被拒绝为 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void BlankAllowedScopeReturnsLeaseInvalid()
    {
        var fixture = TestLeaseFactory.CreateValidLease(allowedScopes: [""]);
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
    }

    /// <summary>
    /// 验证不可解析的地址范围会被拒绝为 LEASE_INVALID。
    /// </summary>
    [Fact]
    public void InvalidAllowedAddressRangeReturnsLeaseInvalid()
    {
        var fixture = TestLeaseFactory.CreateValidLease(allowedAddressRanges: ["not-a-range"]);
        var validator = TestLeaseFactory.CreateValidator(
            fixture.PublicKeyPem,
            "SAM-LOCAL-HOST",
            TestLeaseFactory.TestNow);

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 0L);

        Assert.False(result.IsValid);
        Assert.Equal(DriverResultCode.LeaseInvalid, result.ResultCode);
    }
}

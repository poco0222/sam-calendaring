# Task 03: Lease Validation

> @file Driver Service V1 租约校验任务
> @author PopoY
> @created 2026-06-26
> @purpose 实现 signedLease 离线验签、时间窗、主机身份、信号配置哈希与 fencingToken 校验。

## Goal（目标）

Implement `Lease Validation（租约校验）` for `/applyLeaseAndConfig` in the exact order required by the spec. The service must validate locally with configured `public key（公钥）` or `certificate（证书）`, never call `ERP Server（企业资源计划服务器）`, and never accept target endpoint overrides.

## Status（状态）

- `Done（已完成）`：Task 3 已完成，租约校验与 `/applyLeaseAndConfig` 接线已通过验证。

## Progress（进度）

- `2026-06-26`：已新增 `LeaseValidationTests`、`TestLeaseFactory` 与 `/applyLeaseAndConfig` Task 3 契约测试；`dotnet test --filter FullyQualifiedName~LeaseValidationTests` 已按预期 RED，提示缺少 `Domain/Security/LeaseValidator` 类型，当前进度 `2/8`。
- `2026-06-26`：已完成 `SignedLeaseEnvelope`、`LeaseClaims`、`LeaseValidationResult`、`Base64Url`、`CanonicalJsonHasher`、`LeaseValidator` 与 `/applyLeaseAndConfig` 接线，当前进度 `7/8`。
- `2026-06-26`：`dotnet test --filter FullyQualifiedName~LeaseValidationTests`、`dotnet test --filter FullyQualifiedName~ApiContractTests`、`dotnet test` 与 `dotnet build` 全部通过，当前进度 `8/8`。
- `2026-06-26`：根据 review 修正 Task 3 的校验顺序、`value-type（值类型）` 必填字段缺失识别，以及 `allowedScopes` / `allowedAddressRanges` 的解释性校验。
- `2026-06-26`：已补 `/applyLeaseAndConfig` 对缺失 `signedLease` / `signalConfig` 的必填字段防护，并新增对应 API 测试，确保缺字段返回 `400 + LEASE_INVALID` 而不是 500。

## Files（文件）

- Create: `driver-service/src/Sam.Calendaring.DriverService/Domain/LeaseClaims.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Domain/SignedLeaseEnvelope.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Domain/LeaseValidationResult.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Security/Base64Url.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Security/CanonicalJsonHasher.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Security/LeaseValidator.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/LeaseValidationTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/TestLeaseFactory.cs`

## Steps（步骤）

- [x] **Step 1: Add failing lease validation tests**

```csharp
/**
 * @file Driver Service lease validation tests.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Tests;

public sealed class LeaseValidationTests
{
    [Fact]
    public void ValidLeaseReturnsActiveClaims()
    {
        var fixture = TestLeaseFactory.CreateValidLease();
        var validator = TestLeaseFactory.CreateValidator(fixture.PublicKeyPem, "SAM-LOCAL-HOST");

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 1);

        Assert.True(result.IsValid);
        Assert.Equal("OK", result.ResultCode);
        Assert.Equal("Active", result.LeaseState);
        Assert.Equal("lease-001", result.Claims?.LeaseId);
        Assert.Equal("192.168.19.110:502", result.Claims?.TargetEndpoint);
    }

    [Theory]
    [InlineData("alg")]
    [InlineData("kid")]
    [InlineData("signature")]
    public void MissingSignatureEnvelopeFieldsReturnLeaseInvalid(string missingField)
    {
        var fixture = TestLeaseFactory.CreateValidLease(missingEnvelopeField: missingField);
        var validator = TestLeaseFactory.CreateValidator(fixture.PublicKeyPem, "SAM-LOCAL-HOST");

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 1);

        Assert.False(result.IsValid);
        Assert.Equal("LEASE_INVALID", result.ResultCode);
        Assert.Equal("租约无效或字段不完整", result.Message);
    }

    [Fact]
    public void ExpiredLeaseReturnsLeaseExpired()
    {
        var fixture = TestLeaseFactory.CreateExpiredLease();
        var validator = TestLeaseFactory.CreateValidator(fixture.PublicKeyPem, "SAM-LOCAL-HOST");

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 1);

        Assert.Equal("LEASE_EXPIRED", result.ResultCode);
    }

    [Fact]
    public void HostMismatchReturnsHostMismatch()
    {
        var fixture = TestLeaseFactory.CreateValidLease();
        var validator = TestLeaseFactory.CreateValidator(fixture.PublicKeyPem, "OTHER-HOST");

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 1);

        Assert.Equal("HOST_MISMATCH", result.ResultCode);
    }

    [Fact]
    public void SignalConfigHashMismatchReturnsSignalConfigMismatch()
    {
        var fixture = TestLeaseFactory.CreateValidLease();
        var changedConfig = """{"signals":[{"name":"pressure","address":101}]}""";
        var validator = TestLeaseFactory.CreateValidator(fixture.PublicKeyPem, "SAM-LOCAL-HOST");

        var result = validator.Validate(fixture.SignedLease, changedConfig, maxSeenFencingToken: 1);

        Assert.Equal("SIGNAL_CONFIG_MISMATCH", result.ResultCode);
    }

    [Fact]
    public void StaleFencingTokenReturnsFencingTokenStale()
    {
        var fixture = TestLeaseFactory.CreateValidLease(fencingToken: 9);
        var validator = TestLeaseFactory.CreateValidator(fixture.PublicKeyPem, "SAM-LOCAL-HOST");

        var result = validator.Validate(fixture.SignedLease, fixture.SignalConfig, maxSeenFencingToken: 10);

        Assert.Equal("FENCING_TOKEN_STALE", result.ResultCode);
    }
}
```

- [x] **Step 2: Run tests and confirm RED（失败状态）**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~LeaseValidationTests
```

Expected: fails because `LeaseValidator（租约校验器）` and lease domain types do not exist.

- [x] **Step 3: Add the signed lease envelope and claims types**

V1 accepts `signedLease（签名租约）` as an object with `alg`, `kid`, `payloadJson`, and `signature`. Signature verification uses the exact UTF-8 bytes of `payloadJson（签名载荷 JSON 字符串）`; the service must not reserialize JSON before verifying.

```csharp
/**
 * @file Signed lease envelope accepted by Driver Service V1.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Domain;

public sealed record SignedLeaseEnvelope(
    string Alg,
    string Kid,
    string PayloadJson,
    string Signature);
```

```csharp
/**
 * @file Signed lease claims used by offline validation.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Domain;

public sealed record LeaseClaims(
    string LeaseId,
    string TargetDeviceId,
    string TargetEndpoint,
    string GranteeHostId,
    string SignalConfigHash,
    IReadOnlyList<string> AllowedScopes,
    IReadOnlyList<string> AllowedAddressRanges,
    DateTimeOffset NotBefore,
    DateTimeOffset ExpiresAt,
    long FencingToken);
```

```csharp
/**
 * @file Lease validation result.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Domain;

public sealed record LeaseValidationResult(
    bool IsValid,
    string ResultCode,
    string Message,
    string LeaseState,
    LeaseClaims? Claims)
{
    public static LeaseValidationResult Fail(string resultCode, string message, string leaseState = "None") =>
        new(false, resultCode, message, leaseState, null);

    public static LeaseValidationResult Ok(LeaseClaims claims) =>
        new(true, "OK", "租约校验通过", "Active", claims);
}
```

- [x] **Step 4: Add `Base64Url（Base64 URL 编码）` and canonical signal config hash**

```csharp
/**
 * @file Base64Url helper for signature and hash payloads.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Security;

public static class Base64Url
{
    public static byte[] Decode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }

    public static string Encode(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
```

```csharp
/**
 * @file Canonical JSON hash helper for signalConfig.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sam.Calendaring.DriverService.Security;

public static class CanonicalJsonHasher
{
    public static string Sha256Base64Url(string json)
    {
        var node = JsonNode.Parse(json) ?? throw new InvalidOperationException("信号配置格式不正确");
        var canonical = WriteCanonical(node);
        return Base64Url.Encode(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    private static string WriteCanonical(JsonNode node)
    {
        if (node is JsonObject obj)
        {
            var properties = obj.OrderBy(item => item.Key, StringComparer.Ordinal)
                .Select(item => $"\"{item.Key}\":{WriteCanonical(item.Value!)}");
            return "{" + string.Join(",", properties) + "}";
        }

        if (node is JsonArray array)
        {
            return "[" + string.Join(",", array.Select(item => WriteCanonical(item!))) + "]";
        }

        return node.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }
}
```

- [x] **Step 5: Implement `LeaseValidator（租约校验器）` in spec order**

```csharp
/**
 * @file Offline signed lease validator.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Options;

namespace Sam.Calendaring.DriverService.Security;

public sealed class LeaseValidator(HostIdentityOptions hostOptions, TimeProvider clock)
{
    public LeaseValidationResult Validate(string signedLeaseJson, string signalConfigJson, long maxSeenFencingToken)
    {
        SignedLeaseEnvelope envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<SignedLeaseEnvelope>(signedLeaseJson, DriverJson.Options)
                ?? throw new JsonException();
        }
        catch (JsonException)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        if (string.IsNullOrWhiteSpace(envelope.Alg) ||
            string.IsNullOrWhiteSpace(envelope.Kid) ||
            string.IsNullOrWhiteSpace(envelope.Signature) ||
            string.IsNullOrWhiteSpace(envelope.PayloadJson))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        if (envelope.Alg != "RS256")
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约签名算法不受支持");
        }

        if (!VerifySignature(envelope.PayloadJson, envelope.Signature))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约签名无效");
        }

        var claims = JsonSerializer.Deserialize<LeaseClaims>(envelope.PayloadJson, DriverJson.Options);
        if (claims is null || string.IsNullOrWhiteSpace(claims.TargetDeviceId) || string.IsNullOrWhiteSpace(claims.TargetEndpoint))
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "租约无效或字段不完整");
        }

        var now = clock.GetUtcNow();
        if (now < claims.NotBefore || now >= claims.ExpiresAt)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseExpired, "租约已过期", "Expired");
        }

        if (!StringComparer.Ordinal.Equals(claims.GranteeHostId, hostOptions.GranteeHostId))
        {
            return LeaseValidationResult.Fail(DriverResultCode.HostMismatch, "本机身份不匹配");
        }

        if (!StringComparer.Ordinal.Equals(claims.SignalConfigHash, CanonicalJsonHasher.Sha256Base64Url(signalConfigJson)))
        {
            return LeaseValidationResult.Fail(DriverResultCode.SignalConfigMismatch, "信号配置哈希不匹配");
        }

        if (claims.FencingToken < maxSeenFencingToken)
        {
            return LeaseValidationResult.Fail(DriverResultCode.FencingTokenStale, "隔离令牌过旧");
        }

        if (claims.AllowedScopes.Count == 0 || claims.AllowedAddressRanges.Count == 0)
        {
            return LeaseValidationResult.Fail(DriverResultCode.LeaseInvalid, "授权范围不完整");
        }

        return LeaseValidationResult.Ok(claims);
    }

    private bool VerifySignature(string payloadJson, string signature)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(hostOptions.PublicKeyPem);
        return rsa.VerifyData(
            Encoding.UTF8.GetBytes(payloadJson),
            Base64Url.Decode(signature),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
    }
}
```

- [x] **Step 6: Wire lease validation into `/applyLeaseAndConfig`**

Convert `JsonElement（JSON 元素）` to raw JSON string and pass it to `LeaseValidator（租约校验器）`.

```csharp
// PopoY: Driver Service validates signedLease locally and never calls ERP Server.
var result = leaseValidator.Validate(
    request.SignedLease.GetRawText(),
    request.SignalConfig.GetRawText(),
    maxSeenFencingToken: 0L);
```

Successful response shape:

```csharp
var response = new ApplyLeaseAndConfigResponse(
    request.CorrelationId,
    DriverResultCode.Ok,
    "租约已应用，等待设备连接",
    "Active",
    "Disconnected",
    result.Claims.LeaseId,
    result.Claims.TargetDeviceId,
    result.Claims.FencingToken.ToString(CultureInfo.InvariantCulture));
```

- [x] **Step 7: Add `TestLeaseFactory（测试租约工厂）`**

The test factory must generate the RSA key pair inside the test process, sign `payloadJson（签名载荷 JSON 字符串）`, and never store a private key in repo files.

```csharp
/**
 * @file Test signed lease factory.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Options;
using Sam.Calendaring.DriverService.Security;

namespace Sam.Calendaring.DriverService.Tests;

internal static class TestLeaseFactory
{
    public static LeaseValidator CreateValidator(string publicKeyPem, string hostId) =>
        new(new HostIdentityOptions { PublicKeyPem = publicKeyPem, GranteeHostId = hostId }, TimeProvider.System);

    public static TestLeaseFixture CreateValidLease(long fencingToken = 10, string? missingEnvelopeField = null)
    {
        return CreateLease(
            fencingToken,
            notBefore: DateTimeOffset.UtcNow.AddMinutes(-1),
            expiresAt: DateTimeOffset.UtcNow.AddMinutes(10),
            missingEnvelopeField);
    }

    public static TestLeaseFixture CreateExpiredLease()
    {
        return CreateLease(
            fencingToken: 10,
            notBefore: DateTimeOffset.UtcNow.AddMinutes(-20),
            expiresAt: DateTimeOffset.UtcNow.AddMinutes(-10),
            missingEnvelopeField: null);
    }

    private static TestLeaseFixture CreateLease(
        long fencingToken,
        DateTimeOffset notBefore,
        DateTimeOffset expiresAt,
        string? missingEnvelopeField)
    {
        using var rsa = RSA.Create(2048);
        var signalConfig = """{"signals":[{"address":100,"name":"pressure"}]}""";
        var claims = new LeaseClaims(
            "lease-001",
            "press-001",
            "192.168.19.110:502",
            "SAM-LOCAL-HOST",
            CanonicalJsonHasher.Sha256Base64Url(signalConfig),
            ["read"],
            ["100-120"],
            notBefore,
            expiresAt,
            fencingToken);

        var payloadJson = JsonSerializer.Serialize(claims);
        var signature = Base64Url.Encode(rsa.SignData(
            Encoding.UTF8.GetBytes(payloadJson),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1));

        var envelope = new Dictionary<string, object?>
        {
            ["alg"] = "RS256",
            ["kid"] = "test-key",
            ["payloadJson"] = payloadJson,
            ["signature"] = signature
        };

        if (missingEnvelopeField is not null)
        {
            envelope.Remove(missingEnvelopeField);
        }

        return new TestLeaseFixture(
            JsonSerializer.Serialize(envelope),
            signalConfig,
            rsa.ExportRSAPublicKeyPem());
    }
}

internal sealed record TestLeaseFixture(string SignedLease, string SignalConfig, string PublicKeyPem);
```

- [x] **Step 8: Verify lease validation**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~LeaseValidationTests
dotnet test --filter FullyQualifiedName~ApiContractTests
dotnet build
```

Expected: valid leases produce `OK / Active`, invalid claims map to the required `resultCode（结果码）`, and no test or implementation calls `ERP Server（企业资源计划服务器）`.

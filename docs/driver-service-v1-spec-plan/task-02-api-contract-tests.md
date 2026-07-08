# Task 02: API Contract Tests

> @file Driver Service V1 接口契约测试任务
> @author PopoY
> @created 2026-06-26
> @purpose 固化 applyLeaseAndConfig 与 getSignalSnapshot 的请求白名单、响应 JSON、错误码与中文消息契约。

## Goal（目标）

Lock the V1 `API Contract（接口契约）` before lease validation and device logic are implemented. V1 exposes only `POST /applyLeaseAndConfig` and `POST /getSignalSnapshot`, returns JSON for both success and failure, and rejects request fields that could override authorization.

## Status（状态）

- `Done（已完成）`：`Step 1` 到 `Step 7` 已全部完成，`Task2` 接口契约已通过聚焦测试、全量测试与构建验证。

## Progress（进度）

- `2026-06-26`：计划已落库，当前进度 `0/7`。
- `2026-06-26`：已完成 `Step 1/7`。测试项目已补充 `Microsoft.AspNetCore.Mvc.Testing（ASP.NET Core 测试宿主）`，并新增 `ApiContractTests` 锁定 `/applyLeaseAndConfig`、`/getSignalSnapshot` 与 `/renewLease` 的最小 V1 契约边界。
- `2026-06-26`：已完成 `Step 2/7`。执行 `dotnet test --filter FullyQualifiedName~ApiContractTests` 后得到 `2 failed / 1 passed`；两个失败均为目标端点当前返回 `404 NotFound（未找到）` 而非契约要求的 `400 BadRequest（错误请求）`，`RED（失败状态）` 符合预期，当前进度 `2/7`。
- `2026-06-26`：已完成 `Step 3/7`。新增严格 `request contract（请求契约）`、稳定 `resultCode（结果码）` 常量与统一 `DriverJson.Options`，并通过 `dotnet build src/Sam.Calendaring.DriverService/Sam.Calendaring.DriverService.csproj` 验证当前契约类型可编译，当前进度 `3/7`。
- `2026-06-26`：已完成 `Step 4/7`。补齐 `ApplyLeaseAndConfigResponse` 与 `GetSignalSnapshotResponse` 两个最小 `response contract（响应契约）`，并通过 `dotnet build DriverService.sln` 验证服务项目与测试项目仍可共同编译，当前进度 `4/7`。
- `2026-06-26`：已完成 `Step 5/7`。新增 `/applyLeaseAndConfig` 与 `/getSignalSnapshot` 的最小 V1 端点映射，`Program.cs` 已接入严格 `HttpJsonOptions` 与端点注册；重新执行 `dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter FullyQualifiedName~ApiContractTests` 后 `3/3` 通过，当前进度 `5/7`。后续 `Step 6` 继续把畸形 `JSON（数据格式）` 的统一响应收口到全局 `middleware（中间件）`。
- `2026-06-26`：已完成 `Step 6/7`。将 `BadHttpRequestException（错误 HTTP 请求异常）` 的统一中文 JSON 响应前移到全局 `middleware（中间件）`，并把端点实现收窄回 typed request（强类型请求）绑定；复验 `dotnet test tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj --filter FullyQualifiedName~ApiContractTests` 仍为 `3/3` 通过，同时 `dotnet build src/Sam.Calendaring.DriverService/Sam.Calendaring.DriverService.csproj` 通过，当前进度 `6/7`。
- `2026-06-26`：执行 `Step 7/7` 首轮验证时，我曾把 `dotnet test` 与 `dotnet build` 并行触发，导致 `Microsoft.AspNetCore.Mvc.Testing` 生成 `MvcTestingAppManifest.json` 时发生文件锁冲突；已确认为验证方式冲突，不是业务代码回归。
- `2026-06-26`：已完成 `Step 7/7`。顺序执行 `dotnet test --filter FullyQualifiedName~ApiContractTests`、`dotnet test`、`dotnet build` 后结果分别为 `3/3` 通过、`4/4` 通过、`0 warning / 0 error` 构建通过，当前进度 `7/7`。
- `2026-06-26`：在后续规格审查中发现真实 `Kestrel（ASP.NET Core Web server）` 运行时与 `TestServer（测试宿主）` 存在差异：畸形 `JSON（数据格式）` 与额外字段请求会返回空 `400`，未满足 Task2 的中文 JSON 契约。`Task2` 因此短暂复开，未把该轮审查结果误记为通过。
- `2026-06-26`：已补充真实 `Kestrel` 运行时契约测试，并将端点前 `middleware（中间件）` 调整为“请求体预验证 + 复原流位置”的最小实现，确保 `/applyLeaseAndConfig` 与 `/getSignalSnapshot` 在真实本机 HTTP 路径下对畸形 `JSON` 和额外字段都返回标准 `LEASE_INVALID` 中文 JSON。
- `2026-06-26`：修复 review blocker（审查阻塞项）后，顺序执行 `dotnet test --filter FullyQualifiedName~ApiContractTests`、`dotnet test`、`dotnet build`，结果分别为 `6/6` 通过、`7/7` 通过、`0 warning / 0 error` 构建通过；同时用 `curl` 复验 `/applyLeaseAndConfig` 与 `/getSignalSnapshot` 的三类真实请求，均返回标准中文 JSON，当前进度保持 `7/7`。
- `2026-06-26`：在后续代码质量审查中，继续收紧了 Task2 的测试与入口边界：真实 `Kestrel` 运行时改为按需启动，`Program.cs` 的请求预验证仅对 `POST` 生效并复用 `DriverJson.Options`，同时补充了合法白名单请求的最小响应结构断言，避免仅覆盖非法路径。
- `2026-06-26`：完成上述收口后，顺序执行 `dotnet test --filter FullyQualifiedName~ApiContractTests`、`dotnet test`、`dotnet build`，结果分别为 `9/9` 通过、`10/10` 通过、`0 warning / 0 error` 构建通过；复检后 `Task2` 保持 `Done（已完成）` 状态。

## Files（文件）

- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/ApplyLeaseAndConfigRequest.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/ApplyLeaseAndConfigResponse.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/GetSignalSnapshotRequest.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/GetSignalSnapshotResponse.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DriverResultCode.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Contracts/DriverJson.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/ApiContractTests.cs`

## Steps（步骤）

- [x] **Step 1: Add the failing API contract tests**

Add `Microsoft.AspNetCore.Mvc.Testing（ASP.NET Core 测试宿主）` to the test project and write contract tests first.

```bash
cd driver-service
dotnet add tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing
```

```csharp
/**
 * @file Driver Service API contract tests.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Sam.Calendaring.DriverService.Tests;

public sealed class ApiContractTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task ApplyLeaseAndConfigRejectsRawDeviceOverrideFields()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/applyLeaseAndConfig", new
        {
            correlationId = "cid-contract-001",
            timeoutMs = 5000,
            signedLease = new { leaseId = "lease-001" },
            signalConfig = new { signals = Array.Empty<object>() },
            ip = "192.168.1.10",
            port = 502,
            deviceId = "RAW-DEVICE"
        });

        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object?>>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("LEASE_INVALID", body?["resultCode"]?.ToString());
        Assert.Contains("请求字段不允许", body?["message"]?.ToString());
    }

    [Fact]
    public async Task GetSignalSnapshotRejectsPointOverrides()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/getSignalSnapshot", new
        {
            correlationId = "cid-contract-002",
            timeoutMs = 5000,
            pointOverride = "D100"
        });

        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object?>>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("LEASE_INVALID", body?["resultCode"]?.ToString());
    }

    [Fact]
    public async Task RenewLeaseEndpointDoesNotExist()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/renewLease", new { correlationId = "cid-contract-003" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

- [x] **Step 2: Run tests and confirm RED（失败状态）**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~ApiContractTests
```

Expected: fails because contract DTOs and endpoints do not exist.

- [x] **Step 3: Add strict request and response contracts**

Use `JsonUnmappedMemberHandling.Disallow` so unexpected fields fail at the request boundary.

```csharp
/**
 * @file Driver Service apply lease request contract.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Contracts;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ApplyLeaseAndConfigRequest(
    string CorrelationId,
    int TimeoutMs,
    JsonElement SignedLease,
    JsonElement SignalConfig);
```

```csharp
/**
 * @file Driver Service signal snapshot request contract.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Contracts;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record GetSignalSnapshotRequest(string CorrelationId, int TimeoutMs);
```

```csharp
/**
 * @file Driver Service stable result codes.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Contracts;

public static class DriverResultCode
{
    public const string Ok = "OK";
    public const string LeaseInvalid = "LEASE_INVALID";
    public const string LeaseExpired = "LEASE_EXPIRED";
    public const string HostMismatch = "HOST_MISMATCH";
    public const string SignalConfigMismatch = "SIGNAL_CONFIG_MISMATCH";
    public const string FencingTokenStale = "FENCING_TOKEN_STALE";
    public const string DeviceIdentityMismatch = "DEVICE_IDENTITY_MISMATCH";
    public const string DeviceTimeout = "DEVICE_TIMEOUT";
    public const string DeviceRejected = "DEVICE_REJECTED";
    public const string DeviceBusy = "DEVICE_BUSY";
    public const string CleanupPending = "CLEANUP_PENDING";
}
```

```csharp
/**
 * @file Driver Service JSON options.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Contracts;

public static class DriverJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };
}
```

- [x] **Step 4: Add response contracts**

```csharp
/**
 * @file Driver Service apply lease response contract.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Contracts;

public sealed record ApplyLeaseAndConfigResponse(
    string CorrelationId,
    string ResultCode,
    string Message,
    string LeaseState,
    string DeviceSessionState,
    string? LeaseId,
    string? TargetDeviceId,
    string? FencingToken);
```

```csharp
/**
 * @file Driver Service snapshot response contract.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Contracts;

public sealed record GetSignalSnapshotResponse(
    string CorrelationId,
    string ResultCode,
    string Message,
    IReadOnlyDictionary<string, object?> SignalValues);
```

- [x] **Step 5: Add minimal endpoints and JSON error handling**

```csharp
/**
 * @file Driver Service V1 endpoint mapping.
 * @author PopoY
 * @created 2026-06-26
 */
using Microsoft.AspNetCore.Http.Json;
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.Endpoints;

public static class DriverEndpoints
{
    public static IEndpointRouteBuilder MapDriverV1Endpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/applyLeaseAndConfig", (ApplyLeaseAndConfigRequest request) =>
        {
            // PopoY: Task 03 replaces this stub with real offline lease validation.
            var response = new ApplyLeaseAndConfigResponse(
                request.CorrelationId,
                DriverResultCode.LeaseInvalid,
                "租约无效或字段不完整",
                "None",
                "Disconnected",
                null,
                null,
                null);

            return Results.Json(response, DriverJson.Options, statusCode: StatusCodes.Status400BadRequest);
        });

        app.MapPost("/getSignalSnapshot", (GetSignalSnapshotRequest request) =>
        {
            // PopoY: before Task 05 there is no active session, so snapshot is invalid.
            var response = new GetSignalSnapshotResponse(
                request.CorrelationId,
                DriverResultCode.LeaseInvalid,
                "当前没有可用租约",
                new Dictionary<string, object?>());

            return Results.Json(response, DriverJson.Options, statusCode: StatusCodes.Status400BadRequest);
        });

        return app;
    }
}
```

Modify `Program.cs`:

```csharp
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
});

app.MapDriverV1Endpoints();
```

- [x] **Step 6: Map malformed JSON to standard Chinese JSON**

Add one middleware before route mapping.

```csharp
// PopoY: malformed or extra-field JSON must not leak framework exception text to QT App.
app.Use(async (context, next) =>
{
    try
    {
        await next(context).ConfigureAwait(false);
    }
    catch (BadHttpRequestException)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        if (context.Request.Path == "/getSignalSnapshot")
        {
            await context.Response.WriteAsJsonAsync(new GetSignalSnapshotResponse(
                "",
                DriverResultCode.LeaseInvalid,
                "请求字段不允许或格式不正确",
                new Dictionary<string, object?>()), DriverJson.Options).ConfigureAwait(false);
            return;
        }

        await context.Response.WriteAsJsonAsync(new
        {
            correlationId = "",
            resultCode = DriverResultCode.LeaseInvalid,
            message = "请求字段不允许或格式不正确",
            leaseState = "None",
            deviceSessionState = "Disconnected"
        }, DriverJson.Options).ConfigureAwait(false);
    }
});
```

- [x] **Step 7: Verify the contract**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~ApiContractTests
dotnet test
dotnet build
```

Expected: API contract tests pass, all responses are JSON, and `/renewLease` remains absent.

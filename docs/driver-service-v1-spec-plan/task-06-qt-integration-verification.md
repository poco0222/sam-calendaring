# Task 06: QT Integration Verification

> @file Driver Service V1 Qt 集成验证任务
> @author PopoY
> @created 2026-06-26
> @purpose 验证 QT App 到 Driver Service 的 V1 最小链路、日志边界、错误模型和不访问 ERP 的约束。

## Goal（目标）

Verify the complete V1 acceptance path: `QT App（Qt 应用） -> POST /applyLeaseAndConfig -> Driver Service（驱动服务） offline validation -> Mock or real Modbus session -> POST /getSignalSnapshot -> signalValues（信号值）`. This task also locks the final `Error Model（错误模型）` and sanitized `Logging（日志）` boundary.

## Status（状态）

- `Completed（已完成）`：`Step 1/8` 到 `Step 8/8` 已完成，Task6 的最小 V1 集成验证、错误模型收口、脱敏日志边界与前端契约收口均已通过自动化验证。

## Progress（进度）

- `2026-06-26`：计划已落库，当前进度 `0/8`。
- `2026-06-26`：已完成 `Step 1/8`。新增 `DriverServiceV1AcceptanceTests`，用真实 `WebApplicationFactory（ASP.NET Core 测试宿主）` 串起 `/applyLeaseAndConfig` 与 `/getSignalSnapshot` 的最小 V1 成功链路，当前进度 `1/8`。
- `2026-06-26`：已完成 `Step 2/8`。新增 `ErrorAndLoggingBoundaryTests`，先锁定稳定 `resultCode（结果码） -> HTTP status（HTTP 状态）` 映射，以及 `AuditLogEntry.CreateSanitized` 的中文脱敏消息边界，当前进度 `2/8`。
- `2026-06-26`：已完成 `Step 3/8`。新增 `NoErpAccessTests`，对 `driver-service/src/Sam.Calendaring.DriverService` 做源码级扫描并显式排除 `bin/obj`，锁定 `ErpBaseUrl`、`ERP_BASE_URL`、`AddHttpClient` 三类 ERP 访问标记不得进入源码，当前进度 `3/8`。
- `2026-06-26`：已完成 `Step 4/8`。执行 `cd driver-service && dotnet test --filter "FullyQualifiedName~DriverServiceV1AcceptanceTests|FullyQualifiedName~ErrorAndLoggingBoundaryTests|FullyQualifiedName~NoErpAccessTests"` 后按预期 RED，当前失败原因为 `DriverResponseWriter` 尚未创建、`AuditLogEntry.CreateSanitized` 尚未实现，且新测试还缺 `LeaseState（租约状态）` 与 `DeviceSessionState（设备会话状态）` 的命名空间引用，说明 Task6 缺口已被测试准确钉住，当前进度 `4/8`。
- `2026-06-26`：已完成 `Step 5/8`。新增公共 `DriverResponseWriter.GetHttpStatus`，显式覆盖 `LEASE_INVALID` 到 `400` 的映射并将 `DriverEndpoints` 切换为复用该公共 mapper（映射器）；同时接入 `AuditLogEntry.CreateSanitized` 作为端点审计日志构造入口，当前进度 `5/8`。
- `2026-06-26`：已完成 `Step 6/8`。更新 `qt-app/frontend` 既有契约测试，把成功 `resultCode（结果码）` 从 `SUCCESS` 收口为 `OK`，并执行 `./node_modules/.bin/vitest run src/services/driverClient.test.ts src/tests/acceptanceChecklist.test.ts`，结果 `15/15` 通过；后端同步执行 `dotnet test --filter "FullyQualifiedName~DriverServiceV1AcceptanceTests|FullyQualifiedName~ErrorAndLoggingBoundaryTests|FullyQualifiedName~NoErpAccessTests"`，结果 `14/14` 通过，当前进度 `6/8`。
- `2026-06-26`：已完成 `Step 7/8`。新增 `docs/driver-service-v1-spec-plan/verification-record.md`，落库本轮自动化验证结果、验收快照与真实硬件 smoke 缺口，当前进度 `7/8`。
- `2026-06-26`：已完成 `Step 8/8`。顺序执行 `cd driver-service && dotnet test`、`cd driver-service && dotnet build`、`cd qt-app/frontend && ./node_modules/.bin/vitest run src/services/driverClient.test.ts src/tests/acceptanceChecklist.test.ts`、`cd qt-app/frontend && ./node_modules/.bin/vite build`；结果分别为 `56/56` 通过、`0 warning / 0 error`、`15/15` 通过、生产构建成功但带 `chunk size（分块体积） warning（告警）`，当前进度 `8/8`。

## Files（文件）

- Create: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverResponseWriter.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/AuditLogEntry.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DriverServiceV1AcceptanceTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/ErrorAndLoggingBoundaryTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/NoErpAccessTests.cs`
- Modify: `qt-app/frontend/src/tests/acceptanceChecklist.test.ts`
- Modify: `qt-app/frontend/src/services/driverClient.test.ts`
- Create: `docs/driver-service-v1-spec-plan/verification-record.md`

## Steps（步骤）

- [x] **Step 1: Add failing Driver Service acceptance tests**

```csharp
/**
 * @file Driver Service V1 acceptance tests.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Sam.Calendaring.DriverService.Tests;

public sealed class DriverServiceV1AcceptanceTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task ValidLeaseThenSnapshotReturnsDashboardReadyState()
    {
        var client = factory.CreateClient();
        var lease = TestLeaseFactory.CreateValidLease();
        var correlationId = "cid-v1-acceptance-001";

        var apply = await client.PostAsJsonAsync("/applyLeaseAndConfig", new
        {
            correlationId,
            timeoutMs = 5000,
            signedLease = JsonDocument.Parse(lease.SignedLease).RootElement,
            signalConfig = JsonDocument.Parse(lease.SignalConfig).RootElement
        });
        var applyBody = await apply.Content.ReadFromJsonAsync<ApplyLeaseAndConfigResponse>();

        var snapshot = await client.PostAsJsonAsync("/getSignalSnapshot", new
        {
            correlationId,
            timeoutMs = 5000
        });
        var snapshotBody = await snapshot.Content.ReadFromJsonAsync<GetSignalSnapshotResponse>();

        Assert.Equal(HttpStatusCode.OK, apply.StatusCode);
        Assert.Equal("OK", applyBody?.ResultCode);
        Assert.Equal("Active", applyBody?.LeaseState);
        Assert.Equal("Disconnected", applyBody?.DeviceSessionState);
        Assert.Equal(correlationId, applyBody?.CorrelationId);
        Assert.Equal("OK", snapshotBody?.ResultCode);
        Assert.NotEmpty(snapshotBody?.SignalValues ?? new Dictionary<string, object?>());
    }
}
```

- [x] **Step 2: Add failing error and logging boundary tests**

```csharp
/**
 * @file Driver Service error and logging boundary tests.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Tests;

public sealed class ErrorAndLoggingBoundaryTests
{
    [Theory]
    [InlineData("LEASE_INVALID", 400)]
    [InlineData("LEASE_EXPIRED", 409)]
    [InlineData("HOST_MISMATCH", 403)]
    [InlineData("SIGNAL_CONFIG_MISMATCH", 400)]
    [InlineData("FENCING_TOKEN_STALE", 409)]
    [InlineData("DEVICE_IDENTITY_MISMATCH", 409)]
    [InlineData("DEVICE_TIMEOUT", 504)]
    [InlineData("DEVICE_REJECTED", 502)]
    [InlineData("DEVICE_BUSY", 409)]
    [InlineData("CLEANUP_PENDING", 409)]
    public void ErrorModelMapsResultCodeToHttpStatus(string resultCode, int expectedStatus)
    {
        Assert.Equal(expectedStatus, DriverResponseWriter.GetHttpStatus(resultCode));
    }

    [Fact]
    public void SanitizedLogDoesNotContainSensitiveLeaseFields()
    {
        var entry = AuditLogEntry.CreateSanitized(
            "cid-log-001",
            "lease-001",
            "press-001",
            30,
            "applyLeaseAndConfig",
            TimeSpan.FromMilliseconds(10),
            "LEASE_INVALID",
            "None",
            "Disconnected",
            new InvalidOperationException("Third party library failed with connection refused"));

        Assert.Contains("cid-log-001", entry.CorrelationId);
        Assert.DoesNotContain("signedLease", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signature", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("connection refused", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("驱动命令执行失败", entry.Message);
    }
}
```

- [x] **Step 3: Add failing no-ERP access guard**

```csharp
/**
 * @file Driver Service no ERP access tests.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Tests;

public sealed class NoErpAccessTests
{
    [Fact]
    public void DriverServiceProjectDoesNotRegisterOutboundErpHttpClients()
    {
        var projectRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../src/Sam.Calendaring.DriverService"));
        var files = Directory.GetFiles(projectRoot, "*.cs", SearchOption.AllDirectories)
            .Concat(Directory.GetFiles(projectRoot, "*.json", SearchOption.AllDirectories))
            .Concat(Directory.GetFiles(projectRoot, "*.csproj", SearchOption.AllDirectories));
        var combined = string.Join('\n', files.Select(File.ReadAllText));

        Assert.DoesNotContain("ErpBaseUrl", combined, StringComparison.Ordinal);
        Assert.DoesNotContain("ERP_BASE_URL", combined, StringComparison.Ordinal);
        Assert.DoesNotContain("AddHttpClient", combined, StringComparison.Ordinal);
    }
}
```

If the service needs `HttpClient（HTTP 客户端）` for non-ERP local diagnostics, narrow this guard to namespaces or config keys instead of deleting it.

- [x] **Step 4: Run tests and confirm RED（失败状态）**

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DriverServiceV1AcceptanceTests|FullyQualifiedName~ErrorAndLoggingBoundaryTests|FullyQualifiedName~NoErpAccessTests"
```

Expected: fails until acceptance wiring, error mapping, sanitized log helpers, and no-ERP guard are in place.

- [x] **Step 5: Complete error status mapping and sanitized audit helper**

```csharp
/**
 * @file Driver response writer and HTTP status mapping.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Endpoints;

public static class DriverResponseWriter
{
    public static int GetHttpStatus(string resultCode) => resultCode switch
    {
        "OK" => StatusCodes.Status200OK,
        "LEASE_INVALID" => StatusCodes.Status400BadRequest,
        "LEASE_EXPIRED" => StatusCodes.Status409Conflict,
        "HOST_MISMATCH" => StatusCodes.Status403Forbidden,
        "SIGNAL_CONFIG_MISMATCH" => StatusCodes.Status400BadRequest,
        "FENCING_TOKEN_STALE" => StatusCodes.Status409Conflict,
        "DEVICE_IDENTITY_MISMATCH" => StatusCodes.Status409Conflict,
        "DEVICE_TIMEOUT" => StatusCodes.Status504GatewayTimeout,
        "DEVICE_REJECTED" => StatusCodes.Status502BadGateway,
        "DEVICE_BUSY" => StatusCodes.Status409Conflict,
        "CLEANUP_PENDING" => StatusCodes.Status409Conflict,
        _ => StatusCodes.Status500InternalServerError
    };
}
```

```csharp
/**
 * @file Sanitized audit log entry.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.State;

public sealed record AuditLogEntry(
    string CorrelationId,
    string? LeaseId,
    string? TargetDeviceId,
    long? FencingToken,
    string CommandName,
    long DurationMs,
    string ResultCode,
    string LeaseState,
    string DeviceSessionState,
    string Message)
{
    public static AuditLogEntry CreateSanitized(
        string correlationId,
        string? leaseId,
        string? targetDeviceId,
        long? fencingToken,
        string commandName,
        TimeSpan duration,
        string resultCode,
        string leaseState,
        string deviceSessionState,
        Exception exception)
    {
        var exceptionType = exception.GetType().Name;
        return new AuditLogEntry(
            correlationId,
            leaseId,
            targetDeviceId,
            fencingToken,
            commandName,
            (long)duration.TotalMilliseconds,
            resultCode,
            leaseState,
            deviceSessionState,
            $"驱动命令执行失败，异常类型：{exceptionType}，关联编号：{correlationId}");
    }
}
```

- [x] **Step 6: Update QT App frontend contract tests**

Only update existing `QT App（Qt 应用）` tests that verify the Driver response shape. Do not add new UI flows beyond the current bootstrap dashboard.

```ts
// PopoY: dashboard needs only stable resultCode/state/correlationId from Driver Service V1.
expect(driverStatus.resultCode).toBe("OK");
expect(driverStatus.leaseState).toBe("Active");
expect(driverStatus.deviceSessionState).toBe("Connected");
expect(driverStatus.correlationId).toBeTruthy();
```

Also keep the existing request-shape assertion:

```ts
// PopoY: QT App must never send raw device endpoint authorization fields.
expect(JSON.stringify(requestBody)).not.toContain('"ip"');
expect(JSON.stringify(requestBody)).not.toContain('"port"');
expect(JSON.stringify(requestBody)).not.toContain('"deviceId"');
```

- [x] **Step 7: Add verification record template**

Create `docs/driver-service-v1-spec-plan/verification-record.md` after the final run.

```markdown
# Driver Service V1 Verification Record

> @file Driver Service V1 验证记录
> @author PopoY
> @created 2026-06-26
> @purpose 记录 Driver Service V1 自动化验证、Qt 集成验证和剩余人工验证缺口。

## Automated Checks（自动化检查）

- [ ] `cd driver-service && dotnet test`
- [ ] `cd driver-service && dotnet build`
- [ ] `cd qt-app/frontend && ./node_modules/.bin/vitest run driverClient acceptanceChecklist`
- [ ] `cd qt-app/frontend && ./node_modules/.bin/vite build`

## Acceptance Snapshot（验收快照）

- `resultCode（结果码）`: `OK`
- `leaseState（租约状态）`: `Active`
- `deviceSessionState（设备会话状态）`: `Connected`
- `correlationId（关联 ID）`: recorded
- `signalValues（信号值）`: recorded

## Known Gaps（已知缺口）

- Real `NModbus（Modbus 通信库）` hardware smoke requires the field device endpoint from a signed lease and is recorded separately when hardware is available.
```

- [x] **Step 8: Run final verification**

```bash
cd driver-service
dotnet test
dotnet build
cd ../qt-app/frontend
./node_modules/.bin/vitest run driverClient acceptanceChecklist
./node_modules/.bin/vite build
```

Expected: Driver tests pass, Driver build passes, QT frontend contract tests pass, and the verification record states any real hardware smoke gap explicitly instead of implying it was completed.

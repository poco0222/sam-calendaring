# Task 03: Host Request Response Logging

> @file Driver Service V1 宿主请求响应日志任务
> @author PopoY
> @created 2026-06-27
> @purpose 为启动生命周期、请求接收、响应写回、审计写入和 GET /diagnosticLogs（诊断日志接口）补齐日志。

## Goal（目标）

Expose `GET /diagnosticLogs（诊断日志接口）`, allow `GET` in existing `CORS（跨源资源共享）`, and write diagnostic events for startup, request, response, and audit boundaries.

## Status（状态）

- `Done（完成）`: 本轮只处理 Task3，已完成后端日志链路、文档回写和验证；因当前工作区不是 Git repository（Git 仓库），提交步骤已记录为跳过。

## Progress（进度）

- `2026-06-27`: 计划已落库，当前进度 `0/8`。
- `2026-06-27`: 开始执行 Task3；确认工作区不是 Git repository（Git 仓库），最终 commit（提交）步骤将按实际能力记录。
- `2026-06-27`: 完成 Step 1-3，已新增 RED（失败）测试；聚焦测试失败点为 `/diagnosticLogs` 404、启动诊断事件为空、请求链路诊断事件为空，当前进度 `3/8`。
- `2026-06-27`: 完成 Step 4-6，已新增 `GET /diagnosticLogs（诊断日志接口）`、CORS GET（跨源 GET）、启动生命周期诊断和请求/响应/审计诊断；初步聚焦测试 6/6 通过，当前进度 `6/8`。
- `2026-06-27`: 完成 Step 7，聚焦验证 `dotnet test --filter "FullyQualifiedName~DiagnosticLogsApiTests|FullyQualifiedName~DriverWorkerTests|FullyQualifiedName~ApiContractTests|FullyQualifiedName~DriverServiceV1AcceptanceTests"` 通过 `25/25`，当前进度 `7/8`。
- `2026-06-27`: 根据 review（审查）补充 `AuditLogAppendFailed（审计写入失败）` 失败边界，重新验证聚焦测试通过 `26/26`、全量 `dotnet test` 通过 `89/89`、`dotnet build` 通过 `0` warnings（警告）/ `0` errors（错误）。
- `2026-06-27`: Step 8 已确认无法执行：外层目录与 `driver-service` 均不是 Git repository（Git 仓库），未创建 commit（提交），最终进度 `8/8`。

## Files（文件）

- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/DriverWorker.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/State/DriverStateService.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogsApiTests.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DriverWorkerTests.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/ApiContractTests.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/DriverServiceV1AcceptanceTests.cs`

## Steps（步骤）

- [x] **Step 1: Write failing Diagnostic Logs API tests（编写失败接口测试）**

Create `driver-service/tests/Sam.Calendaring.DriverService.Tests/DiagnosticLogsApiTests.cs`:

```csharp
/**
 * @file DiagnosticLogsApiTests.cs
 * @author PopoY
 * @created 2026-06-27
 * @purpose 锁定 GET /diagnosticLogs（诊断日志接口）的查询、CORS（跨源资源共享）和中文错误响应契约。
 */
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 diagnostic logs API（诊断日志接口）的只读查询契约。
/// </summary>
public sealed class DiagnosticLogsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    /// <summary>
    /// 初始化诊断日志接口测试工厂。
    /// </summary>
    /// <param name="factory">ASP.NET Core 测试宿主工厂。</param>
    public DiagnosticLogsApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// 验证接口按 statusClass（状态分类）、category（分类）和 correlationId（关联 ID）返回日志。
    /// </summary>
    [Fact]
    public async Task DiagnosticLogsEndpointReturnsFilteredLogs()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.AppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Error",
            category: "Device",
            eventName: "SignalReadFailed",
            message: "设备通信超时",
            correlationId: "cid-api-001",
            commandName: "getSignalSnapshot",
            resultCode: DriverResultCode.DeviceTimeout), CancellationToken.None);
        await store.AppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "收到驱动请求",
            correlationId: "cid-api-002",
            commandName: "applyLeaseAndConfig",
            resultCode: DriverResultCode.Ok), CancellationToken.None);

        var client = CreateClientWithStore(store);
        var response = await client.GetFromJsonAsync<DiagnosticLogsResponse>(
            "/diagnosticLogs?statusClass=abnormal&category=device&correlationId=cid-api-001&limit=100");

        Assert.NotNull(response);
        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        var log = Assert.Single(response.Logs);
        Assert.Equal("Device", log.Category);
        Assert.Equal("Abnormal", log.StatusClass);
        Assert.Equal("cid-api-001", log.CorrelationId);
    }

    /// <summary>
    /// 验证无效查询参数返回中文 JSON（JavaScript Object Notation）错误响应。
    /// </summary>
    [Fact]
    public async Task DiagnosticLogsEndpointRejectsInvalidStatusClassWithChineseJson()
    {
        var client = CreateClientWithStore(SqliteDriverStateStore.CreateTempFileForTests());

        var response = await client.GetAsync("/diagnosticLogs?statusClass=broken");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("请求参数不正确", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Exception", body, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证 CORS（跨源资源共享）允许 Qt WebEngine 的 null origin（空来源）访问 GET 接口。
    /// </summary>
    [Fact]
    public async Task CorsAllowsDiagnosticLogsGetFromNullOrigin()
    {
        var client = CreateClientWithStore(SqliteDriverStateStore.CreateTempFileForTests());
        using var request = new HttpRequestMessage(HttpMethod.Options, "/diagnosticLogs");
        request.Headers.Add("Origin", "null");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins));
        Assert.Contains("null", origins);
    }

    /// <summary>
    /// 使用指定状态存储创建隔离测试客户端。
    /// </summary>
    /// <param name="store">测试注入的状态存储。</param>
    /// <returns>返回配置完成的 HTTP client（客户端）。</returns>
    private HttpClient CreateClientWithStore(IDriverStateStore store)
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Driver:Mode"] = "Mock"
                });
            });
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(store);
            });
        }).CreateClient();
    }

    /// <summary>
    /// 表示 GET /diagnosticLogs（诊断日志接口）的测试响应。
    /// </summary>
    private sealed record DiagnosticLogsResponse(string ResultCode, IReadOnlyList<DiagnosticLogEntry> Logs);
}
```

Keep `DiagnosticLogsResponse（诊断日志响应）` in the same test file unless production code needs a shared contract class.

- [x] **Step 2: Add failing runtime boundary tests（新增失败运行边界测试）**

Update `DriverWorkerTests.cs` with a test that runs `DriverWorker（驱动后台任务）` and asserts diagnostic events:

```csharp
/**
 * @author PopoY
 * @brief 验证 DriverWorker（驱动后台任务）写入启动和停止诊断事件。
 */
[Fact]
public async Task ExecuteAsyncWritesStartupAndShutdownDiagnosticEvents()
{
    var store = SqliteDriverStateStore.CreateTempFileForTests();
    await store.InitializeAsync(CancellationToken.None);
    var service = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
    var worker = new DriverWorker(NullLogger<DriverWorker>.Instance, service);
    using var cts = new CancellationTokenSource();

    var executeAsync = typeof(DriverWorker).GetMethod(
        "ExecuteAsync",
        BindingFlags.Instance | BindingFlags.NonPublic);

    Assert.NotNull(executeAsync);

    var workerTask = (Task)executeAsync.Invoke(worker, new object[] { cts.Token })!;
    await Task.Delay(50, CancellationToken.None);
    await cts.CancelAsync();
    await workerTask;

    var logs = await store.QueryDiagnosticLogsAsync(new DiagnosticLogQuery("all", "startup", null, 100), CancellationToken.None);
    Assert.Contains(logs, entry => entry.EventName == "ServiceStarted");
    Assert.Contains(logs, entry => entry.EventName == "ServiceStopped");
    Assert.Contains(logs, entry => entry.EventName == "StateStoreInitialized");
}
```

Update `DriverServiceV1AcceptanceTests.cs` with one assertion after a successful apply + snapshot flow:

```csharp
/**
 * @author PopoY
 * @brief 验证成功链路写入 Request（请求）、Response（响应）和 Audit（审计）诊断事件。
 */
var diagnosticLogs = await store.QueryDiagnosticLogsAsync(
    new DiagnosticLogQuery("all", "all", correlationId, 100),
    CancellationToken.None);

Assert.Contains(diagnosticLogs, entry => entry.EventName == "RequestReceived");
Assert.Contains(diagnosticLogs, entry => entry.EventName == "ResponseSent");
Assert.Contains(diagnosticLogs, entry => entry.EventName == "AuditLogAppendCompleted");
```

- [x] **Step 3: Run tests to confirm RED（确认失败状态）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogsApiTests|FullyQualifiedName~DriverWorkerTests|FullyQualifiedName~DriverServiceV1AcceptanceTests"
```

Expected（期望）: FAIL because API, response type, startup events, and request/response diagnostic events are not implemented.

- [x] **Step 4: Add API response and CORS GET（新增接口响应与 CORS GET）**

Modify `Program.cs` CORS methods:

```csharp
// PopoY: Diagnostic Logs Page（诊断日志页面）需要 GET；Driver command（驱动命令）继续使用 POST。
.WithMethods(HttpMethods.Get, HttpMethods.Post)
```

Add `GET /diagnosticLogs` to `DriverEndpoints.MapDriverV1Endpoints`:

```csharp
app.MapGet("/diagnosticLogs", HandleDiagnosticLogs);
```

Implement `HandleDiagnosticLogs` in `DriverEndpoints.cs`:

```csharp
/// <summary>
/// 查询只读 diagnostic logs（诊断日志）。
/// </summary>
private static async Task<IResult> HandleDiagnosticLogs(
    string? statusClass,
    string? category,
    string? correlationId,
    int? limit,
    DriverStateService driverStateService,
    CancellationToken cancellationToken)
{
    if (!IsAllowedStatusClass(statusClass) || !IsAllowedCategory(category))
    {
        return TypedResults.BadRequest(new
        {
            resultCode = DriverResultCode.LeaseInvalid,
            message = "请求参数不正确"
        });
    }

    var logs = await driverStateService.QueryDiagnosticLogsAsync(
        new DiagnosticLogQuery(statusClass, category, correlationId, limit),
        cancellationToken).ConfigureAwait(false);

    return TypedResults.Ok(new
    {
        resultCode = DriverResultCode.Ok,
        logs
    });
}
```

Use two small allowlist helpers（白名单 helper）:

```csharp
private static bool IsAllowedStatusClass(string? value)
{
    return string.IsNullOrWhiteSpace(value)
        || value.Equals("abnormal", StringComparison.OrdinalIgnoreCase)
        || value.Equals("normal", StringComparison.OrdinalIgnoreCase)
        || value.Equals("all", StringComparison.OrdinalIgnoreCase);
}

private static bool IsAllowedCategory(string? value)
{
    return string.IsNullOrWhiteSpace(value)
        || value.Equals("startup", StringComparison.OrdinalIgnoreCase)
        || value.Equals("request", StringComparison.OrdinalIgnoreCase)
        || value.Equals("execution", StringComparison.OrdinalIgnoreCase)
        || value.Equals("device", StringComparison.OrdinalIgnoreCase)
        || value.Equals("response", StringComparison.OrdinalIgnoreCase)
        || value.Equals("audit", StringComparison.OrdinalIgnoreCase)
        || value.Equals("all", StringComparison.OrdinalIgnoreCase);
}
```

- [x] **Step 5: Add startup lifecycle diagnostics（新增启动生命周期诊断）**

Modify `DriverStateService.cs` to expose initialization:

```csharp
/// <summary>
/// 初始化底层状态存储。
/// </summary>
/// <param name="cancellationToken">取消令牌。</param>
public Task InitializeAsync(CancellationToken cancellationToken)
{
    return _stateStore.InitializeAsync(cancellationToken);
}
```

Modify `DriverWorker.cs` constructor to accept `DriverStateService` and write startup / shutdown events:

```csharp
public sealed class DriverWorker(
    ILogger<DriverWorker> logger,
    DriverStateService driverStateService) : BackgroundService
```

Inside `ExecuteAsync`:

```csharp
await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
    level: "Information",
    category: "Startup",
    eventName: "ServiceStarting",
    eventStage: "Start",
    message: "驱动服务正在启动"), stoppingToken).ConfigureAwait(false);

await driverStateService.InitializeAsync(stoppingToken).ConfigureAwait(false);
await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
    level: "Information",
    category: "Startup",
    eventName: "StateStoreInitialized",
    eventStage: "Completed",
    message: "驱动状态存储已初始化"), stoppingToken).ConfigureAwait(false);
```

On normal startup and cancellation, append `ServiceStarted`, `ServiceStopping`, and `ServiceStopped` with Chinese messages.

- [x] **Step 6: Add request, response, and audit diagnostics（新增请求、响应和审计诊断）**

In `DriverEndpoints.cs`, add small local helpers and use them in both command endpoints:

```csharp
/// <summary>
/// 写入 diagnostic log（诊断日志）并复用 DriverStateService（驱动状态服务）的安全失败策略。
/// </summary>
private static Task AppendDiagnosticAsync(
    DriverStateService driverStateService,
    DiagnosticLogEntry entry,
    CancellationToken cancellationToken)
{
    return driverStateService.TryAppendDiagnosticLogAsync(entry, cancellationToken);
}
```

For each command endpoint:

1. At start: append `RequestReceived`.
2. Before returning: append `ResponseSending`.
3. After audit append succeeds: append `AuditLogAppendCompleted`.
4. Before return: append `ResponseSent`.
5. In exception path: append `ResponseFailed` with `exceptionType（异常类型）` and Chinese message.

Keep all messages Chinese. Do not write raw request body or raw response body.

- [x] **Step 7: Run focused verification（运行聚焦验证）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogsApiTests|FullyQualifiedName~DriverWorkerTests|FullyQualifiedName~ApiContractTests|FullyQualifiedName~DriverServiceV1AcceptanceTests"
```

Expected（期望）: PASS.

- [x] **Step 8: Commit（提交）**

Execution note（执行记录）: skipped（已跳过），因为 `/Users/PopoY/workingFiles/Projects/SAM/sam-calendaring` 和 `driver-service` 均不是 Git repository（Git 仓库），`git status --short --branch` 返回 `fatal: not a git repository`。

```bash
git add driver-service/src/Sam.Calendaring.DriverService driver-service/tests/Sam.Calendaring.DriverService.Tests
git commit -m "feat: 补齐 Driver Service request response diagnostic logging"
```

If this workspace remains not a Git repository（Git 仓库）, skip commit and record that in the execution note.

## Verification（验证）

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~DiagnosticLogsApiTests|FullyQualifiedName~DriverWorkerTests|FullyQualifiedName~ApiContractTests|FullyQualifiedName~DriverServiceV1AcceptanceTests"
```

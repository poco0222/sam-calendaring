/**
 * @file Driver Service 应用入口。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 配置 Driver Service 最小宿主、默认本机监听地址、统一 JSON 错误响应和健康检查端点。
 */
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.Security;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using Sam.Calendaring.DriverService;
using Sam.Calendaring.DriverService.Commands;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Monitoring;
using Sam.Calendaring.DriverService.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// PopoY: 显式启用 patched native SQLite runtime（已修补原生运行时），避免本地状态库依赖有漏洞的默认 bundle（包）。
SQLitePCL.Batteries_V2.Init();

// PopoY: 当前阶段仅监听本机回环地址，避免提前暴露到外部网络。
var driverPort = builder.Configuration.GetValue<int?>("Driver:Port") ?? 5096;
builder.WebHost.UseUrls($"http://127.0.0.1:{driverPort}");

builder.Host.UseWindowsService(options =>
{
    options.ServiceName = "SAM Calendaring Driver Service";
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // PopoY: keep ASP.NET Core binder（绑定器）与手工预验证共享同一份严格 JSON 契约，不再重复硬编码配置。
    options.SerializerOptions.UnmappedMemberHandling = DriverJson.Options.UnmappedMemberHandling;
});
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            // PopoY: Qt WebEngine（Qt 网页引擎）从 file:// 加载 UI，不同运行时可能发送 file:// 或 null origin（来源）。
            .SetIsOriginAllowed(origin =>
                string.Equals(origin, "file://", StringComparison.Ordinal)
                || string.Equals(origin, "null", StringComparison.Ordinal))
            // PopoY: Diagnostic Logs Page（诊断日志页面）读取日志需要 GET，驱动命令继续使用 POST。
            .WithMethods(HttpMethods.Get, HttpMethods.Post)
            .WithHeaders("content-type");
    });
});
builder.Services.Configure<DriverOptions>(builder.Configuration.GetSection("Driver"));
builder.Services.Configure<HostIdentityOptions>(builder.Configuration.GetSection("HostIdentity"));
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddSingleton(serviceProvider =>
    serviceProvider.GetRequiredService<IOptions<HostIdentityOptions>>().Value);
builder.Services.AddSingleton(serviceProvider =>
    serviceProvider.GetRequiredService<IOptions<DriverOptions>>().Value);
builder.Services.AddSingleton<IDriverStateStore>(_ =>
{
    return new SqliteDriverStateStore(ResolveDriverStateConnectionString(builder.Configuration.GetConnectionString("DriverState")));
});
builder.Services.AddSingleton<IModbusAdapter>(_ =>
    string.Equals(builder.Configuration["Driver:Mode"], "Real", StringComparison.OrdinalIgnoreCase)
        ? new NModbusAdapter()
        : new MockModbusAdapter());
builder.Services.AddSingleton<DriverStateService>();
builder.Services.AddSingleton<DriverSessionManager>();
builder.Services.AddSingleton<LeaseValidator>();
builder.Services.AddSingleton<ModbusDeviceGate>();
builder.Services.AddSingleton<PressDeviceIdempotencyStore>();
builder.Services.AddSingleton<DeviceEventHub>();
builder.Services.AddSingleton<PressDownCountMonitorService>();
builder.Services.AddSingleton<PressDeviceCommandExecutor>();
builder.Services.AddHostedService<DiagnosticLogRetentionService>();
builder.Services.AddHostedService<SignalSnapshotPublisherService>();
builder.Services.AddHostedService<DriverWorker>();

var app = builder.Build();
var requestValidationJsonOptions = DriverJson.Options;

app.UseCors();

app.Use(async (context, next) =>
{
    if (TryGetContractRequestType(context.Request, out var contractRequestType)
        && !await TryValidateContractRequestAsync(context, contractRequestType, requestValidationJsonOptions))
    {
        return;
    }

    try
    {
        await next();
    }
    catch (BadHttpRequestException) when (!context.Response.HasStarted && TryCreateInvalidJsonResult(context.Request.Path, string.Empty, out var invalidJsonResult))
    {
        await invalidJsonResult.ExecuteAsync(context);
    }
});

// PopoY: 健康检查用于确认服务壳已启动，不依赖后续业务能力是否完善。
app.MapGet("/health", () => Results.Json(new { resultCode = "OK", message = "驱动服务运行中" }));
app.MapDriverV1Endpoints();

app.Run();

/// <summary>
/// 判断当前请求路径是否属于需要提前验证 JSON 的最小契约端点。
/// </summary>
/// <param name="request">当前 HTTP 请求。</param>
/// <param name="contractRequestType">若命中契约端点，则返回对应请求类型。</param>
/// <returns>命中受保护端点时返回 true，否则返回 false。</returns>
static bool TryGetContractRequestType(HttpRequest request, [NotNullWhen(true)] out Type? contractRequestType)
{
    if (!HttpMethods.IsPost(request.Method))
    {
        contractRequestType = null;
        return false;
    }

    switch (request.Path.Value)
    {
        case "/applyLeaseAndConfig":
            contractRequestType = typeof(ApplyLeaseAndConfigRequest);
            return true;
        case "/getSignalSnapshot":
            contractRequestType = typeof(GetSignalSnapshotRequest);
            return true;
        case "/executeDeviceCommand":
            contractRequestType = typeof(ExecuteDeviceCommandRequest);
            return true;
        default:
            contractRequestType = null;
            return false;
    }
}

/// <summary>
/// 在进入最小 API（应用程序编程接口）绑定前预验证 JSON，请求合法时复原流位置给后续强类型绑定复用。
/// </summary>
/// <param name="context">当前 HTTP 上下文。</param>
/// <param name="contractRequestType">当前端点对应的请求契约类型。</param>
/// <param name="serializerOptions">与运行时保持一致的 JSON 反序列化选项。</param>
/// <returns>验证通过时返回 true；若已直接写回契约错误响应则返回 false。</returns>
static async Task<bool> TryValidateContractRequestAsync(
    HttpContext context,
    Type contractRequestType,
    JsonSerializerOptions serializerOptions)
{
    context.Request.EnableBuffering();
    var startedAt = Stopwatch.GetTimestamp();

    try
    {
        // PopoY: 这里先走一次与端点绑定一致的反序列化，确保 Kestrel 和 TestServer 都在进入处理器前收敛成同一份契约错误响应。
        await JsonSerializer.DeserializeAsync(
            context.Request.Body,
            contractRequestType,
            serializerOptions,
            context.RequestAborted);
        context.Request.Body.Position = 0;
        return true;
    }
    catch (JsonException) when (!context.Response.HasStarted)
    {
        var correlationId = await TryReadCorrelationIdAsync(context.Request, context.RequestAborted);
        if (!TryCreateInvalidJsonResult(context.Request.Path, correlationId, out var invalidJsonResult))
        {
            throw;
        }

        await AppendContractValidationFailureDiagnosticsAsync(
            context,
            GetContractCommandName(context.Request.Path),
            correlationId,
            GetElapsedMilliseconds(startedAt),
            context.RequestAborted);
        context.Request.Body.Position = 0;
        await invalidJsonResult.ExecuteAsync(context);
        return false;
    }
}

/// <summary>
/// 为受保护契约端点创建统一的中文 JSON 错误响应。
/// </summary>
/// <param name="path">当前 HTTP 请求路径。</param>
/// <param name="correlationId">尽力提取到的关联 ID。</param>
/// <param name="invalidJsonResult">若命中目标端点，则返回对应的错误结果。</param>
/// <returns>命中目标端点时返回 true，否则返回 false。</returns>
static bool TryCreateInvalidJsonResult(
    PathString path,
    string correlationId,
    [NotNullWhen(true)] out IResult? invalidJsonResult)
{
    invalidJsonResult = path.Value switch
    {
        "/getSignalSnapshot" => TypedResults.BadRequest(new GetSignalSnapshotResponse
        {
            CorrelationId = correlationId,
            ResultCode = DriverResultCode.LeaseInvalid,
            Message = "请求字段不允许或格式不正确",
            SignalValues = new Dictionary<string, object?>()
        }),
        "/applyLeaseAndConfig" => TypedResults.BadRequest(new ApplyLeaseAndConfigResponse
        {
            CorrelationId = correlationId,
            ResultCode = DriverResultCode.LeaseInvalid,
            Message = "请求字段不允许或格式不正确",
            LeaseState = LeaseState.None,
            DeviceSessionState = DeviceSessionState.Disconnected,
            LeaseId = null,
            TargetDeviceId = null,
            FencingToken = null
        }),
        "/executeDeviceCommand" => TypedResults.BadRequest(new ExecuteDeviceCommandResponse
        {
            CorrelationId = correlationId,
            CommandName = string.Empty,
            LocalJobSessionId = string.Empty,
            IdempotencyKey = string.Empty,
            ResultCode = DriverResultCode.LeaseInvalid,
            Message = "请求字段不允许或格式不正确",
            LeaseState = LeaseState.None,
            DeviceSessionState = DeviceSessionState.Disconnected,
            CompletedSteps = Array.Empty<string>(),
            FailedSteps = new[] { "requestBoundary" }
        }),
        _ => null
    };

    return invalidJsonResult is not null;
}

/// <summary>
/// 为 JSON Contract（JSON 契约）校验失败写入 Request（请求）诊断链路。
/// </summary>
/// <param name="context">当前 HTTP 上下文。</param>
/// <param name="commandName">命令名称。</param>
/// <param name="correlationId">尽力提取到的关联 ID。</param>
/// <param name="durationMs">契约校验耗时。</param>
/// <param name="cancellationToken">取消令牌。</param>
static async Task AppendContractValidationFailureDiagnosticsAsync(
    HttpContext context,
    string commandName,
    string correlationId,
    long durationMs,
    CancellationToken cancellationToken)
{
    var driverStateService = context.RequestServices.GetRequiredService<DriverStateService>();
    const string resultCode = DriverResultCode.LeaseInvalid;
    const int httpStatusCode = StatusCodes.Status400BadRequest;
    const string leaseState = LeaseState.None;
    const string deviceSessionState = DeviceSessionState.Disconnected;

    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Information",
        category: "Request",
        eventName: "RequestReceived",
        message: "收到驱动请求。",
        eventStage: "Start",
        correlationId: correlationId,
        commandName: commandName), cancellationToken);
    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Information",
        category: "Execution",
        eventName: "ActionStarted",
        message: "开始处理驱动契约校验。",
        eventStage: "Start",
        correlationId: correlationId,
        commandName: commandName), cancellationToken);
    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Warning",
        category: "Request",
        eventName: "RequestContractValidationFailed",
        message: "请求契约校验失败，已拒绝处理。",
        eventStage: "Failed",
        correlationId: correlationId,
        commandName: commandName,
        resultCode: resultCode,
        httpStatusCode: httpStatusCode,
        durationMs: durationMs), cancellationToken);
    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Warning",
        category: "Execution",
        eventName: "ActionCompleted",
        message: "驱动契约校验失败。",
        eventStage: "Failed",
        correlationId: correlationId,
        commandName: commandName,
        resultCode: resultCode,
        httpStatusCode: httpStatusCode,
        durationMs: durationMs,
        leaseState: leaseState,
        deviceSessionState: deviceSessionState), cancellationToken);
    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Information",
        category: "Audit",
        eventName: "AuditLogAppendStarted",
        message: "开始写入审计日志。",
        eventStage: "Start",
        correlationId: correlationId,
        commandName: commandName,
        resultCode: resultCode,
        durationMs: durationMs,
        leaseState: leaseState,
        deviceSessionState: deviceSessionState), cancellationToken);
    try
    {
        await driverStateService.AppendAuditLogAsync(AuditLogEntry.CreateSanitized(
            correlationId,
            commandName,
            durationMs,
            resultCode,
            leaseState,
            deviceSessionState,
            "请求字段不允许或格式不正确"), cancellationToken);
    }
    catch (Exception exception) when (exception is not OperationCanceledException)
    {
        await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Error",
            category: "Audit",
            eventName: "AuditLogAppendFailed",
            message: "审计日志写入失败，已记录异常类型。",
            eventStage: "Failed",
            correlationId: correlationId,
            commandName: commandName,
            resultCode: resultCode,
            durationMs: durationMs,
            leaseState: leaseState,
            deviceSessionState: deviceSessionState,
            exceptionType: exception.GetType().Name), cancellationToken);
        throw;
    }

    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Information",
        category: "Audit",
        eventName: "AuditLogAppendCompleted",
        message: "审计日志写入完成。",
        eventStage: "Completed",
        correlationId: correlationId,
        commandName: commandName,
        resultCode: resultCode,
        durationMs: durationMs,
        leaseState: leaseState,
        deviceSessionState: deviceSessionState), cancellationToken);
    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Warning",
        category: "Request",
        eventName: "RequestRejected",
        message: "驱动请求已拒绝。",
        eventStage: "Rejected",
        correlationId: correlationId,
        commandName: commandName,
        resultCode: resultCode,
        httpStatusCode: httpStatusCode,
        durationMs: durationMs), cancellationToken);
    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Information",
        category: "Request",
        eventName: "RequestCompleted",
        message: "驱动请求处理完成。",
        eventStage: "Completed",
        correlationId: correlationId,
        commandName: commandName,
        resultCode: resultCode,
        httpStatusCode: httpStatusCode,
        durationMs: durationMs), cancellationToken);
    await driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
        level: "Information",
        category: "Response",
        eventName: "ResponseSent",
        message: "驱动响应已写回。",
        eventStage: "Completed",
        correlationId: correlationId,
        commandName: commandName,
        resultCode: resultCode,
        httpStatusCode: httpStatusCode,
        durationMs: durationMs,
        leaseState: leaseState,
        deviceSessionState: deviceSessionState), cancellationToken);
}

/// <summary>
/// 计算从开始时间戳到当前时刻的耗时毫秒数。
/// </summary>
/// <param name="startedAt">开始计时的高精度时间戳。</param>
/// <returns>返回非负耗时毫秒数。</returns>
static long GetElapsedMilliseconds(long startedAt)
{
    return Math.Max(0L, (long)Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
}

/// <summary>
/// 从格式正确的 JSON（JavaScript Object Notation）请求体中尽力读取 correlationId（关联 ID）。
/// </summary>
/// <param name="request">当前 HTTP 请求。</param>
/// <param name="cancellationToken">取消令牌。</param>
/// <returns>读到时返回关联 ID，否则返回空字符串。</returns>
static async Task<string> TryReadCorrelationIdAsync(HttpRequest request, CancellationToken cancellationToken)
{
    if (request.Body.CanSeek)
    {
        request.Body.Position = 0;
    }

    try
    {
        using var document = await JsonDocument.ParseAsync(request.Body, cancellationToken: cancellationToken);
        if (document.RootElement.ValueKind == JsonValueKind.Object
            && document.RootElement.TryGetProperty("correlationId", out var correlationIdElement)
            && correlationIdElement.ValueKind == JsonValueKind.String)
        {
            return correlationIdElement.GetString() ?? string.Empty;
        }
    }
    catch (JsonException)
    {
        return string.Empty;
    }
    finally
    {
        if (request.Body.CanSeek)
        {
            request.Body.Position = 0;
        }
    }

    return string.Empty;
}

/// <summary>
/// 将受保护端点 path（路径）映射为稳定命令名。
/// </summary>
/// <param name="path">当前 HTTP 请求路径。</param>
/// <returns>返回命令名。</returns>
static string GetContractCommandName(PathString path)
{
    return path.Value switch
    {
        "/getSignalSnapshot" => "getSignalSnapshot",
        "/applyLeaseAndConfig" => "applyLeaseAndConfig",
        "/executeDeviceCommand" => "executeDeviceCommand",
        _ => "unknown"
    };
}

/// <summary>
/// 解析 Driver state（驱动状态）连接字符串；若未配置或使用相对路径，则落到稳定且可写的本地目录。
/// </summary>
/// <param name="configuredConnectionString">原始配置中的连接字符串。</param>
/// <returns>返回可直接用于 SQLite 的最终连接字符串。</returns>
static string ResolveDriverStateConnectionString(string? configuredConnectionString)
{
    var builder = string.IsNullOrWhiteSpace(configuredConnectionString)
        ? new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder()
        : new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder(configuredConnectionString);
    if (string.IsNullOrWhiteSpace(builder.DataSource))
    {
        builder.DataSource = Path.Combine(GetDefaultDriverStateDirectory(), "driver-state.db");
        return builder.ToString();
    }

    if (!Path.IsPathRooted(builder.DataSource))
    {
        builder.DataSource = Path.Combine(GetDefaultDriverStateDirectory(), builder.DataSource);
    }

    var directoryPath = Path.GetDirectoryName(builder.DataSource);
    if (!string.IsNullOrWhiteSpace(directoryPath))
    {
        Directory.CreateDirectory(directoryPath);
    }

    return builder.ToString();
}

/// <summary>
/// 获取 Driver state（驱动状态）默认落盘目录。
/// </summary>
/// <returns>返回默认状态目录的绝对路径。</returns>
static string GetDefaultDriverStateDirectory()
{
    var rootPath = OperatingSystem.IsWindows()
        ? Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData)
        : Path.Combine(Path.GetTempPath(), "sam-calendaring");
    var stateDirectory = OperatingSystem.IsWindows()
        ? Path.Combine(rootPath, "SAM", "Calendaring", "DriverService")
        : Path.Combine(rootPath, "driver-service");
    Directory.CreateDirectory(stateDirectory);
    return stateDirectory;
}

public partial class Program;

/**
 * @file Driver Service V1 端点映射。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供 Driver Service V1 业务端点、诊断日志查询和请求响应审计日志边界。
 */
using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Sam.Calendaring.DriverService.Commands;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Events;
using Sam.Calendaring.DriverService.Security;
using Sam.Calendaring.DriverService.Sessions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService;

/// <summary>
/// 提供 Driver Service V1 的最小端点映射扩展。
/// </summary>
public static class DriverEndpoints
{
    private const string LeaseIncompleteMessage = "租约无效或字段不完整。";
    private const string LeaseAppliedMessage = "授权已更新，刷新快照时连接设备。";
    private const string ExecuteDeviceCommandInvalidMessage = "请求字段缺失或超时时间不正确。";
    private const string ExecuteDeviceCommandNotAllowedMessage = "命令不在 Driver Service 允许列表中，当前版本不支持该命令。";

    /// <summary>
    /// Task 01 允许的 semantic command（语义命令）白名单。
    /// </summary>
    private static readonly HashSet<string> AllowedDeviceCommandNames =
        new(PressDeviceCommandCatalog.KnownCommandNames, StringComparer.Ordinal);

    /// <summary>
    /// 映射 Driver Service V1 的最小业务端点。
    /// </summary>
    /// <param name="app">用于注册端点的路由构建器。</param>
    /// <returns>返回传入的路由构建器，便于继续链式注册。</returns>
    public static IEndpointRouteBuilder MapDriverV1Endpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/applyLeaseAndConfig", HandleApplyLeaseAndConfig);
        app.MapPost("/getSignalSnapshot", HandleGetSignalSnapshot);
        app.MapPost("/precheckDeviceCommand", HandlePrecheckDeviceCommand);
        app.MapPost("/executeDeviceCommand", HandleExecuteDeviceCommand);
        app.MapGet("/deviceEvents/stream", HandleDeviceEventsStream);
        app.MapGet("/diagnosticLogs", HandleDiagnosticLogs);

        return app;
    }

    /// <summary>
    /// 映射 device event stream（设备事件流）SSE（服务器发送事件）端点。
    /// </summary>
    /// <param name="context">当前 HTTP 上下文。</param>
    /// <param name="eventHub">设备事件中心。</param>
    /// <returns>返回长连接写入任务。</returns>
    private static Task HandleDeviceEventsStream(HttpContext context, DeviceEventHub eventHub)
    {
        var correlationId = context.Request.Query.TryGetValue("correlationId", out var value)
            ? value.ToString()
            : string.Empty;
        return eventHub.WriteSseAsync(context, correlationId, context.RequestAborted);
    }

    /// <summary>
    /// 查询只读 diagnostic logs（诊断日志）。
    /// </summary>
    /// <param name="statusClass">状态分类过滤条件。</param>
    /// <param name="category">分类过滤条件。</param>
    /// <param name="correlationId">关联 ID 过滤条件。</param>
    /// <param name="limit">返回数量限制。</param>
    /// <param name="fromUtc">UTC 起始时间。</param>
    /// <param name="toUtc">UTC 结束时间。</param>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="cancellationToken">当前请求取消令牌。</param>
    /// <returns>返回诊断日志列表或中文参数错误。</returns>
    private static async Task<IResult> HandleDiagnosticLogs(
        string? statusClass,
        string? category,
        string? correlationId,
        int? limit,
        string? fromUtc,
        string? toUtc,
        DriverStateService driverStateService,
        CancellationToken cancellationToken)
    {
        if (!IsAllowedStatusClass(statusClass)
            || !IsAllowedCategory(category)
            || !TryParseDiagnosticLogTimeRange(fromUtc, toUtc, out var parsedFromUtc, out var parsedToUtc))
        {
            return TypedResults.BadRequest(new
            {
                resultCode = DriverResultCode.LeaseInvalid,
                message = "请求参数不正确"
            });
        }

        var logs = await driverStateService.QueryDiagnosticLogsAsync(
            new DiagnosticLogQuery(statusClass, category, correlationId, limit, parsedFromUtc, parsedToUtc),
            cancellationToken).ConfigureAwait(false);

        return TypedResults.Ok(new
        {
            resultCode = DriverResultCode.Ok,
            logs
        });
    }

    /// <summary>
    /// 解析 diagnostic log（诊断日志）的 UTC time range（时间范围）查询参数。
    /// </summary>
    /// <param name="fromUtc">UTC 起始时间字符串。</param>
    /// <param name="toUtc">UTC 结束时间字符串。</param>
    /// <param name="parsedFromUtc">解析后的 UTC 起始时间。</param>
    /// <param name="parsedToUtc">解析后的 UTC 结束时间。</param>
    /// <returns>返回参数是否有效。</returns>
    /// <remarks>@author PopoY</remarks>
    private static bool TryParseDiagnosticLogTimeRange(
        string? fromUtc,
        string? toUtc,
        out DateTimeOffset? parsedFromUtc,
        out DateTimeOffset? parsedToUtc)
    {
        var isFromValid = TryParseOptionalUtc(fromUtc, out parsedFromUtc);
        var isToValid = TryParseOptionalUtc(toUtc, out parsedToUtc);
        if (!isFromValid || !isToValid)
        {
            return false;
        }

        return !parsedFromUtc.HasValue
            || !parsedToUtc.HasValue
            || parsedFromUtc.Value <= parsedToUtc.Value;
    }

    /// <summary>
    /// 解析可选 UTC timestamp（时间戳），空值表示不启用该边界。
    /// </summary>
    /// <param name="value">待解析的时间字符串。</param>
    /// <param name="parsedUtc">解析后的 UTC 时间。</param>
    /// <returns>返回解析是否成功。</returns>
    /// <remarks>@author PopoY</remarks>
    private static bool TryParseOptionalUtc(string? value, out DateTimeOffset? parsedUtc)
    {
        parsedUtc = null;
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        if (!DateTimeOffset.TryParse(
                value.Trim(),
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var parsed))
        {
            return false;
        }

        parsedUtc = parsed.ToUniversalTime();
        return true;
    }

    /// <summary>
    /// 处理租约与配置应用请求，并在当前阶段执行离线租约校验。
    /// </summary>
    /// <param name="request">已通过强类型绑定验证的请求。</param>
    /// <param name="leaseValidator">用于执行离线校验的租约校验器。</param>
    /// <param name="driverStateService">用于读取和保存本地最小状态的服务。</param>
    /// <param name="cancellationToken">当前请求取消令牌。</param>
    /// <returns>返回 Task 3 约定的 JSON 响应。</returns>
    private static async Task<IResult> HandleApplyLeaseAndConfig(
        ApplyLeaseAndConfigRequest request,
        LeaseValidator leaseValidator,
        DriverStateService driverStateService,
        CancellationToken cancellationToken)
    {
        var startedAt = Stopwatch.GetTimestamp();
        const string commandName = "applyLeaseAndConfig";

        await AppendRequestReceivedAsync(
            driverStateService,
            request.CorrelationId,
            commandName,
            cancellationToken).ConfigureAwait(false);
        await AppendExecutionDiagnosticAsync(
            driverStateService,
            "ApplyLeaseStarted",
            "开始应用租约和信号配置。",
            "Start",
            request.CorrelationId,
            commandName,
            cancellationToken).ConfigureAwait(false);

        try
        {
            if (IsMissingRequiredJson(request.SignedLease) || IsMissingRequiredJson(request.SignalConfig))
            {
                var missingFieldResponse = new ApplyLeaseAndConfigResponse
                {
                    CorrelationId = request.CorrelationId,
                    ResultCode = DriverResultCode.LeaseInvalid,
                    Message = LeaseIncompleteMessage,
                    LeaseState = LeaseState.None,
                    DeviceSessionState = DeviceSessionState.Disconnected,
                    LeaseId = null,
                    TargetDeviceId = null,
                    FencingToken = null
                };

                var durationMs = GetElapsedMilliseconds(startedAt);
                return await CompleteCommandAsync(
                    driverStateService,
                    CreateAuditLogEntry(
                        request.CorrelationId,
                        commandName,
                        durationMs,
                        missingFieldResponse.ResultCode,
                        missingFieldResponse.LeaseState,
                        missingFieldResponse.DeviceSessionState,
                        missingFieldResponse.Message),
                    TypedResults.BadRequest(missingFieldResponse),
                    request.CorrelationId,
                    commandName,
                    missingFieldResponse.ResultCode,
                    StatusCodes.Status400BadRequest,
                    durationMs,
                    missingFieldResponse.LeaseState,
                    missingFieldResponse.DeviceSessionState,
                    missingFieldResponse.LeaseId,
                    missingFieldResponse.TargetDeviceId,
                    null,
                    cancellationToken).ConfigureAwait(false);
            }

            var snapshot = await driverStateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
            if (string.Equals(snapshot.DeviceSessionState, DeviceSessionState.CleanupPending, StringComparison.Ordinal))
            {
                var cleanupPendingResponse = new ApplyLeaseAndConfigResponse
                {
                    CorrelationId = request.CorrelationId,
                    ResultCode = DriverResultCode.CleanupPending,
                    Message = "上次清理未完成，禁止应用新租约",
                    LeaseState = LeaseState.Active,
                    DeviceSessionState = DeviceSessionState.CleanupPending,
                    LeaseId = snapshot.ActiveLease?.LeaseId,
                    TargetDeviceId = snapshot.ActiveLease?.TargetDeviceId,
                    FencingToken = snapshot.MaxSeenFencingToken > 0
                        ? snapshot.MaxSeenFencingToken.ToString(CultureInfo.InvariantCulture)
                        : null
                };

                var durationMs = GetElapsedMilliseconds(startedAt);
                return await CompleteCommandAsync(
                    driverStateService,
                    CreateAuditLogEntry(
                        request.CorrelationId,
                        commandName,
                        durationMs,
                        cleanupPendingResponse.ResultCode,
                        cleanupPendingResponse.LeaseState,
                        cleanupPendingResponse.DeviceSessionState,
                        cleanupPendingResponse.Message,
                        cleanupPendingResponse.LeaseId,
                        cleanupPendingResponse.TargetDeviceId,
                        snapshot.MaxSeenFencingToken > 0 ? snapshot.MaxSeenFencingToken : null),
                    TypedResults.Json(cleanupPendingResponse, statusCode: StatusCodes.Status409Conflict),
                    request.CorrelationId,
                    commandName,
                    cleanupPendingResponse.ResultCode,
                    StatusCodes.Status409Conflict,
                    durationMs,
                    cleanupPendingResponse.LeaseState,
                    cleanupPendingResponse.DeviceSessionState,
                    cleanupPendingResponse.LeaseId,
                    cleanupPendingResponse.TargetDeviceId,
                    snapshot.MaxSeenFencingToken > 0 ? snapshot.MaxSeenFencingToken : null,
                    cancellationToken).ConfigureAwait(false);
            }

            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "ValidateLeaseStarted",
                "开始校验签名租约。",
                "Start",
                request.CorrelationId,
                commandName,
                cancellationToken,
                leaseState: snapshot.LeaseState,
                deviceSessionState: snapshot.DeviceSessionState,
                leaseId: snapshot.ActiveLease?.LeaseId,
                targetDeviceId: snapshot.ActiveLease?.TargetDeviceId,
                fencingToken: snapshot.ActiveLease?.FencingToken).ConfigureAwait(false);
            var validationStartedAt = Stopwatch.GetTimestamp();
            var validationResult = leaseValidator.Validate(
                request.SignedLease.GetRawText(),
                request.SignalConfig.GetRawText(),
                snapshot.MaxSeenFencingToken);
            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "ValidateLeaseCompleted",
                validationResult.IsValid ? "租约校验完成。" : "租约校验失败。",
                validationResult.IsValid ? "Completed" : "Failed",
                request.CorrelationId,
                commandName,
                cancellationToken,
                resultCode: validationResult.ResultCode,
                durationMs: GetElapsedMilliseconds(validationStartedAt),
                leaseState: validationResult.LeaseState,
                deviceSessionState: DeviceSessionState.Disconnected,
                leaseId: validationResult.Claims?.LeaseId,
                targetDeviceId: validationResult.Claims?.TargetDeviceId,
                fencingToken: validationResult.Claims?.FencingToken).ConfigureAwait(false);

            if (!validationResult.IsValid)
            {
                var failedResponse = CreateFailedApplyLeaseResponse(request.CorrelationId, validationResult);
                var durationMs = GetElapsedMilliseconds(startedAt);
                var httpStatusCode = DriverResponseWriter.GetHttpStatus(failedResponse.ResultCode);
                return await CompleteCommandAsync(
                    driverStateService,
                    CreateAuditLogEntry(
                        request.CorrelationId,
                        commandName,
                        durationMs,
                        failedResponse.ResultCode,
                        failedResponse.LeaseState,
                        failedResponse.DeviceSessionState,
                        failedResponse.Message),
                    TypedResults.Json(failedResponse, statusCode: httpStatusCode),
                    request.CorrelationId,
                    commandName,
                    failedResponse.ResultCode,
                    httpStatusCode,
                    durationMs,
                    failedResponse.LeaseState,
                    failedResponse.DeviceSessionState,
                    failedResponse.LeaseId,
                    failedResponse.TargetDeviceId,
                    null,
                    cancellationToken).ConfigureAwait(false);
            }

            var claims = validationResult.Claims ?? throw new InvalidOperationException("租约校验成功但缺少 claims。");
            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "SaveLeaseStarted",
                "开始保存活跃租约状态。",
                "Start",
                request.CorrelationId,
                commandName,
                cancellationToken,
                leaseState: LeaseState.Active,
                deviceSessionState: DeviceSessionState.Disconnected,
                leaseId: claims.LeaseId,
                targetDeviceId: claims.TargetDeviceId,
                fencingToken: claims.FencingToken).ConfigureAwait(false);
            var saveStartedAt = Stopwatch.GetTimestamp();
            var saved = await driverStateService.SaveValidatedLeaseAsync(
                claims,
                request.SignalConfig.GetRawText(),
                cancellationToken).ConfigureAwait(false);
            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "SaveLeaseCompleted",
                saved ? "活跃租约状态已保存。" : "活跃租约状态保存失败。",
                saved ? "Completed" : "Failed",
                request.CorrelationId,
                commandName,
                cancellationToken,
                resultCode: saved ? DriverResultCode.Ok : DriverResultCode.FencingTokenStale,
                durationMs: GetElapsedMilliseconds(saveStartedAt),
                leaseState: LeaseState.Active,
                deviceSessionState: DeviceSessionState.Disconnected,
                leaseId: claims.LeaseId,
                targetDeviceId: claims.TargetDeviceId,
                fencingToken: claims.FencingToken).ConfigureAwait(false);

            if (!saved)
            {
                var staleResponse = CreateFailedApplyLeaseResponse(
                    request.CorrelationId,
                    LeaseValidationResult.Fail(DriverResultCode.FencingTokenStale, "隔离令牌过旧"));
                var durationMs = GetElapsedMilliseconds(startedAt);
                var httpStatusCode = DriverResponseWriter.GetHttpStatus(staleResponse.ResultCode);
                return await CompleteCommandAsync(
                    driverStateService,
                    CreateAuditLogEntry(
                        request.CorrelationId,
                        commandName,
                        durationMs,
                        staleResponse.ResultCode,
                        staleResponse.LeaseState,
                        staleResponse.DeviceSessionState,
                        staleResponse.Message),
                    TypedResults.Json(staleResponse, statusCode: httpStatusCode),
                    request.CorrelationId,
                    commandName,
                    staleResponse.ResultCode,
                    httpStatusCode,
                    durationMs,
                    staleResponse.LeaseState,
                    staleResponse.DeviceSessionState,
                    staleResponse.LeaseId,
                    staleResponse.TargetDeviceId,
                    null,
                    cancellationToken).ConfigureAwait(false);
            }

            var successResponse = new ApplyLeaseAndConfigResponse
            {
                CorrelationId = request.CorrelationId,
                ResultCode = DriverResultCode.Ok,
                Message = LeaseAppliedMessage,
                LeaseState = LeaseState.Active,
                DeviceSessionState = DeviceSessionState.Disconnected,
                LeaseId = validationResult.Claims?.LeaseId,
                TargetDeviceId = validationResult.Claims?.TargetDeviceId,
                FencingToken = validationResult.Claims?.FencingToken?.ToString(CultureInfo.InvariantCulture)
            };

            var successDurationMs = GetElapsedMilliseconds(startedAt);
            return await CompleteCommandAsync(
                driverStateService,
                CreateAuditLogEntry(
                    request.CorrelationId,
                    commandName,
                    successDurationMs,
                    successResponse.ResultCode,
                    successResponse.LeaseState,
                    successResponse.DeviceSessionState,
                    successResponse.Message,
                    successResponse.LeaseId,
                    successResponse.TargetDeviceId,
                    validationResult.Claims?.FencingToken),
                TypedResults.Ok(successResponse),
                request.CorrelationId,
                commandName,
                successResponse.ResultCode,
                StatusCodes.Status200OK,
                successDurationMs,
                successResponse.LeaseState,
                successResponse.DeviceSessionState,
                successResponse.LeaseId,
                successResponse.TargetDeviceId,
                validationResult.Claims?.FencingToken,
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            await AppendResponseFailedAsync(
                driverStateService,
                request.CorrelationId,
                commandName,
                exception,
                GetElapsedMilliseconds(startedAt),
                cancellationToken).ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>
    /// 处理信号快照请求，并返回授权点位内的最小快照结果。
    /// </summary>
    /// <param name="request">已通过强类型绑定验证的请求。</param>
    /// <param name="driverSessionManager">负责设备连接与读取的会话管理器。</param>
    /// <param name="driverStateService">用于读取状态并写入审计日志的服务。</param>
    /// <param name="cancellationToken">当前请求取消令牌。</param>
    /// <returns>返回 V1 约定的最小快照 JSON 响应。</returns>
    private static async Task<IResult> HandleGetSignalSnapshot(
        GetSignalSnapshotRequest request,
        DriverSessionManager driverSessionManager,
        DriverStateService driverStateService,
        CancellationToken cancellationToken)
    {
        var startedAt = Stopwatch.GetTimestamp();
        const string commandName = "getSignalSnapshot";

        await AppendRequestReceivedAsync(
            driverStateService,
            request.CorrelationId,
            commandName,
            cancellationToken).ConfigureAwait(false);
        await AppendExecutionDiagnosticAsync(
            driverStateService,
            "GetSignalSnapshotStarted",
            "开始获取信号快照。",
            "Start",
            request.CorrelationId,
            commandName,
            cancellationToken).ConfigureAwait(false);

        try
        {
            var response = await driverSessionManager.GetSignalSnapshotAsync(
                request.CorrelationId,
                NormalizeTimeout(request.TimeoutMs),
                cancellationToken).ConfigureAwait(false);

            var snapshot = await driverStateService.LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
            var leaseState = string.Equals(response.ResultCode, DriverResultCode.LeaseExpired, StringComparison.Ordinal)
                ? LeaseState.Expired
                : snapshot.LeaseState;

            var durationMs = GetElapsedMilliseconds(startedAt);
            var httpStatusCode = DriverResponseWriter.GetHttpStatus(response.ResultCode);
            return await CompleteCommandAsync(
                driverStateService,
                CreateAuditLogEntry(
                    request.CorrelationId,
                    commandName,
                    durationMs,
                    response.ResultCode,
                    leaseState,
                    snapshot.DeviceSessionState,
                    response.Message,
                    snapshot.ActiveLease?.LeaseId,
                    snapshot.ActiveLease?.TargetDeviceId,
                    snapshot.ActiveLease?.FencingToken),
                TypedResults.Json(response, statusCode: httpStatusCode),
                request.CorrelationId,
                commandName,
                response.ResultCode,
                httpStatusCode,
                durationMs,
                leaseState,
                snapshot.DeviceSessionState,
                snapshot.ActiveLease?.LeaseId,
                snapshot.ActiveLease?.TargetDeviceId,
                snapshot.ActiveLease?.FencingToken,
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            await AppendResponseFailedAsync(
                driverStateService,
                request.CorrelationId,
                commandName,
                exception,
                GetElapsedMilliseconds(startedAt),
                cancellationToken).ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>
    /// 处理设备语义命令 preflight（前置校验）请求，只校验授权与写入边界，不触碰设备。
    /// </summary>
    /// <param name="request">已通过强类型绑定验证的请求。</param>
    /// <param name="driverStateService">用于读取状态并写入审计日志的服务。</param>
    /// <param name="deviceCommandExecutor">设备命令执行器。</param>
    /// <param name="cancellationToken">当前请求取消令牌。</param>
    /// <returns>返回稳定 JSON 响应。</returns>
    /// <remarks>@author PopoY</remarks>
    private static async Task<IResult> HandlePrecheckDeviceCommand(
        ExecuteDeviceCommandRequest request,
        DriverStateService driverStateService,
        PressDeviceCommandExecutor deviceCommandExecutor,
        CancellationToken cancellationToken)
    {
        var startedAt = Stopwatch.GetTimestamp();
        var commandName = string.IsNullOrWhiteSpace(request.CommandName)
            ? "precheckDeviceCommand"
            : request.CommandName.Trim();
        var correlationId = request.CorrelationId?.Trim() ?? string.Empty;

        await AppendRequestReceivedAsync(
            driverStateService,
            correlationId,
            commandName,
            cancellationToken).ConfigureAwait(false);
        await AppendExecutionDiagnosticAsync(
            driverStateService,
            "ActionStarted",
            "开始处理设备命令前置校验请求。",
            "Start",
            correlationId,
            commandName,
            cancellationToken).ConfigureAwait(false);

        if (IsInvalidExecuteDeviceCommandRequest(request))
        {
            var response = CreateExecuteDeviceCommandResponse(
                request,
                DriverResultCode.LeaseInvalid,
                ExecuteDeviceCommandInvalidMessage,
                LeaseState.None,
                DeviceSessionState.Disconnected,
                completedSteps: Array.Empty<string>(),
                failedSteps: new[] { "requestBoundary" },
                commandNameOverride: commandName,
                correlationIdOverride: correlationId);
            var durationMs = GetElapsedMilliseconds(startedAt);
            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "ActionCompleted",
                "设备命令前置校验请求边界校验失败。",
                "Failed",
                correlationId,
                commandName,
                cancellationToken,
                response.ResultCode,
                durationMs,
                response.LeaseState,
                response.DeviceSessionState,
                resultDetail: response.Message).ConfigureAwait(false);

            return await CompleteExecuteDeviceCommandAsync(
                driverStateService,
                response,
                TypedResults.BadRequest(response),
                StatusCodes.Status400BadRequest,
                durationMs,
                cancellationToken).ConfigureAwait(false);
        }

        if (!AllowedDeviceCommandNames.Contains(commandName))
        {
            var response = CreateExecuteDeviceCommandResponse(
                request,
                DriverResultCode.CommandNotAllowed,
                ExecuteDeviceCommandNotAllowedMessage,
                LeaseState.None,
                DeviceSessionState.Disconnected,
                completedSteps: Array.Empty<string>(),
                failedSteps: new[] { "commandName" },
                commandNameOverride: commandName,
                correlationIdOverride: correlationId);
            var durationMs = GetElapsedMilliseconds(startedAt);
            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "ActionCompleted",
                "设备命令前置校验不在允许列表中。",
                "Failed",
                correlationId,
                commandName,
                cancellationToken,
                response.ResultCode,
                durationMs,
                response.LeaseState,
                response.DeviceSessionState,
                resultDetail: response.Message).ConfigureAwait(false);

            return await CompleteExecuteDeviceCommandAsync(
                driverStateService,
                response,
                TypedResults.BadRequest(response),
                StatusCodes.Status400BadRequest,
                durationMs,
                cancellationToken).ConfigureAwait(false);
        }

        var normalizedRequest = request with
        {
            CommandName = commandName,
            CorrelationId = correlationId,
            LocalJobSessionId = request.LocalJobSessionId.Trim(),
            IdempotencyKey = request.IdempotencyKey.Trim()
        };
        var precheckResponse = await deviceCommandExecutor.PrecheckAsync(
            normalizedRequest,
            cancellationToken).ConfigureAwait(false);
        var successDurationMs = GetElapsedMilliseconds(startedAt);
        var httpStatus = DriverResponseWriter.GetHttpStatus(precheckResponse.ResultCode);
        await AppendExecutionDiagnosticAsync(
            driverStateService,
            "ActionCompleted",
            httpStatus >= StatusCodes.Status400BadRequest
                ? "设备命令前置校验失败。"
                : "设备命令前置校验完成。",
            httpStatus >= StatusCodes.Status400BadRequest ? "Failed" : "Completed",
            correlationId,
            commandName,
            cancellationToken,
            precheckResponse.ResultCode,
            successDurationMs,
            precheckResponse.LeaseState,
            precheckResponse.DeviceSessionState,
            resultDetail: precheckResponse.Message).ConfigureAwait(false);

        return await CompleteExecuteDeviceCommandAsync(
            driverStateService,
            precheckResponse,
            Results.Json(precheckResponse, statusCode: httpStatus),
            httpStatus,
            successDurationMs,
            cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 处理设备语义命令请求，并在 Task 01 阶段只执行契约边界校验。
    /// </summary>
    /// <param name="request">已通过强类型绑定验证的请求。</param>
    /// <param name="driverStateService">用于读取状态并写入审计日志的服务。</param>
    /// <param name="cancellationToken">当前请求取消令牌。</param>
    /// <returns>返回 Task 01 约定的稳定 JSON 响应。</returns>
    private static async Task<IResult> HandleExecuteDeviceCommand(
        ExecuteDeviceCommandRequest request,
        DriverStateService driverStateService,
        PressDeviceCommandExecutor deviceCommandExecutor,
        CancellationToken cancellationToken)
    {
        var startedAt = Stopwatch.GetTimestamp();
        var commandName = string.IsNullOrWhiteSpace(request.CommandName)
            ? "executeDeviceCommand"
            : request.CommandName.Trim();
        var correlationId = request.CorrelationId?.Trim() ?? string.Empty;

        await AppendRequestReceivedAsync(
            driverStateService,
            correlationId,
            commandName,
            cancellationToken).ConfigureAwait(false);
        await AppendExecutionDiagnosticAsync(
            driverStateService,
            "ActionStarted",
            "开始处理设备命令请求。",
            "Start",
            correlationId,
            commandName,
            cancellationToken).ConfigureAwait(false);

        if (IsInvalidExecuteDeviceCommandRequest(request))
        {
            var response = CreateExecuteDeviceCommandResponse(
                request,
                DriverResultCode.LeaseInvalid,
                ExecuteDeviceCommandInvalidMessage,
                LeaseState.None,
                DeviceSessionState.Disconnected,
                completedSteps: Array.Empty<string>(),
                failedSteps: new[] { "requestBoundary" },
                commandNameOverride: commandName,
                correlationIdOverride: correlationId);
            var durationMs = GetElapsedMilliseconds(startedAt);
            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "ActionCompleted",
                "设备命令请求边界校验失败。",
                "Failed",
                correlationId,
                commandName,
                cancellationToken,
                response.ResultCode,
                durationMs,
                response.LeaseState,
                response.DeviceSessionState,
                resultDetail: response.Message).ConfigureAwait(false);

            return await CompleteExecuteDeviceCommandAsync(
                driverStateService,
                response,
                TypedResults.BadRequest(response),
                StatusCodes.Status400BadRequest,
                durationMs,
                cancellationToken).ConfigureAwait(false);
        }

        if (!AllowedDeviceCommandNames.Contains(commandName))
        {
            var response = CreateExecuteDeviceCommandResponse(
                request,
                DriverResultCode.CommandNotAllowed,
                ExecuteDeviceCommandNotAllowedMessage,
                LeaseState.None,
                DeviceSessionState.Disconnected,
                completedSteps: Array.Empty<string>(),
                failedSteps: new[] { "commandName" },
                commandNameOverride: commandName,
                correlationIdOverride: correlationId);
            var durationMs = GetElapsedMilliseconds(startedAt);
            await AppendExecutionDiagnosticAsync(
                driverStateService,
                "ActionCompleted",
                "设备命令不在允许列表中。",
                "Failed",
                correlationId,
                commandName,
                cancellationToken,
                response.ResultCode,
                durationMs,
                response.LeaseState,
                response.DeviceSessionState,
                resultDetail: response.Message).ConfigureAwait(false);

            return await CompleteExecuteDeviceCommandAsync(
                driverStateService,
                response,
                TypedResults.BadRequest(response),
                StatusCodes.Status400BadRequest,
                durationMs,
                cancellationToken).ConfigureAwait(false);
        }

        var normalizedRequest = request with
        {
            CommandName = commandName,
            CorrelationId = correlationId,
            LocalJobSessionId = request.LocalJobSessionId.Trim(),
            IdempotencyKey = request.IdempotencyKey.Trim()
        };
        var successResponse = await deviceCommandExecutor.ExecuteAsync(
            normalizedRequest,
            cancellationToken).ConfigureAwait(false);
        var successDurationMs = GetElapsedMilliseconds(startedAt);
        var httpStatus = DriverResponseWriter.GetHttpStatus(successResponse.ResultCode);
        await AppendExecutionDiagnosticAsync(
            driverStateService,
            "ActionCompleted",
            httpStatus >= StatusCodes.Status400BadRequest
                ? "设备命令执行失败。"
                : "设备命令执行完成。",
            httpStatus >= StatusCodes.Status400BadRequest ? "Failed" : "Completed",
            correlationId,
            commandName,
            cancellationToken,
            successResponse.ResultCode,
            successDurationMs,
            successResponse.LeaseState,
            successResponse.DeviceSessionState,
            resultDetail: successResponse.Message).ConfigureAwait(false);

        return await CompleteExecuteDeviceCommandAsync(
            driverStateService,
            successResponse,
            Results.Json(successResponse, statusCode: httpStatus),
            httpStatus,
            successDurationMs,
            cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 判断设备命令请求是否缺少白名单必填字段或 timeoutMs（超时毫秒）非法。
    /// </summary>
    /// <param name="request">待检查请求。</param>
    /// <returns>非法时返回 true。</returns>
    private static bool IsInvalidExecuteDeviceCommandRequest(ExecuteDeviceCommandRequest request)
    {
        return string.IsNullOrWhiteSpace(request.CorrelationId)
            || string.IsNullOrWhiteSpace(request.CommandName)
            || string.IsNullOrWhiteSpace(request.LocalJobSessionId)
            || string.IsNullOrWhiteSpace(request.IdempotencyKey)
            || request.TimeoutMs <= 0;
    }

    /// <summary>
    /// 创建 /executeDeviceCommand 的稳定响应，并只回显白名单字段。
    /// </summary>
    /// <param name="request">原始请求。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="message">中文响应消息。</param>
    /// <param name="leaseState">租约状态。</param>
    /// <param name="deviceSessionState">设备会话状态。</param>
    /// <param name="completedSteps">已完成步骤。</param>
    /// <param name="failedSteps">失败步骤。</param>
    /// <param name="commandNameOverride">规范化命令名。</param>
    /// <param name="correlationIdOverride">规范化关联 ID。</param>
    /// <returns>返回稳定响应。</returns>
    private static ExecuteDeviceCommandResponse CreateExecuteDeviceCommandResponse(
        ExecuteDeviceCommandRequest request,
        string resultCode,
        string message,
        string leaseState,
        string deviceSessionState,
        IReadOnlyList<string> completedSteps,
        IReadOnlyList<string> failedSteps,
        string commandNameOverride,
        string correlationIdOverride)
    {
        return new ExecuteDeviceCommandResponse
        {
            CorrelationId = correlationIdOverride,
            CommandName = commandNameOverride,
            LocalJobSessionId = request.LocalJobSessionId?.Trim() ?? string.Empty,
            IdempotencyKey = request.IdempotencyKey?.Trim() ?? string.Empty,
            ResultCode = resultCode,
            Message = message,
            LeaseState = leaseState,
            DeviceSessionState = deviceSessionState,
            CompletedSteps = completedSteps,
            FailedSteps = failedSteps
        };
    }

    /// <summary>
    /// 完成设备命令响应，确保 audit/diagnostic log（审计/诊断日志）不写裸设备字段。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="response">即将返回的设备命令响应。</param>
    /// <param name="result">HTTP 结果。</param>
    /// <param name="httpStatusCode">HTTP 状态码。</param>
    /// <param name="durationMs">命令耗时。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回原始 HTTP 结果。</returns>
    private static Task<IResult> CompleteExecuteDeviceCommandAsync(
        DriverStateService driverStateService,
        ExecuteDeviceCommandResponse response,
        IResult result,
        int httpStatusCode,
        long durationMs,
        CancellationToken cancellationToken)
    {
        return CompleteCommandAsync(
            driverStateService,
            CreateAuditLogEntry(
                response.CorrelationId,
                response.CommandName,
                durationMs,
                response.ResultCode,
                response.LeaseState,
                response.DeviceSessionState,
                response.Message),
            result,
            response.CorrelationId,
            response.CommandName,
            response.ResultCode,
            httpStatusCode,
            durationMs,
            response.LeaseState,
            response.DeviceSessionState,
            leaseId: null,
            targetDeviceId: null,
            fencingToken: null,
            cancellationToken);
    }

    /// <summary>
    /// 将租约校验失败结果映射为 Task 3 约定的 HTTP 响应。
    /// </summary>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="validationResult">租约校验结果。</param>
    /// <returns>返回带正确状态码的 JSON 响应。</returns>
    private static ApplyLeaseAndConfigResponse CreateFailedApplyLeaseResponse(
        string correlationId,
        LeaseValidationResult validationResult)
    {
        return new ApplyLeaseAndConfigResponse
        {
            CorrelationId = correlationId,
            ResultCode = validationResult.ResultCode,
            Message = validationResult.Message,
            LeaseState = validationResult.LeaseState,
            DeviceSessionState = DeviceSessionState.Disconnected,
            LeaseId = null,
            TargetDeviceId = null,
            FencingToken = null
        };
    }

    /// <summary>
    /// 创建用于持久化的最小脱敏审计日志条目。
    /// </summary>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="durationMs">命令耗时。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="leaseState">租约状态。</param>
    /// <param name="deviceSessionState">设备会话状态。</param>
    /// <param name="message">中文消息。</param>
    /// <param name="leaseId">租约 ID。</param>
    /// <param name="targetDeviceId">目标设备 ID。</param>
    /// <param name="fencingToken">隔离令牌。</param>
    /// <returns>返回脱敏审计日志条目。</returns>
    private static AuditLogEntry CreateAuditLogEntry(
        string correlationId,
        string commandName,
        long durationMs,
        string resultCode,
        string leaseState,
        string deviceSessionState,
        string message,
        string? leaseId = null,
        string? targetDeviceId = null,
        long? fencingToken = null)
    {
        return AuditLogEntry.CreateSanitized(
            correlationId,
            commandName,
            durationMs,
            resultCode,
            leaseState,
            deviceSessionState,
            message,
            leaseId,
            targetDeviceId,
            fencingToken);
    }

    /// <summary>
    /// 写入 audit log（审计日志）、Audit（审计）诊断和 Response（响应）诊断后返回结果。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="auditLogEntry">审计日志条目。</param>
    /// <param name="result">即将返回的 HTTP 结果。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="httpStatusCode">HTTP 状态码。</param>
    /// <param name="durationMs">命令耗时。</param>
    /// <param name="leaseState">租约状态。</param>
    /// <param name="deviceSessionState">设备会话状态。</param>
    /// <param name="leaseId">租约 ID。</param>
    /// <param name="targetDeviceId">目标设备 ID。</param>
    /// <param name="fencingToken">隔离令牌。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回原始 HTTP 结果。</returns>
    private static async Task<IResult> CompleteCommandAsync(
        DriverStateService driverStateService,
        AuditLogEntry auditLogEntry,
        IResult result,
        string correlationId,
        string commandName,
        string resultCode,
        int httpStatusCode,
        long durationMs,
        string leaseState,
        string deviceSessionState,
        string? leaseId,
        string? targetDeviceId,
        long? fencingToken,
        CancellationToken cancellationToken)
    {
        await AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
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
            deviceSessionState: deviceSessionState,
            leaseId: leaseId,
            targetDeviceId: targetDeviceId,
            fencingToken: fencingToken), cancellationToken).ConfigureAwait(false);

        try
        {
            await driverStateService.AppendAuditLogAsync(auditLogEntry, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            await AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
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
                leaseId: leaseId,
                targetDeviceId: targetDeviceId,
                fencingToken: fencingToken,
                exceptionType: exception.GetType().Name), cancellationToken).ConfigureAwait(false);
            throw;
        }

        await AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
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
            deviceSessionState: deviceSessionState,
            leaseId: leaseId,
            targetDeviceId: targetDeviceId,
            fencingToken: fencingToken), cancellationToken).ConfigureAwait(false);
        if (httpStatusCode >= StatusCodes.Status400BadRequest)
        {
            await AppendRequestRejectedAsync(
                driverStateService,
                correlationId,
                commandName,
                resultCode,
                httpStatusCode,
                durationMs,
                cancellationToken).ConfigureAwait(false);
        }

        await AppendRequestCompletedAsync(
            driverStateService,
            correlationId,
            commandName,
            resultCode,
            httpStatusCode,
            durationMs,
            cancellationToken).ConfigureAwait(false);

        await AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
            level: "Information",
            category: "Response",
            eventName: "ResponseSending",
            message: "驱动响应正在写回。",
            eventStage: "Start",
            correlationId: correlationId,
            commandName: commandName,
            resultCode: resultCode,
            httpStatusCode: httpStatusCode,
            durationMs: durationMs,
            leaseState: leaseState,
            deviceSessionState: deviceSessionState,
            leaseId: leaseId,
            targetDeviceId: targetDeviceId,
            fencingToken: fencingToken), cancellationToken).ConfigureAwait(false);
        await AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
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
            deviceSessionState: deviceSessionState,
            leaseId: leaseId,
            targetDeviceId: targetDeviceId,
            fencingToken: fencingToken), cancellationToken).ConfigureAwait(false);

        return result;
    }

    /// <summary>
    /// 写入 Execution（执行）诊断事件，复用现有白名单 diagnostic log（诊断日志）。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="eventName">稳定事件名。</param>
    /// <param name="message">中文说明。</param>
    /// <param name="eventStage">事件阶段。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="durationMs">耗时毫秒数。</param>
    /// <param name="leaseState">租约状态。</param>
    /// <param name="deviceSessionState">设备会话状态。</param>
    /// <param name="leaseId">租约 ID。</param>
    /// <param name="targetDeviceId">目标设备 ID。</param>
    /// <param name="fencingToken">隔离令牌。</param>
    private static Task AppendExecutionDiagnosticAsync(
        DriverStateService driverStateService,
        string eventName,
        string message,
        string eventStage,
        string correlationId,
        string commandName,
        CancellationToken cancellationToken,
        string? resultCode = null,
        long? durationMs = null,
        string? leaseState = null,
        string? deviceSessionState = null,
        string? leaseId = null,
        string? targetDeviceId = null,
        long? fencingToken = null,
        string? resultDetail = null)
    {
        var isFailed = string.Equals(eventStage, "Failed", StringComparison.Ordinal)
            || (!string.IsNullOrWhiteSpace(resultCode)
                && !string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal));
        return AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
            level: isFailed ? "Warning" : "Information",
            category: "Execution",
            eventName: eventName,
            message: FormatDiagnosticMessage(message, commandName, resultCode, resultDetail),
            eventStage: eventStage,
            correlationId: correlationId,
            commandName: commandName,
            resultCode: resultCode,
            durationMs: durationMs,
            leaseState: leaseState,
            deviceSessionState: deviceSessionState,
            leaseId: leaseId,
            targetDeviceId: targetDeviceId,
            fencingToken: fencingToken), cancellationToken);
    }

    /// <summary>
    /// 写入 RequestReceived（请求已接收）诊断事件。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static Task AppendRequestReceivedAsync(
        DriverStateService driverStateService,
        string correlationId,
        string commandName,
        CancellationToken cancellationToken)
    {
        return AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: FormatDiagnosticMessage("收到驱动请求。", commandName),
            eventStage: "Start",
            correlationId: correlationId,
            commandName: commandName), cancellationToken);
    }

    /// <summary>
    /// 写入 RequestRejected（请求被拒绝）诊断事件。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="httpStatusCode">HTTP 状态码。</param>
    /// <param name="durationMs">请求耗时。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static Task AppendRequestRejectedAsync(
        DriverStateService driverStateService,
        string correlationId,
        string commandName,
        string resultCode,
        int httpStatusCode,
        long durationMs,
        CancellationToken cancellationToken)
    {
        return AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
            level: "Warning",
            category: "Request",
            eventName: "RequestRejected",
            message: FormatDiagnosticMessage("驱动请求已拒绝。", commandName, resultCode),
            eventStage: "Rejected",
            correlationId: correlationId,
            commandName: commandName,
            resultCode: resultCode,
            httpStatusCode: httpStatusCode,
            durationMs: durationMs), cancellationToken);
    }

    /// <summary>
    /// 写入 RequestCompleted（请求已完成）诊断事件。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="resultCode">稳定结果码。</param>
    /// <param name="httpStatusCode">HTTP 状态码。</param>
    /// <param name="durationMs">请求耗时。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static Task AppendRequestCompletedAsync(
        DriverStateService driverStateService,
        string correlationId,
        string commandName,
        string resultCode,
        int httpStatusCode,
        long durationMs,
        CancellationToken cancellationToken)
    {
        return AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestCompleted",
            message: FormatDiagnosticMessage("驱动请求处理完成。", commandName, resultCode),
            eventStage: "Completed",
            correlationId: correlationId,
            commandName: commandName,
            resultCode: resultCode,
            httpStatusCode: httpStatusCode,
            durationMs: durationMs), cancellationToken);
    }

    /// <summary>
    /// 组合 diagnostic log（诊断日志）正文，补充命令名和中文 resultCode（结果码）。
    /// </summary>
    /// <param name="message">原始中文说明。</param>
    /// <param name="commandName">稳定 commandName（命令名）。</param>
    /// <param name="resultCode">可选 stable resultCode（稳定结果码）。</param>
    /// <returns>返回补足上下文后的中文日志正文。</returns>
    /// <remarks>@author PopoY</remarks>
    private static string FormatDiagnosticMessage(
        string message,
        string commandName,
        string? resultCode = null,
        string? resultDetail = null)
    {
        var safeCommandName = string.IsNullOrWhiteSpace(commandName) ? "未提供" : commandName.Trim();
        var actionName = GetDiagnosticCommandDisplayName(safeCommandName);
        if (string.IsNullOrWhiteSpace(resultCode))
        {
            return $"{message}动作：{actionName}；命令名：{safeCommandName}。";
        }

        var reason = string.Equals(resultCode, DriverResultCode.Ok, StringComparison.Ordinal)
            || string.IsNullOrWhiteSpace(resultDetail)
                ? string.Empty
                : $"；原因：{TrimSentenceEnd(resultDetail)}";
        return $"{message}动作：{actionName}；命令名：{safeCommandName}；结果码：{DriverResultCode.ToChineseText(resultCode)}{reason}。";
    }

    /// <summary>
    /// 获取 diagnostic log（诊断日志）使用的中文动作名。
    /// </summary>
    /// <param name="commandName">稳定命令名。</param>
    /// <returns>返回中文动作名。</returns>
    /// <remarks>@author PopoY</remarks>
    private static string GetDiagnosticCommandDisplayName(string commandName)
    {
        return commandName switch
        {
            "applyLeaseAndConfig" => "应用租约和配置",
            "getSignalSnapshot" => "获取信号快照",
            "executeDeviceCommand" => "执行设备命令",
            _ => PressDeviceCommandCatalog.GetDisplayName(commandName)
        };
    }

    /// <summary>
    /// 去除结尾标点，避免拼接原因时出现重复句号。
    /// </summary>
    /// <param name="value">待清理的中文原因。</param>
    /// <returns>返回可拼接进日志正文的原因。</returns>
    /// <remarks>@author PopoY</remarks>
    private static string TrimSentenceEnd(string value)
    {
        return value.Trim().TrimEnd('。', '.', '；', ';');
    }

    /// <summary>
    /// 写入 ResponseFailed（响应失败）诊断事件，正文只保留中文摘要和异常类型。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="correlationId">请求关联 ID。</param>
    /// <param name="commandName">命令名称。</param>
    /// <param name="exception">捕获到的异常。</param>
    /// <param name="durationMs">命令耗时。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static Task AppendResponseFailedAsync(
        DriverStateService driverStateService,
        string correlationId,
        string commandName,
        Exception exception,
        long durationMs,
        CancellationToken cancellationToken)
    {
        return AppendDiagnosticAsync(driverStateService, DiagnosticLogEntry.Create(
            level: "Error",
            category: "Response",
            eventName: "ResponseFailed",
            message: "驱动响应写回失败，已记录异常类型。",
            eventStage: "Failed",
            correlationId: correlationId,
            commandName: commandName,
            httpStatusCode: StatusCodes.Status500InternalServerError,
            durationMs: durationMs,
            exceptionType: exception.GetType().Name), cancellationToken);
    }

    /// <summary>
    /// 写入 diagnostic log（诊断日志）并复用 DriverStateService（驱动状态服务）的安全失败策略。
    /// </summary>
    /// <param name="driverStateService">驱动状态服务。</param>
    /// <param name="entry">诊断日志条目。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static Task AppendDiagnosticAsync(
        DriverStateService driverStateService,
        DiagnosticLogEntry entry,
        CancellationToken cancellationToken)
    {
        return driverStateService.TryAppendDiagnosticLogAsync(entry, cancellationToken);
    }

    /// <summary>
    /// 判断 statusClass（状态分类）是否属于查询白名单。
    /// </summary>
    /// <param name="value">待检查的查询参数。</param>
    /// <returns>合法或空值时返回 true。</returns>
    private static bool IsAllowedStatusClass(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            || value.Trim().ToLowerInvariant() is "abnormal" or "normal" or "all";
    }

    /// <summary>
    /// 判断 category（分类）是否属于查询白名单。
    /// </summary>
    /// <param name="value">待检查的查询参数。</param>
    /// <returns>合法或空值时返回 true。</returns>
    private static bool IsAllowedCategory(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            || value.Trim().ToLowerInvariant() is "startup" or "request" or "execution" or "device" or "response" or "audit" or "all";
    }

    /// <summary>
    /// 计算从开始时间戳到当前时刻的耗时毫秒数。
    /// </summary>
    /// <param name="startedAt">开始计时的高精度时间戳。</param>
    /// <returns>返回非负耗时毫秒数。</returns>
    private static long GetElapsedMilliseconds(long startedAt)
    {
        return Math.Max(0L, (long)Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
    }

    /// <summary>
    /// 判断请求中的原始 JSON 字段是否缺失或显式为 null。
    /// </summary>
    /// <param name="jsonElement">待检查的 JSON 元素。</param>
    /// <returns>字段缺失或为 null 时返回 true。</returns>
    private static bool IsMissingRequiredJson(JsonElement jsonElement)
    {
        return jsonElement.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null;
    }

    /// <summary>
    /// 将请求中的 timeoutMs（超时时间）转换为可执行的最小正超时，避免非法值把端点打成 500。
    /// </summary>
    /// <param name="timeoutMs">请求中的超时毫秒数。</param>
    /// <returns>返回最小为 1ms 的超时时间。</returns>
    private static TimeSpan NormalizeTimeout(int timeoutMs)
    {
        return TimeSpan.FromMilliseconds(timeoutMs <= 0 ? 1 : timeoutMs);
    }
}

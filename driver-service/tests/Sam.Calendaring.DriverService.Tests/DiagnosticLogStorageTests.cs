/**
 * @file DiagnosticLogStorageTests.cs - 验证 diagnostic log（诊断日志）存储脱敏边界。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 以 TDD（测试驱动开发）锁定 diagnostic_log（诊断日志表）的白名单字段、查询过滤和安全失败行为。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 Driver diagnostic log（驱动诊断日志）独立于 audit log（审计日志）的最小持久化能力。
/// </summary>
public sealed class DiagnosticLogStorageTests
{
    /// <summary>
    /// 验证 Warning（警告）和非 OK resultCode（结果码）会归类为 Abnormal（异常）。
    /// </summary>
    [Fact]
    public void DiagnosticLogEntryDerivesStatusClassFromLevelAndResultCode()
    {
        var warningEntry = DiagnosticLogEntry.Create(
            level: "Warning",
            category: "Device",
            eventName: "SignalReadFailed",
            message: "设备通信超时",
            resultCode: DriverResultCode.DeviceTimeout);
        var informationFailure = DiagnosticLogEntry.Create(
            level: "Information",
            category: "Response",
            eventName: "RequestCompleted",
            message: "请求已完成但设备拒绝",
            resultCode: DriverResultCode.DeviceRejected);
        var normalEntry = DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "收到驱动请求",
            resultCode: DriverResultCode.Ok);

        Assert.Equal("Abnormal", warningEntry.StatusClass);
        Assert.Equal("Abnormal", informationFailure.StatusClass);
        Assert.Equal("Normal", normalEntry.StatusClass);
    }

    /// <summary>
    /// 验证 diagnostic_log（诊断日志表）保存并查询白名单字段。
    /// </summary>
    [Fact]
    public async Task DiagnosticLogStoresAndQueriesWhitelistedFields()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        var service = new DriverStateService(store, NullLogger<DriverStateService>.Instance);

        await service.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Error",
            category: "Device",
            eventName: "SignalReadFailed",
            message: "设备通信超时",
            eventStage: "Failed",
            correlationId: "cid-diagnostic-001",
            commandName: "getSignalSnapshot",
            resultCode: DriverResultCode.DeviceTimeout,
            httpStatusCode: 504,
            durationMs: 5000,
            leaseState: "Active",
            deviceSessionState: "Connected",
            leaseId: "lease-001",
            targetDeviceId: "press-001",
            fencingToken: 11,
            exceptionType: nameof(TimeoutException)), CancellationToken.None);

        var logs = await service.QueryDiagnosticLogsAsync(new DiagnosticLogQuery(
            StatusClass: "abnormal",
            Category: "device",
            CorrelationId: "cid-diagnostic-001",
            Limit: 100), CancellationToken.None);

        var entry = Assert.Single(logs);
        Assert.Equal("Device", entry.Category);
        Assert.Equal("Abnormal", entry.StatusClass);
        Assert.Equal("SignalReadFailed", entry.EventName);
        Assert.Equal("TimeoutException", entry.ExceptionType);
        Assert.DoesNotContain("signedLease", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signalConfig", entry.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证 diagnostic log（诊断日志）正文在模型入口会拦截敏感字段。
    /// </summary>
    [Fact]
    public void DiagnosticLogEntrySanitizesSensitiveMessage()
    {
        var entry = DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "signedLease=secret; signalConfig={raw}; credential=secret");

        Assert.DoesNotContain("signedLease", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signalConfig", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("credential", entry.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("已脱敏", entry.Message, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证 AGENTS.md（代理规则文档）列出的敏感 token（标识）都会触发脱敏。
    /// </summary>
    /// <param name="sensitiveToken">待验证的敏感字段片段。</param>
    [Theory]
    [InlineData("signedLease=secret")]
    [InlineData("signature=secret")]
    [InlineData("signature payload=secret")]
    [InlineData("signaturePayload=secret")]
    [InlineData("signalConfig={raw}")]
    [InlineData("privateKey=secret")]
    [InlineData("credential=secret")]
    [InlineData("sessionToken=secret")]
    [InlineData("ip=10.0.0.1")]
    [InlineData("port=502")]
    [InlineData("deviceId=press-001")]
    [InlineData("raw request body")]
    [InlineData("raw response body")]
    [InlineData("raw endpoint")]
    public void DiagnosticLogEntrySanitizesAllAgentRuleSensitiveTokens(string sensitiveToken)
    {
        var entry = DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: $"日志正文包含 {sensitiveToken}");

        Assert.Contains("已脱敏", entry.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(sensitiveToken, entry.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证 query limit（查询数量限制）默认 100，最大 500。
    /// </summary>
    [Theory]
    [InlineData(null, 100)]
    [InlineData(0, 100)]
    [InlineData(20, 20)]
    [InlineData(900, 500)]
    public void DiagnosticLogQueryNormalizesLimit(int? requestedLimit, int expectedLimit)
    {
        var query = new DiagnosticLogQuery("all", "all", null, requestedLimit);

        Assert.Equal(expectedLimit, query.NormalizedLimit);
    }

    /// <summary>
    /// 验证 diagnostic log（诊断日志）写入失败不会向调用方抛出异常。
    /// </summary>
    [Fact]
    public async Task DiagnosticWriteFailureIsSuppressedAndLogged()
    {
        var service = new DriverStateService(
            new FailingDiagnosticStore(),
            NullLogger<DriverStateService>.Instance);

        await service.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "收到驱动请求"), CancellationToken.None);
    }

    /// <summary>
    /// 验证 diagnostic log（诊断日志）写入失败时，常规日志只记录 exceptionType（异常类型）摘要。
    /// </summary>
    [Fact]
    public async Task DiagnosticWriteFailureLogsOnlySafeExceptionType()
    {
        var logger = new CapturingDriverStateLogger();
        var service = new DriverStateService(new FailingDiagnosticStore(), logger);

        await service.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Information",
            category: "Request",
            eventName: "RequestReceived",
            message: "收到驱动请求"), CancellationToken.None);

        var log = Assert.Single(logger.Logs);
        Assert.Equal(LogLevel.Warning, log.Level);
        Assert.Null(log.Exception);
        Assert.Contains(nameof(InvalidOperationException), log.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("signedLease", log.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secret", log.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 提供只在 diagnostic log（诊断日志）写入时报错的测试状态存储。
    /// </summary>
    private sealed class FailingDiagnosticStore : IDriverStateStore
    {
        public Task InitializeAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new DriverStateSnapshot(null, 0, "None", "Disconnected"));
        }

        public Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(0L);
        }

        public Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }

        public Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken)
        {
            throw new InvalidOperationException("模拟诊断日志写入失败，signedLease=secret。");
        }

        public Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
        {
            return Task.FromResult(0);
        }

        public Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(
            DiagnosticLogQuery query,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<DiagnosticLogEntry>>(Array.Empty<DiagnosticLogEntry>());
        }
    }

    /// <summary>
    /// 捕获 DriverStateService（驱动状态服务）日志，验证失败摘要不会携带完整 exception（异常对象）。
    /// </summary>
    private sealed class CapturingDriverStateLogger : ILogger<DriverStateService>
    {
        public List<CapturedLog> Logs { get; } = [];

        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull
        {
            return NullScope.Instance;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return true;
        }

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Logs.Add(new CapturedLog(logLevel, formatter(state, exception), exception));
        }
    }

    /// <summary>
    /// 表示捕获到的一条 ILogger（日志抽象）输出。
    /// </summary>
    private sealed record CapturedLog(LogLevel Level, string Message, Exception? Exception);

    /// <summary>
    /// 提供 no-op scope（空作用域），避免测试 logger（日志器）引入额外依赖。
    /// </summary>
    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();

        public void Dispose()
        {
        }
    }
}

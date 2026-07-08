/**
 * @file DiagnosticLogRetentionService.cs - 清理过期 diagnostic log（诊断日志）。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 在启动和运行期间按 7 天保留规则清理 diagnostic_log（诊断日志表），不清理 audit_log（审计日志表）。
 */
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sam.Calendaring.DriverService.Options;

namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// @author PopoY
/// 按配置清理过期 diagnostic log（诊断日志）的 hosted service（托管服务）。
/// </summary>
public sealed class DiagnosticLogRetentionService : BackgroundService
{
    /// <summary>
    /// @author PopoY
    /// cleanup interval（清理周期）最小值，避免非法配置导致后台服务退出或忙等。
    /// </summary>
    private const int MinimumCleanupIntervalMs = 1_000;

    private readonly DriverStateService _stateService;
    private readonly DriverOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<DiagnosticLogRetentionService> _logger;

    /// <summary>
    /// @author PopoY
    /// 初始化 diagnostic log retention（诊断日志保留）服务。
    /// </summary>
    /// <param name="stateService">驱动状态服务。</param>
    /// <param name="options">驱动配置。</param>
    /// <param name="timeProvider">时间提供器。</param>
    /// <param name="logger">日志抽象。</param>
    public DiagnosticLogRetentionService(
        DriverStateService stateService,
        DriverOptions options,
        TimeProvider timeProvider,
        ILogger<DiagnosticLogRetentionService> logger)
    {
        _stateService = stateService;
        _options = options;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    /// <summary>
    /// @author PopoY
    /// 启动时清理一次，随后按 cleanup interval（清理周期）循环执行。
    /// </summary>
    /// <param name="stoppingToken">服务停止令牌。</param>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupOnceAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("诊断日志保留清理失败，将在下一轮重试。{ExceptionType}", ex.GetType().Name);
            }

            await Task.Delay(GetCleanupInterval(), _timeProvider, stoppingToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// @author PopoY
    /// 执行一次 diagnostic log retention（诊断日志保留）清理。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回删除行数。</returns>
    public async Task<int> CleanupOnceAsync(CancellationToken cancellationToken)
    {
        var cutoffUtc = _timeProvider.GetUtcNow().AddDays(-Math.Max(1, _options.DiagnosticLogRetentionDays));
        var deleted = await _stateService.DeleteDiagnosticLogsBeforeAsync(cutoffUtc, cancellationToken).ConfigureAwait(false);
        _logger.LogInformation("诊断日志保留清理完成，删除行数：{DeletedCount}", deleted);
        return deleted;
    }

    /// <summary>
    /// @author PopoY
    /// 获取钳制后的 cleanup interval（清理周期）。
    /// </summary>
    /// <returns>返回有效清理周期。</returns>
    private TimeSpan GetCleanupInterval()
    {
        return TimeSpan.FromMilliseconds(Math.Max(MinimumCleanupIntervalMs, _options.DiagnosticLogCleanupIntervalMs));
    }
}

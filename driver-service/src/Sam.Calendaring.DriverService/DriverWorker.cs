/**
 * @file Driver 后台任务壳。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供 Driver Service 的最小后台任务壳，并写入启动生命周期诊断事件。
 */
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService;

public sealed class DriverWorker(
    ILogger<DriverWorker> logger,
    DriverStateService driverStateService) : BackgroundService
{
    /// <summary>
    /// 持续保持后台服务存活，直到宿主收到停止信号。
    /// </summary>
    /// <param name="stoppingToken">应用停止时触发的取消令牌。</param>
    /// <returns>表示后台循环生命周期的任务。</returns>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await AppendStartupDiagnosticAsync("ServiceStarting", "Start", "驱动服务正在启动。", stoppingToken).ConfigureAwait(false);
        await driverStateService.InitializeAsync(stoppingToken).ConfigureAwait(false);
        await AppendStartupDiagnosticAsync("StateStoreInitialized", "Completed", "驱动状态存储已初始化。", stoppingToken).ConfigureAwait(false);
        await AppendStartupDiagnosticAsync("ServiceStarted", "Completed", "驱动服务已启动。", stoppingToken).ConfigureAwait(false);

        // PopoY: Task3 仍只保持后台任务存活；真实设备轮询不属于本轮范围。
        logger.LogInformation("驱动服务后台任务已启动");
        try
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // PopoY: shutdown（停机）诊断不能使用已取消 token（令牌），否则停止事件会被取消掉。
            await AppendStartupDiagnosticAsync("ServiceStopping", "Start", "驱动服务正在停止。", CancellationToken.None).ConfigureAwait(false);
            logger.LogInformation("驱动服务后台任务已停止");
            await AppendStartupDiagnosticAsync("ServiceStopped", "Completed", "驱动服务已停止。", CancellationToken.None).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// 写入 Startup（启动）分类的 diagnostic log（诊断日志）。
    /// </summary>
    /// <param name="eventName">稳定事件名。</param>
    /// <param name="eventStage">事件阶段。</param>
    /// <param name="message">中文说明。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private Task AppendStartupDiagnosticAsync(
        string eventName,
        string eventStage,
        string message,
        CancellationToken cancellationToken)
    {
        return driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
            level: "Information",
            category: "Startup",
            eventName: eventName,
            message: message,
            eventStage: eventStage), cancellationToken);
    }
}

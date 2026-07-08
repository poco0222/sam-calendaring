/**
 * @file DriverWorkerTests.cs - 验证 Driver Worker（驱动后台工作器）。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 验证 DriverWorker（驱动后台任务）取消、启动和停止诊断事件。
 */
using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 覆盖 DriverWorker（驱动后台任务）的最小生命周期行为。
/// </summary>
public sealed class DriverWorkerTests
{
    /// <summary>
    /// 验证宿主取消后台任务时，DriverWorker（驱动后台任务）不会向外冒泡预期的取消异常。
    /// </summary>
    [Fact]
    public async Task ExecuteAsyncCompletesWhenStoppingTokenIsCanceled()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        var service = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var worker = CreateWorker(service);
        using var cts = new CancellationTokenSource();

        // PopoY: DriverWorker（驱动后台任务）是 sealed（密封类）且 ExecuteAsync 是 protected（受保护方法），这里用 reflection（反射）保持生产 API 不变。
        var executeAsync = typeof(DriverWorker).GetMethod(
            "ExecuteAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(executeAsync);

        var workerTask = (Task)executeAsync.Invoke(worker, new object[] { cts.Token })!;
        await cts.CancelAsync();

        await workerTask;
    }

    /// <summary>
    /// 验证 DriverWorker（驱动后台任务）写入启动和停止诊断事件。
    /// </summary>
    [Fact]
    public async Task ExecuteAsyncWritesStartupAndShutdownDiagnosticEvents()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        var service = new DriverStateService(store, NullLogger<DriverStateService>.Instance);
        var worker = CreateWorker(service);
        using var cts = new CancellationTokenSource();

        // PopoY: DriverWorker（驱动后台任务）是 sealed（密封类）且 ExecuteAsync 是 protected（受保护方法），这里用 reflection（反射）保持生产 API 不变。
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

    /// <summary>
    /// 使用 DI（依赖注入）创建 worker（后台任务），让测试同时兼容旧构造函数和 Task3 新依赖。
    /// </summary>
    /// <param name="service">测试状态服务。</param>
    /// <returns>返回可执行的 DriverWorker（驱动后台任务）。</returns>
    private static DriverWorker CreateWorker(DriverStateService service)
    {
        var services = new ServiceCollection()
            .AddSingleton<ILogger<DriverWorker>>(NullLogger<DriverWorker>.Instance)
            .AddSingleton(service)
            .BuildServiceProvider();

        return ActivatorUtilities.CreateInstance<DriverWorker>(services);
    }
}

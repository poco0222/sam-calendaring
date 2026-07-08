/**
 * @file DeviceEventHub.cs - 实现 Driver device event hub（设备事件中心）。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 使用进程内 channel（通道）广播设备事件，并按 SSE（服务器发送事件）格式输出安全 payload（载荷）。
 */
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Http;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Events;

/// <summary>
/// 提供 Driver Service（驱动服务）进程内设备事件广播能力。
/// </summary>
public sealed class DeviceEventHub
{
    private readonly DriverStateService _driverStateService;
    private readonly object _gate = new();
    private readonly List<Channel<DeviceEventStreamItem>> _subscribers = [];

    /// <summary>
    /// 初始化设备事件中心。
    /// </summary>
    /// <param name="driverStateService">用于写入断开 diagnostic log（诊断日志）的状态服务。</param>
    public DeviceEventHub(DriverStateService driverStateService)
    {
        _driverStateService = driverStateService;
    }

    /// <summary>
    /// 获取当前是否存在 SSE subscriber（服务器发送事件订阅者）。
    /// </summary>
    /// <remarks>@author PopoY: 后台快照发布器用它避免无人查看时空耗设备通信。</remarks>
    public bool HasSubscribers
    {
        get
        {
            lock (_gate)
            {
                return _subscribers.Count > 0;
            }
        }
    }

    /// <summary>
    /// 发布设备事件；使用无界订阅队列避免慢 SSE client（客户端）反向阻塞监测线程。
    /// </summary>
    /// <param name="item">白名单事件载荷。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    public Task PublishAsync(DeviceEventStreamItem item, CancellationToken cancellationToken)
    {
        Channel<DeviceEventStreamItem>[] subscribers;
        lock (_gate)
        {
            subscribers = _subscribers.ToArray();
        }

        foreach (var subscriber in subscribers)
        {
            subscriber.Writer.TryWrite(item);
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// 订阅设备事件，供单元测试和 SSE（服务器发送事件）端点复用。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回异步事件序列。</returns>
    public async IAsyncEnumerable<DeviceEventStreamItem> SubscribeAsync(
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var channel = AddSubscriber();
        try
        {
            await foreach (var item in channel.Reader.ReadAllAsync(cancellationToken).ConfigureAwait(false))
            {
                yield return item;
            }
        }
        finally
        {
            RemoveSubscriber(channel);
        }
    }

    /// <summary>
    /// 将设备事件写成 SSE（服务器发送事件）帧。
    /// </summary>
    /// <param name="context">当前 HTTP 上下文。</param>
    /// <param name="correlationId">可选关联 ID，只记录白名单字段。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    public async Task WriteSseAsync(
        HttpContext context,
        string correlationId,
        CancellationToken cancellationToken)
    {
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache";
        var channel = AddSubscriber();

        try
        {
            // PopoY: 先写入 keep-alive（保活）注释，确保 TestServer 和 Qt WebEngine（Qt 网页引擎）尽快拿到响应头。
            await context.Response.WriteAsync(": connected\n\n", cancellationToken).ConfigureAwait(false);
            await context.Response.Body.FlushAsync(cancellationToken).ConfigureAwait(false);

            await foreach (var item in channel.Reader.ReadAllAsync(cancellationToken).ConfigureAwait(false))
            {
                await context.Response.WriteAsync($"event: {item.EventName}\n", cancellationToken).ConfigureAwait(false);
                await context.Response.WriteAsync($"id: {item.EventId}\n", cancellationToken).ConfigureAwait(false);
                await context.Response.WriteAsync(
                    $"data: {JsonSerializer.Serialize(item, DriverJson.Options)}\n\n",
                    cancellationToken).ConfigureAwait(false);
                await context.Response.Body.FlushAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        finally
        {
            RemoveSubscriber(channel);
            await _driverStateService.TryAppendDiagnosticLogAsync(DiagnosticLogEntry.Create(
                level: "Information",
                category: "EventStream",
                eventName: "DeviceEventStreamDisconnected",
                message: "设备事件流已断开。",
                eventStage: "Completed",
                correlationId: correlationId,
                commandName: "deviceEventsStream"), CancellationToken.None).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// 注册订阅者 channel（通道）。
    /// </summary>
    /// <returns>返回订阅者通道。</returns>
    private Channel<DeviceEventStreamItem> AddSubscriber()
    {
        var channel = Channel.CreateUnbounded<DeviceEventStreamItem>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });
        lock (_gate)
        {
            _subscribers.Add(channel);
        }

        return channel;
    }

    /// <summary>
    /// 移除订阅者 channel（通道）。
    /// </summary>
    /// <param name="channel">待移除通道。</param>
    private void RemoveSubscriber(Channel<DeviceEventStreamItem> channel)
    {
        lock (_gate)
        {
            _subscribers.Remove(channel);
        }

        channel.Writer.TryComplete();
    }
}

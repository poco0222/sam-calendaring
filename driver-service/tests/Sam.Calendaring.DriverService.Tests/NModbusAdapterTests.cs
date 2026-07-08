/**
 * @file NModbusAdapterTests.cs - 验证 NModbus（Modbus 通信库）适配器。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 验证真实 NModbus（Modbus 通信库）读取会受调用方 timeout（超时）约束。
 */
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using Sam.Calendaring.DriverService.Modbus;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证真实 NModbus（Modbus 通信库）适配器的最小真实网络边界。
/// </summary>
public sealed class NModbusAdapterTests
{
    /// <summary>
    /// 验证设备接受 TCP（传输控制协议）连接但不响应时，读取会在 socket timeout（套接字超时）内失败。
    /// </summary>
    [Fact]
    public async Task RealReadHonorsSocketTimeoutWhenDeviceDoesNotRespond()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        using var testTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        try
        {
            var endpoint = BuildLoopbackEndpoint(listener);
            var adapter = new NModbusAdapter();
            var acceptedClientTask = listener.AcceptTcpClientAsync(testTimeout.Token);

            await adapter.ConnectAsync(endpoint, testTimeout.Token);
            using var acceptedClient = await acceptedClientTask;

            var stopwatch = Stopwatch.StartNew();
            var readTask = adapter.ReadAsync(
                [new SignalPoint { Name = "pressure", Address = 100 }],
                TimeSpan.FromMilliseconds(150),
                testTimeout.Token);
            var completedTask = await Task.WhenAny(
                readTask,
                Task.Delay(TimeSpan.FromSeconds(2), testTimeout.Token));

            Assert.Same(readTask, completedTask);
            await Assert.ThrowsAnyAsync<Exception>(() => readTask);
            Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(2));
        }
        finally
        {
            listener.Stop();
        }
    }

    /// <summary>
    /// 验证设备接受 TCP（传输控制协议）连接但不响应时，写入会在 socket timeout（套接字超时）内失败。
    /// </summary>
    [Fact]
    public async Task RealWriteHonorsSocketTimeoutWhenDeviceDoesNotRespond()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        using var testTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        try
        {
            var endpoint = BuildLoopbackEndpoint(listener);
            var adapter = new NModbusAdapter();
            var acceptedClientTask = listener.AcceptTcpClientAsync(testTimeout.Token);

            await adapter.ConnectAsync(endpoint, testTimeout.Token);
            using var acceptedClient = await acceptedClientTask;

            var stopwatch = Stopwatch.StartNew();
            var writeTask = adapter.WriteAsync(
                new SignalPoint { Name = "allowMoveIn", SemanticKey = "allowMoveIn", RegisterAddress = 100, RegisterType = "1", Writable = true },
                true,
                TimeSpan.FromMilliseconds(150),
                testTimeout.Token);
            var completedTask = await Task.WhenAny(
                writeTask,
                Task.Delay(TimeSpan.FromSeconds(2), testTimeout.Token));

            Assert.Same(writeTask, completedTask);
            await Assert.ThrowsAnyAsync<Exception>(() => writeTask);
            Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(2));
        }
        finally
        {
            listener.Stop();
        }
    }

    /// <summary>
    /// 生成当前测试 TCP server（TCP 服务器）的 loopback endpoint（回环端点）。
    /// </summary>
    /// <param name="listener">已启动的 TCP listener（TCP 监听器）。</param>
    /// <returns>返回 host:port 形式端点。</returns>
    private static string BuildLoopbackEndpoint(TcpListener listener)
    {
        var endpoint = (IPEndPoint)listener.LocalEndpoint;
        return $"{IPAddress.Loopback}:{endpoint.Port}";
    }
}

/**
 * @file MockModbusAdapter.cs - 提供 Driver Service（驱动服务）mock Modbus（模拟通信）适配器。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供可预测的 Mock（模拟）设备读取行为，支撑快照测试。
 */
namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 提供 Task5 所需的最小 Mock（模拟）Modbus 适配器。
/// </summary>
public sealed class MockModbusAdapter : IModbusAdapter
{
    private readonly Dictionary<string, object?> _values = new(StringComparer.Ordinal);

    /// <inheritdoc />
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        IDictionary<string, object?> values = points.ToDictionary(
            point => point.EffectiveKey(),
            point => _values.TryGetValue(point.EffectiveKey(), out var value)
                ? value
                : (object?)point.EffectiveAddress());
        return Task.FromResult(values);
    }

    /// <inheritdoc />
    public Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<object?>("MOCK-IDENTITY");
    }

    /// <inheritdoc />
    public Task WriteAsync(
        SignalPoint point,
        object value,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        _values[point.EffectiveKey()] = value;
        return Task.CompletedTask;
    }
}

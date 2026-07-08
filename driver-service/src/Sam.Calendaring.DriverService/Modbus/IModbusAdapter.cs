/**
 * @file IModbusAdapter.cs - 定义 Modbus（工业通信协议）适配器契约。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 最小 Modbus 读取适配接口。
 */
namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 定义 Driver Service V1 读取设备所需的最小适配能力。
/// </summary>
public interface IModbusAdapter
{
    /// <summary>
    /// 建立与目标设备的连接。
    /// </summary>
    /// <param name="targetEndpoint">目标设备端点。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken);

    /// <summary>
    /// 读取一组授权信号点的当前值。
    /// </summary>
    /// <param name="points">待读取的信号点。</param>
    /// <param name="timeout">本次读取允许的最长耗时。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回按信号名称索引的读取结果。</returns>
    Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken);

    /// <summary>
    /// 读取可选的 identity probe（身份探针）值。
    /// </summary>
    /// <param name="identityProbe">身份探针点位。</param>
    /// <param name="timeout">本次读取允许的最长耗时。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回探针值；无结果时为 null。</returns>
    Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken);

    /// <summary>
    /// 写入一个授权 signal point（信号点）。
    /// </summary>
    /// <param name="point">待写入的信号点。</param>
    /// <param name="value">待写入值。</param>
    /// <param name="timeout">本次写入允许的最长耗时。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    Task WriteAsync(
        SignalPoint point,
        object value,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        throw new NotSupportedException("当前 Modbus adapter（适配器）不支持写入。");
    }
}

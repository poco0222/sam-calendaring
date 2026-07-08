/**
 * @file NModbusAdapter.cs - 封装 NModbus（Modbus 通信库）适配边界。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供真实 NModbus（Modbus 通信库）设备连接与按 RegisterType（寄存器类型）读取能力。
 */
using System.Globalization;
using System.Net.Sockets;
using NModbus;

namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 提供真实设备读取适配器的最小边界实现。
/// </summary>
public sealed class NModbusAdapter : IModbusAdapter
{
    private TcpClient? _client;
    private IModbusMaster? _master;

    /// <inheritdoc />
    public async Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        var (host, port) = ParseEndpoint(targetEndpoint);

        _client?.Dispose();
        _client = new TcpClient();
        await _client.ConnectAsync(host, port, cancellationToken).ConfigureAwait(false);
        _master = new ModbusFactory().CreateMaster(_client);
    }

    /// <inheritdoc />
    public Task<IDictionary<string, object?>> ReadAsync(
        IReadOnlyList<SignalPoint> points,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        ThrowIfNotConnected();
        ConfigureSocketTimeout(timeout);

        return Task.Run<IDictionary<string, object?>>(() =>
        {
            IDictionary<string, object?> values = new Dictionary<string, object?>(StringComparer.Ordinal);
            foreach (var point in points)
            {
                var plan = SignalReadPlanner.Create(point);
                values[point.EffectiveKey()] = ReadPlannedValue(point, plan);
            }

            return values;
        }, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<object?> ReadIdentityAsync(
        SignalPoint identityProbe,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        var values = await ReadAsync([identityProbe], timeout, cancellationToken).ConfigureAwait(false);
        return values.TryGetValue(identityProbe.EffectiveKey(), out var value)
            ? UnwrapReadResult(value)
            : null;
    }

    /// <inheritdoc />
    public Task WriteAsync(
        SignalPoint point,
        object value,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        ThrowIfNotConnected();
        ConfigureSocketTimeout(timeout);

        return Task.Run(() =>
        {
            var plan = SignalReadPlanner.Create(point);
            switch (plan.Kind)
            {
                case ModbusReadKind.Coil:
                    _master!.WriteSingleCoil(1, plan.Address, ToBooleanWriteValue(value));
                    break;
                case ModbusReadKind.HoldingRegister:
                    _master!.WriteSingleRegister(1, plan.Address, ToUShortWriteValue(value));
                    break;
                default:
                    throw new NotSupportedException("当前写入类型暂不支持。");
            }
        }, cancellationToken);
    }

    /// <summary>
    /// 解析租约中保存的目标设备端点。
    /// </summary>
    /// <param name="targetEndpoint">形如 host:port 的端点字符串。</param>
    /// <returns>返回主机与端口。</returns>
    private static (string Host, int Port) ParseEndpoint(string targetEndpoint)
    {
        var parts = targetEndpoint.Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || string.IsNullOrWhiteSpace(parts[0]))
        {
            throw new InvalidOperationException("目标设备端点格式无效。");
        }

        return (parts[0], int.Parse(parts[1], CultureInfo.InvariantCulture));
    }

    /// <summary>
    /// 确保当前真实设备连接已经建立。
    /// </summary>
    private void ThrowIfNotConnected()
    {
        if (_client is null || !_client.Connected || _master is null)
        {
            throw new InvalidOperationException("设备尚未连接。");
        }
    }

    /// <summary>
    /// 将调用方 timeout（超时）同步到底层 TCP socket（套接字），避免真实设备不响应时阻塞。
    /// </summary>
    /// <param name="timeout">调用方允许的最长读取耗时。</param>
    private void ConfigureSocketTimeout(TimeSpan timeout)
    {
        ThrowIfNotConnected();

        var timeoutMs = ToSocketTimeoutMilliseconds(timeout);
        _client!.ReceiveTimeout = timeoutMs;
        _client.SendTimeout = timeoutMs;
    }

    /// <summary>
    /// 按 read plan（读取计划）执行真实 Modbus read（读取）。
    /// </summary>
    /// <param name="point">当前 signal point（信号点），用于 ERP value conversion（值转换）。</param>
    /// <param name="plan">已由 signal point（信号点）转换出的读取计划。</param>
    /// <returns>返回可写入 signal snapshot（信号快照）的读取结果。</returns>
    private SignalReadResult ReadPlannedValue(SignalPoint point, SignalReadPlan plan)
    {
        return plan.Kind switch
        {
            ModbusReadKind.Coil => ReadCoilValue(plan),
            ModbusReadKind.HoldingRegister => ReadHoldingRegisterValue(point, plan),
            _ => throw new NotSupportedException("当前读取类型暂不支持。")
        };
    }

    /// <summary>
    /// 执行 function code 01（功能码 01）的 coil（线圈）读取。
    /// </summary>
    /// <param name="plan">线圈读取计划。</param>
    /// <returns>返回 0/1 形式的线圈读取结果。</returns>
    private SignalReadResult ReadCoilValue(SignalReadPlan plan)
    {
        var values = _master!.ReadCoils(1, plan.Address, plan.Count);
        return new SignalReadResult(NormalizeCoilValues(values));
    }

    /// <summary>
    /// 执行 function code 03（功能码 03）的 holding register（保持寄存器）读取。
    /// </summary>
    /// <param name="point">当前 signal point（信号点），用于旧 ERP conversion（转换）。</param>
    /// <param name="plan">保持寄存器读取计划。</param>
    /// <returns>返回展示值并保留 rawRegisters（原始寄存器）。</returns>
    private SignalReadResult ReadHoldingRegisterValue(SignalPoint point, SignalReadPlan plan)
    {
        var registerValues = _master!.ReadHoldingRegisters(1, plan.Address, plan.Count);
        var value = SignalValueConverter.ConvertHoldingRegisters(point, registerValues);
        return new SignalReadResult(value, registerValues);
    }

    /// <summary>
    /// 将 NModbus bool array（布尔数组）转换成现场更直观的 0/1 值。
    /// </summary>
    /// <param name="values">NModbus 返回的 coil values（线圈值）。</param>
    /// <returns>单点返回 0/1，多点返回 0/1 数组。</returns>
    private static object NormalizeCoilValues(bool[] values)
    {
        if (values.Length == 1)
        {
            return values[0] ? 1 : 0;
        }

        return values
            .Select(value => value ? 1 : 0)
            .ToArray();
    }

    /// <summary>
    /// 从 SignalReadResult（信号读取结果）中取出可参与 identity compare（身份比较）的实际值。
    /// </summary>
    /// <param name="value">适配器读取到的原始结果。</param>
    /// <returns>返回实际读取值。</returns>
    private static object? UnwrapReadResult(object? value)
    {
        return value is SignalReadResult readResult
            ? readResult.Value
            : value;
    }

    /// <summary>
    /// 将 TimeSpan（时间跨度）转换为 TcpClient 可接受的毫秒超时值。
    /// </summary>
    /// <param name="timeout">调用方传入的 timeout（超时）。</param>
    /// <returns>返回 1 到 int.MaxValue 之间的毫秒数。</returns>
    private static int ToSocketTimeoutMilliseconds(TimeSpan timeout)
    {
        if (timeout <= TimeSpan.Zero)
        {
            return 1;
        }

        if (timeout.TotalMilliseconds >= int.MaxValue)
        {
            return int.MaxValue;
        }

        return Math.Max(1, (int)Math.Ceiling(timeout.TotalMilliseconds));
    }

    /// <summary>
    /// 将业务写入值转换为 coil（线圈）所需的 bool（布尔值）。
    /// </summary>
    /// <param name="value">业务写入值。</param>
    /// <returns>返回可写入 coil（线圈）的布尔值。</returns>
    private static bool ToBooleanWriteValue(object value)
    {
        return value switch
        {
            bool boolean => boolean,
            byte number => number != 0,
            short number => number != 0,
            int number => number != 0,
            ushort number => number != 0,
            string text when bool.TryParse(text, out var parsed) => parsed,
            string text when ushort.TryParse(text, CultureInfo.InvariantCulture, out var parsed) => parsed != 0,
            _ => throw new InvalidOperationException("coil 写入值必须是 bool 或 0/1 数字。")
        };
    }

    /// <summary>
    /// 将业务写入值转换为 holding register（保持寄存器）所需的 ushort（16 位无符号整数）。
    /// </summary>
    /// <param name="value">业务写入值。</param>
    /// <returns>返回可写入 holding register（保持寄存器）的数值。</returns>
    private static ushort ToUShortWriteValue(object value)
    {
        return value switch
        {
            bool boolean => (ushort)(boolean ? 1 : 0),
            byte number => number,
            short number when number >= 0 => (ushort)number,
            int number when number is >= 0 and <= ushort.MaxValue => (ushort)number,
            ushort number => number,
            string text when ushort.TryParse(text, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => throw new InvalidOperationException("holding register 写入值必须在 ushort 范围内。")
        };
    }
}

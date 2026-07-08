/**
 * @file SignalReadPlan.cs - 定义 Modbus（工业通信协议）信号读取计划。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 将 ERP signalConfig（信号配置）转换成 Driver Service 可执行的 Modbus read plan（读取计划）。
 */
namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 表示当前 Driver Service 支持的 Modbus read kind（读取类型）。
/// </summary>
public enum ModbusReadKind
{
    /// <summary>
    /// 使用 function code 01（功能码 01）读取 coil（线圈）。
    /// </summary>
    Coil,

    /// <summary>
    /// 使用 function code 03（功能码 03）读取 holding register（保持寄存器）。
    /// </summary>
    HoldingRegister
}

/// <summary>
/// 表示一个已规范化的 Modbus read plan（读取计划）。
/// </summary>
/// <param name="Kind">读取类型。</param>
/// <param name="Address">实际下发给 Modbus 的 address（地址）。</param>
/// <param name="Count">本次读取的 point count（点位数量）。</param>
public sealed record SignalReadPlan(ModbusReadKind Kind, ushort Address, ushort Count);

/// <summary>
/// 表示一次真实设备读取后的标准结果。
/// </summary>
/// <param name="Value">用于业务展示的 value（值）。</param>
/// <param name="RawRegisters">保持寄存器读取时保留的 raw registers（原始寄存器）。</param>
public sealed record SignalReadResult(object? Value, IReadOnlyList<ushort>? RawRegisters = null);

/// <summary>
/// 提供 signal point（信号点）到 Modbus read plan（读取计划）的最小映射。
/// </summary>
public static class SignalReadPlanner
{
    /// <summary>
    /// 根据 ERP RegisterType（寄存器类型）创建 Modbus read plan（读取计划）。
    /// </summary>
    /// <param name="point">待读取的 signal point（信号点）。</param>
    /// <returns>返回可由 NModbus adapter（适配器）直接执行的读取计划。</returns>
    public static SignalReadPlan Create(SignalPoint point)
    {
        ArgumentNullException.ThrowIfNull(point);

        return NormalizeRegisterType(point) switch
        {
            "1" or "coil" or "coils" => new SignalReadPlan(
                ModbusReadKind.Coil,
                ToUShort(point.RegisterAddress ?? point.EffectiveAddress(), "registerAddress"),
                ReadCount(point)),
            "3" => new SignalReadPlan(
                ModbusReadKind.HoldingRegister,
                ToUShort(point.OffsetValue ?? point.EffectiveAddress(), "offsetValue"),
                ReadCount(point)),
            "holdingregister" or "holdingregisters" => new SignalReadPlan(
                ModbusReadKind.HoldingRegister,
                ToUShort(point.EffectiveAddress(), "registerAddress"),
                ReadCount(point)),
            _ => throw new NotSupportedException("当前仅支持 RegisterType=1 线圈与 RegisterType=3 保持寄存器读取。")
        };
    }

    /// <summary>
    /// 读取 ERP registerType（寄存器类型）；缺失时兼容旧 type（类型）字段。
    /// </summary>
    /// <param name="point">待读取的 signal point（信号点）。</param>
    /// <returns>返回小写后的读取类型标记。</returns>
    private static string NormalizeRegisterType(SignalPoint point)
    {
        var registerType = string.IsNullOrWhiteSpace(point.RegisterType)
            ? point.Type
            : point.RegisterType;
        return registerType.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
    }

    /// <summary>
    /// 获取本次 Modbus read（读取）的 point count（点位数量）。
    /// </summary>
    /// <param name="point">待读取的 signal point（信号点）。</param>
    /// <returns>返回可传给 NModbus 的 ushort 数量。</returns>
    private static ushort ReadCount(SignalPoint point)
    {
        var count = point.RegisterCount ?? 1;
        if (count <= 0)
        {
            throw new InvalidOperationException("registerCount 必须大于 0。");
        }

        return ToUShort(count, "registerCount");
    }

    /// <summary>
    /// 将 ERP numeric field（数字字段）收窄成 NModbus 使用的 ushort（16 位无符号整数）。
    /// </summary>
    /// <param name="value">待转换的数值。</param>
    /// <param name="fieldName">用于错误消息的字段名。</param>
    /// <returns>返回 ushort 值。</returns>
    private static ushort ToUShort(int value, string fieldName)
    {
        if (value < 0 || value > ushort.MaxValue)
        {
            throw new InvalidOperationException($"{fieldName} 超出 Modbus address/count 范围。");
        }

        return (ushort)value;
    }
}

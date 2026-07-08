/**
 * @file Driver Service signal value converter（信号值转换器）。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 复刻旧 ERP ModbusSignals（信号配置）读取后的最小 value conversion（值转换）规则。
 */
using System.Globalization;

namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 提供 ERP Modbus signal value conversion（信号值转换）的最小兼容实现。
/// </summary>
public static class SignalValueConverter
{
    /// <summary>
    /// 将 holding register raw registers（保持寄存器原始寄存器）转换成 snapshot value（快照值）。
    /// </summary>
    /// <param name="point">当前 ERP signal point（信号点）。</param>
    /// <param name="registers">NModbus 返回的 raw registers（原始寄存器）。</param>
    /// <returns>返回旧 ERP 展示口径的 value（值），并保留非双寄存器读取的既有行为。</returns>
    public static object ConvertHoldingRegisters(SignalPoint point, IReadOnlyList<ushort> registers)
    {
        ArgumentNullException.ThrowIfNull(point);
        ArgumentNullException.ThrowIfNull(registers);

        var registerCount = point.RegisterCount ?? registers.Count;
        if (registerCount == 2 && registers.Count >= 2)
        {
            return ConvertTwoRegistersToLegacyFloat(registers[0], registers[1]);
        }

        return registers.Count == 1
            ? registers[0]
            : registers.ToArray();
    }

    /// <summary>
    /// 按旧 ERP low word first（低位字在前）规则把两个 register（寄存器）转换成 Float（单精度浮点数）。
    /// </summary>
    /// <param name="lowWord">低位 word（字）。</param>
    /// <param name="highWord">高位 word（字）。</param>
    /// <returns>返回保留三位小数的旧 ERP 字符串值。</returns>
    private static string ConvertTwoRegistersToLegacyFloat(ushort lowWord, ushort highWord)
    {
        var intBits = ((uint)highWord << 16) | lowWord;
        var value = BitConverter.Int32BitsToSingle(unchecked((int)intBits));
        var rounded = Math.Round(value, 3, MidpointRounding.AwayFromZero);
        return rounded.ToString("0.000", CultureInfo.InvariantCulture);
    }
}

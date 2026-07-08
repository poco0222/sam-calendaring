/**
 * @file SignalReadPlannerTests.cs - 验证 Modbus（工业通信协议）读取计划。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 验证北辰 Modbus gateway（网关）信号配置会被转换成正确的 read plan（读取计划）。
 */
using Sam.Calendaring.DriverService.Modbus;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 signalConfig（信号配置）到 Modbus read plan（读取计划）的最小映射。
/// </summary>
public sealed class SignalReadPlannerTests
{
    /// <summary>
    /// 验证 RegisterType=1（线圈）使用 registerAddress（寄存器地址）读取 coil（线圈）。
    /// </summary>
    [Fact]
    public void CoilSignalUsesRegisterAddress()
    {
        var point = new SignalPoint
        {
            SignalCode = "902",
            SignalName = "MES通信状态",
            RegisterType = "1",
            RegisterAddress = 4902,
            RegisterCount = 1,
            DataType = "bit"
        };

        var plan = SignalReadPlanner.Create(point);

        Assert.Equal(ModbusReadKind.Coil, plan.Kind);
        Assert.Equal((ushort)4902, plan.Address);
        Assert.Equal((ushort)1, plan.Count);
    }

    /// <summary>
    /// 验证 RegisterType=3（保持寄存器）使用 offsetValue（偏移量）读取 holding register（保持寄存器）。
    /// </summary>
    [Fact]
    public void HoldingRegisterSignalUsesOffsetValue()
    {
        var point = new SignalPoint
        {
            SignalCode = "1100",
            SignalName = "下压计数",
            RegisterType = "3",
            RegisterAddress = 411101,
            RegisterCount = 2,
            OffsetValue = 11100,
            DataType = "word"
        };

        var plan = SignalReadPlanner.Create(point);

        Assert.Equal(ModbusReadKind.HoldingRegister, plan.Kind);
        Assert.Equal((ushort)11100, plan.Address);
        Assert.Equal((ushort)2, plan.Count);
    }

    /// <summary>
    /// 验证 RegisterType=3（保持寄存器）双寄存器按旧 ERP low word first（低位字在前）转换为 Float（单精度浮点数）。
    /// </summary>
    [Fact]
    public void HoldingRegisterCountTwoUsesLegacyErpFloatConversion()
    {
        var point = new SignalPoint
        {
            SignalCode = "628",
            SignalName = "装模高度",
            RegisterType = "3",
            RegisterAddress = 410629,
            RegisterCount = 2,
            ScaleFactor = 1,
            OffsetValue = 10628,
            DataType = "word"
        };

        var value = SignalValueConverter.ConvertHoldingRegisters(point, [57443, 1]);

        Assert.Equal("0.000", value);
    }

    /// <summary>
    /// 验证双寄存器 Float（单精度浮点数）转换能用非零值锁住 low word first（低位字在前）的 word order（字序）。
    /// </summary>
    [Fact]
    public void HoldingRegisterCountTwoPreservesLowWordFirstOrder()
    {
        var point = new SignalPoint
        {
            SignalCode = "float-probe",
            SignalName = "浮点探测",
            RegisterType = "3",
            RegisterAddress = 400001,
            RegisterCount = 2,
            OffsetValue = 0,
            DataType = "word"
        };

        var value = SignalValueConverter.ConvertHoldingRegisters(point, [0x0000, 0x3F80]);

        Assert.Equal("1.000", value);
    }
}

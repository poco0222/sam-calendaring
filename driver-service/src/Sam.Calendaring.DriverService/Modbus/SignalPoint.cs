/**
 * @file SignalPoint.cs - 定义 Driver Service（驱动服务）signal point（信号点位）。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 读取快照时使用的最小信号点模型。
 */
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 表示一个可读的 signal point（信号点）。
/// </summary>
public sealed record SignalPoint
{
    /// <summary>
    /// 获取或设置信号名称。
    /// </summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 ERP signalCode（信号编码），来自 ModbusSignals 页面。
    /// </summary>
    public string SignalCode { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 ERP signalName（信号名称），来自 ModbusSignals 页面。
    /// </summary>
    public string SignalName { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 Driver semanticKey（语义键），用于设备动作只按内部语义解析点位。
    /// </summary>
    public string SemanticKey { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 Modbus 地址。
    /// </summary>
    public int Address { get; init; }

    /// <summary>
    /// 获取或设置 ERP registerAddress（寄存器地址），来自 ModbusSignals 页面。
    /// </summary>
    public int? RegisterAddress { get; init; }

    /// <summary>
    /// 获取或设置信号类型；V1 默认只按 holdingRegister（保持寄存器）处理。
    /// </summary>
    public string Type { get; init; } = "holdingRegister";

    /// <summary>
    /// 获取或设置 ERP RegisterType（寄存器类型），用于选择 Modbus function code（功能码）。
    /// </summary>
    public string RegisterType { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 ERP signalType（读写类型），仅作为快照元数据展示。
    /// </summary>
    public string SignalType { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置当前 signal point（信号点）是否允许写入；null 时兼容旧 signalType（信号类型）。
    /// </summary>
    public bool? Writable { get; init; }

    /// <summary>
    /// 获取或设置 ERP dataType（数据类型），仅作为快照元数据展示。
    /// </summary>
    public string DataType { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 ERP registerCount（寄存器数量），用于控制 Modbus read count（读取数量）。
    /// </summary>
    public int? RegisterCount { get; init; }

    /// <summary>
    /// 获取或设置 ERP scaleFactor（比例因子），仅作为快照元数据展示。
    /// </summary>
    public int? ScaleFactor { get; init; }

    /// <summary>
    /// 获取或设置 ERP offsetValue（偏移量），RegisterType=3 时作为实际 holding register address（保持寄存器地址）。
    /// </summary>
    public int? OffsetValue { get; init; }

    /// <summary>
    /// 获取或设置 ERP unit（单位），用于信号快照表展示。
    /// </summary>
    public string Unit { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 ERP description（信号描述），仅作为快照元数据展示。
    /// </summary>
    public string Description { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 ERP isActive（是否启用），仅作为快照元数据展示。
    /// </summary>
    public int? IsActive { get; init; }

    /// <summary>
    /// 获取或设置 ERP plcAreaType（PLC 区域类型），仅作为快照元数据展示。
    /// </summary>
    public string PlcAreaType { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 ERP paramGroup（参数组别），用于信号快照表展示。
    /// </summary>
    public string ParamGroup { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置 identityProbe（身份探测点位）的可选期望值。
    /// </summary>
    public string? ExpectedValue { get; init; }

    /// <summary>
    /// 获取 ERP ModbusSignals 页面中的其余字段，确保 signalConfig（信号配置）字段不被丢弃。
    /// </summary>
    [JsonExtensionData]
    public IDictionary<string, JsonElement> ExtraFields { get; init; } =
        new Dictionary<string, JsonElement>(StringComparer.Ordinal);

    /// <summary>
    /// 获取设备读取使用的有效地址。
    /// </summary>
    /// <returns>优先返回 ERP registerAddress（寄存器地址），否则兼容旧 address（地址）。</returns>
    public int EffectiveAddress()
    {
        return RegisterAddress ?? Address;
    }

    /// <summary>
    /// 获取快照 map（映射）使用的稳定 key（键）。
    /// </summary>
    /// <returns>优先返回 signalCode（信号编码），再兼容旧 name（名称）和 signalName（信号名称）。</returns>
    public string EffectiveKey()
    {
        if (!string.IsNullOrWhiteSpace(SignalCode))
        {
            return SignalCode;
        }

        if (!string.IsNullOrWhiteSpace(Name))
        {
            return Name;
        }

        return !string.IsNullOrWhiteSpace(SignalName)
            ? SignalName
            : string.Create(
                System.Globalization.CultureInfo.InvariantCulture,
                $"signal-{EffectiveAddress()}");
    }

    /// <summary>
    /// 判断当前点位是否允许作为 write signal（写信号）使用。
    /// </summary>
    /// <returns>显式 writable（可写）优先；旧 signalType（信号类型）包含写能力时返回 true。</returns>
    public bool IsWriteCapable()
    {
        if (Writable.HasValue)
        {
            return Writable.Value;
        }

        if (string.IsNullOrWhiteSpace(SignalType))
        {
            return false;
        }

        var normalized = SignalType.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
        return normalized is "w" or "rw" or "write" or "readwrite" or "read/write"
            || normalized.Contains("写", StringComparison.Ordinal);
    }

    /// <summary>
    /// 判断当前点位是否携带 ERP ModbusSignals（信号配置）元数据。
    /// </summary>
    /// <returns>有 ERP signalCode（信号编码）或 signalName（信号名称）时返回 true。</returns>
    public bool HasErpMetadata()
    {
        return !string.IsNullOrWhiteSpace(SignalCode)
            || !string.IsNullOrWhiteSpace(SignalName);
    }
}

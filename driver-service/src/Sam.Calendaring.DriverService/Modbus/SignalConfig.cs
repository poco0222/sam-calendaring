/**
 * @file SignalConfig.cs - 定义 Driver Service（驱动服务）signal config（信号配置）模型。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 解析活跃租约中保存的 signalConfig（信号配置）JSON。
 */
using System.Text.Json;

namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 表示租约内允许读取的信号配置。
/// </summary>
public sealed record SignalConfig
{
    private static readonly JsonSerializerOptions ParseOptions = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// 获取或设置配置模式；ERP bootstrap（启动引导）占位配置会使用 bootstrap-minimal。
    /// </summary>
    public string Mode { get; init; } = string.Empty;

    /// <summary>
    /// 获取或设置当前配置声明的信号点集合。
    /// </summary>
    public IReadOnlyList<SignalPoint> Signals { get; init; } = Array.Empty<SignalPoint>();

    /// <summary>
    /// 获取或设置可选的 identity probe（身份探针）点位。
    /// </summary>
    public SignalPoint? IdentityProbe { get; init; }

    /// <summary>
    /// 解析 signalConfig（信号配置）JSON。
    /// </summary>
    /// <param name="json">租约中保存的原始 JSON。</param>
    /// <returns>返回解析后的配置；空白输入时返回空配置。</returns>
    public static SignalConfig Parse(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new SignalConfig();
        }

        // PopoY: signalConfig（信号配置）允许携带 ERP 元数据；连接读取只消费 signals 与 identityProbe。
        return JsonSerializer.Deserialize<SignalConfig>(json, ParseOptions)
            ?? new SignalConfig();
    }
}

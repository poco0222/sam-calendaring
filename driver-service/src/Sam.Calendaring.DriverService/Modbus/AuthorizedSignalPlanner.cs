/**
 * @file AuthorizedSignalPlanner.cs - 规划已授权 signal（信号）读取点位。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 根据租约授权地址范围筛选允许读取的信号点。
 */
using System.Globalization;

namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 提供授权信号点规划逻辑。
/// </summary>
public static class AuthorizedSignalPlanner
{
    /// <summary>
    /// 从信号配置中筛选出授权地址范围内的点位。
    /// </summary>
    /// <param name="config">租约信号配置。</param>
    /// <param name="allowedRanges">允许读取的地址范围列表。</param>
    /// <returns>返回授权后的信号点列表。</returns>
    public static IReadOnlyList<SignalPoint> Plan(
        SignalConfig config,
        IReadOnlyList<string> allowedRanges)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(allowedRanges);

        if (config.Signals.Count == 0 || allowedRanges.Count == 0)
        {
            return Array.Empty<SignalPoint>();
        }

        var ranges = allowedRanges.Select(ParseRange).ToArray();
        return config.Signals
            .Where(signal =>
            {
                var address = signal.EffectiveAddress();
                return IsAddressAllowed(address, ranges);
            })
            .ToArray();
    }

    /// <summary>
    /// 判断单个 address（地址）是否落在授权范围内。
    /// </summary>
    /// <param name="address">待校验地址。</param>
    /// <param name="allowedRanges">允许读取或写入的地址范围列表。</param>
    /// <returns>地址命中任一范围时返回 true。</returns>
    public static bool IsAddressAllowed(int address, IReadOnlyList<string> allowedRanges)
    {
        ArgumentNullException.ThrowIfNull(allowedRanges);
        var ranges = allowedRanges.Select(ParseRange).ToArray();
        return IsAddressAllowed(address, ranges);
    }

    /// <summary>
    /// 判断单个 address（地址）是否落在已解析范围内。
    /// </summary>
    /// <param name="address">待校验地址。</param>
    /// <param name="ranges">已解析授权范围。</param>
    /// <returns>地址命中任一范围时返回 true。</returns>
    private static bool IsAddressAllowed(int address, IReadOnlyList<(int Start, int End)> ranges)
    {
        return ranges.Any(range => address >= range.Start && address <= range.End);
    }

    /// <summary>
    /// 解析单个授权地址范围字符串。
    /// </summary>
    /// <param name="value">形如 100-120 或 100 的范围字符串。</param>
    /// <returns>返回起止地址。</returns>
    private static (int Start, int End) ParseRange(string value)
    {
        var parts = value.Split('-', 2, StringSplitOptions.TrimEntries);
        var start = int.Parse(parts[0], CultureInfo.InvariantCulture);
        var end = parts.Length == 1
            ? start
            : int.Parse(parts[1], CultureInfo.InvariantCulture);
        return (start, end);
    }
}

/**
 * @file DiagnosticLogQuery.cs - 定义 diagnostic log（诊断日志）查询条件。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 定义 GET /diagnosticLogs（诊断日志接口）的最小查询条件。
 */
namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 表示 diagnostic log（诊断日志）查询条件。
/// </summary>
public sealed record DiagnosticLogQuery(
    string? StatusClass,
    string? Category,
    string? CorrelationId,
    int? Limit,
    DateTimeOffset? FromUtc = null,
    DateTimeOffset? ToUtc = null)
{
    /// <summary>
    /// 获取规范化后的 statusClass（状态分类）。
    /// </summary>
    public string NormalizedStatusClass => NormalizeAllValue(StatusClass);

    /// <summary>
    /// 获取规范化后的 category（分类）。
    /// </summary>
    public string NormalizedCategory => NormalizeAllValue(Category);

    /// <summary>
    /// 获取 fromUtc（UTC 起始时间）的标准 UTC 值。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    public DateTimeOffset? NormalizedFromUtc => FromUtc?.ToUniversalTime();

    /// <summary>
    /// 获取 toUtc（UTC 结束时间）的标准 UTC 值。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    public DateTimeOffset? NormalizedToUtc => ToUtc?.ToUniversalTime();

    /// <summary>
    /// 判断是否启用了 time range（时间范围）查询。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    public bool HasTimeRange => FromUtc.HasValue || ToUtc.HasValue;

    /// <summary>
    /// 判断是否仍需应用 limit（数量限制）；时间范围查询默认返回范围内全部日志。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    public bool ShouldApplyLimit => Limit is > 0 || !HasTimeRange;

    /// <summary>
    /// 获取默认 100、最大 500 的 limit（数量限制）。
    /// </summary>
    public int NormalizedLimit => Limit is > 0
        ? Math.Min(Limit.Value, 500)
        : 100;

    /// <summary>
    /// 把空值统一成 all（全部）。
    /// </summary>
    /// <param name="value">待规范化的查询参数。</param>
    /// <returns>返回小写查询值。</returns>
    private static string NormalizeAllValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? "all"
            : value.Trim().ToLowerInvariant();
    }
}

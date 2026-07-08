/**
 * @file IDriverStateStore.cs - 定义 Driver Service（驱动服务）状态存储契约。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 定义 Driver Service V1 最小状态持久化读写契约。
 */
namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 定义 Driver Service V1 最小状态存储需要提供的能力。
/// </summary>
public interface IDriverStateStore
{
    /// <summary>
    /// 初始化底层状态存储。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    Task InitializeAsync(CancellationToken cancellationToken);

    /// <summary>
    /// 加载当前最小状态快照。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回当前状态快照。</returns>
    Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken);

    /// <summary>
    /// 获取当前已见最大 fencing token（隔离令牌）。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回当前已见最大 token。</returns>
    Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken);

    /// <summary>
    /// 保存活跃租约摘要，并同步更新相关状态字段。
    /// </summary>
    /// <param name="summary">待保存的活跃租约摘要。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken);

    /// <summary>
    /// 保存完整的最小状态快照。
    /// </summary>
    /// <param name="snapshot">待保存的状态快照。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken);

    /// <summary>
    /// 追加一条脱敏审计日志。
    /// </summary>
    /// <param name="entry">待追加的审计日志。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken);

    /// <summary>
    /// 追加一条诊断日志。
    /// </summary>
    /// <param name="entry">待追加的诊断日志。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken);

    /// <summary>
    /// 删除 cutoffUtc（截止时间）之前的 diagnostic log（诊断日志）。
    /// </summary>
    /// <param name="cutoffUtc">UTC 截止时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回删除行数。</returns>
    Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken);

    /// <summary>
    /// 查询诊断日志。
    /// </summary>
    /// <param name="query">查询条件。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回匹配条件的诊断日志。</returns>
    Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(DiagnosticLogQuery query, CancellationToken cancellationToken);
}

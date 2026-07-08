/**
 * @file DriverStateService.cs - 编排 Driver Service（驱动服务）状态读写。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供 Driver Service V1 状态读写、初始化和诊断日志安全写入编排。
 */
using Microsoft.Extensions.Logging;
using Sam.Calendaring.DriverService.Domain;

namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 提供 Driver Service V1 读写本地最小状态的便捷方法。
/// </summary>
public sealed class DriverStateService
{
    private readonly IDriverStateStore _stateStore;
    private readonly ILogger<DriverStateService> _logger;

    /// <summary>
    /// 初始化状态编排服务。
    /// </summary>
    /// <param name="stateStore">底层状态存储实现。</param>
    /// <param name="logger">诊断日志写入失败时使用的日志抽象。</param>
    public DriverStateService(IDriverStateStore stateStore, ILogger<DriverStateService> logger)
    {
        _stateStore = stateStore;
        _logger = logger;
    }

    /// <summary>
    /// 初始化底层状态存储。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    public Task InitializeAsync(CancellationToken cancellationToken)
    {
        return _stateStore.InitializeAsync(cancellationToken);
    }

    /// <summary>
    /// 读取当前最小状态快照。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回当前状态快照。</returns>
    public Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
    {
        return _stateStore.LoadSnapshotAsync(cancellationToken);
    }

    /// <summary>
    /// 保存一条已通过校验的活跃租约摘要。
    /// </summary>
    /// <param name="claims">已通过校验的租约声明。</param>
    /// <param name="signalConfigJson">已验证通过的信号配置 JSON。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    public Task<bool> SaveValidatedLeaseAsync(LeaseClaims claims, string signalConfigJson, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(claims);

        // PopoY: Task4 仅落盘当前会话状态；真实连接建立与切换由后续 Task5 的 session manager 接管。
        var summary = new ActiveLeaseSummary(
            claims.LeaseId ?? throw new InvalidOperationException("已通过校验的租约缺少 leaseId。"),
            claims.TargetDeviceId ?? throw new InvalidOperationException("已通过校验的租约缺少 targetDeviceId。"),
            claims.TargetEndpoint ?? throw new InvalidOperationException("已通过校验的租约缺少 targetEndpoint。"),
            signalConfigJson,
            claims.AllowedAddressRanges ?? Array.Empty<string>(),
            claims.FencingToken ?? throw new InvalidOperationException("已通过校验的租约缺少 fencingToken。"),
            claims.ExpiresAt ?? throw new InvalidOperationException("已通过校验的租约缺少 expiresAt。"),
            LeaseState.Active,
            DeviceSessionState.Disconnected)
        {
            AllowedScopes = claims.AllowedScopes ?? Array.Empty<string>()
        };

        return _stateStore.SaveActiveLeaseAsync(summary, cancellationToken);
    }

    /// <summary>
    /// 保存完整状态快照，供设备命令更新 device session state（设备会话状态）。
    /// </summary>
    /// <param name="snapshot">待保存的状态快照。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    public Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken)
    {
        return _stateStore.SaveSnapshotAsync(snapshot, cancellationToken);
    }

    /// <summary>
    /// 追加一条脱敏审计日志。
    /// </summary>
    /// <param name="entry">待写入的审计日志。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    public Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken)
    {
        return _stateStore.AppendAuditLogAsync(entry, cancellationToken);
    }

    /// <summary>
    /// 尝试追加 diagnostic log（诊断日志）；失败时只写 ILogger（日志抽象），不影响业务响应。
    /// </summary>
    /// <param name="entry">待写入的诊断日志。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    public async Task TryAppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken)
    {
        try
        {
            await _stateStore.AppendDiagnosticLogAsync(entry, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                "诊断日志写入失败，业务响应不受影响。事件：{EventName}，异常类型：{ExceptionType}，关联 ID：{CorrelationId}",
                entry.EventName,
                exception.GetType().Name,
                entry.CorrelationId);
        }
    }

    /// <summary>
    /// 删除截止时间之前的 diagnostic log（诊断日志）。
    /// </summary>
    /// <param name="cutoffUtc">UTC 截止时间。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回删除行数。</returns>
    public Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
    {
        return _stateStore.DeleteDiagnosticLogsBeforeAsync(cutoffUtc, cancellationToken);
    }

    /// <summary>
    /// 查询 diagnostic log（诊断日志）。
    /// </summary>
    /// <param name="query">查询条件。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回诊断日志列表。</returns>
    public Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(
        DiagnosticLogQuery query,
        CancellationToken cancellationToken)
    {
        return _stateStore.QueryDiagnosticLogsAsync(query, cancellationToken);
    }
}

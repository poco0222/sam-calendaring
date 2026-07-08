/**
 * @file SqliteDriverStateStore.cs - 实现 SQLite（嵌入式数据库）状态存储。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 使用最小 SQLite + WAL 表保存 Driver Service V1 的状态快照与审计日志。
 */
using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;

namespace Sam.Calendaring.DriverService.State;

/// <summary>
/// 提供基于 SQLite（嵌入式数据库）的 Driver Service 状态持久化实现。
/// </summary>
public sealed class SqliteDriverStateStore(string connectionString) : IDriverStateStore
{
    private const string ActiveLeaseKey = "activeLease";
    private const string MaxSeenFencingTokenKey = "maxSeenFencingToken";
    private const string LeaseStateKey = "leaseState";
    private const string DeviceSessionStateKey = "deviceSessionState";

    /// <summary>
    /// 为测试创建一个指向临时 SQLite 文件的状态存储。
    /// </summary>
    /// <returns>返回可隔离测试数据的状态存储实例。</returns>
    public static SqliteDriverStateStore CreateTempFileForTests()
    {
        var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db");
        return new SqliteDriverStateStore($"Data Source={path}");
    }

    /// <inheritdoc />
    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await EnsureSchemaAsync(connection, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<DriverStateSnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        var values = await ReadStateValuesAsync(connection, cancellationToken).ConfigureAwait(false);
        return CreateSnapshot(values);
    }

    /// <inheritdoc />
    public async Task<long> GetMaxSeenFencingTokenAsync(CancellationToken cancellationToken)
    {
        var snapshot = await LoadSnapshotAsync(cancellationToken).ConfigureAwait(false);
        return snapshot.MaxSeenFencingToken;
    }

    /// <inheritdoc />
    public async Task<bool> SaveActiveLeaseAsync(ActiveLeaseSummary summary, CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var currentMaxSeenFencingToken = await ReadCurrentMaxSeenFencingTokenAsync(
            connection,
            transaction,
            cancellationToken).ConfigureAwait(false);

        if (summary.FencingToken < currentMaxSeenFencingToken)
        {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            return false;
        }

        await SaveSnapshotCoreAsync(
            connection,
            transaction,
            new DriverStateSnapshot(
            summary,
            summary.FencingToken,
            summary.LeaseState,
            summary.DeviceSessionState),
            currentMaxSeenFencingToken,
            cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return true;
    }

    /// <inheritdoc />
    public async Task SaveSnapshotAsync(DriverStateSnapshot snapshot, CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var currentMaxSeenFencingToken = await ReadCurrentMaxSeenFencingTokenAsync(
            connection,
            transaction,
            cancellationToken).ConfigureAwait(false);

        await SaveSnapshotCoreAsync(
            connection,
            transaction,
            snapshot,
            currentMaxSeenFencingToken,
            cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task AppendAuditLogAsync(AuditLogEntry entry, CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO audit_log (
                created_at,
                correlation_id,
                lease_id,
                target_device_id,
                fencing_token,
                command_name,
                duration_ms,
                result_code,
                lease_state,
                device_session_state,
                message
            )
            VALUES (
                @createdAt,
                @correlationId,
                @leaseId,
                @targetDeviceId,
                @fencingToken,
                @commandName,
                @durationMs,
                @resultCode,
                @leaseState,
                @deviceSessionState,
                @message
            );
            """;
        command.Parameters.AddWithValue("@createdAt", DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture));
        command.Parameters.AddWithValue("@correlationId", entry.CorrelationId);
        command.Parameters.AddWithValue("@leaseId", (object?)entry.LeaseId ?? DBNull.Value);
        command.Parameters.AddWithValue("@targetDeviceId", (object?)entry.TargetDeviceId ?? DBNull.Value);
        command.Parameters.AddWithValue("@fencingToken", (object?)entry.FencingToken ?? DBNull.Value);
        command.Parameters.AddWithValue("@commandName", entry.CommandName);
        command.Parameters.AddWithValue("@durationMs", entry.DurationMs);
        command.Parameters.AddWithValue("@resultCode", entry.ResultCode);
        command.Parameters.AddWithValue("@leaseState", entry.LeaseState);
        command.Parameters.AddWithValue("@deviceSessionState", entry.DeviceSessionState);
        command.Parameters.AddWithValue("@message", entry.Message);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task AppendDiagnosticLogAsync(DiagnosticLogEntry entry, CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO diagnostic_log (
                created_at,
                level,
                category,
                status_class,
                event_name,
                event_stage,
                correlation_id,
                command_name,
                result_code,
                http_status_code,
                duration_ms,
                lease_state,
                device_session_state,
                lease_id,
                target_device_id,
                fencing_token,
                exception_type,
                message
            )
            VALUES (
                @createdAt,
                @level,
                @category,
                @statusClass,
                @eventName,
                @eventStage,
                @correlationId,
                @commandName,
                @resultCode,
                @httpStatusCode,
                @durationMs,
                @leaseState,
                @deviceSessionState,
                @leaseId,
                @targetDeviceId,
                @fencingToken,
                @exceptionType,
                @message
            );
            """;
        command.Parameters.AddWithValue("@createdAt", entry.CreatedAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture));
        command.Parameters.AddWithValue("@level", entry.Level);
        command.Parameters.AddWithValue("@category", entry.Category);
        command.Parameters.AddWithValue("@statusClass", entry.StatusClass);
        command.Parameters.AddWithValue("@eventName", entry.EventName);
        command.Parameters.AddWithValue("@eventStage", (object?)entry.EventStage ?? DBNull.Value);
        command.Parameters.AddWithValue("@correlationId", (object?)entry.CorrelationId ?? DBNull.Value);
        command.Parameters.AddWithValue("@commandName", (object?)entry.CommandName ?? DBNull.Value);
        command.Parameters.AddWithValue("@resultCode", (object?)entry.ResultCode ?? DBNull.Value);
        command.Parameters.AddWithValue("@httpStatusCode", (object?)entry.HttpStatusCode ?? DBNull.Value);
        command.Parameters.AddWithValue("@durationMs", (object?)entry.DurationMs ?? DBNull.Value);
        command.Parameters.AddWithValue("@leaseState", (object?)entry.LeaseState ?? DBNull.Value);
        command.Parameters.AddWithValue("@deviceSessionState", (object?)entry.DeviceSessionState ?? DBNull.Value);
        command.Parameters.AddWithValue("@leaseId", (object?)entry.LeaseId ?? DBNull.Value);
        command.Parameters.AddWithValue("@targetDeviceId", (object?)entry.TargetDeviceId ?? DBNull.Value);
        command.Parameters.AddWithValue("@fencingToken", (object?)entry.FencingToken ?? DBNull.Value);
        command.Parameters.AddWithValue("@exceptionType", (object?)entry.ExceptionType ?? DBNull.Value);
        command.Parameters.AddWithValue("@message", entry.Message);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<int> DeleteDiagnosticLogsBeforeAsync(DateTimeOffset cutoffUtc, CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM diagnostic_log WHERE created_at < @cutoffUtc;";
        command.Parameters.AddWithValue("@cutoffUtc", cutoffUtc.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture));
        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<DiagnosticLogEntry>> QueryDiagnosticLogsAsync(
        DiagnosticLogQuery query,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        var filters = new List<string>();

        if (!string.Equals(query.NormalizedStatusClass, "all", StringComparison.Ordinal))
        {
            filters.Add("lower(status_class) = @statusClass");
            command.Parameters.AddWithValue("@statusClass", query.NormalizedStatusClass);
        }

        if (!string.Equals(query.NormalizedCategory, "all", StringComparison.Ordinal))
        {
            filters.Add("lower(category) = @category");
            command.Parameters.AddWithValue("@category", query.NormalizedCategory);
        }

        if (!string.IsNullOrWhiteSpace(query.CorrelationId))
        {
            filters.Add("correlation_id = @correlationId");
            command.Parameters.AddWithValue("@correlationId", query.CorrelationId.Trim());
        }

        if (query.NormalizedFromUtc is { } fromUtc)
        {
            filters.Add("created_at >= @fromUtc");
            command.Parameters.AddWithValue("@fromUtc", fromUtc.ToString("O", CultureInfo.InvariantCulture));
        }

        if (query.NormalizedToUtc is { } toUtc)
        {
            filters.Add("created_at <= @toUtc");
            command.Parameters.AddWithValue("@toUtc", toUtc.ToString("O", CultureInfo.InvariantCulture));
        }

        var whereClause = filters.Count > 0
            ? $"WHERE {string.Join(" AND ", filters)}"
            : string.Empty;
        // PopoY: time range（时间范围）查询用于 QT App（Qt 应用）分页展示，默认不再套 500 条上限。
        var limitClause = query.ShouldApplyLimit ? "LIMIT @limit" : string.Empty;
        command.CommandText = $"""
            SELECT
                created_at,
                level,
                category,
                status_class,
                event_name,
                event_stage,
                correlation_id,
                command_name,
                result_code,
                http_status_code,
                duration_ms,
                lease_state,
                device_session_state,
                lease_id,
                target_device_id,
                fencing_token,
                exception_type,
                message
            FROM diagnostic_log
            {whereClause}
            ORDER BY id DESC
            {limitClause};
            """;
        if (query.ShouldApplyLimit)
        {
            command.Parameters.AddWithValue("@limit", query.NormalizedLimit);
        }

        var logs = new List<DiagnosticLogEntry>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            logs.Add(new DiagnosticLogEntry(
                DateTimeOffset.Parse(reader.GetString(0), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.IsDBNull(8) ? null : reader.GetString(8),
                reader.IsDBNull(9) ? null : reader.GetInt32(9),
                reader.IsDBNull(10) ? null : reader.GetInt64(10),
                reader.IsDBNull(11) ? null : reader.GetString(11),
                reader.IsDBNull(12) ? null : reader.GetString(12),
                reader.IsDBNull(13) ? null : reader.GetString(13),
                reader.IsDBNull(14) ? null : reader.GetString(14),
                reader.IsDBNull(15) ? null : reader.GetInt64(15),
                reader.IsDBNull(16) ? null : reader.GetString(16),
                reader.GetString(17)));
        }

        return logs;
    }

    /// <summary>
    /// 在单个事务内保存最小状态快照，并确保 `maxSeenFencingToken（最大已见隔离令牌）` 单调不降。
    /// </summary>
    /// <param name="connection">已初始化的 SQLite 连接。</param>
    /// <param name="transaction">当前事务。</param>
    /// <param name="snapshot">待保存的状态快照。</param>
    /// <param name="currentMaxSeenFencingToken">当前数据库中已存在的最大 token。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static async Task SaveSnapshotCoreAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        DriverStateSnapshot snapshot,
        long currentMaxSeenFencingToken,
        CancellationToken cancellationToken)
    {
        var effectiveMaxSeenFencingToken = Math.Max(currentMaxSeenFencingToken, snapshot.MaxSeenFencingToken);
        await UpsertStateValueAsync(
            connection,
            transaction,
            ActiveLeaseKey,
            snapshot.ActiveLease is null
                ? null
                : JsonSerializer.Serialize(snapshot.ActiveLease, DriverJson.Options),
            cancellationToken).ConfigureAwait(false);
        await UpsertStateValueAsync(
            connection,
            transaction,
            MaxSeenFencingTokenKey,
            effectiveMaxSeenFencingToken.ToString(CultureInfo.InvariantCulture),
            cancellationToken).ConfigureAwait(false);
        await UpsertStateValueAsync(
            connection,
            transaction,
            LeaseStateKey,
            snapshot.LeaseState,
            cancellationToken).ConfigureAwait(false);
        await UpsertStateValueAsync(
            connection,
            transaction,
            DeviceSessionStateKey,
            snapshot.DeviceSessionState,
            cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 读取当前全部审计日志，供测试验证持久化内容使用。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回当前已写入的审计日志列表。</returns>
    public async Task<IReadOnlyList<AuditLogEntry>> ReadAuditLogsForTestsAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenInitializedConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                correlation_id,
                lease_id,
                target_device_id,
                fencing_token,
                command_name,
                duration_ms,
                result_code,
                lease_state,
                device_session_state,
                message
            FROM audit_log
            ORDER BY id;
            """;

        var logs = new List<AuditLogEntry>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            logs.Add(new AuditLogEntry(
                reader.GetString(0),
                reader.IsDBNull(1) ? null : reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetInt64(3),
                reader.GetString(4),
                reader.GetInt64(5),
                reader.GetString(6),
                reader.GetString(7),
                reader.GetString(8),
                reader.GetString(9)));
        }

        return logs;
    }

    /// <summary>
    /// 打开 SQLite 连接并确保 WAL（预写日志）与最小表结构已创建。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回已初始化完成的 SQLite 连接。</returns>
    private async Task<SqliteConnection> OpenInitializedConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = await OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await EnsureSchemaAsync(connection, cancellationToken).ConfigureAwait(false);
        return connection;
    }

    /// <summary>
    /// 打开 SQLite 数据库连接。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回已打开的 SQLite 连接。</returns>
    private async Task<SqliteConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        return connection;
    }

    /// <summary>
    /// 创建最小状态表与审计日志表，并开启 WAL（预写日志）模式。
    /// </summary>
    /// <param name="connection">已打开的 SQLite 连接。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static async Task EnsureSchemaAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await ExecuteAsync(connection, "PRAGMA journal_mode=WAL;", cancellationToken).ConfigureAwait(false);
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS driver_state (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
            """, cancellationToken).ConfigureAwait(false);
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                correlation_id TEXT NOT NULL,
                lease_id TEXT,
                target_device_id TEXT,
                fencing_token INTEGER,
                command_name TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                result_code TEXT NOT NULL,
                lease_state TEXT NOT NULL,
                device_session_state TEXT NOT NULL,
                message TEXT NOT NULL
            );
            """, cancellationToken).ConfigureAwait(false);
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS diagnostic_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                level TEXT NOT NULL,
                category TEXT NOT NULL,
                status_class TEXT NOT NULL,
                event_name TEXT NOT NULL,
                event_stage TEXT,
                correlation_id TEXT,
                command_name TEXT,
                result_code TEXT,
                http_status_code INTEGER,
                duration_ms INTEGER,
                lease_state TEXT,
                device_session_state TEXT,
                lease_id TEXT,
                target_device_id TEXT,
                fencing_token INTEGER,
                exception_type TEXT,
                message TEXT NOT NULL
            );
            """, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 执行不返回结果集的 SQL（结构化查询语言）命令。
    /// </summary>
    /// <param name="connection">已打开的 SQLite 连接。</param>
    /// <param name="sql">待执行的 SQL 语句。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static async Task ExecuteAsync(SqliteConnection connection, string sql, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// 读取当前状态表中的全部键值对。
    /// </summary>
    /// <param name="connection">已初始化的 SQLite 连接。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回键值字典。</returns>
    private static async Task<Dictionary<string, string>> ReadStateValuesAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT key, value FROM driver_state;";

        var values = new Dictionary<string, string>(StringComparer.Ordinal);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            values[reader.GetString(0)] = reader.GetString(1);
        }

        return values;
    }

    /// <summary>
    /// 在当前事务上下文中读取数据库里已经持久化的最大 fencing token（隔离令牌）。
    /// </summary>
    /// <param name="connection">已初始化的 SQLite 连接。</param>
    /// <param name="transaction">当前事务。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>返回当前数据库里的最大 token；若不存在则返回 0。</returns>
    private static async Task<long> ReadCurrentMaxSeenFencingTokenAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT value FROM driver_state WHERE key = @key LIMIT 1;";
        command.Parameters.AddWithValue("@key", MaxSeenFencingTokenKey);

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        if (result is null or DBNull)
        {
            return 0L;
        }

        var value = Convert.ToString(result, CultureInfo.InvariantCulture);
        if (!long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var currentMaxSeenFencingToken))
        {
            throw new InvalidOperationException("驱动状态存储中的 maxSeenFencingToken 数据格式不正确。");
        }

        return currentMaxSeenFencingToken;
    }

    /// <summary>
    /// 将读取到的键值字典组装成最小状态快照。
    /// </summary>
    /// <param name="values">从状态表读取到的键值字典。</param>
    /// <returns>返回组装后的状态快照。</returns>
    private static DriverStateSnapshot CreateSnapshot(IReadOnlyDictionary<string, string> values)
    {
        ActiveLeaseSummary? activeLease = null;
        if (values.TryGetValue(ActiveLeaseKey, out var activeLeaseJson) && !string.IsNullOrWhiteSpace(activeLeaseJson))
        {
            activeLease = JsonSerializer.Deserialize<ActiveLeaseSummary>(activeLeaseJson, DriverJson.Options)
                ?? throw new InvalidOperationException("驱动状态存储中的 activeLease 数据格式不正确。");
        }

        var maxSeenFencingToken = 0L;
        if (values.TryGetValue(MaxSeenFencingTokenKey, out var maxSeenFencingTokenText))
        {
            if (!long.TryParse(maxSeenFencingTokenText, NumberStyles.Integer, CultureInfo.InvariantCulture, out maxSeenFencingToken))
            {
                throw new InvalidOperationException("驱动状态存储中的 maxSeenFencingToken 数据格式不正确。");
            }
        }

        var leaseState = values.TryGetValue(LeaseStateKey, out var savedLeaseState)
            ? savedLeaseState
            : activeLease?.LeaseState ?? LeaseState.None;
        var deviceSessionState = values.TryGetValue(DeviceSessionStateKey, out var savedDeviceSessionState)
            ? savedDeviceSessionState
            : activeLease?.DeviceSessionState ?? DeviceSessionState.Disconnected;

        return new DriverStateSnapshot(activeLease, maxSeenFencingToken, leaseState, deviceSessionState);
    }

    /// <summary>
    /// 以 UPSERT（存在则更新，不存在则插入）方式写入状态值；当值为 null 时删除该键。
    /// </summary>
    /// <param name="connection">已初始化的 SQLite 连接。</param>
    /// <param name="transaction">当前事务。</param>
    /// <param name="key">状态键。</param>
    /// <param name="value">状态值；为 null 时删除。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    private static async Task UpsertStateValueAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string key,
        string? value,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;

        if (value is null)
        {
            command.CommandText = "DELETE FROM driver_state WHERE key = @key;";
            command.Parameters.AddWithValue("@key", key);
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            return;
        }

        command.CommandText = """
            INSERT INTO driver_state (key, value)
            VALUES (@key, @value)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            """;
        command.Parameters.AddWithValue("@key", key);
        command.Parameters.AddWithValue("@value", value);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}

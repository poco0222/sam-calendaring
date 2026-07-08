/**
 * @file PressDeviceCommandExecutorTests.cs - 验证 press working device command（压机作业设备命令）执行器。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 以 TDD（测试驱动开发）锁定 signalName（信号名）写设备、read-back confirmation（回读确认）和 idempotency（幂等）边界。
 */
using Microsoft.Extensions.Logging.Abstractions;
using Sam.Calendaring.DriverService.Commands;
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.Domain;
using Sam.Calendaring.DriverService.Modbus;
using Sam.Calendaring.DriverService.State;

namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 PressDeviceCommandExecutor（压机设备命令执行器）只从 active lease（活跃租约）与 signalConfig（信号配置）解析写点位。
/// </summary>
public sealed class PressDeviceCommandExecutorTests
{
    /// <summary>
    /// 验证 connectMes（建立通信）只写 MES communication status（MES 通信状态），不再触发 press counter clear（下压计数清零）。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task ConnectMes_WritesCommunicationOnly()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("connectMes"), CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal(["MES通信状态"], response.CompletedSteps);
        var write = Assert.Single(adapter.Writes);
        Assert.Equal("MES通信状态", write.SignalName);
        Assert.Equal(true, write.Value);
    }

    /// <summary>
    /// 验证 required signal（必需信号）缺失时 failedSteps（失败步骤）直接返回现场 signalName（信号名）。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task ConnectMes_ReturnsSignalName_WhenRequiredSignalMissing()
    {
        var executor = await CreateExecutorAsync(
            new RecordingModbusAdapter(),
            SignalConfigJson(("下压计数清零", 11, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("connectMes"), CancellationToken.None);

        Assert.Equal(DriverResultCode.SignalNotConfigured, response.ResultCode);
        Assert.Equal(["MES通信状态"], response.FailedSteps);
    }

    /// <summary>
    /// 验证 startDeviceSession（启动设备会话）会在 start signal（开始信号）前触发 press counter clear（下压计数清零）。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task StartDeviceSession_WritesCounterClearBeforeStartSignal()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true),
            ("开始信号", 12, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("startDeviceSession"), CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal(["MES通信状态", "下压计数清零", "开始信号"], response.CompletedSteps);
        Assert.Equal(
            [
                ("MES通信状态", (object)true),
                ("下压计数清零", (object)true),
                ("开始信号", (object)true)
            ],
            adapter.Writes.Select(static write => (write.SignalName, write.Value)).ToArray());
    }

    /// <summary>
    /// 验证 optional start signal（可选开始信号）未配置时按原语义跳过，不影响 required writes（必需写入）。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task StartDeviceSession_SkipsMissingOptionalStartSignal()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("startDeviceSession"), CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal(["MES通信状态", "下压计数清零"], response.CompletedSteps);
        Assert.Equal(
            [
                ("MES通信状态", (object)true),
                ("下压计数清零", (object)true)
            ],
            adapter.Writes.Select(static write => (write.SignalName, write.Value)).ToArray());
    }

    /// <summary>
    /// 验证 startDeviceSession（启动设备会话）在 press counter clear（下压计数清零）失败时不会继续写 start signal（开始信号）。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task StartDeviceSession_StopsBeforeStartSignal_WhenCounterClearFails()
    {
        var adapter = new RecordingModbusAdapter();
        adapter.SetReadback("下压计数清零", false);
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true),
            ("开始信号", 12, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("startDeviceSession"), CancellationToken.None);

        Assert.Equal(DriverResultCode.DeviceRejected, response.ResultCode);
        Assert.Equal(["MES通信状态"], response.CompletedSteps);
        Assert.Equal(["下压计数清零"], response.FailedSteps);
        Assert.DoesNotContain(adapter.Writes, static write => write.SignalName == "开始信号");
    }

    /// <summary>
    /// 验证 preflight（前置校验）会提前检查 optional write（可选写入）授权，且不连接或写入设备。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task PrecheckDeviceCommand_ValidatesOptionalWriteAuthorizationWithoutWriting()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true),
            ("开始信号", 12, "1", false)));

        var response = await executor.PrecheckAsync(CreateRequest("startDeviceSession"), CancellationToken.None);

        Assert.Equal(DriverResultCode.SignalNotWritable, response.ResultCode);
        Assert.Equal(["开始信号"], response.FailedSteps);
        Assert.Empty(adapter.ConnectedEndpoints);
        Assert.Empty(adapter.Writes);
    }

    /// <summary>
    /// 验证 startDeviceSession（启动设备会话）会检查 lease（租约）、scope（作用域）和 writable（可写）信号。
    /// </summary>
    [Fact]
    public async Task StartDeviceSession_PrechecksLeaseScopeAndWritableSignals()
    {
        var noLeaseExecutor = CreateExecutor(new RecordingModbusAdapter(), SqliteDriverStateStore.CreateTempFileForTests());
        var noLeaseResponse = await noLeaseExecutor.ExecuteAsync(CreateRequest("startDeviceSession"), CancellationToken.None);
        Assert.Equal(DriverResultCode.LeaseInvalid, noLeaseResponse.ResultCode);

        var missingScopeExecutor = await CreateExecutorAsync(
            new RecordingModbusAdapter(),
            SignalConfigJson(("MES通信状态", 10, "1", true)),
            allowedScopes: ["pressWorking.readonly"]);
        var missingScopeResponse = await missingScopeExecutor.ExecuteAsync(CreateRequest("startDeviceSession"), CancellationToken.None);
        Assert.Equal(DriverResultCode.CommandNotAllowed, missingScopeResponse.ResultCode);

        var unwritableExecutor = await CreateExecutorAsync(
            new RecordingModbusAdapter(),
            SignalConfigJson(("MES通信状态", 10, "1", false)),
            allowedScopes: ["pressWorking.deviceActions.startDeviceSession"]);
        var unwritableResponse = await unwritableExecutor.ExecuteAsync(CreateRequest("startDeviceSession"), CancellationToken.None);
        Assert.Equal(DriverResultCode.SignalNotWritable, unwritableResponse.ResultCode);
    }

    /// <summary>
    /// 验证 cleanupDeviceSession（清理设备会话）回读失败时进入 CleanupPending（清理待完成）。
    /// </summary>
    [Fact]
    public async Task CleanupDeviceSession_SetsCleanupPending_WhenReadbackFails()
    {
        var adapter = new RecordingModbusAdapter();
        adapter.SetReadback("MES通信状态", true);
        var store = await CreateStoreWithActiveLeaseAsync(SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true)));
        var executor = CreateExecutor(adapter, store);

        var response = await executor.ExecuteAsync(CreateRequest("cleanupDeviceSession"), CancellationToken.None);
        var snapshot = await store.LoadSnapshotAsync(CancellationToken.None);

        Assert.Equal(DriverResultCode.CleanupPending, response.ResultCode);
        Assert.Equal(DeviceSessionState.CleanupPending, response.DeviceSessionState);
        Assert.Equal(DeviceSessionState.CleanupPending, snapshot.DeviceSessionState);
        Assert.Contains("MES通信状态", response.FailedSteps);
    }

    /// <summary>
    /// 验证 cleanupDeviceSession（清理设备会话）会在 complete workflow（完成加工流程）后触发 press counter clear（下压计数清零）脉冲。
    /// </summary>
    /// <remarks>@author PopoY</remarks>
    [Fact]
    public async Task CleanupDeviceSession_PulsesCounterClearForCompleteWorkflow()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("cleanupDeviceSession"), CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal(
            [
                ("MES通信状态", (object)false),
                ("下压计数清零", (object)false),
                ("下压计数清零", (object)true)
            ],
            adapter.Writes.Select(static write => (write.SignalName, write.Value)).ToArray());
    }

    /// <summary>
    /// 验证 moveIn/moveOut/lineIn/lineOut（移入/移出/入线/出线）命令映射到固定 signalName（信号名）。
    /// </summary>
    [Fact]
    public async Task MoveInMoveOutLineInLineOut_MapToSignalNames()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("允许移入", 20, "1", true),
            ("允许移出", 21, "1", true),
            ("是否出线", 22, "1", true)));

        await executor.ExecuteAsync(CreateRequest("moveIn", idempotencyKey: "idem-move-in"), CancellationToken.None);
        await executor.ExecuteAsync(CreateRequest("moveOut", idempotencyKey: "idem-move-out"), CancellationToken.None);
        await executor.ExecuteAsync(CreateRequest("lineIn", idempotencyKey: "idem-line-in"), CancellationToken.None);
        await executor.ExecuteAsync(CreateRequest("lineOut", idempotencyKey: "idem-line-out"), CancellationToken.None);

        Assert.Equal(
            [
                ("允许移入", (object)true),
                ("允许移出", (object)true),
                ("是否出线", (object)false),
                ("是否出线", (object)true)
            ],
            adapter.Writes.Select(static write => (write.SignalName, write.Value)).ToArray());
    }

    /// <summary>
    /// 验证重复 idempotencyKey（幂等键）会 replay（重放）结果，不重复写设备。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_ReplaysIdempotencyKey()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true)));
        var request = CreateRequest("connectMes", idempotencyKey: "idem-connect-replay");

        var first = await executor.ExecuteAsync(request, CancellationToken.None);
        var second = await executor.ExecuteAsync(request, CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, first.ResultCode);
        Assert.Equal(DriverResultCode.IdempotencyReplay, second.ResultCode);
        Assert.Single(adapter.Writes);
    }

    /// <summary>
    /// 验证并发重复 idempotencyKey（幂等键）不会在等待 device gate（设备门闩）后重复写设备。
    /// </summary>
    [Fact]
    public async Task ExecuteDeviceCommand_ReplaysConcurrentDuplicateIdempotencyKey()
    {
        var adapter = new RecordingModbusAdapter { BlockFirstWrite = true };
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(
            ("MES通信状态", 10, "1", true),
            ("下压计数清零", 11, "1", true)));
        var request = CreateRequest("connectMes", idempotencyKey: "idem-connect-concurrent");

        var firstTask = executor.ExecuteAsync(request, CancellationToken.None);
        await adapter.FirstWriteStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
        var secondTask = executor.ExecuteAsync(request, CancellationToken.None);
        adapter.ReleaseFirstWrite();
        var responses = await Task.WhenAll(firstTask, secondTask);

        Assert.Contains(responses, response => response.ResultCode == DriverResultCode.Ok);
        Assert.Contains(responses, response => response.ResultCode == DriverResultCode.IdempotencyReplay);
        Assert.Single(adapter.Writes);
    }

    /// <summary>
    /// 验证授权校验使用最终 Modbus plan address（计划地址），避免 RegisterType=3 的 offsetValue（偏移地址）越权写入。
    /// </summary>
    [Fact]
    public async Task Executor_RejectsWrite_WhenPlannedAddressOutsideAllowedRange()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(
            adapter,
            """{"signals":[{"name":"允许移入","signalName":"允许移入","registerAddress":10,"offsetValue":200,"registerType":"3","writable":true}]}""",
            allowedRanges: ["1-120"]);

        var response = await executor.ExecuteAsync(CreateRequest("moveIn"), CancellationToken.None);

        Assert.Equal(DriverResultCode.SignalNotWritable, response.ResultCode);
        Assert.Empty(adapter.Writes);
    }

    /// <summary>
    /// 验证设备连接失败会收敛成 stable result code（稳定结果码），而不是向 API（接口）抛出 runtime exception（运行时异常）。
    /// </summary>
    [Fact]
    public async Task Executor_ReturnsStableFailure_WhenDeviceConnectFails()
    {
        var executor = await CreateExecutorAsync(
            new ThrowingConnectModbusAdapter(),
            SignalConfigJson(("MES通信状态", 10, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("startDeviceSession"), CancellationToken.None);

        Assert.Equal(DriverResultCode.DeviceRejected, response.ResultCode);
        Assert.Equal(["startDeviceSession"], response.FailedSteps);
    }

    /// <summary>
    /// 验证执行器不读取 HTTP request（HTTP 请求）中的 endpoint/point（端点/点位），只使用 active lease（活跃租约）内配置。
    /// </summary>
    [Fact]
    public async Task Executor_DoesNotReadEndpointOrPointFromRequest()
    {
        var adapter = new RecordingModbusAdapter();
        var executor = await CreateExecutorAsync(adapter, SignalConfigJson(("允许移入", 61, "1", true)));

        var response = await executor.ExecuteAsync(CreateRequest("moveIn", localJobSessionId: "10.0.0.1:502/address/999"), CancellationToken.None);

        Assert.Equal(DriverResultCode.Ok, response.ResultCode);
        Assert.Equal(["192.168.19.110:502"], adapter.ConnectedEndpoints);
        Assert.Equal(61, Assert.Single(adapter.Writes).Address);
    }

    /// <summary>
    /// 创建默认测试请求。
    /// </summary>
    /// <param name="commandName">命令名称。</param>
    /// <param name="idempotencyKey">可选幂等键。</param>
    /// <param name="localJobSessionId">可选本地作业会话 ID。</param>
    /// <returns>返回设备命令请求。</returns>
    private static ExecuteDeviceCommandRequest CreateRequest(
        string commandName,
        string idempotencyKey = "idem-001",
        string localJobSessionId = "press-job-001")
    {
        return new ExecuteDeviceCommandRequest
        {
            CorrelationId = $"cid-{commandName}",
            CommandName = commandName,
            LocalJobSessionId = localJobSessionId,
            IdempotencyKey = idempotencyKey,
            TimeoutMs = 5000
        };
    }

    /// <summary>
    /// 创建带 active lease（活跃租约）的执行器。
    /// </summary>
    /// <param name="adapter">测试 Modbus（工业通信协议）适配器。</param>
    /// <param name="signalConfigJson">测试 signalConfig（信号配置）JSON。</param>
    /// <param name="allowedScopes">可选授权 scope（作用域）。</param>
    /// <returns>返回待测执行器。</returns>
    private static async Task<PressDeviceCommandExecutor> CreateExecutorAsync(
        IModbusAdapter adapter,
        string signalConfigJson,
        IReadOnlyList<string>? allowedScopes = null,
        IReadOnlyList<string>? allowedRanges = null)
    {
        var store = await CreateStoreWithActiveLeaseAsync(signalConfigJson, allowedScopes, allowedRanges);
        return CreateExecutor(adapter, store);
    }

    /// <summary>
    /// 创建执行器并注入最小依赖。
    /// </summary>
    /// <param name="adapter">测试 Modbus（工业通信协议）适配器。</param>
    /// <param name="store">测试状态存储。</param>
    /// <returns>返回待测执行器。</returns>
    private static PressDeviceCommandExecutor CreateExecutor(IModbusAdapter adapter, IDriverStateStore store)
    {
        return new PressDeviceCommandExecutor(
            new DriverStateService(store, NullLogger<DriverStateService>.Instance),
            adapter,
            new PressDeviceIdempotencyStore(),
            TimeProvider.System);
    }

    /// <summary>
    /// 创建已保存 active lease（活跃租约）的临时状态库。
    /// </summary>
    /// <param name="signalConfigJson">测试 signalConfig（信号配置）JSON。</param>
    /// <param name="allowedScopes">可选授权 scope（作用域）。</param>
    /// <returns>返回初始化完成的 SQLite（轻量数据库）状态存储。</returns>
    private static async Task<SqliteDriverStateStore> CreateStoreWithActiveLeaseAsync(
        string signalConfigJson,
        IReadOnlyList<string>? allowedScopes = null,
        IReadOnlyList<string>? allowedRanges = null)
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-001",
            "press-001",
            "192.168.19.110:502",
            signalConfigJson,
            allowedRanges ?? ["1-120"],
            10,
            DateTimeOffset.UtcNow.AddMinutes(10),
            LeaseState.Active,
            DeviceSessionState.Connected)
        {
            AllowedScopes = allowedScopes ?? ["pressWorking.deviceActions"]
        }, CancellationToken.None);
        return store;
    }

    /// <summary>
    /// 生成只包含测试信号点的 signalConfig（信号配置）JSON。
    /// </summary>
    /// <param name="signals">信号名、地址、寄存器类型和可写标记。</param>
    /// <returns>返回 JSON 字符串。</returns>
    private static string SignalConfigJson(params (string SignalName, int Address, string RegisterType, bool Writable)[] signals)
    {
        var body = string.Join(
            ',',
            signals.Select(static signal =>
                $$"""{"name":"{{signal.SignalName}}","signalName":"{{signal.SignalName}}","registerAddress":{{signal.Address}},"registerType":"{{signal.RegisterType}}","writable":{{signal.Writable.ToString().ToLowerInvariant()}}}"""));
        return $$"""{"signals":[{{body}}]}""";
    }

    /// <summary>
    /// 记录连接、写入和回读行为的测试 Modbus adapter（适配器）。
    /// </summary>
    private sealed class RecordingModbusAdapter : IModbusAdapter
    {
        private readonly Dictionary<string, object?> _values = new(StringComparer.Ordinal);
        private readonly Dictionary<string, object?> _readbackOverrides = new(StringComparer.Ordinal);
        private readonly TaskCompletionSource _releaseFirstWrite = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public List<string> ConnectedEndpoints { get; } = [];

        public List<(string SignalName, int Address, object Value)> Writes { get; } = [];

        public bool BlockFirstWrite { get; init; }

        public TaskCompletionSource FirstWriteStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        /// <summary>
        /// 释放被测试阻塞的首次 write（写入）。
        /// </summary>
        public void ReleaseFirstWrite()
        {
            _releaseFirstWrite.TrySetResult();
        }

        /// <summary>
        /// 指定某个 signalName（信号名）的回读覆盖值。
        /// </summary>
        /// <param name="signalName">信号名。</param>
        /// <param name="value">回读值。</param>
        public void SetReadback(string signalName, object? value)
        {
            _readbackOverrides[signalName] = value;
        }

        /// <inheritdoc />
        public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
        {
            ConnectedEndpoints.Add(targetEndpoint);
            return Task.CompletedTask;
        }

        /// <inheritdoc />
        public Task<IDictionary<string, object?>> ReadAsync(
            IReadOnlyList<SignalPoint> points,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            IDictionary<string, object?> values = points.ToDictionary(
                static point => point.EffectiveKey(),
                point => _readbackOverrides.TryGetValue(SignalDisplayName(point), out var readback)
                    ? readback
                    : _values.GetValueOrDefault(point.EffectiveKey()));
            return Task.FromResult(values);
        }

        /// <inheritdoc />
        public Task<object?> ReadIdentityAsync(
            SignalPoint identityProbe,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<object?>(null);
        }

        /// <summary>
        /// 模拟写入并缓存回读值。
        /// </summary>
        /// <param name="point">待写入 signal point（信号点）。</param>
        /// <param name="value">写入值。</param>
        /// <param name="timeout">写入超时。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        /// <returns>返回完成任务。</returns>
        public Task WriteAsync(
            SignalPoint point,
            object value,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            if (BlockFirstWrite && Writes.Count == 0)
            {
                FirstWriteStarted.TrySetResult();
                return WaitAndWriteAsync(point, value, cancellationToken);
            }

            Writes.Add((SignalDisplayName(point), point.EffectiveAddress(), value));
            _values[point.EffectiveKey()] = value;
            return Task.CompletedTask;
        }

        /// <summary>
        /// 等待测试释放后再执行首次 write（写入），用于制造并发幂等场景。
        /// </summary>
        /// <param name="point">待写入 signal point（信号点）。</param>
        /// <param name="value">写入值。</param>
        /// <param name="cancellationToken">取消令牌。</param>
        private async Task WaitAndWriteAsync(SignalPoint point, object value, CancellationToken cancellationToken)
        {
            await _releaseFirstWrite.Task.WaitAsync(cancellationToken);
            Writes.Add((SignalDisplayName(point), point.EffectiveAddress(), value));
            _values[point.EffectiveKey()] = value;
        }

        /// <summary>
        /// 获取测试断言使用的现场 signalName（信号名）。
        /// </summary>
        /// <param name="point">信号点。</param>
        /// <returns>返回可读信号名。</returns>
        /// <remarks>@author PopoY</remarks>
        private static string SignalDisplayName(SignalPoint point)
        {
            return !string.IsNullOrWhiteSpace(point.SignalName)
                ? point.SignalName
                : point.Name;
        }
    }

    /// <summary>
    /// 模拟 connect（连接）失败的 Modbus adapter（适配器）。
    /// </summary>
    private sealed class ThrowingConnectModbusAdapter : IModbusAdapter
    {
        /// <inheritdoc />
        public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
        {
            throw new InvalidOperationException("模拟设备连接失败。");
        }

        /// <inheritdoc />
        public Task<IDictionary<string, object?>> ReadAsync(
            IReadOnlyList<SignalPoint> points,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            throw new InvalidOperationException("不应在连接失败后读取。");
        }

        /// <inheritdoc />
        public Task<object?> ReadIdentityAsync(
            SignalPoint identityProbe,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<object?>(null);
        }
    }
}

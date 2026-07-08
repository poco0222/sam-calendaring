# Task 05: Mock + NModbus Snapshot

> @file Driver Service V1 Mock 与 NModbus 快照任务
> @author PopoY
> @created 2026-06-26
> @purpose 实现 MockModbusAdapter、NModbusAdapter、授权点位读取和 getSignalSnapshot。

## Goal（目标）

Implement `DriverSessionManager（驱动会话管理器）` and two `Adapter（适配器）` modes: `MockModbusAdapter（模拟 Modbus 适配器）` for deterministic verification and `NModbusAdapter（真实 Modbus 适配器）` for real device reads. V1 reads only authorized signal points and never writes device commands.

## Status（状态）

- `Completed（已完成）`：`Step 1/8` 到 `Step 8/8` 已完成，Task5 最小 Mock 与 NModbus 快照链路已落地。

## Progress（进度）

- `2026-06-26`：计划已落库，当前进度 `0/8`。
- `2026-06-26`：已完成 `Step 1/8`。新增 `SignalSnapshotTests` 与 `TestDriverSessionManagerFactory` 两个最小 `RED test（失败测试）` 文件，锁定授权快照、无活跃租约、授权地址过滤与设备超时四个行为边界，当前进度 `1/8`。
- `2026-06-26`：已完成 `Step 2/8`。执行 `cd driver-service && dotnet test --filter FullyQualifiedName~SignalSnapshotTests` 后按预期 `RED（失败）`，当前失败原因为 `Sam.Calendaring.DriverService.Modbus`、`Sam.Calendaring.DriverService.Sessions`、`DriverSessionManager`、`IModbusAdapter`、`SignalPoint` 尚不存在，说明测试已准确钉住 Task5 缺口，当前进度 `2/8`。
- `2026-06-26`：已完成 `Step 3/8`。新增 `SignalConfig`、`SignalPoint` 与 `AuthorizedSignalPlanner`，把租约内 `signalConfig（信号配置）` 解析与 `allowedAddressRanges（授权地址范围）` 过滤收口到独立 `Modbus` 模块，当前进度 `3/8`。
- `2026-06-26`：已完成 `Step 4/8`。新增 `IModbusAdapter` 与 `MockModbusAdapter`，为 `SignalSnapshotTests` 提供可预测的授权点位读取行为，当前进度 `4/8`。
- `2026-06-26`：已完成 `Step 5/8`。补齐 `NModbusAdapter` 最小真实读取边界，并在 `Sam.Calendaring.DriverService.csproj` 引入 `NModbus 3.0.83` 依赖，当前进度 `5/8`。
- `2026-06-26`：已完成 `Step 6/8`。新增 `DriverSessionManager`，串行化活跃租约连接与授权快照读取，并把 `OperationCanceledException` 统一映射为 `DEVICE_TIMEOUT（设备超时）`，当前进度 `6/8`。
- `2026-06-26`：已完成 `Step 7/8`。`Program.cs` 已注册 `IModbusAdapter` 与 `DriverSessionManager`，`/getSignalSnapshot` 已切换到 `DriverSessionManager` 路径；后续边界已调整为 `/applyLeaseAndConfig` 只更新 authorization（授权）并返回 `deviceSessionState（设备会话状态） = Disconnected`，由 `/getSignalSnapshot` 连接设备并推进为 `Connected`；同时更新 `ApiContractTests` 的有效租约预期，当前进度 `7/8`。
- `2026-06-26`：已完成 `Step 8/8`。依次执行 `dotnet test --filter FullyQualifiedName~SignalSnapshotTests`、`dotnet test --filter FullyQualifiedName~SessionStateSqliteTests`、`dotnet test --filter FullyQualifiedName~LeaseValidationTests`、`dotnet test --filter FullyQualifiedName~ApiContractTests` 与 `dotnet build`，结果分别为 `4/4`、`4/4`、`18/18`、`15/15` 通过，且 `dotnet build` 为 `0 warning / 0 error`，当前进度 `8/8`。

## Files（文件）

- Create: `driver-service/src/Sam.Calendaring.DriverService/Modbus/SignalConfig.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Modbus/SignalPoint.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Modbus/IModbusAdapter.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Modbus/MockModbusAdapter.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Modbus/NModbusAdapter.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Modbus/AuthorizedSignalPlanner.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Sessions/DriverSessionManager.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Endpoints/DriverEndpoints.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Modify: `driver-service/src/Sam.Calendaring.DriverService/Sam.Calendaring.DriverService.csproj`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/SignalSnapshotTests.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/TestDriverSessionManagerFactory.cs`
- Modify: `driver-service/tests/Sam.Calendaring.DriverService.Tests/ApiContractTests.cs`

## Steps（步骤）

- [x] **Step 1: Add failing snapshot and authorization tests**

```csharp
/**
 * @file Driver signal snapshot tests.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Tests;

public sealed class SignalSnapshotTests
{
    [Fact]
    public async Task MockModeReturnsAuthorizedSignalValues()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithActiveLeaseAsync("""
            {"signals":[{"name":"pressure","address":100,"type":"holdingRegister"}]}
            """, allowedRanges: ["100-120"]);

        var result = await manager.GetSignalSnapshotAsync("cid-snapshot-001", TimeSpan.FromSeconds(5), CancellationToken.None);

        Assert.Equal("OK", result.ResultCode);
        Assert.True(result.SignalValues.ContainsKey("pressure"));
    }

    [Fact]
    public async Task SnapshotWithoutActiveLeaseReturnsLeaseInvalid()
    {
        var manager = await TestDriverSessionManagerFactory.CreateMockWithoutActiveLeaseAsync();

        var result = await manager.GetSignalSnapshotAsync("cid-snapshot-002", TimeSpan.FromSeconds(5), CancellationToken.None);

        Assert.Equal("LEASE_INVALID", result.ResultCode);
        Assert.Empty(result.SignalValues);
    }

    [Fact]
    public void PlannerKeepsOnlyAllowedAddressRanges()
    {
        var config = SignalConfig.Parse("""
            {"signals":[{"name":"allowed","address":100},{"name":"blocked","address":999}]}
            """);

        var points = AuthorizedSignalPlanner.Plan(config, ["100-120"]);

        Assert.Single(points);
        Assert.Equal("allowed", points[0].Name);
    }

    [Fact]
    public async Task TimeoutReturnsDeviceTimeout()
    {
        var manager = await TestDriverSessionManagerFactory.CreateTimeoutMockAsync();

        var result = await manager.GetSignalSnapshotAsync("cid-snapshot-003", TimeSpan.FromMilliseconds(1), CancellationToken.None);

        Assert.Equal("DEVICE_TIMEOUT", result.ResultCode);
    }
}
```

Add the test factory used by the tests:

```csharp
/**
 * @file Test DriverSessionManager factory.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Tests;

internal static class TestDriverSessionManagerFactory
{
    public static async Task<DriverSessionManager> CreateMockWithActiveLeaseAsync(
        string signalConfigJson,
        IReadOnlyList<string> allowedRanges)
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-001",
            "press-001",
            "192.168.19.110:502",
            signalConfigJson,
            allowedRanges,
            10,
            "Active",
            "Connected"), CancellationToken.None);
        return new DriverSessionManager(store, new MockModbusAdapter());
    }

    public static async Task<DriverSessionManager> CreateMockWithoutActiveLeaseAsync()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        return new DriverSessionManager(store, new MockModbusAdapter());
    }

    public static async Task<DriverSessionManager> CreateTimeoutMockAsync()
    {
        var store = SqliteDriverStateStore.CreateTempFileForTests();
        await store.InitializeAsync(CancellationToken.None);
        await store.SaveActiveLeaseAsync(new ActiveLeaseSummary(
            "lease-timeout",
            "press-001",
            "192.168.19.110:502",
            """{"signals":[{"name":"pressure","address":100}]}""",
            ["100-120"],
            10,
            "Active",
            "Connected"), CancellationToken.None);
        return new DriverSessionManager(store, new TimeoutModbusAdapter());
    }
}

internal sealed class TimeoutModbusAdapter : IModbusAdapter
{
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task<IDictionary<string, object?>> ReadAsync(IReadOnlyList<SignalPoint> points, CancellationToken cancellationToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(30), cancellationToken);
        return new Dictionary<string, object?>();
    }

    public Task<object?> ReadIdentityAsync(SignalPoint identityProbe, CancellationToken cancellationToken) =>
        Task.FromResult<object?>(null);
}
```

- [x] **Step 2: Run tests and confirm RED（失败状态）**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~SignalSnapshotTests
```

Expected: fails because session manager and Modbus adapters do not exist.

- [x] **Step 3: Add signal config and authorization planner**

```csharp
/**
 * @file Signal config model for authorized Modbus reads.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Text.Json;
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.Modbus;

public sealed record SignalConfig(IReadOnlyList<SignalPoint> Signals, SignalPoint? IdentityProbe)
{
    public static SignalConfig Parse(string json) =>
        JsonSerializer.Deserialize<SignalConfig>(json, DriverJson.Options)
        ?? new SignalConfig(Array.Empty<SignalPoint>(), null);
}
```

```csharp
/**
 * @file Signal point model for V1 reads.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Modbus;

public sealed record SignalPoint(string Name, int Address, string Type = "holdingRegister");
```

```csharp
/**
 * @file Authorized signal point planner.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Modbus;

public static class AuthorizedSignalPlanner
{
    public static IReadOnlyList<SignalPoint> Plan(SignalConfig config, IReadOnlyList<string> allowedRanges)
    {
        var ranges = allowedRanges.Select(ParseRange).ToArray();
        return config.Signals
            .Where(signal => ranges.Any(range => signal.Address >= range.Start && signal.Address <= range.End))
            .ToArray();
    }

    private static (int Start, int End) ParseRange(string value)
    {
        var parts = value.Split('-', 2, StringSplitOptions.TrimEntries);
        var start = int.Parse(parts[0], CultureInfo.InvariantCulture);
        var end = parts.Length == 1 ? start : int.Parse(parts[1], CultureInfo.InvariantCulture);
        return (start, end);
    }
}
```

- [x] **Step 4: Add adapter contract and `MockModbusAdapter（模拟 Modbus 适配器）`**

```csharp
/**
 * @file Modbus adapter contract.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Modbus;

public interface IModbusAdapter
{
    Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken);
    Task<IDictionary<string, object?>> ReadAsync(IReadOnlyList<SignalPoint> points, CancellationToken cancellationToken);
    Task<object?> ReadIdentityAsync(SignalPoint identityProbe, CancellationToken cancellationToken);
}
```

```csharp
/**
 * @file Mock Modbus adapter for deterministic V1 verification.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Modbus;

public sealed class MockModbusAdapter : IModbusAdapter
{
    public Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task<IDictionary<string, object?>> ReadAsync(IReadOnlyList<SignalPoint> points, CancellationToken cancellationToken)
    {
        IDictionary<string, object?> values = points.ToDictionary(point => point.Name, point => (object?)point.Address);
        return Task.FromResult(values);
    }

    public Task<object?> ReadIdentityAsync(SignalPoint identityProbe, CancellationToken cancellationToken) =>
        Task.FromResult<object?>("MOCK-IDENTITY");
}
```

- [x] **Step 5: Add `NModbusAdapter（真实 Modbus 适配器）` boundary**

The real adapter must use `NModbus（Modbus 通信库）`; it must not parse raw `ip/port（网络地址/端口）` from request bodies.

```csharp
/**
 * @file Real NModbus adapter for authorized signal reads.
 * @author PopoY
 * @created 2026-06-26
 */
using System.Net.Sockets;
using NModbus;

namespace Sam.Calendaring.DriverService.Modbus;

public sealed class NModbusAdapter : IModbusAdapter
{
    private TcpClient? client;
    private IModbusMaster? master;

    public async Task ConnectAsync(string targetEndpoint, CancellationToken cancellationToken)
    {
        var parts = targetEndpoint.Split(':', 2);
        var host = parts[0];
        var port = int.Parse(parts[1], CultureInfo.InvariantCulture);

        client = new TcpClient();
        await client.ConnectAsync(host, port, cancellationToken).ConfigureAwait(false);
        master = new ModbusFactory().CreateMaster(client);
    }

    public Task<IDictionary<string, object?>> ReadAsync(IReadOnlyList<SignalPoint> points, CancellationToken cancellationToken)
    {
        if (master is null)
        {
            throw new InvalidOperationException("设备尚未连接");
        }

        // PopoY: NModbus sync reads stay inside the adapter so Minimal API handlers only await manager calls.
        return Task.Run<IDictionary<string, object?>>(() =>
            points.ToDictionary(
                point => point.Name,
                point => (object?)master.ReadHoldingRegisters(1, (ushort)point.Address, 1)[0]), cancellationToken);
    }

    public async Task<object?> ReadIdentityAsync(SignalPoint identityProbe, CancellationToken cancellationToken)
    {
        var values = await ReadAsync([identityProbe], cancellationToken).ConfigureAwait(false);
        return values[identityProbe.Name];
    }
}
```

- [x] **Step 6: Add `DriverSessionManager（驱动会话管理器）`**

Use one `SemaphoreSlim（信号量）` for V1 serialization.

```csharp
/**
 * @file Driver session manager for serialized device access.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Sessions;

public sealed class DriverSessionManager(IDriverStateStore stateStore, IModbusAdapter adapter)
{
    // ponytail: V1 supports one active device session; replace with per-device locks if V2 supports multiple devices.
    private readonly SemaphoreSlim gate = new(1, 1);

    public async Task<GetSignalSnapshotResponse> GetSignalSnapshotAsync(
        string correlationId,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);

        await gate.WaitAsync(timeoutCts.Token).ConfigureAwait(false);
        try
        {
            var snapshot = await stateStore.LoadSnapshotAsync(timeoutCts.Token).ConfigureAwait(false);
            if (snapshot.ActiveLease is null || snapshot.LeaseState != "Active")
            {
                return new GetSignalSnapshotResponse(correlationId, "LEASE_INVALID", "当前没有可用租约", new Dictionary<string, object?>());
            }

            var config = SignalConfig.Parse(snapshot.ActiveLease.SignalConfigJson);
            var points = AuthorizedSignalPlanner.Plan(config, snapshot.ActiveLease.AllowedAddressRanges);
            var values = await adapter.ReadAsync(points, timeoutCts.Token).ConfigureAwait(false);
            return new GetSignalSnapshotResponse(correlationId, "OK", "信号快照获取成功", values);
        }
        catch (OperationCanceledException)
        {
            return new GetSignalSnapshotResponse(correlationId, "DEVICE_TIMEOUT", "设备通信超时", new Dictionary<string, object?>());
        }
        finally
        {
            gate.Release();
        }
    }
}
```

- [x] **Step 7: Wire endpoints and adapter selection**

`Program.cs`:

```csharp
builder.Services.AddSingleton<IDriverStateStore>(sp =>
    new SqliteDriverStateStore(builder.Configuration.GetConnectionString("DriverState")!));
builder.Services.AddSingleton<IModbusAdapter>(sp =>
    builder.Configuration["Driver:Mode"] == "Real"
        ? new NModbusAdapter()
        : new MockModbusAdapter());
builder.Services.AddSingleton<DriverSessionManager>();
```

`/getSignalSnapshot` must call `DriverSessionManager（驱动会话管理器）` and respect request `timeoutMs（超时时间）`.

- [x] **Step 8: Verify snapshot behavior**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~SignalSnapshotTests
dotnet test --filter FullyQualifiedName~SessionStateSqliteTests
dotnet test --filter FullyQualifiedName~LeaseValidationTests
dotnet test --filter FullyQualifiedName~ApiContractTests
dotnet build
```

Expected: `Mock` mode returns `signalValues（信号值）`, stale or missing lease fails safely, timeout maps to `DEVICE_TIMEOUT（设备超时）`, and no device endpoint is accepted from `QT App（Qt 应用）` request fields.

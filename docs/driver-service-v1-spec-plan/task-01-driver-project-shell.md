# Task 01: Driver Project Shell

> @file Driver Service V1 项目壳任务
> @author PopoY
> @created 2026-06-26
> @purpose 创建最小 .NET 10 Driver Service 项目壳、Windows Service 承载、本机监听配置与测试工程。

## Goal（目标）

Create the minimal `Driver Service（驱动服务）` workspace so later tasks can add `Minimal API（最小 API）`, `Lease Validation（租约校验）`, `SQLite（嵌入式数据库）`, and `NModbus（Modbus 通信库）` without changing the project shape.

## Status（状态）

- `Done（已完成）`：`Step 1` 到 `Step 7` 已全部完成，`Task1` 项目壳已通过聚焦测试与构建验证。

## Progress（进度）

- `2026-06-26`：计划已落库，当前进度 `0/7`。
- `2026-06-26`：已完成 `Step 1/7`。执行脚手架失败校验，确认 `driver-service（驱动服务目录）` 及目标文件尚不存在，`RED（失败起点）` 符合预期。
- `2026-06-26`：执行中曾受本机 shell 缺少可用 `dotnet` 命令阻塞，后续已补齐 `.NET 10 SDK（软件开发工具包）`。
- `2026-06-26`：已完成 `Step 2/7`。创建 `solution（解决方案）`、服务项目、测试项目与项目引用，并按 `Task1` 边界仅添加 `Microsoft.Extensions.Hosting.WindowsServices`；`SQLite（嵌入式数据库）` 与 `NModbus（Modbus 通信库）` 继续留在后续任务处理。
- `2026-06-26`：已完成 `Step 3/7`。将模板入口替换为 `Minimal API（最小 API）` 宿主，默认绑定 `127.0.0.1:5096`，并保留 `/health` 健康检查端点。
- `2026-06-26`：已完成 `Step 4/7`。新增 `DriverOptions` 与 `HostIdentityOptions`，补齐 `appsettings.json` 的默认本地配置。
- `2026-06-26`：已完成 `Step 5/7`。新增 `DriverWorker` 后台服务空壳，仅保持宿主生命周期，不提前引入任何设备会话逻辑。
- `2026-06-26`：已完成 `Step 6/7`。新增 `ProjectShellTests`，锁定真实 `appsettings.json` 下的 `Mock` 模式、本机回环端口和主机身份配置。
- `2026-06-26`：执行 `Step 7/7` 的首轮验证时，`ProjectShellTests` 因 `appsettings.json` 相对路径少一层目录而失败；已定位为测试路径计算错误，而非宿主或配置错误。
- `2026-06-26`：已完成 `Step 7/7`。修正测试路径后，`dotnet test --filter FullyQualifiedName~ProjectShellTests` 通过，`dotnet build` 通过，目标文件存在性检查通过，当前进度 `7/7`。
- `2026-06-26`：根据代码审查结果，已移除 `Step 2` 命令块中越界的 `Microsoft.Data.Sqlite` 与 `NModbus` 依赖安装命令，保持 `Task1` 文档与实际实现边界一致。

## Files（文件）

- Create: `driver-service/DriverService.sln`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Sam.Calendaring.DriverService.csproj`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Program.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/DriverWorker.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/appsettings.json`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Options/DriverOptions.cs`
- Create: `driver-service/src/Sam.Calendaring.DriverService/Options/HostIdentityOptions.cs`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/ProjectShellTests.cs`

## Steps（步骤）

- [x] **Step 1: Run the failing scaffold check**

```bash
bash -lc 'test -f driver-service/DriverService.sln && test -f driver-service/src/Sam.Calendaring.DriverService/Program.cs && test -f driver-service/tests/Sam.Calendaring.DriverService.Tests/ProjectShellTests.cs'
```

Expected: exit code `1` because the `Driver Service（驱动服务）` workspace does not exist yet.

- [x] **Step 2: Create the solution and project layout**

```bash
mkdir -p driver-service/src driver-service/tests
cd driver-service
dotnet new sln -n DriverService
dotnet new web -n Sam.Calendaring.DriverService -o src/Sam.Calendaring.DriverService --framework net10.0
dotnet new xunit -n Sam.Calendaring.DriverService.Tests -o tests/Sam.Calendaring.DriverService.Tests --framework net10.0
dotnet sln add src/Sam.Calendaring.DriverService/Sam.Calendaring.DriverService.csproj
dotnet sln add tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj
dotnet add tests/Sam.Calendaring.DriverService.Tests/Sam.Calendaring.DriverService.Tests.csproj reference src/Sam.Calendaring.DriverService/Sam.Calendaring.DriverService.csproj
dotnet add src/Sam.Calendaring.DriverService/Sam.Calendaring.DriverService.csproj package Microsoft.Extensions.Hosting.WindowsServices
```

Expected: solution, service project, and test project are created with `net10.0`.

- [x] **Step 3: Add minimal hosting and loopback binding**

`Program.cs` must keep `Driver Service（驱动服务）` local by default and prepare `Worker Service（工作服务）` + `Windows Service（Windows 服务）` hosting.

```csharp
/**
 * @file Driver Service application entrypoint.
 * @author PopoY
 * @created 2026-06-26
 */
using Sam.Calendaring.DriverService;
using Sam.Calendaring.DriverService.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseWindowsService(options =>
{
    options.ServiceName = "SAM Calendaring Driver Service";
});

builder.Services.Configure<DriverOptions>(builder.Configuration.GetSection("Driver"));
builder.Services.Configure<HostIdentityOptions>(builder.Configuration.GetSection("HostIdentity"));
builder.Services.AddHostedService<DriverWorker>();

var app = builder.Build();

// PopoY: health check proves local service hosting before API contract tasks add business endpoints.
app.MapGet("/health", () => Results.Json(new { resultCode = "OK", message = "驱动服务运行中" }));

app.Run();

public partial class Program;
```

- [x] **Step 4: Add options classes and default config**

```csharp
/**
 * @file Driver mode and local listener options.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Options;

public sealed class DriverOptions
{
    /// <summary>Driver mode selected by local config.</summary>
    public string Mode { get; init; } = "Mock";

    /// <summary>Loopback port for QT App local HTTP calls.</summary>
    public int Port { get; init; } = 5096;
}
```

```csharp
/**
 * @file Local host identity options used by lease validation.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService.Options;

public sealed class HostIdentityOptions
{
    /// <summary>Host id expected in signedLease.granteeHostId.</summary>
    public string GranteeHostId { get; init; } = "SAM-LOCAL-HOST";

    /// <summary>Public key PEM used for offline signature verification.</summary>
    public string PublicKeyPem { get; init; } = "";
}
```

`appsettings.json`:

```json
{
  "Urls": "http://127.0.0.1:5096",
  "Driver": {
    "Mode": "Mock",
    "Port": 5096
  },
  "HostIdentity": {
    "GranteeHostId": "SAM-LOCAL-HOST",
    "PublicKeyPem": ""
  },
  "ConnectionStrings": {
    "DriverState": "Data Source=driver-state.db"
  }
}
```

- [x] **Step 5: Add the background worker shell**

```csharp
/**
 * @file Driver background worker shell.
 * @author PopoY
 * @created 2026-06-26
 */
namespace Sam.Calendaring.DriverService;

public sealed class DriverWorker(ILogger<DriverWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("驱动服务后台任务已启动");
        await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken).ConfigureAwait(false);
    }
}
```

- [x] **Step 6: Add project shell tests**

```csharp
/**
 * @file Driver Service project shell tests.
 * @author PopoY
 * @created 2026-06-26
 */
using Microsoft.Extensions.Configuration;
using Sam.Calendaring.DriverService.Options;

namespace Sam.Calendaring.DriverService.Tests;

public sealed class ProjectShellTests
{
    [Fact]
    public void DefaultConfigBindsDriverToMockModeAndLoopbackPort()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Driver:Mode"] = "Mock",
                ["Driver:Port"] = "5096",
                ["HostIdentity:GranteeHostId"] = "SAM-LOCAL-HOST"
            })
            .Build();

        var driverOptions = config.GetSection("Driver").Get<DriverOptions>();
        var hostOptions = config.GetSection("HostIdentity").Get<HostIdentityOptions>();

        Assert.Equal("Mock", driverOptions?.Mode);
        Assert.Equal(5096, driverOptions?.Port);
        Assert.Equal("SAM-LOCAL-HOST", hostOptions?.GranteeHostId);
    }
}
```

- [x] **Step 7: Verify the shell**

```bash
cd driver-service
dotnet test --filter FullyQualifiedName~ProjectShellTests
dotnet build
bash -lc 'test -f src/Sam.Calendaring.DriverService/Program.cs && test -f tests/Sam.Calendaring.DriverService.Tests/ProjectShellTests.cs'
```

Expected: focused tests pass, build exits with code `0`, and scaffold files exist.

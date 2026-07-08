# Task 01: Logging Contract and AGENTS Rules

> @file Driver Service V1 日志契约与代理规则任务
> @author PopoY
> @created 2026-06-27
> @purpose 固化日志字段、敏感信息禁令和项目根目录 AGENTS.md（代理规则文档）约束。

## Goal（目标）

Create the project-level `AGENTS.md（代理规则文档）` and executable guards that prevent direct console logging and keep logging rules visible before storage or UI work begins.

## Status（状态）

- `Completed（已完成）`: Task1 已完成；commit（提交）因 workspace（工作区）不是 Git repository（版本库）而跳过。

## Progress（进度）

- `2026-06-27`: Step 1 完成，已新增 `LoggingContractTests.cs` 契约测试，当前进度 `1/5`。
- `2026-06-27`: Step 2 完成，`dotnet test --filter "FullyQualifiedName~LoggingContractTests"` 失败符合预期：`AGENTS.md` 不存在；当前进度 `2/5`。
- `2026-06-27`: Step 3 完成，已创建项目根目录 `AGENTS.md` 并固化 logging rules（日志规则）；当前进度 `3/5`。
- `2026-06-27`: Step 4 完成，`dotnet test --filter "FullyQualifiedName~LoggingContractTests"` 通过：2 passed（通过）、0 failed（失败）；当前进度 `4/5`。
- `2026-06-27`: Step 5 完成，`git status --short --branch` 在项目根目录和 `driver-service` 均返回 `fatal: not a git repository`，commit skipped（提交跳过）；当前进度 `5/5`。
- `2026-06-27`: Regression verification（回归验证）完成，`dotnet test` 通过：75 passed（通过）、0 failed（失败）。

## Files（文件）

- Create: `AGENTS.md`
- Create: `driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs`

## Steps（步骤）

- [x] **Step 1: Write failing contract tests（编写失败契约测试）**

Create `driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs`:

```csharp
/**
 * @file LoggingContractTests.cs
 * @author PopoY
 * @created 2026-06-27
 * @purpose 验证 Driver Service V1 logging contract（日志契约）与 AGENTS.md（代理规则文档）已落库。
 */
namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证日志实现前必须存在的项目规则与静态边界。
/// </summary>
public sealed class LoggingContractTests
{
    /// <summary>
    /// 验证项目根目录 AGENTS.md（代理规则文档）包含日志硬约束。
    /// </summary>
    [Fact]
    public void AgentsRulesDocumentPinsLoggingBoundaries()
    {
        var repositoryRoot = FindRepositoryRoot();
        var agentsPath = Path.Combine(repositoryRoot, "AGENTS.md");

        Assert.True(File.Exists(agentsPath), "项目根目录必须存在 AGENTS.md。");

        var content = File.ReadAllText(agentsPath);
        Assert.Contains("ILogger（日志抽象）", content, StringComparison.Ordinal);
        Assert.Contains("diagnostic_log（诊断日志表）", content, StringComparison.Ordinal);
        Assert.Contains("signedLease（签名租约）", content, StringComparison.Ordinal);
        Assert.Contains("correlationId（关联 ID）", content, StringComparison.Ordinal);
        Assert.Contains("@author PopoY", content, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证 Driver Service（驱动服务）源码不得使用 Console.WriteLine 作为日志通道。
    /// </summary>
    [Fact]
    public void DriverServiceSourceDoesNotUseConsoleWriteLineForLogging()
    {
        var repositoryRoot = FindRepositoryRoot();
        var sourceRoot = Path.Combine(
            repositoryRoot,
            "driver-service",
            "src",
            "Sam.Calendaring.DriverService");

        var files = Directory.GetFiles(sourceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                && !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal));

        var combinedSource = string.Join('\n', files.Select(File.ReadAllText));

        Assert.DoesNotContain("Console.WriteLine", combinedSource, StringComparison.Ordinal);
    }

    /// <summary>
    /// 从测试输出目录向上查找项目根目录。
    /// </summary>
    /// <returns>返回包含 docs（文档目录）和 driver-service（驱动服务目录）的项目根目录。</returns>
    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "docs"))
                && Directory.Exists(Path.Combine(current.FullName, "driver-service")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new InvalidOperationException("未找到 sam-calendaring 项目根目录。");
    }
}
```

- [x] **Step 2: Run test to confirm RED（确认失败状态）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~LoggingContractTests"
```

Expected（期望）: FAIL because `AGENTS.md（代理规则文档）` does not exist yet.

- [x] **Step 3: Create AGENTS.md（创建代理规则文档）**

Create `AGENTS.md`:

```markdown
# AGENTS.md

> @file sam-calendaring 代理规则文档
> @author PopoY
> @created 2026-06-27
> @purpose 固化 Driver Service（驱动服务）日志、QT App（Qt 应用）诊断页和敏感信息边界。

## Logging Rules（日志规则）

1. 所有 Driver Service（驱动服务）新增日志必须使用 `ILogger（日志抽象）`、`audit_log（审计日志表）` 或 `diagnostic_log（诊断日志表）`，不得直接使用 `Console.WriteLine`。
2. 日志字段名使用稳定 English identifier（英文标识），日志正文、错误说明、排查建议必须中文。
3. 严禁记录完整 `signedLease（签名租约）`、`signature（签名）`、`signature payload（签名原文）`、`signalConfig（信号配置）` 原文、`privateKey（私钥）`、`credential（凭据）` 或 `sessionToken（会话令牌）`。
4. 第三方异常不得大段写入常规日志；只允许记录 `exceptionType（异常类型）`、中文摘要、hash（哈希）和 `correlationId（关联 ID）`。
5. 每个外部请求必须能用 `correlationId（关联 ID）` 串联 `RequestReceived -> ActionStarted/Completed -> ResponseSent -> audit_log/diagnostic_log（审计日志/诊断日志）`。
6. 不得为了日志让 QT App（Qt 应用）额外传裸 `ip（网络地址）`、`port（端口）` 或 `deviceId（设备 ID）`。
7. Diagnostic Logs Page（诊断日志页面）必须遵循 `docs/driver-service-v1-logging-spec.md` 的 Frontend Design Contract（前端设计契约），不得引入新的视觉体系。
8. 所有新增或修改代码注释必须包含 `@author PopoY` 的文件头，说明文字必须中文或中英混合，不能全英文。
```

- [x] **Step 4: Run focused verification（运行聚焦验证）**

Run:

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~LoggingContractTests"
```

Result（结果）: 2 passed（通过）、0 failed（失败）。

Expected（期望）: PASS.

- [x] **Step 5: Commit（提交）**

Execution note（执行记录）: commit skipped（提交跳过），因为 `/Users/PopoY/workingFiles/Projects/SAM/sam-calendaring` 和 `driver-service` 均不是 Git repository（版本库），且当前任务不初始化新仓库。

```bash
git add AGENTS.md driver-service/tests/Sam.Calendaring.DriverService.Tests/LoggingContractTests.cs
git commit -m "test: 固化 Driver Service logging 契约"
```

If this workspace remains not a Git repository（Git 仓库）, skip commit and record that in the execution note.

## Verification（验证）

```bash
cd driver-service
dotnet test --filter "FullyQualifiedName~LoggingContractTests"
```

Result（结果）: 2 passed（通过）、0 failed（失败）。

Regression（回归）:

```bash
cd driver-service
dotnet test
```

Result（结果）: 75 passed（通过）、0 failed（失败）。

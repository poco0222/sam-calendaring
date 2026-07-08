/**
 * @file LoggingContractTests.cs - 验证 logging contract（日志契约）和 AGENTS.md（代理规则文档）。
 * @author PopoY
 * @created 2026-06-27
 * @purpose 验证 Driver Service V1 logging contract（日志契约）与 AGENTS.md（代理规则文档）已落库。
 */
using Sam.Calendaring.DriverService.Contracts;
using Sam.Calendaring.DriverService.State;

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
        Assert.Contains("signature（签名）", content, StringComparison.Ordinal);
        Assert.Contains("signature payload（签名原文）", content, StringComparison.Ordinal);
        Assert.Contains("signalConfig（信号配置）", content, StringComparison.Ordinal);
        Assert.Contains("privateKey（私钥）", content, StringComparison.Ordinal);
        Assert.Contains("credential（凭据）", content, StringComparison.Ordinal);
        Assert.Contains("sessionToken（会话令牌）", content, StringComparison.Ordinal);
        Assert.Contains("ip（网络地址）", content, StringComparison.Ordinal);
        Assert.Contains("port（端口）", content, StringComparison.Ordinal);
        Assert.Contains("deviceId（设备 ID）", content, StringComparison.Ordinal);
        Assert.Contains("exceptionType（异常类型）", content, StringComparison.Ordinal);
        Assert.Contains("hash（哈希）", content, StringComparison.Ordinal);
        Assert.Contains("correlationId（关联 ID）", content, StringComparison.Ordinal);
        Assert.Contains("@author PopoY", content, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证 Driver Service（驱动服务）源码不得使用 Console.WriteLine 作为日志通道。
    /// </summary>
    [Fact]
    public void DriverServiceSourceDoesNotUseConsoleWriteLineForLogging()
    {
        // PopoY: 合并源码文本，使用最小 static guard（静态防线）锁住日志通道。
        var combinedSource = ReadDriverServiceSource();

        Assert.DoesNotContain("Console.WriteLine", combinedSource, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证 Driver Service（驱动服务）源码包含 Request/Audit（请求/审计）生命周期事件。
    /// </summary>
    [Fact]
    public void DriverServiceSourceContainsRequestAndAuditLifecycleEvents()
    {
        var combinedSource = ReadDriverServiceSource();

        Assert.Contains("RequestReceived", combinedSource, StringComparison.Ordinal);
        Assert.Contains("RequestContractValidationFailed", combinedSource, StringComparison.Ordinal);
        Assert.Contains("RequestRejected", combinedSource, StringComparison.Ordinal);
        Assert.Contains("RequestCompleted", combinedSource, StringComparison.Ordinal);
        Assert.Contains("ActionStarted", combinedSource, StringComparison.Ordinal);
        Assert.Contains("ActionCompleted", combinedSource, StringComparison.Ordinal);
        Assert.Contains("AuditLogAppendStarted", combinedSource, StringComparison.Ordinal);
        Assert.Contains("AuditLogAppendCompleted", combinedSource, StringComparison.Ordinal);
        Assert.Contains("AuditLogAppendFailed", combinedSource, StringComparison.Ordinal);
        Assert.Contains("ResponseSent", combinedSource, StringComparison.Ordinal);
    }

    /// <summary>
    /// 验证 diagnostic/audit log（诊断/审计日志）会拦截 Task7（任务七）禁止的设备动作原始字段。
    /// </summary>
    /// <author>PopoY</author>
    [Fact]
    public void DriverLogsSanitizePressDeviceActionSensitiveFragments()
    {
        const string sensitiveMessage = """
            {"targetEndpoint":"10.0.0.1:502","registerAddress":100,"writeValue":true,"signalValues":{"pressDownCount":5},"snapshotValues":[{"signalCode":"deviceId"}],"deviceId":"press-001","ip":"10.0.0.1","port":502}
            """;

        var diagnosticLog = DiagnosticLogEntry.Create(
            level: "Warning",
            category: "Execution",
            eventName: "ActionCompleted",
            message: sensitiveMessage,
            correlationId: "cid-sensitive-01",
            commandName: "lineOut",
            resultCode: DriverResultCode.DeviceRejected);
        var auditLog = AuditLogEntry.CreateSanitized(
            correlationId: "cid-sensitive-01",
            commandName: "lineOut",
            durationMs: 12,
            resultCode: DriverResultCode.Ok,
            leaseState: "Active",
            deviceSessionState: "Connected",
            message: sensitiveMessage);

        Assert.DoesNotContain("registerAddress", diagnosticLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("writeValue", diagnosticLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signalValues", diagnosticLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("snapshotValues", diagnosticLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("registerAddress", auditLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("targetEndpoint", auditLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("writeValue", auditLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signalValues", auditLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("snapshotValues", auditLog.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 验证 audit log sanitizer（审计日志清洗器）会清洗 targetEndpoint（目标端点）。
    /// </summary>
    /// <author>PopoY</author>
    [Fact]
    public void AuditLogEntrySanitizesTargetEndpoint()
    {
        var auditLog = AuditLogEntry.CreateSanitized(
            correlationId: "cid-target-endpoint-01",
            commandName: "lineOut",
            durationMs: 12,
            resultCode: DriverResultCode.DeviceRejected,
            leaseState: "Active",
            deviceSessionState: "Connected",
            message: """{"targetEndpoint":"10.0.0.1:502"}""");

        Assert.DoesNotContain("targetEndpoint", auditLog.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("设备拒绝执行", auditLog.Message);
    }

    /// <summary>
    /// 验证 diagnostic/audit log（诊断/审计日志）不会落库结构化目标设备字段。
    /// </summary>
    /// <author>PopoY</author>
    [Fact]
    public void DriverLogsDropStructuredTargetDeviceFields()
    {
        var diagnosticLog = DiagnosticLogEntry.Create(
            level: "Warning",
            category: "Execution",
            eventName: "ActionCompleted",
            message: "设备动作失败",
            correlationId: "cid-structured-01",
            commandName: "lineOut",
            resultCode: DriverResultCode.DeviceRejected,
            targetDeviceId: "press-001",
            fencingToken: 11);
        var auditLog = AuditLogEntry.CreateSanitized(
            correlationId: "cid-structured-01",
            commandName: "lineOut",
            durationMs: 12,
            resultCode: DriverResultCode.DeviceRejected,
            leaseState: "Active",
            deviceSessionState: "Connected",
            message: "设备动作失败",
            targetDeviceId: "press-001",
            fencingToken: 11);

        Assert.Null(diagnosticLog.TargetDeviceId);
        Assert.Null(diagnosticLog.FencingToken);
        Assert.Null(auditLog.TargetDeviceId);
        Assert.Null(auditLog.FencingToken);
    }

    /// <summary>
    /// 验证源码文件头 @file 说明使用中文或中英混合描述。
    /// </summary>
    /// <author>PopoY</author>
    [Fact]
    public void SourceFileHeadersUseChineseOrMixedFileDescriptions()
    {
        var repositoryRoot = FindRepositoryRoot();
        var invalidHeaders = EnumerateProjectSourceFiles(repositoryRoot)
            .SelectMany(file => ValidateSourceFileHeader(repositoryRoot, file))
            .ToArray();

        Assert.True(
            invalidHeaders.Length == 0,
            "文件头必须存在、包含 @author PopoY，且说明必须包含中文或中英混合描述：" + Environment.NewLine
                + string.Join(Environment.NewLine, invalidHeaders));
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

    /// <summary>
    /// 读取 Driver Service（驱动服务）生产源码并排除 build output（构建输出）。
    /// </summary>
    /// <returns>返回合并后的源码文本。</returns>
    private static string ReadDriverServiceSource()
    {
        var repositoryRoot = FindRepositoryRoot();
        var sourceRoot = Path.Combine(
            repositoryRoot,
            "driver-service",
            "src",
            "Sam.Calendaring.DriverService");

        var files = Directory.GetFiles(sourceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(static path => !path.Contains(
                    $"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}",
                    StringComparison.Ordinal)
                && !path.Contains(
                    $"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}",
                    StringComparison.Ordinal));

        return string.Join('\n', files.Select(File.ReadAllText));
    }

    /// <summary>
    /// 枚举需要执行 AGENTS.md（代理规则文档）文件头规则的源码文件。
    /// </summary>
    /// <author>PopoY</author>
    /// <param name="repositoryRoot">sam-calendaring 项目根目录。</param>
    /// <returns>返回需要检查的源码文件路径。</returns>
    private static IEnumerable<string> EnumerateProjectSourceFiles(string repositoryRoot)
    {
        var sourceRoots = new[]
        {
            Path.Combine(repositoryRoot, "driver-service", "src", "Sam.Calendaring.DriverService"),
            Path.Combine(repositoryRoot, "driver-service", "tests", "Sam.Calendaring.DriverService.Tests"),
            Path.Combine(repositoryRoot, "qt-app", "frontend", "src"),
            Path.Combine(repositoryRoot, "qt-app", "native", "src"),
            Path.Combine(repositoryRoot, "qt-app", "native", "tests")
        };
        var patterns = new[] { "*.cs", "*.ts", "*.tsx", "*.css", "*.cpp", "*.h" };

        return sourceRoots
            .Where(Directory.Exists)
            .SelectMany(root => patterns.SelectMany(pattern =>
                Directory.GetFiles(root, pattern, SearchOption.AllDirectories)))
            .Where(static path => !path.Contains(
                    $"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}",
                    StringComparison.Ordinal)
                && !path.Contains(
                    $"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}",
                    StringComparison.Ordinal));
    }

    /// <summary>
    /// 校验单个源码文件的文件头规则。
    /// </summary>
    /// <author>PopoY</author>
    /// <param name="repositoryRoot">sam-calendaring 项目根目录。</param>
    /// <param name="file">待检查源码文件。</param>
    /// <returns>返回文件头违规描述；无违规时返回空序列。</returns>
    private static IEnumerable<string> ValidateSourceFileHeader(string repositoryRoot, string file)
    {
        var relativePath = Path.GetRelativePath(repositoryRoot, file);
        var headerLines = ReadTopFileHeaderLines(file).ToArray();

        if (headerLines.Length == 0)
        {
            yield return $"{relativePath}:1 缺少顶部文件头 block comment（块注释）";
            yield break;
        }

        if (!headerLines.Any(static header => header.Line.StartsWith("* @author PopoY", StringComparison.Ordinal)))
        {
            yield return $"{relativePath}:1 文件头缺少 @author PopoY";
        }

        foreach (var header in headerLines.Where(static header =>
            (header.Line.StartsWith("* @file", StringComparison.Ordinal)
                || header.Line.StartsWith("* @brief", StringComparison.Ordinal))
            && !ContainsChineseCharacter(header.Line)))
        {
            yield return $"{relativePath}:{header.LineNumber} {header.Line}";
        }
    }

    /// <summary>
    /// 读取文件开头第一个 block comment（块注释）作为文件头。
    /// </summary>
    /// <author>PopoY</author>
    /// <param name="file">待检查源码文件。</param>
    /// <returns>返回文件头注释块中的行号和去空白文本。</returns>
    private static IEnumerable<(int LineNumber, string Line)> ReadTopFileHeaderLines(string file)
    {
        var lineNumber = 0;
        var inHeader = false;

        foreach (var line in File.ReadLines(file))
        {
            lineNumber += 1;
            var trimmed = line.Trim();

            if (lineNumber == 1)
            {
                if (!trimmed.StartsWith("/**", StringComparison.Ordinal))
                {
                    yield break;
                }

                inHeader = true;
            }

            if (!inHeader)
            {
                yield break;
            }

            yield return (lineNumber, trimmed);

            if (trimmed.EndsWith("*/", StringComparison.Ordinal))
            {
                yield break;
            }
        }
    }

    /// <summary>
    /// 判断文本是否包含中文字符，用于阻止纯英文文件头回归。
    /// </summary>
    /// <author>PopoY</author>
    /// <param name="value">待检查文本。</param>
    /// <returns>包含中文字符时返回 true。</returns>
    private static bool ContainsChineseCharacter(string value)
    {
        return value.Any(static character =>
            character is >= '\u4e00' and <= '\u9fff'
                or >= '\u3400' and <= '\u4dbf'
                or >= '\uf900' and <= '\ufaff');
    }
}

/**
 * @file NoErpAccessTests.cs - 验证 Driver Service（驱动服务）不直接访问 ERP（企业资源计划系统）。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 锁定 Driver Service 源码目录不存在 ERP 访问入口。
 */
namespace Sam.Calendaring.DriverService.Tests;

/// <summary>
/// 验证 Driver Service 源码目录不包含 ERP 配置或 HTTP 客户端接入痕迹。
/// </summary>
public sealed class NoErpAccessTests
{
    private static readonly string SourceRoot = Path.GetFullPath(
        Path.Combine(
            AppContext.BaseDirectory,
            "..",
            "..",
            "..",
            "..",
            "..",
            "src",
            "Sam.Calendaring.DriverService"));

    /// <summary>
    /// 验证源码目录中不存在 ErpBaseUrl、ERP_BASE_URL 或 AddHttpClient。
    /// </summary>
    [Fact]
    public void DriverServiceSourceContainsNoErpAccessMarkers()
    {
        var files = Directory.EnumerateFiles(SourceRoot, "*", SearchOption.AllDirectories)
            .Where(static path => IsAllowedSourceFile(path))
            .ToArray();

        Assert.NotEmpty(files);

        var violations = files
            .Select(path => new
            {
                Path = path,
                Content = File.ReadAllText(path)
            })
            .SelectMany(file => FindForbiddenMarkers(file.Path, file.Content))
            .ToArray();

        Assert.True(violations.Length == 0, string.Join(Environment.NewLine, violations));
    }

    /// <summary>
    /// 判断文件是否属于受扫描的源码类型，并排除 bin/obj 生成目录。
    /// </summary>
    /// <param name="path">待判断的文件绝对路径。</param>
    /// <returns>命中允许后缀且不在生成目录中时返回 true。</returns>
    private static bool IsAllowedSourceFile(string path)
    {
        if (path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
            || path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
        {
            return false;
        }

        return path.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith(".json", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 扫描单个文件内容中的禁止标记。
    /// </summary>
    /// <param name="path">当前文件路径。</param>
    /// <param name="content">当前文件内容。</param>
    /// <returns>返回命中的违规描述列表。</returns>
    private static IEnumerable<string> FindForbiddenMarkers(string path, string content)
    {
        var forbiddenMarkers = new[] { "ErpBaseUrl", "ERP_BASE_URL", "AddHttpClient" };

        foreach (var marker in forbiddenMarkers)
        {
            if (content.Contains(marker, StringComparison.Ordinal))
            {
                yield return $"{path}: {marker}";
            }
        }
    }
}

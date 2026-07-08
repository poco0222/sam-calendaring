/**
 * @file PressDeviceCommandCatalog.cs - 定义 press working device command（压机作业设备命令）目录。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 将 commandName（命令名）映射到 ERP legacy signalName（旧信号名）与写入值。
 */
namespace Sam.Calendaring.DriverService.Commands;

/// <summary>
/// 提供 Task2 支持的 device command（设备命令）目录。
/// </summary>
public static class PressDeviceCommandCatalog
{
    public const string BaseScope = "pressWorking.deviceActions";

    private static readonly IReadOnlyDictionary<string, PressDeviceCommandDefinition> Commands =
        new Dictionary<string, PressDeviceCommandDefinition>(StringComparer.Ordinal)
        {
            ["connectMes"] = Define(
                "connectMes",
                required: [Step("MES通信状态", true)]),
            ["precheckForStart"] = Define("precheckForStart"),
            ["startDeviceSession"] = Define(
                "startDeviceSession",
                required: [Step("MES通信状态", true), Step("下压计数清零", true)],
                optional: [Step("开始信号", true)]),
            ["startPressDownCountMonitor"] = Define("startPressDownCountMonitor"),
            ["stopPressDownCountMonitor"] = Define("stopPressDownCountMonitor"),
            ["rollbackStartSignal"] = Define(
                "rollbackStartSignal",
                optional: [Step("开始信号", false)]),
            ["cleanupDeviceSession"] = Define(
                "cleanupDeviceSession",
                optional:
                [
                    Step("MES通信状态", false),
                    Step("下压计数清零", false),
                    Step("下压计数清零", true)
                ]),
            ["moveIn"] = Define("moveIn", required: [Step("允许移入", true)]),
            ["moveOut"] = Define("moveOut", required: [Step("允许移出", true)]),
            ["lineIn"] = Define("lineIn", required: [Step("是否出线", false)]),
            ["lineOut"] = Define("lineOut", required: [Step("是否出线", true)])
        };

    /// <summary>
    /// 获取当前 Task2 支持的 commandName（命令名）集合。
    /// </summary>
    public static IReadOnlyCollection<string> KnownCommandNames => Commands.Keys.ToArray();

    /// <summary>
    /// 尝试查找 command definition（命令定义）。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <param name="definition">输出命令定义。</param>
    /// <returns>命中目录时返回 true。</returns>
    public static bool TryGet(string commandName, out PressDeviceCommandDefinition definition)
    {
        return Commands.TryGetValue(commandName, out definition!);
    }

    /// <summary>
    /// 判断给定 scope（作用域）是否允许执行命令。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <param name="allowedScopes">租约授权 scope（作用域）列表。</param>
    /// <returns>允许执行时返回 true。</returns>
    public static bool IsScopeAllowed(string commandName, IReadOnlyList<string> allowedScopes)
    {
        return allowedScopes.Any(scope =>
            string.Equals(scope, BaseScope, StringComparison.Ordinal)
            || string.Equals(scope, $"{BaseScope}.{commandName}", StringComparison.Ordinal));
    }

    /// <summary>
    /// 获取 commandName（命令名）对应的中文动作名，用于 diagnostic log（诊断日志）。
    /// </summary>
    /// <param name="commandName">Driver Service（驱动服务）收到的命令名。</param>
    /// <returns>返回现场可读的中文动作名。</returns>
    /// <remarks>@author PopoY</remarks>
    public static string GetDisplayName(string? commandName)
    {
        return commandName?.Trim() switch
        {
            "connectMes" => "建立通信",
            "precheckForStart" => "开始前检查",
            "startDeviceSession" => "启动设备会话",
            "startPressDownCountMonitor" => "启动下压计数监测",
            "stopPressDownCountMonitor" => "停止下压计数监测",
            "rollbackStartSignal" => "回滚开始信号",
            "cleanupDeviceSession" => "清理设备会话",
            "moveIn" => "移入",
            "moveOut" => "移出",
            "lineIn" => "入线",
            "lineOut" => "出线",
            _ => "未知命令"
        };
    }

    /// <summary>
    /// 创建命令定义。
    /// </summary>
    /// <param name="commandName">命令名。</param>
    /// <param name="required">必需步骤。</param>
    /// <param name="optional">可选步骤。</param>
    /// <returns>返回命令定义。</returns>
    private static PressDeviceCommandDefinition Define(
        string commandName,
        IReadOnlyList<PressDeviceCommandStep>? required = null,
        IReadOnlyList<PressDeviceCommandStep>? optional = null)
    {
        return new PressDeviceCommandDefinition(
            commandName,
            required ?? Array.Empty<PressDeviceCommandStep>(),
            optional ?? Array.Empty<PressDeviceCommandStep>());
    }

    /// <summary>
    /// 创建写入步骤。
    /// </summary>
    /// <param name="signalName">ERP legacy signalName（旧信号名）。</param>
    /// <param name="writeValue">内部写入值。</param>
    /// <returns>返回命令步骤。</returns>
    private static PressDeviceCommandStep Step(string signalName, object writeValue)
    {
        return new PressDeviceCommandStep(signalName, writeValue, signalName);
    }
}

/// <summary>
/// 表示一个 press device command（压机设备命令）定义。
/// </summary>
/// <param name="CommandName">命令名。</param>
/// <param name="RequiredSteps">必需写入步骤。</param>
/// <param name="OptionalSteps">可选写入步骤。</param>
public sealed record PressDeviceCommandDefinition(
    string CommandName,
    IReadOnlyList<PressDeviceCommandStep> RequiredSteps,
    IReadOnlyList<PressDeviceCommandStep> OptionalSteps);

/// <summary>
/// 表示一个内部写入步骤，不向 QT App（Qt 应用）暴露点位或写入值。
/// </summary>
/// <param name="SignalName">ERP legacy signalName（旧信号名）。</param>
/// <param name="WriteValue">内部写入值。</param>
/// <param name="ResultStepKey">响应中的现场信号名。</param>
public sealed record PressDeviceCommandStep(string SignalName, object WriteValue, string ResultStepKey);

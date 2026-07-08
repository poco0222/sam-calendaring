/**
 * @file DriverJson.cs - 定义 Driver Service（驱动服务）JSON（JavaScript Object Notation）序列化选项。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 提供 Driver Service 统一的 JSON 序列化配置。
 */
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sam.Calendaring.DriverService.Contracts;

/// <summary>
/// 提供 Driver Service 统一复用的 JSON 序列化选项。
/// </summary>
public static class DriverJson
{
    /// <summary>
    /// 获取基于 Web 默认值并禁止未知字段的 JSON 选项。
    /// </summary>
    public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        // PopoY: reject undeclared JSON members at the serializer boundary so later steps inherit the same contract strictness.
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };
}

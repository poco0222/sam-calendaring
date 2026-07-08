/**
 * @file Driver Service 规范化 JSON 哈希器。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 为 signalConfig（信号配置）生成稳定的 canonical JSON（规范化 JSON）哈希。
 */
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sam.Calendaring.DriverService.Security;

/// <summary>
/// 提供 canonical JSON（规范化 JSON）的 SHA-256 哈希能力。
/// </summary>
public static class CanonicalJsonHasher
{
    private static readonly JsonWriterOptions CanonicalWriterOptions = new()
    {
        // PopoY: ERP FastJSON（快速 JSON）会保留中文字符；这里仅用于 hash buffer（哈希缓冲区），不作为页面输出。
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>
    /// 计算输入 JSON 的 SHA-256 Base64Url 哈希。
    /// </summary>
    /// <param name="json">待哈希的原始 JSON 字符串。</param>
    /// <returns>返回 Base64Url 编码的 SHA-256 哈希。</returns>
    public static string Sha256Base64Url(string json)
    {
        var node = JsonNode.Parse(json) ?? throw new InvalidOperationException("信号配置格式不正确");
        using var buffer = new MemoryStream();
        using var writer = new Utf8JsonWriter(buffer, CanonicalWriterOptions);

        WriteCanonicalNode(writer, node);
        writer.Flush();

        return Base64Url.Encode(SHA256.HashData(buffer.ToArray()));
    }

    /// <summary>
    /// 将 JSON 节点按稳定顺序写入 Utf8JsonWriter（UTF-8 JSON 写入器）。
    /// </summary>
    /// <param name="writer">目标 JSON 写入器。</param>
    /// <param name="node">待写入的 JSON 节点。</param>
    private static void WriteCanonicalNode(Utf8JsonWriter writer, JsonNode node)
    {
        switch (node)
        {
            case JsonObject jsonObject:
                writer.WriteStartObject();

                foreach (var property in jsonObject.OrderBy(static item => item.Key, StringComparer.Ordinal))
                {
                    writer.WritePropertyName(property.Key);

                    if (property.Value is null)
                    {
                        writer.WriteNullValue();
                        continue;
                    }

                    WriteCanonicalNode(writer, property.Value);
                }

                writer.WriteEndObject();
                break;
            case JsonArray jsonArray:
                writer.WriteStartArray();

                foreach (var item in jsonArray)
                {
                    if (item is null)
                    {
                        writer.WriteNullValue();
                        continue;
                    }

                    WriteCanonicalNode(writer, item);
                }

                writer.WriteEndArray();
                break;
            default:
                // PopoY: 原始标量值直接交给 BCL（基础类库）写回，避免手写字符串转义逻辑。
                node.WriteTo(writer);
                break;
        }
    }
}

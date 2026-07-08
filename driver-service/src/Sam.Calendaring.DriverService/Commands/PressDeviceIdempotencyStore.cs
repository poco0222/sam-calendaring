/**
 * @file PressDeviceIdempotencyStore.cs - 保存 press device command（压机设备命令）的幂等结果。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 在 Driver Service（驱动服务）进程内避免相同 idempotencyKey（幂等键）重复写设备。
 */
using System.Collections.Concurrent;
using Sam.Calendaring.DriverService.Contracts;

namespace Sam.Calendaring.DriverService.Commands;

/// <summary>
/// 提供进程内 idempotency（幂等）结果缓存。
/// </summary>
public sealed class PressDeviceIdempotencyStore
{
    private readonly ConcurrentDictionary<string, ExecuteDeviceCommandResponse> _completed = new(StringComparer.Ordinal);

    /// <summary>
    /// 尝试读取已完成命令的响应。
    /// </summary>
    /// <param name="idempotencyKey">幂等键。</param>
    /// <param name="response">命中时输出原响应。</param>
    /// <returns>命中缓存时返回 true。</returns>
    public bool TryGetCompleted(string idempotencyKey, out ExecuteDeviceCommandResponse response)
    {
        return _completed.TryGetValue(idempotencyKey, out response!);
    }

    /// <summary>
    /// 保存已确认完成的命令响应。
    /// </summary>
    /// <param name="idempotencyKey">幂等键。</param>
    /// <param name="response">待缓存响应。</param>
    public void StoreCompleted(string idempotencyKey, ExecuteDeviceCommandResponse response)
    {
        _completed.TryAdd(idempotencyKey, response);
    }
}

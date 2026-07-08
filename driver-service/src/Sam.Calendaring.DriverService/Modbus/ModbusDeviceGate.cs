/**
 * @file ModbusDeviceGate.cs - 定义 Modbus adapter（工业通信适配器）共享门闩。
 * @author PopoY
 * @created 2026-07-02
 * @purpose 串行化 Driver Service（驱动服务）内 read/write/connect（读/写/连接）访问，避免共享 NModbus client（客户端）并发交错。
 */
namespace Sam.Calendaring.DriverService.Modbus;

/// <summary>
/// 提供进程内单设备 Modbus（工业通信协议）访问门闩。
/// </summary>
public sealed class ModbusDeviceGate
{
    // ponytail: V1 只支持单设备活跃租约；多设备并发时再拆成 per-device gate（按设备门闩）。
    private readonly SemaphoreSlim _gate = new(1, 1);

    /// <summary>
    /// 等待进入设备访问临界区。
    /// </summary>
    /// <param name="cancellationToken">取消令牌。</param>
    public Task WaitAsync(CancellationToken cancellationToken)
    {
        return _gate.WaitAsync(cancellationToken);
    }

    /// <summary>
    /// 释放设备访问临界区。
    /// </summary>
    public void Release()
    {
        _gate.Release();
    }
}

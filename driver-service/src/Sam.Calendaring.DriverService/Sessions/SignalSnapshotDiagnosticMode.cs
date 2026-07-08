/**
 * @file SignalSnapshotDiagnosticMode.cs - 定义信号快照读取诊断模式。
 * @author PopoY
 * @created 2026-07-03
 * @purpose 让后台自动读取复用 GetSignalSnapshotAsync（获取信号快照）时避免成功 tick（计时读取）刷 diagnostic_log（诊断日志）。
 */
namespace Sam.Calendaring.DriverService.Sessions;

/// <summary>
/// 定义 signal snapshot（信号快照）读取的 diagnostic log（诊断日志）写入模式。
/// </summary>
public enum SignalSnapshotDiagnosticMode
{
    /// <summary>
    /// @author PopoY
    /// 完整记录 manual refresh（手动刷新）链路。
    /// </summary>
    Full,

    /// <summary>
    /// @author PopoY
    /// 仅保留失败摘要，供后台自动读取使用。
    /// </summary>
    FailureOnly
}

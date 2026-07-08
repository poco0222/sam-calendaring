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

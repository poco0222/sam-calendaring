# Driver Service V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> @file Driver Service V1 实现计划总览
> @author PopoY
> @created 2026-06-26
> @purpose 基于 `driver-service-v1-spec.md` 拆分 Driver Service V1 的最小可执行任务。

**Goal（目标）:** Build the minimal `Driver Service（驱动服务）` slice that accepts `signedLease（签名租约） + signalConfig（信号配置）`, validates the lease offline, connects a `Mock` or real `NModbus（Modbus 通信库）` session, and returns the first `signalValues（信号值）` snapshot to `QT App（Qt 应用）`.

**Architecture（架构）:** `ASP.NET Core Minimal API（最小 API）` owns only local HTTP JSON entry points. `LeaseValidator（租约校验器）` owns offline signature and claim validation. `DriverSessionManager（驱动会话管理器）` serializes device access, stores the minimal `SQLite（嵌入式数据库）` state, and delegates reads to either `MockModbusAdapter（模拟 Modbus 适配器）` or `NModbusAdapter（真实 Modbus 适配器）`.

**Tech Stack（技术栈）:** `.NET 10 LTS`, `Worker Service（工作服务）`, `Windows Service（Windows 服务）`, `ASP.NET Core Minimal API（最小 API）`, `SQLite + WAL（预写日志）`, `NModbus（Modbus 通信库）`, `System.Security.Cryptography（系统加密库）`, `System.Text.Json（JSON 序列化库）`, `ILogger（日志抽象）`.

**Source Spec（来源规格）:** `docs/driver-service-v1-spec.md`

---

## Task Index（任务索引）

| Order | Task | Goal | Depends On |
| --- | --- | --- | --- |
| 1 | [Task 01: Driver Project Shell](./task-01-driver-project-shell.md) | Create the local `.NET 10` service shell with Windows Service hosting, loopback binding, config, and test project. | None |
| 2 | [Task 02: API Contract Tests](./task-02-api-contract-tests.md) | Lock `/applyLeaseAndConfig` and `/getSignalSnapshot` request and response contracts before business logic. | Task 01 |
| 3 | [Task 03: Lease Validation](./task-03-lease-validation.md) | Validate `signedLease（签名租约）` in the required order and reject invalid claims without calling `ERP Server（企业资源计划服务器）`. | Task 02 |
| 4 | [Task 04: Session State + SQLite](./task-04-session-state-sqlite.md) | Persist the minimum lease/session state, `fencingToken（隔离令牌）`, and audit log in `SQLite（嵌入式数据库）`. | Task 03 |
| 5 | [Task 05: Mock + NModbus Snapshot](./task-05-mock-nmodbus-snapshot.md) | Connect through `Mock` or real `NModbus（Modbus 通信库）` and return authorized `signalValues（信号值）`. | Task 04 |
| 6 | [Task 06: QT Integration Verification](./task-06-qt-integration-verification.md) | Verify the complete `QT App（Qt 应用） -> Driver Service（驱动服务） -> Modbus` V1 acceptance path and logging boundary. | Task 01 through Task 05 |

## Execution Notes（执行说明）

1. Keep each task implementation details in its own `task-*.md` file.
2. Use `RED -> GREEN -> verification（验证）` for every task: write the failing test, confirm it fails, implement the smallest working code, then rerun focused and relevant regression checks.
3. Use `dotnet test` and `dotnet build` for `Driver Service（驱动服务）`; do not reuse `QT App（Qt 应用）` frontend commands except in Task 06 integration verification.
4. Keep `Driver Service（驱动服务）` bound to `127.0.0.1` by default. `driverBaseUrl（驱动服务地址）` is transport config only, never device authorization.
5. Do not add `/renewLease`; `periodic renew（周期续租）` and `supersede（替换旧租约）` reuse `/applyLeaseAndConfig`.
6. Do not add `MVC Controller（MVC 控制器）`, `gRPC（远程过程调用）`, `GraphQL（查询语言）`, `Redis（内存数据库）`, `RabbitMQ（消息队列）`, `Kafka（消息队列）`, `API Gateway（接口网关）`, or external configuration center.
7. Do not implement `precheckForStart（开始前检查）`, `startDeviceSession（启动设备会话）`, `cleanupDeviceSession（清理设备会话）`, `rollbackStartSignal（回滚开始信号）`, full `production workflow（生产流程）`, or device write commands in V1.
8. Do not accept raw `ip（网络地址）`, `port（端口）`, `deviceId（设备 ID）`, `targetEndpointOverride（目标端点覆盖）`, `addressOverride（地址覆盖）`, or `pointOverride（点位覆盖）` from `QT App（Qt 应用）`.
9. Error `message（消息）`, custom exception `Message（异常消息）`, log body, and operator-facing diagnostics must be Chinese. Stable `resultCode（结果码）` values stay English.
10. Logs must include `correlationId（关联 ID）` and must not include private keys, complete `signedLease（签名租约）`, complete `signature payload（签名原文）`, reusable credentials, or full sensitive authorization packages.

## Acceptance Coverage（验收覆盖）

| Spec Acceptance（规格验收） | Covered By |
| --- | --- |
| `QT App（Qt 应用）` can call `/applyLeaseAndConfig` | Task 02, Task 06 |
| Requests contain no raw `ip/port/deviceId（网络地址/端口/设备 ID）` | Task 02, Task 06 |
| Valid lease returns `resultCode = OK` | Task 03, Task 06 |
| Valid lease returns `leaseState = Active` | Task 03, Task 04, Task 06 |
| Device connection returns `deviceSessionState = Connected` | Task 05, Task 06 |
| `/getSignalSnapshot` returns `signalValues（信号值）` | Task 05, Task 06 |
| Expired lease returns `LEASE_EXPIRED（租约过期）` | Task 03 |
| Host mismatch returns `HOST_MISMATCH（主机不匹配）` | Task 03 |
| `signalConfigHash（信号配置哈希）` mismatch returns `SIGNAL_CONFIG_MISMATCH（信号配置不匹配）` | Task 03 |
| stale `fencingToken（隔离令牌）` returns `FENCING_TOKEN_STALE（隔离令牌过旧）` | Task 03, Task 04 |
| Device timeout returns `DEVICE_TIMEOUT（设备超时）` | Task 05 |
| Full flow does not access `ERP Server（企业资源计划服务器）` | Task 03, Task 06 |
| Logs contain `correlationId（关联 ID）` and omit sensitive authorization package | Task 04, Task 06 |
| Custom errors and logs have no large English text | Task 02, Task 06 |
| Dashboard can show `OK / Active / Connected / correlationId（成功 / 活跃 / 已连接 / 关联 ID）` | Task 06 |

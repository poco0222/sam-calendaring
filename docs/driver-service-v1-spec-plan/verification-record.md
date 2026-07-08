# Driver Service V1 Verification Record

> @file Driver Service V1 验证记录
> @author PopoY
> @created 2026-06-26
> @purpose 记录 Driver Service V1 自动化验证、Qt 集成验证和剩余人工验证缺口。

## Automated Checks（自动化检查）

- [x] `cd driver-service && dotnet test`
  - 结果：`66/66` 通过。
- [x] `cd driver-service && dotnet build`
  - 结果：`0 warning / 0 error`。
- [x] `cd driver-service && dotnet test --filter "FullyQualifiedName~NModbusAdapterTests|FullyQualifiedName~SignalSnapshotTests"`
  - 结果：`9/9` 通过；覆盖真实 `NModbus（Modbus 通信库）` 读取在设备不响应时受 `timeoutMs（超时时间）` 约束的本地 TCP（传输控制协议）场景。
- [x] `cd qt-app/frontend && ./node_modules/.bin/vitest run src/services/driverClient.test.ts src/tests/acceptanceChecklist.test.ts`
  - 结果：`15/15` 通过。
- [x] `cd qt-app/frontend && ./node_modules/.bin/vite build`
  - 结果：构建成功；存在 `chunk size（分块体积） warning（告警）`，但不影响本轮 Task6 通过。

## Acceptance Snapshot（验收快照）

- `resultCode（结果码）`: `OK`
- `leaseState（租约状态）`: `Active`
- `deviceSessionState（设备会话状态）`: `Connected`
- `correlationId（关联 ID）`: recorded in automated acceptance tests as `cid-task6-001`
- `signalValues（信号值）`: recorded in automated acceptance path as non-empty Mock snapshot, including `pressure = 100`

## Known Gaps（已知缺口）

- Real `NModbus（Modbus 通信库）` hardware smoke requires a field-device endpoint carried by a valid `signedLease（签名租约）`; this was not executed in the current local automated run.
- Current local automation only proves timeout-bounded TCP read behavior against a non-responsive loopback server; it does not prove the field `Modbus Device（Modbus 设备）` address, network path, or read-only point mapping.
- `vite build` reports a large generated chunk warning; this is a packaging signal, not a Task6 functional failure.
- `2026-06-26 Runtime Follow-up`：真实 ERP `lease-package（租约包）` 当前仍返回 bootstrap placeholder（启动占位数据），包括 `UNSIGNED_BOOTSTRAP_PLACEHOLDER`、`driver://pending` 和 `bootstrap-minimal`，因此真实 hardware smoke（硬件冒烟测试）尚未进入 Driver Service -> `NModbus（Modbus 通信库）` 读取阶段。

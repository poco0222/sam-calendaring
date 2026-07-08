# Task 03: Current Job Query And Display

> @file QT App 当前作业查询展示任务
> @author PopoY
> @created 2026-06-30
> @purpose 接入 sam-erp `PressWorkingTimeFeedback` 的 Current Job（当前作业）查询和表格展示逻辑。

## Scope（范围）

参考 `sam-erp` 的 `PressWorkingTimeFeedback`：

1. 读取 `GET /modbus/device/getPressJobByHandleIp`，由 ERP Server（企业资源计划服务器）按 request source IP（请求来源网络地址）解析当前处理端绑定压机。
2. QT App（Qt 应用）不得额外传裸 `ip（网络地址）`、`port（端口）` 或 `deviceId（设备 ID）`。
3. Current Job Table（当前作业表）只展示白名单字段：压机、模具号、预计时长、实际时长、开始时间、当前状态。
4. 不展示、不传递 `modbusEntity（设备实体）`、`operationIp（操作网络地址）`、`ipAddress（设备网络地址）`、`port（端口）`、`startParameterRecords（开始参数记录）` 等敏感或无关字段。
5. 不接入预计时长编辑、模具解锁、历史作业、作业操作按钮真实业务逻辑、polling（轮询）或 WebSocket（网页套接字）。

## Reference（参考）

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/views/sam-smes2/prd/partsOrder/pressWorking/pressWorkingTimeFeedback.vue
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/views/sam-smes2/prd/partsOrder/pressWorking/comps/PressCurrentJobTable.vue
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/api/modbus/modbusDevice.js
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/controller/ModbusController.java
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/ModbusServiceImpl.java
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/domain/VO/PressMouldJobVO.java
```

## File Boundary（文件边界）

Modify:

```text
qt-app/frontend/src/domain/pressJob.ts
qt-app/frontend/src/services/erpClient.ts
qt-app/frontend/src/services/erpClient.test.ts
qt-app/frontend/src/components/PressJobPage.tsx
qt-app/frontend/src/components/PressJobPage.test.tsx
```

Do not modify（不要修改）:

```text
driver-service/**
qt-app/frontend/src/services/driverClient.ts
qt-app/frontend/src/hooks/useBootstrapSession.ts
qt-app/frontend/src/hooks/useDriverSession.ts
```

Do not add（不要新增）:

```text
router（路由）
new component library（新组件库）
new icon dependency（新图标依赖）
polling（轮询）
WebSocket（网页套接字）
mock data（模拟数据）
```

## Data Contract（数据契约）

ERP endpoint（企业资源计划接口）:

```text
GET /modbus/device/getPressJobByHandleIp
```

Input（输入）:

```text
No query params（无查询参数）
Authorization: Bearer <sessionToken>
```

Output narrowing（输出收窄）:

| ERP Field（ERP 字段） | UI Field（界面字段） | Rule（规则） |
| --- | --- | --- |
| `deviceName` | `pressName` | 优先展示压机名称；无名称但行有效时显示“已绑定压机”。 |
| `mouldCode` | `moldNo` | 无值时显示“未锁定”。 |
| `expectedDuration` | `plannedDurationHours` | 保留字符串或数字展示值。 |
| `startTime` | `startedAt` | 保留 ERP 返回的 `yyyy-MM-dd HH:mm:ss` 文本。 |
| `status` | `status` | 映射为中文状态；未知值原样兜底。 |
| `startTime + status` | `actualDurationHours` | 仅 `status === "1"` 时按当前时间计算一位小数小时数。 |

Drop fields（丢弃字段）:

```text
deviceId
modbusEntity
operationIp
ipAddress
port
comPort
pressJobInfoJson
pressMouldJobInfoJson
startParameterRecords
privateKey
credential
sessionToken
signedLease
signature
signalConfig
```

## Progress（进度）

- `2026-06-30`: Step 1 started（开始）- 创建 Task 03 文档并固定 current job（当前作业）查询展示边界。
- `2026-06-30`: Step 1 completed（完成）- 已新增 `erpClient.test.ts` 和 `PressJobPage.test.tsx` 的 current job（当前作业）RED tests（失败测试）。
- `2026-06-30`: Step 2 completed（完成）- 已在 `domain/pressJob.ts` 新增 `PressJobCurrentJobRow` 最小领域模型。
- `2026-06-30`: Step 3 completed（完成）- 已在 `erpClient.ts` 新增 `fetchPressJobCurrentJobs`，读取 `/modbus/device/getPressJobByHandleIp` 并收窄字段。
- `2026-06-30`: Step 4 completed（完成）- 已在 `PressJobPage.tsx` 使用 `bootstrapSession.data.pressJobCurrentJobs` 渲染 Current Job Table（当前作业表）。
- `2026-06-30`: Step 5 started（开始）- 正在执行 focused tests（聚焦测试）和 build（构建）验证。
- `2026-06-30`: Step 5 completed（完成）- focused tests（聚焦测试）与 build（构建）已通过；Vite（构建工具）保留既有 chunk size warning（包体积警告）。

## Steps（步骤）

- [x] **Step 1: Write RED tests（编写失败测试）**

Modify:

```text
qt-app/frontend/src/services/erpClient.test.ts
qt-app/frontend/src/components/PressJobPage.test.tsx
```

Expected RED（预期失败）:

```text
fetchPressJobCurrentJobs is not exported（当前作业查询函数未导出）
PressJobPage does not render current job rows（压机作业页未渲染当前作业行）
```

- [x] **Step 2: Add current job domain model（新增当前作业领域模型）**

Modify:

```text
qt-app/frontend/src/domain/pressJob.ts
```

Add:

```text
PressJobCurrentJobRow
```

- [x] **Step 3: Implement ERP current job read（实现 ERP 当前作业读取）**

Modify:

```text
qt-app/frontend/src/services/erpClient.ts
```

Rules:

1. Reuse `GetJson（GET JSON 读取器）`.
2. Reuse `unwrapErpAjaxResult（ERP 响应解包）`.
3. Add `fetchPressJobCurrentJobs（读取当前作业）`.
4. Add current jobs to `BootstrapSession（启动会话）` as `pressJobCurrentJobs`.
5. Fetch failure（读取失败）falls back to `[]`.

- [x] **Step 4: Render current job rows（渲染当前作业行）**

Modify:

```text
qt-app/frontend/src/components/PressJobPage.tsx
```

Rules:

1. Replace empty hardcoded `dataSource（数据源）` with `bootstrapSession.data.pressJobCurrentJobs ?? []`.
2. Keep empty state（空状态） as “暂无当前作业”.
3. Keep row key（行键） local-only and do not expose raw `deviceId（设备 ID）`.
4. Add a small actual duration formatter（实际时长格式化函数） based on existing sam-erp helper behavior.

- [x] **Step 5: Verify（验证）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx
pnpm build
```

Expected（预期）:

```text
Focused tests pass（聚焦测试通过）
Build exits 0（构建退出码为 0）
Existing Vite chunk-size warning（包体积警告） may remain
```

Verification record（验证记录）:

```text
2026-06-30 ./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx
PASS: 2 test files passed（测试文件通过）, 23 tests passed（测试通过）.

2026-06-30 ./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx
PASS: 3 test files passed（测试文件通过）, 25 tests passed（测试通过）.

2026-06-30 pnpm test
PASS: 16 test files passed（测试文件通过）, 107 tests passed（测试通过）.

2026-06-30 pnpm build
PASS: vite build exit 0（退出码 0）. Warning（警告）: one JS chunk is larger than 500 kB after minification.

2026-06-30 reviewer subagent（评审子代理）
PASS: no P0/P1 blocker（无 P0/P1 阻断问题）. Only P2 was missing verification record（验证记录未闭环）, now closed（已关闭）.
```

## Acceptance Criteria（验收标准）

1. Current Job Table（当前作业表）展示 ERP 返回的真实当前作业。
2. Empty payload（空响应）、empty object row（空对象行）、request failure（请求失败）都显示“暂无当前作业”。
3. UI（用户界面）不展示 `sessionToken（会话令牌）`、`signedLease（签名租约）`、`signature（签名）`、`signalConfig（信号配置）`、raw `ip（网络地址）`、raw `port（端口）` 或 raw `deviceId（设备 ID）`。
4. QT App（Qt 应用）不向 ERP Server（企业资源计划服务器）传 `ip（网络地址）`、`port（端口）` 或 `deviceId（设备 ID）`。
5. No new dependency（不新增依赖）。
6. No backend change（不改后端）。

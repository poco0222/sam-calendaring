# Press Working Mold Unlock Design

> @file QT App 压机作业解锁模具设计说明
> @author PopoY
> @created 2026-07-02
> @purpose 固化 PressJobPage（压机作业页）新增 unlock mold（解锁模具）完整业务入口的 UI（界面）、API contract（接口契约）、安全边界和验证范围。

## 1. Goal（目标）

在 `QT App（Qt 应用）` 的 `PressJobPage（压机作业页）` 中新增完整 `unlock mold（解锁模具）` 业务入口，让现场操作员可以对当前压机已锁定模具执行 single unlock（单套解锁）或 batch unlock（批量解锁）。

本设计解决原 `sam-erp（原系统）` 中“点击当前作业信息里的模具号打开解锁”的 hidden affordance（隐藏式可操作入口）问题。新交互不再把 `moldNo（模具号）` 文本做成入口，而是在“当前作业信息”标题栏右侧放置清晰的“解锁模具”按钮。

## 2. Non-Goals（不做范围）

1. 不把 `moldNo（模具号）` 列做成可点击链接。
2. 不在“当前作业信息”表格中新增 action column（操作列），避免挤压 1280x720 touch IPC（触控工控机）视口。
3. 不把 `lock mold（锁定模具）` 和 `unlock mold（解锁模具）` 合并成新的 `Mold Management（模具管理）` 大面板，避免重做现有锁模 flow（流程）。
4. 不新增手动刷新按钮。
5. 不新增 polling（轮询）、WebSocket（网页套接字）、router（路由）、state store（状态仓库）、组件库或图标依赖。
6. 不让 QT App（Qt 应用）传裸 `deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）`。
7. 不修改 Driver Service（驱动服务）逻辑，也不写 Modbus Device（Modbus 设备）信号。

## 3. Design Decision（设计决策）

采用方案：**当前作业标题栏按钮 + Unlock Drawer（解锁抽屉）**。

1. 在“当前作业信息”标题栏右侧放置“解锁模具”按钮。
2. 按钮使用 danger（危险）语义的 outlined button（描边按钮），不设为 primary action（主操作）。
3. 点击按钮后打开右侧 `Drawer（抽屉）`，标题为“解锁模具”。
4. Drawer（抽屉）打开时查询一次 `locked molds（已锁定模具）`。
5. Drawer（抽屉）内 Table（表格）支持 checkbox selection（复选框选择）和 per-row operation（行内操作）。
6. 解锁成功后关闭 Drawer（抽屉），刷新 `current jobs（当前作业）`。

放弃方案：

1. 操作区独立按钮：入口过醒目，和锁模、开始加工、完成加工争抢主操作区。
2. 表格行内按钮：single unlock（单套解锁）清晰，但 batch unlock（批量解锁）会让当前作业表变成操作台，且挤压现有字段。
3. Mold Management Drawer（模具管理抽屉）：统一感较强，但会扩大 scope（范围），不符合 minimal change（最小改动）。

## 4. UI Contract（界面契约）

### 4.1 Entry（入口）

在 `PressJobPage（压机作业页）` 的“当前作业信息” section header（区块标题栏）右侧新增按钮：

```text
解锁模具
```

按钮规则：

1. 当前作业没有 `moldNo（模具号）` 时按钮 disabled（禁用），或点击后提示“当前没有可解锁模具”。
2. 按钮不显示在顶层操作区，不和“锁定模具”并列。
3. 按钮不影响 `moldNo（模具号）` 列展示，`moldNo（模具号）` 继续作为纯文本。

### 4.2 Drawer Layout（抽屉布局）

Drawer（抽屉）标题：

```text
解锁模具
```

Drawer（抽屉）内容分为三层：

1. Status bar（状态条）：展示“已锁定 N 套”“加工中需保留 1 套”“已选 N 套”。
2. Table（表格）：展示已锁定模具。
3. Footer actions（底部操作）：取消、确认解锁 N 套。

不放手动刷新按钮。数据只在 Drawer（抽屉）打开时查询；解锁成功后通过 current jobs refresh（当前作业刷新）回到主界面。

### 4.3 Table Fields（表格字段）

Table（表格）在原 `sam-erp（原系统）` 的 `LockedMouldComp（已锁定模具组件）` 基础上保留以下业务字段：

| Column（列） | Data Field（数据字段） | Description（说明） |
| --- | --- | --- |
| 模具号 | `moldNo` | 映射原 `mouldCode（模具号）`。 |
| 工序号 | `stages` | 当前模具工序。 |
| 制造令号 | `makeOrderNumber` | 当前模具制造令号。 |
| 工艺名称 | `craftName` | 后端直接返回展示名，或由 App layer（应用层）按已有工艺字典转换。 |
| 工时类型 | `workTimeTypeText` | 后端直接返回中文展示名，或由 App layer（应用层）按字典转换。 |
| 开始时间 | `startedAt` | 当前模具作业开始时间。 |
| 作业员 | `operatorName` | 展示作业员中文名；没有中文名时使用安全 fallback（兜底）显示。 |
| 操作 | action（操作） | 每行提供“解锁”，用于 single unlock（单套解锁）。 |

为了支持 batch unlock（批量解锁），表格左侧保留 checkbox selection（复选框选择）列。该列是 operation control（操作控件），不属于业务字段。

### 4.4 Operation（操作）

支持两种入口，但共用同一套 validation（校验）和 submit（提交）逻辑：

1. Single unlock（单套解锁）：点击行内“解锁”，只提交当前行。
2. Batch unlock（批量解锁）：勾选一套或多套后，点击底部“确认解锁 N 套”。

提交前统一使用 Modal.confirm（确认框）：

```text
是否确认解锁「{moldNos}」模具？
```

按钮文案：

```text
确认解锁
取消
```

确认按钮使用 danger（危险）语义。

## 5. Data Model（数据模型）

Frontend domain（前端领域模型）建议新增：

```text
PressLockedMoldRow
PressMoldUnlockRequest
PressMoldUnlockResult
```

`PressLockedMoldRow（已锁定模具行）` 字段：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `moldNo` | Yes | 模具号，用于展示和提交。 |
| `stages` | No | 工序号。 |
| `makeOrderNumber` | No | 制造令号。 |
| `craftName` | No | 工艺名称。 |
| `workTimeTypeText` | No | 工时类型中文展示值。 |
| `startedAt` | No | 开始时间。 |
| `operatorName` | No | 作业员展示名。 |
| `moldJobId` | No | 可选业务主键，仅用于后端需要时定位，不在日志中大段输出。 |

`PressMoldUnlockRequest（解锁模具请求）` 字段：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `operatorId` | Yes | 当前人员 ID。 |
| `moldNos` | Yes | 本次解锁模具号数组。 |
| `correlationId` | Yes | correlationId（关联 ID）。 |

`PressMoldUnlockResult（解锁模具结果）` 字段：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `unlockedMoldNos` | Yes | 已解锁模具号数组。 |

## 6. API Contract（接口契约）

### 6.1 Query Locked Molds（查询已锁定模具）

推荐 endpoint（端点）：

```text
GET /api/qt/press-working/locked-molds
```

Headers（请求头）：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer sessionToken`，只在 ERP client（ERP 客户端）内部使用。 |
| `X-Correlation-Id` | Yes | correlationId（关联 ID）。 |

Response（响应）：

```json
{
  "code": 200,
  "data": [
    {
      "moldNo": "P123-MOLD-01",
      "stages": "OP10",
      "makeOrderNumber": "MO-001",
      "craftName": "冲压成型",
      "workTimeTypeText": "正常",
      "startedAt": "2026-07-02 08:30:00",
      "operatorName": "张三"
    }
  ]
}
```

Frontend narrowing（前端收窄）规则：

1. 只保留 Table Fields（表格字段）和可选 `moldJobId（模具作业主键）`。
2. 丢弃 raw response（原始响应）中的 `deviceId/ip/port（设备/网络字段）`。
3. 不把 `sessionToken（会话令牌）` 写入 React state（React 状态）、Table dataSource（表格数据源）、日志或错误文案。

### 6.2 Unlock Molds（解锁模具）

推荐 endpoint（端点）：

```text
POST /api/qt/press-working/mold-unlocks
```

Body（请求体）：

```json
{
  "operatorId": "zhangsan",
  "moldNos": ["P123-MOLD-01", "P123-MOLD-02"],
  "correlationId": "press-mold-unlock-..."
}
```

Server-side requirements（服务端要求）：

1. ERP Server（企业资源计划服务器）从 session（会话）和 station context（工位上下文）解析绑定压机。
2. QT App（Qt 应用）不传 `deviceId/ip/port（设备/网络字段）`。
3. ERP Server（企业资源计划服务器）重复执行全部业务校验，包括“加工中至少保留 1 套模具”。
4. ERP Server（企业资源计划服务器）记录业务 operation log（操作日志），QT App（Qt 应用）只记录 diagnostic summary（诊断摘要）。

Response（响应）：

```json
{
  "code": 200,
  "msg": "解锁完成!",
  "data": {
    "unlockedMoldNos": ["P123-MOLD-01", "P123-MOLD-02"]
  }
}
```

## 7. Validation Rules（校验规则）

Frontend（前端）校验：

1. 当前没有已锁定模具时，提示：“当前没有可解锁模具。”
2. Drawer（抽屉）内未选择模具时，提示：“请先选择要解锁的模具。”
3. 沿用原 `sam-erp（原系统）` 保护规则：如果 `currentStatus（当前状态）` 不是待加工/未开始，则不能解锁最后一套模具。
4. 如果只剩 1 套模具且状态不是待加工/未开始，提示：“请使用完成加工功能。”
5. 如果批量选择会清空全部已锁定模具且状态不是待加工/未开始，提示：“请使用完成加工功能。”

Frontend（前端）校验只用于防误触，不作为 trust boundary（信任边界）。ERP Server（企业资源计划服务器）必须重复校验。

## 8. Error Handling（错误处理）

1. 查询已锁定模具失败：显示“已锁定模具查询失败，请稍后重试。”，Drawer（抽屉）保持打开并展示空态。
2. 解锁失败：优先展示 ERP 返回的安全中文业务错误。
3. 未知解锁失败：显示“解锁失败，请查看诊断信息后重试。”
4. 解锁成功：显示“解锁完成”，关闭 Drawer（抽屉）。
5. 解锁成功但 current jobs refresh（当前作业刷新）失败：显示“解锁完成，当前作业刷新失败，请手动切换页面后确认。”，不要把它归类成解锁失败。

错误文案不得泄漏 raw response（原始响应）、sessionToken（会话令牌）、signedLease（签名租约）、signature（签名）、signalConfig（信号配置）、deviceId/ip/port（设备/网络字段）。

## 9. Security and Logging（安全与日志）

1. 所有 unlock mold（解锁模具）请求带 `X-Correlation-Id（关联 ID 请求头）`。
2. QT App（Qt 应用）不记录完整 request body（请求体）、raw response（原始响应）或 selected rows（选中行）原文。
3. Diagnostic summary（诊断摘要）只允许包含：
   - `correlationId（关联 ID）`
   - `durationMs（耗时毫秒）`
   - `moldNos（模具号数组）`
   - `operatorId（人员 ID）`
   - `commandName（命令名）`
   - `resultCode（结果码）`
   - `stationAccountId（工位账号 ID）`
4. 第三方异常不得大段写入日志；只记录 exceptionType（异常类型）、中文摘要、hash（哈希）和 correlationId（关联 ID）。

## 10. Refresh Contract（刷新契约）

Drawer（抽屉）内不提供刷新按钮。

流程：

```text
点击“解锁模具”
  -> 查询 locked molds（已锁定模具）
  -> 操作员选择并确认
  -> 调用 unlock endpoint（解锁端点）
  -> 成功后关闭 Drawer（抽屉）
  -> 刷新 current jobs（当前作业）
```

刷新约束：

1. 只刷新 current jobs（当前作业）。
2. 不重跑 bootstrap session（启动会话）。
3. 不重新申请 signedLease（签名租约）。
4. 不触发 applyLeaseAndConfig（应用租约和配置）。
5. 不改变 Driver Service（驱动服务）的 deviceSessionState（设备会话状态）。

## 11. Implementation Boundaries（实施边界）

建议最小改动文件：

```text
qt-app/frontend/src/domain/pressJob.ts
qt-app/frontend/src/services/erpClient.ts
qt-app/frontend/src/App.tsx
qt-app/frontend/src/components/PressJobPage.tsx
qt-app/frontend/src/components/PressJobPage.css
qt-app/frontend/src/services/erpClient.test.ts
qt-app/frontend/src/components/PressJobPage.test.tsx
```

不改文件：

```text
driver-service/**
qt-app/native/**
```

## 12. Testing Strategy（测试策略）

保持 minimal tests（最小测试），不新增框架或依赖。

1. Domain helper tests（领域辅助函数测试）：
   - 未选择模具时返回中文提示。
   - 加工中只剩 1 套时阻止解锁。
   - 加工中批量选择全部模具时阻止解锁。
   - 待加工/未开始状态允许清空已锁定模具。
2. ERP client tests（ERP 客户端测试）：
   - 查询已锁定模具使用 Qt endpoint（Qt 端点）。
   - 查询结果只保留白名单字段。
   - 解锁请求 body（请求体）不包含 deviceId/ip/port（设备/网络字段）。
   - 解锁失败优先保留安全中文业务错误。
3. PressJobPage tests（压机作业页测试）：
   - “当前作业信息”标题栏出现“解锁模具”按钮。
   - Drawer（抽屉）包含指定 8 个业务字段。
   - Drawer（抽屉）没有刷新按钮。
   - 行内“解锁”和底部“确认解锁 N 套”共用确认逻辑。
   - 解锁成功关闭 Drawer（抽屉）并刷新 current jobs（当前作业）。

## 13. Acceptance Criteria（验收标准）

1. `moldNo（模具号）` 列不再作为 unlock mold（解锁模具）入口。
2. “解锁模具”按钮位于“当前作业信息”标题栏右侧。
3. 当前没有已锁定模具时不能进入有效解锁提交。
4. Drawer（抽屉）打开时查询一次已锁定模具。
5. Drawer（抽屉）Table（表格）保留：模具号、工序号、制造令号、工艺名称、工时类型、开始时间、作业员、操作。
6. Drawer（抽屉）不包含刷新按钮。
7. 支持 single unlock（单套解锁）和 batch unlock（批量解锁）。
8. 提交前使用 Modal.confirm（确认框）二次确认。
9. 加工中不能解锁最后一套模具，提示“请使用完成加工功能。”
10. 解锁请求不包含 deviceId/ip/port（设备/网络字段）。
11. 解锁成功后关闭 Drawer（抽屉），刷新 current jobs（当前作业）。
12. 解锁失败展示中文安全错误，不泄漏 sensitive data（敏感数据）。

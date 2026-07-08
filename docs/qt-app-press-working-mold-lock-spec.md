# QT App Press Working Mold Lock Spec

> @file QT App 压机作业锁定模具规格说明
> @author PopoY
> @created 2026-06-30
> @purpose 固化 QT App（Qt 应用）接入 Press Working Page（压机作业页面）锁定模具功能的业务、接口、安全和 UI（界面）边界。

## 1. Goal（目标）

在现有 `PressJobPage（压机作业页）` 上接入“锁定模具”真实业务逻辑，让现场操作员在固定 `1280x720 touch IPC（触控工控机）` 上完成以下流程：

1. 选择 `team（班组）`、`operator（人员）`、`process（预选工艺）`。
2. 点击“锁定模具”。
3. 搜索并选择一个待锁定模具。
4. 确认 `makeOrderNumber（制造令号）` 和 `craftCode（工艺编码）`。
5. 调用 `ERP Server（企业资源计划服务器）` Qt 专用 lock endpoint（锁模端点）。
6. 成功后刷新 `current jobs（当前作业）` 并展示已锁定模具。

本规格采用 A 方案：`ERP Server（企业资源计划服务器）` 提供或适配 Qt 专用锁模接口，由服务端根据 `session（会话）`、`station account（工位账号）`、`granteeHostId（授权主机 ID）` 或后端绑定关系解析目标压机。`QT App（Qt 应用）` 不传裸 `deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）`。

## 2. Non-Goals（不做范围）

1. 不接入 `unlock mold（解锁模具）`。
2. 不实现“开始加工”“完成加工”“移入”“移出”“入线”“出线”的真实业务逻辑。
3. 不新增 `Driver Service（驱动服务）` lock command（锁模命令）。
4. 不让 `Driver Service（驱动服务）` 访问 `ERP Server（企业资源计划服务器）`。
5. 不写 `Modbus Device（Modbus 设备）` 信号。
6. 不新增 `polling（轮询）`、`WebSocket（网页套接字）` 或后台自动刷新。
7. 不新增组件库、路由库、状态管理库或图标依赖。
8. 不展示、记录或提交 `signedLease（签名租约）`、`signature（签名）`、`signalConfig（信号配置）` 原文、`sessionToken（会话令牌）`、raw `ip/port/deviceId`。

## 3. Reference Behavior（参考行为）

参考 `sam-erp` 的 `PressWorkingTimeFeedback（冲压工时反馈）`：

1. “锁定模具”按钮先校验班组、人员、预选工艺和当前压机状态。
2. 页面展开 `MouldInfoComp（模具信息组件）`，支持模具号远程搜索、单选候选模具、选择工艺和确认锁定。
3. 锁模前校验：
   - 必须选择模具。
   - `makeOrderNumber（制造令号）` 与 `craftCode（工艺编码）` 必填。
   - 新选模具的 `projectCode（项目号）` 必须一致。
   - 如果当前设备已有锁定模具，新选模具项目号必须与已锁定模具项目号一致。
   - 已锁定模具数量最多 5 套。
4. 原实现请求 `POST /modbus/pressmouldJob/lockPressMouldCode`，字段为 `choosedRowsStr`、`userName`、`deviceId`。
5. 本项目不直接照搬 `deviceId（设备 ID）` 字段，改为 Qt 专用 endpoint（端点）由 `ERP Server（企业资源计划服务器）` 服务端解析当前工位绑定压机。

参考源码：

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/views/sam-smes2/prd/partsOrder/pressWorking/pressWorkingTimeFeedback.vue
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/views/sam-smes2/prd/partsOrder/pressWorking/comps/mouldInfoComp.vue
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/api/modbus/pressMouldJob.js
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/controller/PressMouldJobInfoController.java
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/java/com/yr/smes2/smes/modbus/service/impl/PressMouldJobInfoServiceImpl.java
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-be/sam-erp/src/main/resources/mapper/smes/modbus/PressMouldJobInfoMapper.xml
```

## 4. Architecture（架构）

### 4.1 Responsibility Split（职责拆分）

| Component（组件） | Responsibility（职责） |
| --- | --- |
| `QT App（Qt 应用）` | 收集操作员选择、展示模具候选、执行前端校验、调用 ERP Qt 专用接口、刷新当前作业。 |
| `ERP Server（企业资源计划服务器）` | 根据当前会话和工位上下文解析绑定压机，校验锁模业务规则，更新业务数据和当前作业缓存。 |
| `Driver Service（驱动服务）` | 不参与锁模；继续只负责 signed lease（签名租约）校验、设备连接和 signal snapshot（信号快照）。 |

### 4.2 Data Flow（数据流）

```text
QT App PressJobPage
  -> ERP Qt mold search endpoint（模具查询端点）
  -> ERP returns whitelisted mold candidates（白名单候选模具）
  -> operator selects one candidate（操作员选择一条候选）
  -> QT App validates required fields and project consistency（前端校验必填和项目一致性）
  -> ERP Qt mold lock endpoint（Qt 专用锁模端点）
  -> ERP resolves bound press from server-side station context（服务端解析绑定压机）
  -> ERP updates press job cache and mold job data（更新压机作业缓存和模具作业数据）
  -> QT App refreshes current jobs（刷新当前作业）
```

## 5. ERP API Contract（ERP 接口契约）

### 5.1 Search Mold Candidates（查询候选模具）

推荐 endpoint（端点）：

```text
GET /api/qt/press-working/mold-candidates
```

Query（查询参数）：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `moldNo` | Yes | 操作员输入或选择的模具号，映射 sam-erp `mouldCode`。 |
| `lockedMoldNos` | No | 当前已锁定模具号数组，用于后端过滤或提示。 |

Headers（请求头）：

| Field（字段） | Required（必填） | Description（说明） |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer sessionToken`，仅由 ERP client（客户端）内部使用，不进入 UI（界面）和日志。 |
| `X-Correlation-Id` | Yes | `correlationId（关联 ID）`，用于诊断串联。 |

Response（响应）：

```json
{
  "code": 200,
  "data": [
    {
      "moldNo": "P123-001",
      "makeOrderNumber": "MO_N001",
      "stages": "OP10",
      "projectCode": "P123",
      "name": "上模",
      "defaultProcessId": "CRAFT-001"
    }
  ]
}
```

Narrowing rules（收窄规则）：

1. 前端只保留 `moldNo`、`makeOrderNumber`、`stages`、`projectCode`、`name`、`defaultProcessId`。
2. 后端如返回其他字段，前端必须丢弃。
3. 前端不得接收或转发 raw `deviceId（设备 ID）`、`ip（网络地址）`、`port（端口）`。

### 5.2 Lock Mold（锁定模具）

推荐 endpoint（端点）：

```text
POST /api/qt/press-working/mold-locks
```

Body（请求体）：

```json
{
  "operatorId": "zhangsan",
  "teamId": "PLINE-01",
  "processId": "CRAFT-001",
  "selectedRows": [
    {
      "moldNo": "P123-001",
      "makeOrderNumber": "MO_N001",
      "stages": "OP10",
      "craftCode": "CRAFT-001",
      "projectCode": "P123"
    }
  ],
  "correlationId": "press-mold-lock-..."
}
```

Server-side requirements（服务端要求）：

1. `ERP Server（企业资源计划服务器）` 必须从服务端上下文解析当前绑定压机，不要求 `QT App（Qt 应用）` 传 `deviceId（设备 ID）`。
2. 如当前工位没有绑定压机，返回中文错误：“压机设备已不存在或已被其他设备占用，请联系管理员。”
3. 如目标模具已被其他设备锁定，返回中文错误：“模具号 xxx 已存在，请检查后重试。”
4. 如 `selectedRows（选中行）` 为空，返回中文错误：“模具作业信息列表不能为空。”
5. 锁模成功后，服务端更新当前压机的 `press job（压机作业）` 和 `press mold job（压机模具作业）` 业务状态。

Response（响应）：

```json
{
  "code": 200,
  "msg": "锁定完成!",
  "data": {
    "lockedMoldNos": ["P123-001"]
  }
}
```

## 6. Frontend Domain Model（前端领域模型）

新增或扩展 `qt-app/frontend/src/domain/pressJob.ts`：

```text
PressMoldCandidate
PressMoldLockSelection
PressMoldLockRequest
PressMoldLockResult
```

字段映射：

| sam-erp Field（字段） | QT App Field（字段） | Note（说明） |
| --- | --- | --- |
| `mouldCode` | `moldNo` | 前端统一使用现有 `moldNo` 命名。 |
| `makeOrderNumber` | `makeOrderNumber` | 制造令号，锁模必填。 |
| `stages` | `stages` | 工序号，展示和提交。 |
| `craftCode` | `craftCode` 或 `processId` | UI（界面）选择使用 `processId`，提交给 ERP 时保持 `craftCode`。 |
| `projectCode` | `projectCode` | 用于前端项目一致性校验。 |
| `name` | `name` | 候选模具展示名，可为空。 |

## 7. UI Contract（界面契约）

### 7.1 Entry（入口）

点击 `PressJobPage（压机作业页）` 操作区“锁定模具”按钮时：

1. 校验 `teamId（班组）`、`operatorId（人员）`、`processId（预选工艺）`。
2. 校验当前 `current job（当前作业）` 中已锁定模具数量小于 5。
3. 打开 `Mold Lock Panel（模具锁定面板）`。

### 7.2 Panel Layout（面板布局）

在 1280x720 baseline（基线视口）下，锁模面板必须保持紧凑：

1. 顶部一行：`moldNo（模具号）` remote select（远程选择器）+ “搜索” + “重置” + “确认锁定” + “取消锁定”。
2. 下方表格：单选、制造令号、模具号、工序号、选择工艺。
3. 不使用 nested cards（嵌套卡片）。
4. 不引入新视觉体系，沿用 Ant Design（组件库）和当前 `Field Control Desk（现场控制台）`。
5. 若使用 `Drawer（抽屉）`，只能承载锁模流程本身，不放营销式说明或大段帮助文案。

### 7.3 Interaction Rules（交互规则）

1. `moldNo（模具号）` 支持 remote search（远程搜索）。
2. 候选表单选一条模具。
3. 如果候选行没有 `craftCode（工艺编码）`，默认填入页面当前 `processId（预选工艺）`。
4. “确认锁定”前弹确认框：“是否确认锁定「{moldNo}」模具？”
5. 成功提示：“锁定完成”。
6. 失败提示优先展示 ERP 返回的中文业务错误；未知错误统一展示：“锁定失败，请查看诊断信息后重试。”
7. 取消锁定只关闭面板并清空本地候选，不调用后端。

## 8. Validation Rules（校验规则）

Frontend（前端）必须校验：

1. 未选择模具时提示：“请先选择模具。”
2. `makeOrderNumber（制造令号）` 或 `craftCode（工艺编码）` 为空时提示：“制造令号与工艺不能为空。”
3. 新选模具 `projectCode（项目号）` 必须只有一个。
4. 当前已锁定模具有项目号时，新选模具项目号必须一致。
5. 当前已锁定模具数量达到 5 时禁止继续锁定。

ERP Server（企业资源计划服务器）仍必须重复校验所有业务规则。前端校验只用于减少误操作，不作为信任边界。

## 9. Security and Logging（安全与日志）

1. `QT App（Qt 应用）` 不传裸 `deviceId（设备 ID）`、`ip（网络地址）`、`port（端口）` 给锁模 endpoint（端点）。
2. `sessionToken（会话令牌）` 只在 `erpClient（ERP 客户端）` 内作为 `Authorization` header（请求头）使用，不进入 React state（状态）展示字段、Table（表格）数据源、日志或错误文案。
3. `correlationId（关联 ID）` 必须随搜索和锁模请求发送。
4. `QT App（Qt 应用）` 只记录锁模成功/失败摘要、`moldNo（模具号）`、`operatorId（人员 ID）`、`teamId（班组 ID）`、`processId（工艺 ID）` 和 `correlationId（关联 ID）`。
5. 不记录 `selectedRows（选中行）` 原始 JSON（对象表示法）全文；如需排障，只记录字段白名单摘要。
6. 第三方异常不直接展示 stack trace（堆栈）；UI（界面）只显示中文摘要。

## 10. Refresh Contract（刷新契约）

锁模成功后：

1. 只刷新 `current jobs（当前作业）`。
2. 不重跑完整 `bootstrap session（启动会话）`。
3. 不重新申请 `signedLease（签名租约）`。
4. 不触发 `applyLeaseAndConfig（应用租约和配置）`。
5. 不改变 `Driver Service（驱动服务）` 的 `deviceSessionState（设备会话状态）`。

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

除非后续 Task（任务）明确要求接入设备写信号。

## 12. Acceptance Criteria（验收标准）

1. 点击“锁定模具”后，未选择班组/人员/预选工艺时展示中文必填提示。
2. 当前已锁定 5 套模具时不能打开锁模确认流程。
3. 模具号搜索能调用 Qt 专用 search endpoint（查询端点），并只展示白名单字段。
4. 候选模具表支持单选。
5. 选择候选模具后，工艺为空时默认使用当前预选工艺。
6. 跨项目锁模被前端阻止，并展示当前项目与所选项目。
7. 确认锁模调用 Qt 专用 lock endpoint（锁模端点），请求体不包含 raw `deviceId/ip/port`。
8. 锁模成功后刷新当前作业表，模具号列展示新锁定模具。
9. 锁模失败时展示中文错误，不泄漏 raw response（原始响应）、`sessionToken（会话令牌）` 或授权包。
10. `Driver Service（驱动服务）` 无代码变更。

## 13. Backend Assumptions（后端默认假设）

1. `ERP Server（企业资源计划服务器）` Qt 专用 endpoint（端点）默认采用 `/api/qt/press-working/mold-candidates` 和 `/api/qt/press-working/mold-locks`；如后端已有命名规范，实施计划中只替换路径，不改变请求字段和安全边界。
2. `ERP Server（企业资源计划服务器）` 必须基于当前 `session（会话）` 和工位上下文解析绑定压机，前端不提供 `deviceId（设备 ID）` 入参。
3. 锁模候选默认只支持单选；参考 `sam-erp` 当前是单选，前端仍把 selected row（选中行）包装为数组以兼容后端批量模型。
4. 锁模成功后的 ERP operation log（企业资源计划操作日志）由 `ERP Server（企业资源计划服务器）` 记录，`QT App（Qt 应用）` 不直接写 `modbusHandleLog（Modbus 操作日志）`。

<!--
@file proposal.md - QT App 历史作业能力提案
@author PopoY
@created 2026-07-24 17:03:20
@purpose 说明历史作业第四一级入口、只读查询和详情追溯能力的业务目标与变更边界。
-->

## Why

QT App（Qt 应用）当前只能处理和查看正在进行的压机作业，现场操作员缺少在当前认证工位内查询已完成作业、核对参数及追溯操作记录的入口。需要在不改变既有“压机作业”四行布局和安全边界的前提下，提供适合 1280×720 触控工控机的只读历史查询能力。

## What Changes

- 在“压机作业”右侧增加第四个一级入口“历史作业”，使用全宽表格展示当前工位的已完成模具作业。
- 支持默认当天、最多 31 个自然日、模具号和作业人员筛选，以及每页 10 条的服务端分页。
- 点击记录后使用应用视口 70% 宽的右侧 Drawer（抽屉）展示作业概要、开始/完工参数和可可靠关联的操作记录。
- 在 ERP 增加两个受 QT bootstrap context（启动上下文）约束的只读历史接口；设备身份来自认证上下文，不接受客户端设备或网络字段。
- 对列表、详情、参数和操作记录执行字段白名单投影，并使用独立 `correlationId（关联 ID）` 与 latest-request-wins（最新请求生效）约束。
- 继续复用现有 Ant Design（组件库）、Design Token（设计变量）、压机数据表和 `qt_press_job_operation`；不新增数据库迁移、主题体系、缓存或汇总表。

## Capabilities

### New Capabilities

- `press-job-history-query`: 当前认证 QT 工位的历史作业筛选、分页列表、脱敏详情、参数对照、操作追溯及 70% 宽详情抽屉。

### Modified Capabilities

无。既有压机作业、完工前置检查和当前状态时长契约保持不变。

## Impact

- QT App 前端：`App.tsx`、压机领域类型、`erpClient`、新增历史作业页面及对应测试和样式。
- ERP 后端：`QtPressWorkingController`、压机模具作业 Mapper/Service、操作记录查询及对应测试。
- API：新增 `GET /api/qt/press-working/history-jobs` 与 `GET /api/qt/press-working/history-jobs/{mouldJobId}`。
- 依赖：只把 Ant Design 已使用的同版本 Day.js 声明为前端直接依赖，不引入第二套日期库。
- 数据库：复用既有表结构，不新增 Liquibase（数据库迁移）变更。

<!--
@file brainstorm-summary.md - 压机历史作业设计确认摘要
@author PopoY
@created 2026-07-24 17:10:28
@editor PopoY
@edited 2026-07-24 17:16:18
@purpose 记录 Comet Design（设计）阶段已确认的技术方案、风险、测试策略和规格补丁结论。
-->

# Brainstorm Summary

- Change: add-qt-press-job-history
- Date: 2026-07-24

## Confirmed Technical Approach

- 采用方案 A：在“压机作业”右侧增加第四个一级入口“历史作业”，页面使用单行筛选区、服务端分页八列表格和占应用视口 70% 宽的右侧 Drawer（抽屉）。
- 一条历史记录对应一条已完成的 `press_mould_job_info`，以其真实主键作为稳定 `mouldJobId`；ERP 提供列表和详情两个受 QT bootstrap context（启动上下文）约束的只读 GET endpoint（端点）。
- 查询默认当天、最多 31 个自然日，使用带 offset（偏移量）的半开时间区间；前端维护 `draftFilters` 与 `appliedQuery`，列表和详情分别执行 latest-request-wins（最新请求生效）。
- 复用现有 Ant Design（组件库）、Design Token（设计变量）、数据表和 `qt_press_job_operation`，不新增主题体系、状态库、数据库迁移、缓存或汇总表。
- 前后端均使用字段白名单；设备身份仅来自认证上下文，页面不得接收 token、设备网络字段、租约、凭据、完整信号配置或原始异常。
- ERP 功能 worktree 必须直接从 `master` 建立，完成后只合并回 `master`；不得以 `dev`、`dev-popo` 或其他长期分支作为基线、中间集成分支或合并目标。

## Key Trade-offs and Risks

- 不按父作业聚合，换取模具号、参数和详情身份的稳定语义；每个已完成模具作业独立成行。
- 历史班组、锁模/解锁和失败操作缺少可靠持久化关联，首版显示“未记录”或空状态，不按时间窗口推断，也不新增结构。
- 操作 session 可能在作业生命周期中切换，查询必须覆盖该作业任意已绑定 session，并始终限定当前 `device_id`。
- 参数 JSON 可能局部损坏，单侧异常不能隐藏另一侧有效参数或详情其他区域。
- ERP 与 QT App 需要协调发布；生产数据量增长前不预建索引、缓存、虚拟列表或汇总结构。

## Testing Strategy

- ERP 采用 TDD（测试驱动开发），覆盖 Mapper 半开区间、稳定排序、session A/B、设备隔离、严格 offset 解析、31 日上限、分页、404 和安全异常投影。
- QT App 采用 TDD，覆盖 `erpClient` 响应收窄、独立 `correlationId`、敏感字段剔除、默认当天、已提交筛选快照、分页、请求竞态、70% Drawer、键盘操作和焦点恢复。
- 完成后运行 ERP 定向测试与 Java 8 模块构建、QT App 相关 Vitest 与 production build（生产构建），并在 1280×720 下核对浅色/深色布局和敏感字段边界。

## Spec Patches

None

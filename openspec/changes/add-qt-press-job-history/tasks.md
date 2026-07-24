<!--
@file tasks.md - QT App 历史作业实施任务
@author PopoY
@created 2026-07-24 17:04:06
@editor PopoY
@edited 2026-07-24 17:16:18
@purpose 以可验证检查项跟踪历史作业跨前后端实现、测试和审查。
-->

## 1. 隔离环境与基线

- [x] 1.1 从前端 `main` 与 ERP 后端 `master` 直接创建隔离 worktree（工作树），记录基线提交并运行前端、后端基线测试；ERP 功能分支完成后只合并回 `master`，不得使用 `dev`、`dev-popo` 或其他长期分支作为基线、中间集成分支或合并目标。
- [x] 1.2 确认后端基线包含压机生命周期接口、`QtPressJobOperation` 和既有 Liquibase operation changelog，且两个工作树没有用户未归属修改。

## 2. ERP 历史数据查询

- [x] 2.1 先写失败的 Mapper contract test（映射契约测试），再实现当前设备、完成状态、半开时间区间、可选筛选和稳定倒序的历史列表/详情 SQL。
- [x] 2.2 先覆盖 session A/B 失败场景，再实现按作业任意已绑定 `local_job_session_id` 汇集成功操作记录的安全查询。
- [x] 2.3 先写失败的 Service delegation test（服务委派测试），再通过现有 `IPressMouldJobInfoService` 暴露最薄的设备绑定只读方法。

## 3. ERP 历史接口与安全投影

- [ ] 3.1 先写失败的 Controller test，覆盖带 offset 的严格时间解析、最多 31 个自然日、固定分页、认证设备限定和真实 HTTP 状态。
- [ ] 3.2 实现历史列表与详情两个 GET endpoint、PageHelper 服务端分页及固定响应白名单，确保 ID 和时长均为 JSON string。
- [ ] 3.3 实现参数/操作记录白名单和端点内安全异常转换，测试原始异常消息、堆栈及敏感字段不会进入响应或日志。
- [ ] 3.4 运行 ERP 定向测试和 `yr-admin` Java 8 模块构建，提交后端实现并完成任务级代码审查。

## 4. QT App 请求契约

- [ ] 4.1 先写失败的 `erpClient` 测试，再增加历史 Query/List/Detail View Model（视图模型）、两个 GET 请求和响应字段收窄。
- [ ] 4.2 覆盖 URL offset、授权与独立 `X-Correlation-Id`、敏感字段剔除、未知状态以及时长 null/小数/超大值边界。

## 5. QT App 历史页面

- [ ] 5.1 声明 Ant Design 已解析的同版本 Day.js 直接依赖，不引入第二套日期库。
- [ ] 5.2 先写失败的历史页面测试，再实现默认当天、31 日上限、`draftFilters/appliedQuery`、每页 10 条服务端分页和独立列表/详情请求版本。
- [ ] 5.3 使用现有 Ant Design 组件和 Design Token 实现八列表格、中文空错状态、触控/键盘行为与 70% 宽详情 Drawer。
- [ ] 5.4 实现 4×2 概要、64%/36% 参数/操作区域、参数单侧保留、操作空状态和关闭后焦点恢复。

## 6. App Shell 集成

- [ ] 6.1 先写失败的 App integration test（应用集成测试），再在“压机作业”右侧增加第四个一级入口和显式渲染分支。
- [ ] 6.2 在 App Shell 内注入两个历史只读回调，确保页面 props 不包含 token、ERP 地址、设备、网络、租约或 Driver Session。

## 7. 验证与交付

- [ ] 7.1 运行 ERP 全部目标测试、Java 8 模块构建、QT App 相关 Vitest 和 production build（生产构建）。
- [ ] 7.2 在 1280×720 下核对浅色/深色布局、44px 触控目标、固定表头分页、70% Drawer、遮罩、焦点和局部滚动。
- [ ] 7.3 执行敏感字段、日志、Liquibase 无新增迁移及工作树范围扫描，完成最终 correctness/security/regression（正确性/安全性/回归）审查。
- [ ] 7.4 记录 Comet Verify（验证）证据；Archive（归档）、合并和 push（推送）继续作为独立授权门。

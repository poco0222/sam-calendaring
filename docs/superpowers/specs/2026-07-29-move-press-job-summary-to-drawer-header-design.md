<!--
@file 2026-07-29-move-press-job-summary-to-drawer-header-design.md
@author PopoY
@created 2026-07-29 16:57:30
@purpose 规定历史作业概要迁入 Drawer 标题栏并将操作记录调整为每页 10 条的最小前端方案。
-->

# 历史作业概要标题栏整合设计

## 1. 目标与边界

历史作业详情不再单独显示“作业详情 · 模具号”标题。详情加载成功后，现有蓝色作业概要整体迁入 Drawer header（抽屉标题栏），继续使用四列两行展示八项信息；释放出的 Drawer body（抽屉内容区）高度全部交给参数记录和操作记录面板。

同时把 Drawer 内操作记录的客户端分页从每页 9 条调整为每页 10 条。

本次只修改 QT App frontend（前端）。不修改 ERP API（接口）、View Model（视图模型）、Drawer `80%` 宽度、参数与操作面板 `64% / 36%` 比例、主题、依赖或历史主列表分页。

## 2. 布局设计

### 2.1 标题栏

- 详情加载成功时，Drawer `title` 使用现有 `Descriptions`（描述列表）渲染蓝色概要，不再渲染独立文字标题。
- 概要继续保持四列两行，字段与格式化规则不变：压机、模具号、作业状态、实际时长、班组 / 作业人员、工艺、开始时间、完成时间。
- 概要继续复用现有 `--qt-app-control-blue-soft` 和 `--qt-app-control-blue-line` Design Token（设计变量），保留长文本换行能力，不新增视觉体系。
- Drawer 关闭按钮继续保持 `44px` 触控尺寸；概要只包含只读文本，不增加标题栏交互控件。

### 2.2 内容区

- 从 `HistoryDetailContent` 中删除概要节点和原有“概要 + 正文”两行 Grid（网格布局）。
- 参数记录和操作记录作为正文唯一内容，直接占满 Drawer body 的可用高度。
- 两个面板继续保持 `64% / 36%` 横向比例。
- 参数表现有 Ant Design `.ant-spin` 高度链、表体局部滚动、操作时间线局部滚动和底部分页布局全部保留，避免内容被面板底部裁切。

## 3. 状态与数据流

1. 选择历史作业后立即打开 Drawer，并按现有流程加载详情。
2. `loading` 或 `error` 状态没有完整详情数据时，Drawer 标题暂时显示现有“作业详情 · 模具号”文本；正文继续显示 Skeleton（骨架屏）或错误重试。
3. 详情请求成功后，标题切换为四列两行概要，正文渲染参数与操作面板。
4. 关闭、重试、latest-request-wins（最新请求生效）和焦点归还逻辑保持不变。

该方案不使用列表行数据补齐或猜测详情字段，也不增加标题栏 Skeleton 分支。

## 4. 操作记录分页

- 将现有 `OPERATION_PAGE_SIZE` 从 `9` 改为 `10`，继续由该常量统一控制 `slice`、分页器显示条件和 `Pagination.pageSize`。
- 第 1 页显示第 1 至 10 条，第 11 条进入第 2 页。
- 切换作业或操作记录集合变化时，页码继续恢复为第 1 页。
- 较长记录仍由现有时间线局部滚动承载，不增加高度计算或第二套滚动容器。

## 5. 预计改动范围

- `qt-app/frontend/src/components/PressJobHistoryPage.tsx`：迁移概要节点、简化正文结构、调整操作记录分页常量。
- `qt-app/frontend/src/components/PressJobHistoryPage.css`：把概要样式限定到 Drawer header，删除不再需要的正文两行布局，保留面板高度链。
- `qt-app/frontend/src/components/PressJobHistoryPage.test.tsx`：更新结构和 CSS 契约，验证第 1 至 10 条可见、第 11 条不可见。

## 6. 验证

- 聚焦 Vitest（测试框架）：`pnpm test -- --run src/components/PressJobHistoryPage.test.tsx`。
- TypeScript（类型检查）：`pnpm exec tsc --noEmit`。
- Production build（生产构建）：`pnpm build`。
- `git diff --check` 检查空白错误。
- 在 `1280×720` 浅色和深色主题下确认：顶部为四列两行概要，正文获得新增高度，参数表与操作时间线不越界，操作记录每页最多 10 条。

## 7. 非目标

- 不调整字段、文案、排序、接口或脱敏边界。
- 不修改历史主列表每页 10 条的服务端分页。
- 不新增组件库、主题变量、配置项、响应式断点或自定义高度计算。

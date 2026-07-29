<!--
@file design.md - 历史作业详情布局与操作分页修复设计
@author PopoY
@created 2026-07-29 15:56:59
@editor PopoY
@edited 2026-07-29 16:19:18
@purpose 规定复用现有 Drawer、Grid、Table 和 Timeline 的最小垂直空间调整方案。
-->

## Context

详情 Drawer（抽屉）已使用 `auto + minmax(0, 1fr)` 两行 Grid（网格布局），操作时间线已有局部滚动。参数表虽然声明了滚动，但 Ant Design 6（组件库）在 `.ant-table-wrapper` 与 `.ant-spin-container` 之间增加 `.ant-spin` 包装层；该层不在现有 `height: 100%` 约束中，导致表体按内容高度越过面板并被裁切。Drawer body（抽屉内容区）、概要卡片和区块间距还共同占用了过多垂直空间，操作记录分页常量也仍为 5。

## Goals / Non-Goals

**Goals:**

- 让蓝色概要卡片靠近 Drawer 标题，并为下方两个面板释放上下空间。
- 保持参数表和操作时间线在各自面板内滚动，不让底部参数被面板边界遮挡。
- 每页最多展示 9 条操作记录，并在切换作业时继续恢复第 1 页。

**Non-Goals:**

- 不修改 Drawer 的 `80%` 宽度、两面板 `64/36` 横向比例或数据字段。
- 不新增滚动容器、组件、依赖、主题变量或分页配置项。
- 不修改 ERP API（接口）和历史作业主列表每页 10 条的服务端分页。

## Decisions

1. 将 `.ant-drawer-body` 的垂直内边距收窄为 `12px`，保留 `24px` 水平内边距。相比改 Drawer 高度或 Header（标题栏），该修改直接让蓝色概要上移，并同时增加下方面板可用高度。
2. 将详情布局纵向 `gap` 从 `16px` 收窄为 `12px`，概要卡片内边距从 `12px` 调整为 `8px 12px`。继续复用既有蓝色 Design Token（设计变量），不改变 DOM（文档对象模型）结构。
3. 将 Ant Design 6 的 `.ant-spin` 加入参数表既有高度链，并复用页面主表已经采用的 `auto + minmax(0, 1fr)` Grid 约束 `.ant-table-container`；表头保持自适应，表体占用剩余高度并通过既有 `overflow: auto` 滚动。Timeline（时间轴）与分页底栏保持不变，不建立第二套滚动或高度计算逻辑。
4. 仅把既有 `OPERATION_PAGE_SIZE` 从 `5` 改为 `9`；该常量继续统一控制数组 `slice`、分页器显示条件和 `Pagination.pageSize`。
5. 先修改聚焦测试，使其要求第 1–9 条可见、第 10 条不可见，并锁定三处垂直间距和参数表高度链；确认 RED 后再修改生产代码。

## Risks / Trade-offs

- [9 条操作记录在较长文本场景下仍可能超过面板高度] → 保留 Timeline 的局部滚动，分页器继续固定在面板底部。
- [缩小纵向留白导致视觉过密] → 只压缩顶部和区块间垂直空间，保留 `24px` 水平内边距及现有面板 `12px` 内边距。
- [误改历史作业主列表分页] → 只修改 Drawer 内唯一的 `OPERATION_PAGE_SIZE`，保留列表查询和表格的 `pageSize: 10`。

## Migration Plan

无数据迁移。随 QT App（Qt 应用）前端资源发布；回滚时恢复三处 CSS 间距和操作分页常量。

## Open Questions

无。

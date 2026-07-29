<!--
@file proposal.md - 历史作业详情布局与操作分页修复提案
@author PopoY
@created 2026-07-29 15:56:59
@editor PopoY
@edited 2026-07-29 16:19:18
@purpose 记录作业概要占用垂直空间、详情面板内容遮挡和操作记录分页数量不符合现场展示需求的问题。
-->

## Why

1280×720 QT App（Qt 应用）中，历史作业详情概要与下方两个面板之间留白偏大；同时 Ant Design 6（组件库）的 `.ant-spin` 包装层未进入既有高度约束，参数表内容会越过面板底部后被裁切。操作记录当前每页仅显示 5 条，也没有充分利用面板高度。

## What Changes

- 压缩详情概要的垂直内边距和概要与内容面板之间的间距，让蓝色作业信息区域上移并为下方内容释放高度。
- 将 Ant Design 6 的 `.ant-spin` 和参数表容器纳入既有剩余高度约束，使参数表在面板内形成真实局部滚动，避免底部内容被裁切。
- 将 Drawer（抽屉）内操作记录客户端分页从每页 5 条调整为每页 9 条。
- 先更新聚焦回归测试并记录 RED（失败），再实施最小 CSS（样式）与分页常量修改。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `press-job-history-query`：调整详情区域的垂直布局，并将操作记录每页最大展示数量从 5 条改为 9 条。

## Impact

- 修改 `PressJobHistoryPage.tsx`、`PressJobHistoryPage.css` 和对应 Vitest（测试框架）测试。
- 同步 `press-job-history-query` delta spec（增量规格）。
- 不修改 Drawer 宽度、ERP API（接口）、数据模型、Driver Service（驱动服务）、依赖或主题体系。

<!--
@file proposal.md - 历史作业筛选栏尺寸修复提案
@author PopoY
@created 2026-07-29 10:10:51
@editor PopoY
@edited 2026-07-29 10:26:24
@purpose 记录历史作业筛选字段未复用压机作业栅格尺寸导致控件过窄的问题、修复目标与边界。
-->

## Why

“历史作业”筛选栏使用独立的 `270/190/190px` flex（弹性布局）字段宽度：扣除 `56px` 标签和 `8px` 间距后，日期范围仅剩 `206px`，模具号和作业人员各仅剩 `126px`。日期文本在用户截图中被截断，其他控件也明显比“压机作业”现有筛选尺寸拥挤。

前一次只修复了外层盒模型，没有处理用户指出的字段横向尺寸，因此运行界面中的核心问题没有解决。本次直接复用“压机作业”的 `Form + Row + Col（表单栅格）`尺寸体系。

## What Changes

- 先补充结构与尺寸契约测试，要求历史筛选栏采用与压机作业相同的 `72px` 标签列、`12px` gutter（沟槽）和 `220/360px` 固定列，并记录修复前的失败证据。
- 将历史筛选容器改为 Ant Design `Form + Row + Col`：日期范围映射压机页 `360px` 长字段，模具号和作业人员分别映射 `220px` 标准字段，查询按钮使用剩余列。
- 保留现有 `62px` 筛选栏、`44px` 触控控件、日期校验、查询行为和数据契约。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。主规格 `press-job-history-query` 已要求筛选项在固定 1280×720 视口中使用统一、可读的控件布局，本次只修复实现偏差，不改变验收场景。

## Impact

- 修改 `qt-app/frontend/src/components/PressJobHistoryPage.tsx`、对应 CSS 及已有 Vitest（测试框架）布局契约测试。
- 不修改筛选字段类型、ERP API（接口）、Driver Service（驱动服务）、数据库、依赖或主题体系。

<!--
@file design.md - 历史作业筛选控件尺寸修复设计
@author PopoY
@created 2026-07-29 09:43:18
@purpose 规定复用压机作业已有选择器触控高度规则的最小实现。
-->

## Context

历史页筛选栏将 `RangePicker（范围日期选择器）`、`Input（输入框）`、`Select（选择器）` 和 `Button（按钮）` 的外层最小高度统一设为 `44px`。Ant Design 的 `Select` 由外层 `.ant-select` 和内层可见框 `.ant-select-selector` 组成；只拉高外层不会同步拉高实际边框。

压机作业页已使用 `.press-job-page__filters .ant-select-selector { min-height: 44px; }` 解决同类触控尺寸问题。本次修复应复用该模式，不改造历史页的筛选布局。

## Goals / Non-Goals

**Goals:**

- 让历史页作业人员选择器的可见框与同栏其他控件统一为 `44px`。
- 使用最小样式契约测试固定正确的 Ant Design DOM（文档对象模型）层级。
- 保持 1280×720 单行筛选、浅色/深色主题和既有 Design Token（设计变量）不变。

**Non-Goals:**

- 不将历史页筛选栏重写为 `Form/Row/Col（表单/栅格）`。
- 不调整字段宽度、描述列宽度、间距、查询行为或后端数据契约。
- 不新增组件、主题、依赖或可配置项。

## Decisions

1. 在历史页筛选栏作用域内，直接为 `.ant-select-selector` 设置 `min-height: 44px`。这与压机作业页的现有实现一致，且只影响目标页面。
2. 先将现有“不得出现 `.ant-select-selector`”断言改为“该 selector 必须具有 `44px` 最小高度”，运行并记录 RED（失败）证据后再改 CSS。
3. 不抽取共享 mixin（混入）或通用选择器；两页的样式文件和布局作用域不同，新抽象会扩大回归面而无额外价值。

## Risks / Trade-offs

- [Ant Design 内部 DOM 类名在大版本升级时可能变化] → 保留聚焦样式契约测试，并通过当前已锁定的 Ant Design 6.4.5 前端构建验证。
- [只修复高度，不统一两页全部栅格宽度] → 这是有意的最小范围；宽度和布局不影响当前报告的 `12px` 高度偏差。

## Migration Plan

无数据迁移。随 QT App（Qt 应用）前端资源发布；回滚时恢复一条 CSS 规则及对应测试断言。

## Open Questions

无。

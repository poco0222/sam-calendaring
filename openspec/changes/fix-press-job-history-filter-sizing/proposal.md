<!--
@file proposal.md - 历史作业筛选控件尺寸修复提案
@author PopoY
@created 2026-07-29 09:43:18
@purpose 记录历史作业人员选择器高度与同栏控件不一致的根因、修复目标与边界。
-->

## Why

“历史作业”筛选栏只将 Ant Design `Select（选择器）`外层容器设为 `44px`，可见的 `.ant-select-selector` 仍使用默认高度，导致作业人员选择器比同排日期、输入框和查询按钮明显更矮并向上偏移。

根因是历史页的触控高度 CSS 选择器落在 `.ant-select` 外壳，而压机作业页已正确将同一规则应用到 `.ant-select-selector`；现有回归测试还反向禁止该选择器，使缺陷被固化。

## What Changes

- 先修改历史页样式契约测试，要求 `.ant-select-selector` 具有 `44px` 最小高度，并记录修复前的失败证据。
- 复用“压机作业”已有 CSS 模式，让历史页选择器的实际可见框与同栏其他控件统一为 `44px`。
- 保留现有单行筛选结构、宽度分配、主题变量、交互行为和数据契约。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。主规格 `press-job-history-query` 已要求筛选项使用统一控件高度，本次只修复实现与现有契约的偏差，不改变验收场景。

## Impact

- 修改 `qt-app/frontend/src/components/PressJobHistoryPage.css` 及其已有 Vitest（测试框架）样式契约测试。
- 不修改 React 组件结构、ERP API（接口）、Driver Service（驱动服务）、数据库、依赖或主题体系。

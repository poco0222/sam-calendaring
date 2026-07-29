<!--
@file proposal.md - 历史作业筛选栏整体高度修复提案
@author PopoY
@created 2026-07-29 10:10:51
@purpose 记录历史作业筛选容器盒模型导致整体高度超出压机作业筛选栏的问题、修复目标与边界。
-->

## Why

“历史作业”筛选容器缺少 `box-sizing: border-box`，导致声明的 `62px` 最小高度之外又叠加 `16px` 垂直内边距和 `2px` 边框，实际外高至少为 `80px`；“压机作业”筛选栏的外高为 `62px`，因此两者在截图中明显不一致。

## What Changes

- 先补充样式契约测试，要求历史筛选容器使用 `border-box（边框盒）` 并记录修复前的失败证据。
- 复用“压机作业”已有盒模型，在历史筛选容器上增加 `box-sizing: border-box`，使 `62px` 包含内边距和边框。
- 保留现有 `44px` 触控控件、字段宽度、间距、组件结构和交互行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。主规格 `press-job-history-query` 已要求筛选项使用统一控件高度，本次只修复实现与现有契约的偏差，不改变验收场景。

## Impact

- 修改 `qt-app/frontend/src/components/PressJobHistoryPage.css` 及其已有 Vitest（测试框架）样式契约测试。
- 不修改 React 组件结构、ERP API（接口）、Driver Service（驱动服务）、数据库、依赖或主题体系。

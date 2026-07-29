<!--
@file design.md - 历史作业筛选栏整体高度修复设计
@author PopoY
@created 2026-07-29 10:10:51
@purpose 规定复用压机作业既有边框盒模型的最小实现。
-->

## Context

历史筛选容器当前使用默认 `content-box（内容盒）`：`min-height: 62px` 只约束内容区，再叠加上下各 `8px` 内边距和上下各 `1px` 边框，外高至少为 `80px`。压机作业筛选容器已使用 `border-box（边框盒）`，其 `62px` 包含内边距和边框。

## Goals / Non-Goals

**Goals:**

- 让历史筛选栏总外高与压机作业筛选栏统一为 `62px`。
- 保留内部控件 `44px` 触控高度和 1280×720 单行布局。
- 用聚焦样式契约防止盒模型遗漏回归。

**Non-Goals:**

- 不调整字段宽度、间距、标签、查询按钮位置或组件结构。
- 不重写为 `Form/Row/Col（表单/栅格）`，不新增样式抽象、依赖或配置。

## Decisions

1. 仅在 `.press-job-history-page__filters` 增加 `box-sizing: border-box`。内容可用高度为 `62 - 16 - 2 = 44px`，正好容纳现有触控控件。
2. 先在已有 CSS 契约测试中要求该容器同时具有 `box-sizing: border-box`、`min-height: 62px` 和 `padding: 8px 12px`，记录 RED（失败）后再改样式。
3. 不修改父级 `grid-template-rows: auto`；盒模型修正后自动行会采用正确的 `62px` 外高。

## Risks / Trade-offs

- [后续提高内部控件高度可能超过 `62px`] → 现有测试同时锁定容器和 `44px` 控件；调整触控规范时需同步评估容器高度。
- [静态 CSS 契约不能替代实际浏览器截图] → 结合盒模型算术、生产构建和 Impeccable layout（布局）复扫验证本次单点修复。

## Migration Plan

无数据迁移。随 QT App（Qt 应用）前端资源发布；回滚时移除一条 CSS 声明及对应测试断言。

## Open Questions

无。

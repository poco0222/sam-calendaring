<!--
@file design.md - 历史作业筛选栏尺寸修复设计
@author PopoY
@created 2026-07-29 10:10:51
@editor PopoY
@edited 2026-07-29 10:26:24
@purpose 规定复用压机作业既有表单栅格尺寸的最小实现。
-->

## Context

历史筛选栏当前使用裸 `label + flex（弹性布局）`，日期、模具号、作业人员的字段宽度分别为 `270/190/190px`，实际控件宽度仅为 `206/126/126px`。压机作业已通过 Ant Design `Form + Row + Col（表单栅格）`建立 `72px` 标签列、`12px` gutter 和 `220/220/360px` 字段列；用户明确要求复用这套已验证尺寸。

前一次修复的 `border-box（边框盒）`、`62px` 外高和 `44px` 触控高度仍然正确，应保留；未解决的是横向字段分配。

## Goals / Non-Goals

**Goals:**

- 直接复用压机作业的表单栅格结构和尺寸，让历史日期、模具号、作业人员完整可读。
- 保持 `62px` 筛选栏、`44px` 触控高度和 1280×720 单行布局。
- 用聚焦结构与尺寸契约防止历史页重新偏离压机页模式。

**Non-Goals:**

- 不把历史日期或模具号改成压机页的业务 Select（选择器），只复用布局尺寸。
- 不引入压机页的班组级联、预选工艺、指导按钮、Tour（引导）或 popup（浮层）逻辑。
- 不新增共享抽象、依赖或配置。

## Decisions

1. 将历史筛选栏改为与压机作业相同的 `Form component="section"`、`labelCol={{ flex: "72px" }}`、`wrapperCol={{ flex: "1 1 0" }}` 和 `Row gutter={12} wrap={false}`。
2. 按内容长度映射压机页现有列：日期范围使用预选工艺的 `360px` 长列，模具号与作业人员使用班组/人员的 `220px` 标准列，查询按钮放入 `flex="auto"` 剩余列。
3. 保留历史页专属 `RangePicker（日期范围选择器）`、Input（输入框）、日期校验提示和查询处理；只替换布局容器，不复制压机页业务逻辑。
4. 保留已有 `border-box + 62px + 44px` 垂直尺寸。删除历史页手工 `270/190/190px` flex 规则，避免继续维护平行尺寸体系。

## Risks / Trade-offs

- [Ant Design Form 生成的 DOM 与裸 label 不同] → 使用现有 PressJobPage 的同形结构与样式选择器，并运行真实 server render（服务端渲染）测试。
- [日期校验提示可能被表单布局影响] → 保留字段定位容器和绝对定位提示，聚焦检查其父子结构。
- [静态契约不能代替视觉结果] → 生成 1280×720 浏览器截图并读取实际 bounding box（边界框）尺寸后才能再次声明修复。

## Migration Plan

无数据迁移。随 QT App（Qt 应用）前端资源发布；回滚时恢复历史页原有筛选 JSX、CSS 和对应测试断言。

## Open Questions

无。

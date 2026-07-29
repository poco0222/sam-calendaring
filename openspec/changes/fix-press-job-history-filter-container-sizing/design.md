<!--
@file design.md - 历史作业筛选栏尺寸修复设计
@author PopoY
@created 2026-07-29 10:10:51
@editor PopoY
@edited 2026-07-29 11:14:03
@purpose 规定压机作业与历史作业复用既有表单栅格和 medium 控件高度的最小实现。
-->

## Context

历史筛选栏当前使用裸 `label + flex（弹性布局）`，日期、模具号、作业人员的字段宽度分别为 `270/190/190px`，实际控件宽度仅为 `206/126/126px`。压机作业已通过 Ant Design `Form + Row + Col（表单栅格）`建立 `72px` 标签列、`12px` gutter 和 `220/220/360px` 字段列；用户明确要求复用这套已验证尺寸。

横向字段分配已对齐，但历史页仍用通用选择器把所有筛选控件强制到 `44px`。压机页的实际筛选控件是 Ant Design medium（中号）默认高度；用户明确选择以压机作业为唯一尺寸基准，历史页必须删除自己的高度覆盖。

完成历史页修复后，压机筛选栏的两个 guidance launcher（指导入口）仍由 `.press-job-page__guidance-launchers .ant-btn` 强制为 `44px`，而同栏 Select 与历史查询按钮实际均为 `32px`。它们属于辅助入口，应回归 medium 默认高度；真正生产操作按钮仍保留独立 `44px` 规则。

## Goals / Non-Goals

**Goals:**

- 直接复用压机作业的表单栅格结构和尺寸，让历史日期、模具号、作业人员完整可读。
- 保持 `62px` 筛选栏和 1280×720 单行布局，控件高度直接继承压机页使用的 medium 默认值。
- 用聚焦结构与尺寸契约防止历史页重新偏离压机页模式。
- 让压机页两个指导按钮与历史查询按钮同高，同时保持下方生产操作按钮触控尺寸不变。

**Non-Goals:**

- 不把历史日期或模具号改成压机页的业务 Select（选择器），只复用布局尺寸。
- 不向历史页引入压机页的班组级联、预选工艺、指导按钮、Tour（引导）或 popup（浮层）逻辑。
- 不修改压机页 Tour 步骤、点击处理或下方生产操作按钮尺寸。
- 不新增共享抽象、依赖或配置。

## Decisions

1. 将历史筛选栏改为与压机作业相同的 `Form component="section"`、`labelCol={{ flex: "72px" }}`、`wrapperCol={{ flex: "1 1 0" }}` 和 `Row gutter={12} wrap={false}`。
2. 按内容长度映射压机页现有列：日期范围使用预选工艺的 `360px` 长列，模具号与作业人员使用班组/人员的 `220px` 标准列，查询按钮放入 `flex="auto"` 剩余列。
3. 保留历史页专属 `RangePicker（日期范围选择器）`、Input（输入框）、日期校验提示和查询处理；只替换布局容器，不复制压机页业务逻辑。
4. 保留已有 `border-box + 62px` 外层尺寸；删除历史页筛选控件的两段 `44px` override（覆盖规则），避免继续维护与压机页不同的高度体系。
5. 删除 `.press-job-page__guidance-launchers .ant-btn` 的 `min-height: 44px`，保留 `white-space: nowrap`；不显式写 `32px` 或 `size="middle"`，直接继承与历史查询按钮相同的 medium 主题尺寸。
6. 通过 `press-job-history-query` delta spec（增量规格）固化跨页面 medium 高度与生产操作按钮独立触控高度，不提前同步主规格，统一由 archive（归档）阶段处理。

## Risks / Trade-offs

- [Ant Design Form 生成的 DOM 与裸 label 不同] → 使用现有 PressJobPage 的同形结构与样式选择器，并运行真实 server render（服务端渲染）测试。
- [日期校验提示可能被表单布局影响] → 保留字段定位容器和绝对定位提示，聚焦检查其父子结构。
- [静态契约不能代替视觉结果] → 生成 1280×720 浏览器截图并读取实际 bounding box（边界框）尺寸后才能再次声明修复。
- [指导按钮缩小可能误伤生产操作] → 只删除 guidance launcher 作用域内的高度声明，并实测 `.press-job-page__actions .ant-btn` 仍为 `44px`。

## Migration Plan

无数据迁移。随 QT App（Qt 应用）前端资源发布；回滚时恢复历史页原有筛选 JSX、CSS 和对应测试断言。

## Open Questions

无。

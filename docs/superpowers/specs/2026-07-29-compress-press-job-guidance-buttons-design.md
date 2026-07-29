---
comet_change: fix-press-job-history-filter-container-sizing
role: technical-design
canonical_spec: openspec
status: final
---

<!--
@file 2026-07-29-compress-press-job-guidance-buttons-design.md
@author PopoY
@created 2026-07-29 10:57:34
@editor PopoY
@edited 2026-07-29 11:08:06
@purpose 规定压机作业顶部指导按钮与历史作业查询按钮的尺寸对齐边界和验证方式。
-->

# 压机作业指导按钮紧凑化设计

## 1. 目标与边界

把压机作业筛选栏中的“开始加工指导”和“完成加工指导”两个按钮压缩为与历史作业“查询”按钮一致的 Ant Design medium（中号）默认高度；当前真实页面目标为 `32px`。

- 两个指导按钮宽度继续随中文文案和图标自适应，不要求与“查询”按钮同宽。
- 保留右对齐、`8px` 间距和不换行行为。
- 不修改班组、人员、预选工艺 Select（选择器）的结构或尺寸。
- 不修改下方“建立通信、锁定模具、开始加工、完成加工”等生产操作按钮；它们继续保持独立的 `44px` 触控高度。
- 不修改 Tour（引导）步骤、点击处理、业务状态、ERP API（接口）、Driver Service（驱动服务）或依赖。

## 2. 方案

删除 `.press-job-page__guidance-launchers .ant-btn` 中专属的 `min-height: 44px`，保留 `white-space: nowrap`。两个 Button（按钮）本身没有 `size` 属性，因此会与历史查询按钮一样继承现有 `ConfigProvider componentSize="medium"` 的默认尺寸。

不显式增加 `height: 32px`、`min-height: 32px` 或 `size="middle"`：这些写法重复当前主题配置，并会在全局组件密度调整后重新形成平行尺寸体系。

## 3. 布局与交互

- Spacing（间距）：继续使用 `.press-job-page__guidance-launchers { gap: 8px; }`。
- Hierarchy（层级）：筛选和指导入口统一为紧凑控件；下方真实生产动作继续使用 `44px`，保持主次层级。
- Grid（栅格）：保留现有 `Form + Row + Col` 和指导按钮所在的 `Col flex="auto"`，不调整列宽。
- Error handling（错误处理）：本次无数据流或异常分支变化；按钮原有启用、点击和 Tour 行为保持不变。

## 4. TDD 与验收

1. 先修改 `PressJobPage.test.tsx` 的指导按钮尺寸契约，明确禁止 `.press-job-page__guidance-launchers .ant-btn` 恢复 `min-height: 44px`，并运行聚焦 Vitest（测试框架）记录 RED（失败）。
2. 删除唯一的 `min-height: 44px` 声明，运行聚焦测试记录 GREEN（通过）。
3. 在真实 `1280×720` 页面分别读取：
   - 两个指导按钮可见高度均为 `32px`。
   - 历史查询按钮可见高度为 `32px`。
   - 下方生产操作按钮仍为 `44px`。
4. 运行完整 `pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build`、Impeccable layout（布局）复扫和 `git diff --check`。

## 5. 已知边界

两个指导按钮的可见按钮本体将与历史查询按钮一样为 `32px`，不再单独满足 `44px` 按钮本体高度。该结果是本次跨页面视觉一致性的明确选择；如果未来统一恢复最小 `44px` 触控规范，应同时调整压机筛选控件、指导按钮和历史筛选控件，而不是再次为单页增加覆盖。

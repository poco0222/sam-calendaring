---
name: QT App V1 Bootstrap
description: A field-readable industrial bootstrap dashboard for fixed Windows touch IPC devices.
colors:
  primary-control-blue: "#0078c8"
  success-signal-green: "#52c41a"
  warning-caution-amber: "#faad14"
  error-fault-red: "#ff4d4f"
  light-surface: "#ffffff"
  light-ink: "#000000"
  dark-field-bg: "#151518"
  dark-panel: "#242428"
  dark-elevated-panel: "#2c2c30"
  dark-border: "#6e6e73"
  dark-ink: "#f5f5f7"
  dark-secondary-text: "#d1d1d6"
typography:
  title:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.27
    letterSpacing: "normal"
  body:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.57
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  md: "6px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary-control-blue}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.md}"
    padding: "4px 15px"
    height: "32px"
  button-default:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.md}"
    padding: "4px 15px"
    height: "32px"
  status-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.md}"
    padding: "12px"
  status-tag-success:
    backgroundColor: "{colors.success-signal-green}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.md}"
    padding: "0 7px"
  status-tag-error:
    backgroundColor: "{colors.error-fault-red}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.md}"
    padding: "0 7px"
---

# Design System: QT App V1 Bootstrap

## 1. Overview

**Creative North Star: "Field Control Desk"**

`QT App V1 Bootstrap` 的视觉系统是一块现场控制台，而不是展示型 `dashboard`（仪表盘）。它服务于固定 1280x720 的 10-inch Windows touch IPC（10 寸 Windows 触控工控机）：操作员需要快速看清工控机绑定、ERP auto-login（ERP 免登录）、signedLease（签名租约）、Driver Service（驱动服务）和 signal snapshot（信号快照）的状态。

系统需要有设计性，但必须克制。设计感来自清楚的 hierarchy（层级）、稳定的 alignment（对齐）、紧凑但可触控的 controls（控件）、明确的 state color（状态色）和中文文案，而不是装饰性 motion（动效）、大面积阴影、glass effect（玻璃效果）或花哨背景。

它继承现有 `Ant Design`（组件库）语言：`ConfigProvider`（全局配置提供器）集中主题，`Row`/`Col`（栅格）、`Card`（卡片）、`Descriptions`（描述列表）、`Table`（表格）、`Alert`（警告）、`Tag`（标签）、`Segmented`（分段控制器）和 `Button`（按钮）构成界面。后续设计必须先复用这些已存在模式。

**Key Characteristics:**

- Fixed field viewport（固定现场视口）：以 1280x720 为设计基线。
- Compact diagnostic layout（紧凑诊断布局）：信息密度高，但状态和动作必须可扫读。
- Restrained industrial color（克制工业色）：沿用现有 `#0078c8` 主色和 Ant Design 状态色。
- Light lift, not decoration（轻层级，不装饰）：层级可用轻阴影和边界表达，但不能变成展示型卡片墙。
- Chinese-first operator copy（中文优先操作文案）：错误和状态不能回退到英文原始异常。

## 2. Colors

色彩系统使用现有 `Ant Design`（组件库）`token`（令牌），命名采用工业状态语义，但不改变当前主题色配置。

### Primary

- **Control Blue** (`primary-control-blue`): 主操作、信息状态和当前选择使用的控制蓝。light theme（浅色主题）当前值为 `#0078c8`；dark theme（深色主题）使用 `#0a84ff`，dashboard（仪表盘）局部强调使用 `#64d2ff` 提升深色可读性。

### Secondary

- **Signal Green** (`success-signal-green`): 成功、通过、已连接、active（激活）状态。light theme（浅色主题）当前值为 `#52c41a`；dark theme（深色主题）使用 `#30d158`。
- **Caution Amber** (`warning-caution-amber`): 警告、等待确认、需要现场注意但未失败的状态。light theme（浅色主题）当前值为 `#faad14`；dark theme（深色主题）使用 `#ffd60a`。
- **Fault Red** (`error-fault-red`): 错误、拒绝、faulted（故障）和阻断流程的状态。light theme（浅色主题）当前值为 `#ff4d4f`；dark theme（深色主题）使用 `#ff453a`。

### Neutral

- **Light Surface** (`light-surface`): light theme（浅色主题）的主背景，当前值为 `#ffffff`。
- **Light Ink** (`light-ink`): light theme（浅色主题）的正文文字，当前值为 `#000000`。
- **Dark Field Background** (`dark-field-bg`): dark theme（深色主题）的现场背景，当前值为 `#151518`。
- **Dark Panel** (`dark-panel`): dark theme（深色主题）的容器背景，当前值为 `#242428`。
- **Dark Elevated Panel** (`dark-elevated-panel`): dark theme（深色主题）的浮层容器背景，当前值为 `#2c2c30`。
- **Dark Border** (`dark-border`): dark theme（深色主题）的边界线，当前值为 `#6e6e73`。
- **Dark Ink** (`dark-ink`): dark theme（深色主题）的主文字，当前值为 `#f5f5f7`。
- **Dark Secondary Text** (`dark-secondary-text`): dark theme（深色主题）的次级文字，当前值为 `#d1d1d6`。

### Named Rules

**The Status Means State Rule.** Control Blue、Signal Green、Caution Amber 和 Fault Red 只用于动作、选择和状态，不用于装饰。

**The No Spectacle Dark Rule.** dark theme（深色主题）必须保持现场可读，禁止做成过度炫酷 dark dashboard（深色仪表盘）。

## 3. Typography

**Display Font:** IBM Plex Sans with system fallbacks  
**Body Font:** IBM Plex Sans with system fallbacks  
**Label/Mono Font:** no separate mono stack

**Character:** 单一 sans-serif（无衬线）字体系统让界面像现场工具，不像宣传页。字号比例保持 Ant Design 的产品界面节奏，避免 display typography（展示字体）抢走状态信息的优先级。

### Hierarchy

- **Title** (600, 30px, 1.27): 用于页面标题，例如“启动仪表盘”。只保留一个页面级标题。
- **Body** (400, 14px, 1.57): 用于 `Descriptions`（描述列表）、`Table`（表格）、`Alert`（警告）和普通状态内容。
- **Label** (400, 12px, 1.5): 用于 `Tag`（标签）、紧凑元信息和小型控制说明。

### Named Rules

**The One Operator Language Rule.** 用户可见状态、错误和动作必须优先使用中文；不要把 raw English runtime error（英文运行时错误）暴露给操作员。

**The No Display Drama Rule.** 产品界面不使用夸张 display type（展示字体）；设计感来自层级、密度和状态，而不是大标题。

## 4. Elevation

系统采用 `Subtle Lift`（轻层级）策略：默认靠 surface（表面）、border（边界）、spacing（间距）和 status tag（状态标签）建立层级；只有在需要表达 hover（悬停）、focus（聚焦）或当前操作面板时，才允许小范围轻阴影。不要把所有 `Card`（卡片）都做成漂浮层。

### Shadow Vocabulary

- **Control Lift** (`box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12)`): 仅用于可交互容器的 hover（悬停）或 focus-within（内部聚焦）状态。
- **Focus Ring** (`box-shadow: 0 0 0 2px rgba(0, 120, 200, 0.22)`): 用于 keyboard focus（键盘聚焦）或触屏辅助焦点。

### Named Rules

**The Lift Must Explain Itself Rule.** 阴影必须表示可操作、当前、聚焦或临时浮层；静态装饰阴影禁止使用。

**The No Broad Shadow Rule.** 禁止 broad shadows（大范围阴影）和 `1px border + 16px+ blur shadow` 的 ghost-card（幽灵卡片）组合。

## 5. Components

### Buttons

- **Shape:** 中等圆角，来自 Ant Design `borderRadius`（6px）。
- **Primary:** Control Blue 背景，白色文字，用于“刷新快照”这类当前主要动作。
- **Default:** 白色或当前 surface（表面）背景，用于“重试登录”“重获授权”等次级动作。
- **Hover / Focus:** 可以使用 Control Lift 或 Focus Ring，但不改变按钮语义色。

### Chips

- **Style:** 状态使用 `Tag`（标签），颜色必须来自状态语义：success（成功）、error（错误）、processing（处理中）、default（默认）。
- **State:** 不依赖颜色单独传达状态，标签文案必须同步说明“成功”“异常”“加载中”“未启动”。

### Cards / Containers

- **Corner Style:** 中等圆角（6px）。
- **Background:** light theme（浅色主题）使用白色 surface（表面）；dark theme（深色主题）使用深色 panel（面板）。
- **Shadow Strategy:** 默认不加阴影；仅在当前或聚焦状态使用 Control Lift。
- **Border:** 依赖 Ant Design 默认边界，dark theme（深色主题）使用 `#6e6e73`。
- **Internal Padding:** 小型状态卡以紧凑 padding（12px 左右）为基准，页面外边距使用 16px。

### Inputs / Fields

- **Style:** V1 当前没有配置编辑 form（表单）；后续如果新增输入，必须继承 Ant Design medium（中等）控件、6px 圆角和清晰 focus ring（聚焦环）。
- **Focus:** 使用 Control Blue focus ring（聚焦环），不能只靠边框颜色变化。
- **Error / Disabled:** 错误状态使用 Fault Red，disabled（禁用）状态必须清晰不可操作。

### Navigation

- **Style:** V1 当前没有主 navigation（导航）。主题模式使用右上角图标式 `Segmented`（分段控制器），只承载 display preference（显示偏好），不能混入业务动作。

### Status Dashboard

Bootstrap Dashboard（启动仪表盘）由六块状态区组成：工控机绑定信息、ERP 登录状态、租约授权状态、驱动服务状态、信号快照、错误面板。布局使用 `Row`/`Col`（栅格）和 16px gutter（间距），在 1280x720 下保持紧凑可读。

## 6. Do's and Don'ts

### Do:

- **Do** keep the interface as a Field Control Desk（现场控制台）：紧凑、清晰、状态优先。
- **Do** use `#0078c8` as Control Blue for primary action（主操作）、current selection（当前选择）和 info state（信息状态）。
- **Do** keep success/warning/error colors tied to actual runtime state（运行状态）。
- **Do** preserve the single `Ant Design` component vocabulary（组件语言）：Button、Card、Table、Alert、Tag、Segmented、Descriptions。
- **Do** design for the fixed 1280x720 Windows touch IPC（触控工控机） baseline before considering larger screens.
- **Do** use subtle lift（轻层级） only for hover（悬停）、focus（聚焦） or active context（当前上下文）。
- **Do** render user-facing UI（用户界面） and error copy（错误文案） in Chinese.

### Don't:

- **Don't** create traditional ERP-heavy form walls where every field has equal visual weight and operators must search for the current state.
- **Don't** create over-styled dark dashboards that look impressive in screenshots but reduce trust, readability, or touch accuracy on field hardware.
- **Don't** use low-contrast gray text, ambiguous status color, raw English runtime errors, or ordinary account/password login screens.
- **Don't** suggest operators can manually override `ip`, `port`, or `deviceId` outside the signedLease（签名租约） and signalConfig（信号配置） path.
- **Don't** use decorative cards, nested cards, broad shadows, gradient text, glass effects, or visual flourishes that do not help an operator answer the startup-state question faster.
- **Don't** add side-stripe borders, oversized radius, decorative motion, or marketing-page typography to this product UI（产品界面）.

# Press Working Tour Guidance Design

> @file QT App 压机作业 Tour（漫游式引导）设计说明
> @author PopoY
> @created 2026-07-03
> @purpose 固化 PressJobPage（压机作业页）新增开始加工指导、完成加工指导、解锁模具指导的 UI（用户界面）入口、Tour（漫游式引导）流程、半强制引导规则和验证范围。

## 1. Goal（目标）

在 `PressJobPage（压机作业页）` 中新增三种独立 `Tour guidance（漫游式指导）`：

1. `开始加工指导`：指导操作工从班组、人员、预选工艺等条件确认开始，直到点击真实的“开始加工”生产动作。
2. `完成加工指导`：指导操作工确认当前作业和实时信号，再点击真实的“完成加工”生产动作。
3. `解锁模具指导`：在 `Unlock Drawer（解锁抽屉）` 内指导操作工理解已锁定、需保留、已选择状态，并完成解锁选择。

三种 guidance（指导）采用半强制 `guided Tour（引导流程）`：每一步提示当前要做的现场动作，必要条件不满足时不进入下一步，但保留关闭入口，避免现场异常时卡死操作界面。

## 2. Non-Goals（不做范围）

1. 不把三种 guidance（指导）合并成一个从头到尾的大流程。
2. 不新增 `workflow engine（工作流引擎）`、router（路由）、全局 state store（状态仓库）或新的前端 dependency（依赖）。
3. 不替代真实生产动作按钮，“开始加工指导”“完成加工指导”“解锁模具指导”只负责启动 Tour（漫游式引导）。
4. 不在 guidance（指导）中自动选择班组、人员、预选工艺、模具或自动提交生产动作。
5. 不修改 Driver Service（驱动服务）、Modbus Device（Modbus 设备）或 ERP Server（企业资源计划服务器）接口契约。
6. 不让 QT App（Qt 应用）传裸 `deviceId（设备 ID）`、`ip（网络地址）` 或 `port（端口）`。
7. 不引入新的视觉体系，不使用装饰性卡片、过度阴影、gradient text（渐变文字）或 glass effect（玻璃效果）。

## 3. Current Context（当前上下文）

当前项目已有以下基础：

1. 前端为 `React（前端库） + Ant Design（设计组件库）`，`antd` 已安装，版本为 `6.4.5`。
2. `PressJobPage（压机作业页）` 已有班组、人员、预选工艺三个 `Select（选择器）`。
3. `PressJobPage（压机作业页）` 已有真实生产动作：锁定模具、开始加工、完成加工、进站、出站、上线、下线。
4. `PressJobPage（压机作业页）` 已有 `Unlock Drawer（解锁抽屉）`，顶部展示“已锁定 n 套”“加工中需保留 1 套”“已选 n 套”三个 `Tag（标签）`。
5. 现有页面基线是固定 `1280x720 touch IPC（触控工控机）`，布局必须保持紧凑、可读、可触控。
6. 现有设计系统要求使用 Ant Design（设计组件库）组件语言，保留 `#0078c8` control blue（控制蓝）和语义状态色。

## 4. Design Decision（设计决策）

采用方案：**三入口 guidance launcher（指导启动入口） + Ant Design Tour（漫游式引导） + 页面内最小状态**。

1. 在顶部筛选区右侧新增 `开始加工指导` 和 `完成加工指导` 两个按钮，按钮右对齐。
2. 班组、人员两个筛选框缩小为目前约一半宽度，预选工艺保持现有宽度，三个筛选框整体左对齐。
3. 在 `Unlock Drawer（解锁抽屉）` 顶部状态条右侧新增 `解锁模具指导` 按钮，按钮右对齐。
4. 使用 Ant Design `Tour（漫游式引导）` 作为引导浮层，不新增自研浮层组件。
5. 在 `PressJobPage（压机作业页）` 内维护一个最小状态：

```text
activeTour: "start" | "complete" | "unlock" | null
currentTourStep: number
```

6. 每一种 guidance（指导）维护独立 `steps（步骤）` 配置，避免把三条业务路径耦合成一个大流程。

放弃方案：

1. 单一完整 Tour（漫游式引导）：覆盖范围过大，操作工只想做完成加工或解锁模具时会被无关步骤打断。
2. 流程锁定 wizard（向导流程）：管控更强，但现场异常处理成本高，且容易阻塞真实生产。
3. 自研 Tour（漫游式引导）组件：没有必要，Ant Design 已提供可复用基础能力。

## 5. Layout Contract（布局契约）

### 5.1 Top Filters and Guidance Buttons（顶部筛选和指导按钮）

顶部筛选区拆成左右两部分：

```text
[班组 Select] [人员 Select] [预选工艺 Select]                    [开始加工指导] [完成加工指导]
```

布局规则：

1. 班组 `Select（选择器）` 和人员 `Select（选择器）` 缩小为当前约一半宽度，但必须保留触控可点区域。
2. 预选工艺 `Select（选择器）` 保持当前宽度，不缩短选项阅读空间。
3. 三个筛选框左对齐，不居中、不平均铺满整行。
4. `开始加工指导` 和 `完成加工指导` 放在同一行右侧，整体右对齐。
5. 不使用 `Form inline（内联表单）` 属性；继续使用 `Row（行）` 和 `Col（列）` 或等价的 Ant Design grid（栅格）排版。
6. 推荐用 `Col flex（弹性列）` 或 CSS grid（网格布局）控制宽度，不建议只用 `span={4}`，避免 `labelCol（标签列）` 吃掉过多输入宽度。

按钮语义：

| Button（按钮） | Type（类型） | Purpose（用途） |
| --- | --- | --- |
| 开始加工指导 | default 或 outlined | 启动开始加工 guidance（指导），不是生产提交。 |
| 完成加工指导 | default 或 outlined | 启动完成加工 guidance（指导），不是生产提交。 |

### 5.2 Unlock Drawer Guidance Entry（解锁抽屉指导入口）

`Unlock Drawer（解锁抽屉）` 顶部状态条调整为左右分布：

```text
[已锁定 n 套] [加工中需保留 1 套] [已选 n 套]                    [解锁模具指导]
```

布局规则：

1. 三个 `Tag（标签）` 保持左侧分组，继续承担状态说明。
2. `解锁模具指导` 放在同一行右侧，右对齐。
3. 该按钮只在 Drawer（抽屉）打开后显示，不移动页面外部的“解锁模具”入口。
4. Drawer（抽屉）关闭时不能丢失打开 Drawer（抽屉）的生产入口。

## 6. Tour Flow Contract（漫游流程契约）

### 6.1 Start Processing Guidance（开始加工指导）

步骤建议：

1. 高亮班组 `Select（选择器）`，提示：“请先确认本次作业班组。”
2. 高亮人员 `Select（选择器）`，提示：“请选择当前操作员。”
3. 高亮预选工艺 `Select（选择器）`，提示：“请选择本次加工工艺。”
4. 高亮“锁定模具”入口或当前作业 Table（表格），提示：“开始加工前请确认模具已锁定。”
5. 高亮预计加工时长 `Input（输入框）`，提示：“请确认预计加工时长，系统会用于开始加工记录。”
6. 高亮真实“开始加工”按钮，提示：“确认无误后点击开始加工。”

必要条件：

1. 未选择班组时，不进入人员步骤，并提示中文 warning（警告）。
2. 未选择人员时，不进入预选工艺步骤。
3. 未选择预选工艺时，不进入开始加工动作步骤。
4. 当前没有可开始的作业时，Tour（漫游式引导）可提示原因并停留在当前作业 Table（表格）。

### 6.2 Complete Processing Guidance（完成加工指导）

步骤建议：

1. 高亮当前作业 Table（表格），提示：“请确认当前作业处于加工中。”
2. 高亮实时信号 Snapshot（快照）区域，提示：“完成加工会读取最终信号并记录参数。”
3. 高亮真实“完成加工”按钮，提示：“确认后点击完成加工，系统会执行 ERP complete（ERP 完工）和 Driver cleanup（驱动清理）。”

必要条件：

1. 当前没有加工中的作业时，不推进到完成加工按钮步骤。
2. Driver Session（驱动会话）未连接时，提示需要先恢复驱动连接。
3. 完成加工指导不自动触发 final snapshot（最终快照）或提交 ERP complete（ERP 完工）。

### 6.3 Unlock Mold Guidance（解锁模具指导）

该 guidance（指导）只在 `Unlock Drawer（解锁抽屉）` 内启动。

步骤建议：

1. 高亮“已锁定 n 套”Tag（标签），提示：“这里显示当前可查看的已锁定模具数量。”
2. 高亮“加工中需保留 1 套”Tag（标签），提示：“加工中不能解锁最后一套，请先完成加工。”
3. 高亮“已选 n 套”Tag（标签），提示：“勾选模具后这里会同步显示已选数量。”
4. 高亮 Drawer Table（抽屉表格）选择列，提示：“请选择需要解锁的模具。”
5. 高亮真实“确认解锁 n 套”按钮，提示：“确认选择后再执行解锁。”

必要条件：

1. Drawer（抽屉）未打开时，不启动 `解锁模具指导`。
2. 已锁定模具为空时，提示“当前没有可解锁模具。”
3. 未选择模具时，不推进到确认解锁动作步骤。
4. 如果选择会违反“加工中需保留 1 套”规则，提示使用完成加工功能。

## 7. Interaction Contract（交互契约）

1. 每个 guidance launcher（指导启动按钮）点击后只设置 `activeTour（当前漫游）`，不直接改业务数据。
2. Tour（漫游式引导）关闭时清空 `activeTour（当前漫游）` 和 `currentTourStep（当前步骤）`。
3. Tour（漫游式引导）点击 `Next（下一步）` 时先执行当前步骤的 condition check（条件检查）。
4. 条件不满足时，使用 `message.warning（警告消息）` 显示中文提示，并保持当前步骤。
5. Tour（漫游式引导）允许关闭，不能禁用页面上的真实异常处理路径。
6. Tour（漫游式引导）文案必须是中文，专业术语可用 English（中文翻译）形式。
7. 不在 Tour（漫游式引导）中记录敏感数据，也不把 selected rows（选中行）完整写入日志。

## 8. Accessibility and Field Usability（可访问性与现场可用性）

1. 新增按钮高度保持现有 touch target（触控目标）水平，优先不低于 32px，顶部筛选区内建议接近 44px。
2. 长中文按钮文案不得溢出容器；必要时使用更短文案，不使用超小字号硬塞。
3. Tour（漫游式引导）的可关闭入口必须可见。
4. 颜色不单独承担语义，步骤标题和说明必须写清楚操作意图。
5. 禁用、加载、警告状态继续沿用 Ant Design（设计组件库）标准 affordance（可感知操作方式）。
6. 1280x720 baseline（基线视口）必须检查顶部筛选区、生产动作区、当前作业表、Unlock Drawer（解锁抽屉）不互相挤压。

## 9. Testing and Verification（测试与验证）

### 9.1 Unit Tests（单元测试）

推荐新增或调整 `PressJobPage.test.tsx`：

1. 渲染三个 guidance launcher（指导启动按钮）。
2. 点击 `开始加工指导` 后出现第一步 Tour（漫游式引导）。
3. 开始加工 guidance（指导）在缺少班组、人员、预选工艺时保持当前步骤并给出 warning（警告）。
4. 点击 `完成加工指导` 后进入完成加工 guidance（指导）。
5. Drawer（抽屉）打开后渲染 `解锁模具指导`。
6. Drawer（抽屉）关闭时不渲染或不可触发 `解锁模具指导`。

### 9.2 Visual Verification（视觉验证）

1. 在 1280x720 视口检查顶部筛选区不换行、不遮挡、不压缩生产动作区。
2. 检查两个顶部 guidance（指导）按钮右对齐。
3. 检查 Unlock Drawer（解锁抽屉）中 status tags（状态标签）左对齐，`解锁模具指导` 右对齐。
4. 检查 Tour（漫游式引导）浮层不会遮住被指导的关键控件。

### 9.3 Regression Gates（回归门禁）

1. `pnpm test`
2. `pnpm build`
3. 如本地 dev server（开发服务器）可用，使用 Browser（浏览器）做 1280x720 smoke check（冒烟检查）。

## 10. Decided Boundaries（已定边界）

1. Guidance（指导）采用半强制 guided Tour（引导流程），不采用提示型或流程锁定型。
2. 三个 guidance（指导）独立启动，不合并为大 Tour（漫游式引导）。
3. 真实生产动作按钮保留，guidance launcher（指导启动按钮）不执行生产动作。
4. `解锁模具指导` 只放在 Unlock Drawer（解锁抽屉）内，不移动页面外部“解锁模具”入口。
5. 实现第一版只覆盖 PressJobPage（压机作业页），不抽取全局 reusable tour framework（可复用漫游框架）。

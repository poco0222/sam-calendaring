# QT App Tech Stack

> @file QT App 技术栈规则
> @author PopoY
> @created 2026-06-25
> @purpose 仅固化当前阶段已确定的 QT 应用技术栈选择。

## 已确定

新开发的 `QT App` 采用：

```text
Qt WebEngine + React + TypeScript + TSX + Ant Design 6.4.5 + Vite
```

其中：

1. `Qt WebEngine` 负责承载新前端页面。
2. `React` 是前端框架。
3. `TypeScript` 是默认前端语言。
4. `TSX` 是默认组件写法。
5. `Ant Design 6.4.5` 是默认 UI 组件库。
6. `Vite` 是默认构建工具。

## Ant Design Global Config

新 `QT App` 必须集中配置 `Ant Design` 全局能力，不在业务组件里重复声明主题和国际化。

默认全局配置：

1. 使用 `ConfigProvider` 作为根级 `Provider`。
2. `locale` 使用 `zh_CN`，并从 `antd/es/locale/zh_CN` 引入。
3. `componentSize` 使用 `medium`。
4. 默认 `theme mode` 使用 `system（跟随系统）`，并允许操作员切换 `light（浅色）`、`dark（深色）`、`system（跟随系统）`。
5. 使用 `@ant-design/happy-work-theme` 的 `HappyProvider` 承载动态波纹效果。
6. 使用 `ConfigProvider.config({ holderRender })` 让 `message`、`modal`、`notification` 静态方法继承同一套 `Provider`。
7. 业务组件优先使用 `App.useApp()` 或 hooks 形态调用反馈组件；`holderRender` 只用于无法避免的静态方法兼容。

主题公共 `token` 固定为：

```json
{
  "token": {
    "colorPrimary": "#0078c8",
    "colorInfo": "#0078c8",
    "colorSuccess": "#52c41a",
    "colorWarning": "#faad14",
    "colorError": "#ff4d4f",
    "borderRadius": 6,
    "fontFamily": "IBM Plex Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  }
}
```

`light（浅色）` 使用 `theme.defaultAlgorithm`，并设置 `colorTextBase="#000000"`、`colorBgBase="#ffffff"`。
`dark（深色）` 使用 `theme.darkAlgorithm`，并设置 `colorPrimary="#0a84ff"`、`colorTextBase="#f5f5f7"`、`colorTextSecondary="#d1d1d6"`、`colorBgBase="#151518"`、`colorBgContainer="#242428"`、`colorBgElevated="#2c2c30"`、`colorBorder="#6e6e73"`。

`ConfigProvider`、`HappyProvider`、`holderRender` 和主题算法必须封装在一个根级模块中，例如 `AntdRootProvider`，不得在页面组件中散落配置。
这些 `token` 只能通过 `ConfigProvider.theme.token` 注入，不允许业务组件直接读取或硬编码 `colorBgBase`、`colorTextBase` 等派生基础色。

## 参考边界

现有 `ERP` 操作页可作为交互复杂度和流程参考：

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/views/sam-smes2/prd/partsOrder/pressWorking/pressWorkingTimeFeedback.vue
```

但新 `QT App` 不复用：

1. `Vue 2`
2. `Element UI 2.x`
3. 旧页面组件结构
4. 旧页面样式体系
5. 旧页面 mixin 组织方式

## Ant Design CLI

本机已安装 `@ant-design/cli`，当前验证到的 CLI 版本为 `6.4.5`。

后续在项目中安装 `Ant Design skill` 时，先检查和预览：

```bash
antd setup --client codex --check
antd setup --client codex --mode skill --dry-run
```

确认后再写入：

```bash
antd setup --client codex --mode skill
```

当前 `Codex` 只使用 `--mode skill`。不要使用：

```bash
antd setup --client codex --mode both
```

## 未定

以下内容当前不在本规则内定稿：

1. `ERP` 接口契约
2. `Driver Service` 通信方式
3. 本地存储方案
4. `native bridge` API
5. 应用目录结构
6. 业务状态机细节

开发前接口、状态、线程和错误边界见：

```text
docs/development-boundary-constraints.md
```

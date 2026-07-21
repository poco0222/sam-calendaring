<!--
@file design.md - Windows Qt 原生应用打包修复设计
@author PopoY
@created 2026-07-21 15:42:36
@purpose 规定 Windows runner、Qt 模块和 native 构建失败传播的最小修复方案。
-->

## 修复方案

将 job 的 runner image（运行器镜像）从会迁移的 `windows-latest` 固定为 `windows-2022`，继续复用 workflow 现有的 Visual Studio 2022 初始化路径和 `win64_msvc2022_64` Qt 架构，不引入额外 GitHub Action。

在 `install-qt-action` 的 `modules` 中加入 `qtpositioning`，补齐 `QtWebEngineCore` 的运行时构建依赖。

为 `vcvars64.bat`、CMake configure（配置）、build（构建）和 CTest（测试）命令分别追加 `|| exit /b 1`。任何前序失败都会由 native step 原位报告并终止，不再进入部署步骤产生误导性的 `Copy-Item` 错误。

## 边界

- 不修改 `qt_app_native.exe` 的目标名称或复制路径。
- 不引入 MSVC 环境初始化 Action 或自定义脚本。
- 不调整 Qt、Node.js、pnpm 或 .NET 版本。
- 不修改应用代码和产品行为。

## 验证

1. 修复前的静态检查必须因 runner、Qt 模块和 fail-fast 条件不满足而失败。
2. 修复后同一检查通过，且 workflow YAML（工作流配置）可解析。
3. OpenSpec change 验证通过；Windows GitHub Actions 远程打包由提交后实际运行最终确认。

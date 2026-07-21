<!--
@file proposal.md - Windows Qt 原生应用打包修复提案
@author PopoY
@created 2026-07-21 15:42:36
@purpose 记录 GitHub Actions 无法生成 Qt 原生应用可执行文件的根因与修复边界。
-->

## Why

Windows 打包 workflow 在 Qt App native shell（Qt 应用原生外壳）构建阶段未生成 `qt_app_native.exe`，最终在部署阶段因 `Copy-Item` 找不到文件而失败。

根因是 `windows-latest` 已指向仅包含 Visual Studio 2026 的 runner image（运行器镜像），但 workflow 写死 Visual Studio 2022 初始化路径；CMake 因此误用 MinGW。同时 Qt WebEngine 安装缺少其 `QtPositioning` 依赖，且 `cmd` 未在配置失败后立即退出。

## What Changes

- 固定使用包含 Visual Studio 2022 的 `windows-2022` runner image。
- 补充 Qt WebEngine 所需的 `qtpositioning` 模块。
- 让 Qt 配置、构建和测试命令在任一步失败时立即终止。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无；本次仅修复 CI packaging（持续集成打包）工具链和失败传播，不改变产品行为或验收场景。

## Impact

- 仅修改 `.github/workflows/package-windows.yml`。
- 不修改 Qt、前端或 Driver Service（驱动服务）应用代码。
- 不新增项目依赖、公开 API（接口）或数据结构。

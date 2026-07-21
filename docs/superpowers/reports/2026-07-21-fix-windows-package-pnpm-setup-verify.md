<!--
@file 2026-07-21-fix-windows-package-pnpm-setup-verify.md - Windows 打包 pnpm 初始化修复验证报告
@author PopoY
@created 2026-07-21 15:08:50
@purpose 记录 workflow 修复、版本控制边界和本地合并的可追溯验证证据。
-->

# Windows 打包 pnpm 初始化修复验证

- Change: `fix-windows-package-pnpm-setup`
- Base ref: `9dd78cb8087433f57069235db19e75331c61772c`
- Verified ref: `ed0cb2104554143f54c6d45f87b84557b3bcee3e`
- Verify mode: `light`；自动统计的 15 个文件主要是 OpenSpec/Comet 流程产物，产品实现仅修改一个 workflow，另精确修正 `.gitignore`。

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 任务完成 | PASS | `tasks.md` 共 3 项，全部为 `[x]`。 |
| 改动范围 | PASS | `pnpm/action-setup@v6` 位于 `actions/setup-node@v6` 前；删除重复 Corepack 初始化；OpenSpec/Comet 目录未被整体忽略。 |
| Build（构建） | PASS | `pnpm --dir qt-app/frontend build`，Vite 生产构建成功。 |
| Test（测试） | PASS | `pnpm --dir qt-app/frontend test`：20 个测试文件、237 项测试全部通过。 |
| Security（安全） | PASS | 实现 diff 未发现硬编码密钥、凭据或新增不安全操作。 |
| Code review（代码审查） | PASS | `review_mode=off`；本次为小范围 workflow/忽略规则修正，跳过自动审查的原因已写入 `tasks.md`。 |

## 补充验证

- Workflow YAML 通过 Ruby YAML parser（YAML 解析器）校验。
- RED 检查已证明原 `.gitignore` 会整体忽略 `openspec/`；GREEN 检查证明项目级 OpenSpec/Comet 文件可跟踪，仅 `.comet/current-change.json` 作为本地运行指针被忽略。
- 合并到本地 `main` 后重新执行依赖锁定安装、全量测试和生产构建，结果全部通过。
- Vite 仅报告已有的大于 500 kB chunk size warning（分块体积警告），不影响本次验证结果。

## 分支处理

- `PopoY-WorkTree/fix-windows-package-pnpm-setup` 已 fast-forward merge（快进合并）到本地 `main`。
- 本地修复分支已删除；远程修复分支保留。
- 本地 `main` 未推送，符合用户选择的“本地合并”边界。

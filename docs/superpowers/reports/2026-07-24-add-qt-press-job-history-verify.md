<!--
@file 2026-07-24-add-qt-press-job-history-verify.md - 压机历史作业 Comet Verify 报告
@author PopoY
@created 2026-07-24 21:23:53
@purpose 记录跨 QT App 与 ERP 的完整规格、测试、构建、视觉和安全验证证据。
-->

# Verification Report：add-qt-press-job-history

## 结论

`PASS`。实现与 Proposal（提案）、OpenSpec delta spec（增量规格）、高层 Design（设计）及书面视觉规格一致；未发现 Critical、Important、Minor、Warning 或 Suggestion。可进入 Archive（归档）确认门，但本报告不授权归档、合并或 push（推送）。

## Summary Scorecard（汇总记分卡）

| Dimension（维度） | Status（状态） | Evidence（证据） |
| --- | --- | --- |
| Completeness（完整性） | PASS | `21/21` OpenSpec tasks；`7/7` requirements 有实现落点 |
| Correctness（正确性） | PASS | `20/20` scenarios 由测试、源码契约或 1280×720 实测覆盖 |
| Coherence（一致性） | PASS | 实现遵循 proposal、design、视觉规格和既有项目模式，无 spec/design drift（规格/设计漂移） |
| Security（安全性） | PASS | 当前认证设备限定、双侧响应白名单、固定错误语义、日志生命周期和敏感字段扫描通过 |
| Build（构建） | PASS | 前端 production build、TypeScript、后端 Java 8 13-module package 均成功 |

## 验证范围

- 前端：`main@9a6c52cdbbe980136692529188e48a568310d875..05f4a3667942a1981291990942d1eb611f5a424f`。
- ERP 后端：创建时 `master@54a8c09e494212924cec01e5470029e4a9e7d10c..18ea832aaf01e17d83e67a80f8fd2b9819a767dc`。
- ERP 后续集成目标只能是届时最新 `master`；本轮未 rebase/merge，也未使用或修改 `dev`、`dev-popo`。
- 关联技术设计：`docs/superpowers/specs/2026-07-24-press-job-history-page-design.md`，文件存在且与本 change 直接关联。

## Requirement / Scenario Coverage（要求与场景覆盖）

| Requirement | 主要实现 | 自动/实测证据 |
| --- | --- | --- |
| 第四入口与现有视觉体系 | `App.tsx`、`PressJobHistoryPage.css` | `App.test.tsx`；1280×720 light/dark 实测 |
| 已提交筛选与服务端分页 | 本地日期 helper、`draftFilters/appliedQuery`、Mapper/PageHelper | 页面测试、Controller 测试、Mapper contract test |
| 稳定作业身份与明确状态 | `press_mould_job_info.id → mouldJobId → moldJobId` | Mapper、Controller、client、页面测试 |
| 70% 脱敏详情 Drawer | 默认 body Portal、mask、`size="70%"`、4×2/64–36 | 页面测试；896px Drawer、遮罩、滚动和焦点实测 |
| 参数与操作白名单 | 双侧参数安全解析、session A/B 操作关联、前端对齐 | Controller/Mapper/client/页面测试 |
| 认证、时区和敏感边界 | bootstrap context `deviceId`、OffsetDateTime、固定 400/404/500、日志白名单 | MockMvc、AuthenticationEntryPoint、日志 appender、安全扫描 |
| 并发与 correlationId | list version+loader+query；detail version+loader+ID | client header 测试、页面竞态纯函数测试、Controller lifecycle 日志测试 |

## Fresh Verification Evidence（本轮实际证据）

### Frontend

- Vitest：3 files，`79/79` tests 通过，exit 0。
- `pnpm --dir qt-app/frontend exec tsc --noEmit`：exit 0。
- `pnpm --dir qt-app/frontend build`：exit 0，1114 modules transformed；仅有既有单 chunk 大于 500kB 警告。
- 禁用字段、历史页四安全 props、client narrower、Drawer token/size、CSS 色板扫描通过。
- `git status --short` 为空，`git diff --check` exit 0；构建未产生 tracked 修改。

### ERP Backend

- Java 8 目标测试：13 个 Reactor modules 全部 SUCCESS；Controller 本轮 `25/25`，相关持久化 Surefire suites 合计 `51/51`，无 failure/error/skipped。
- Java 8 `-pl yr-admin -am -DskipTests package`：13 modules 全部 SUCCESS，jar/repackage 成功。
- Liquibase master `includeAll` 与既有 operation changelog 可达；固定创建基线到 HEAD 无 Liquibase/changelog 变更。
- history response/log/security 扫描通过；`deviceId` 只来自认证上下文，不由客户端提供且不进入响应。
- `git status --short` 为空，`git diff --check` exit 0，创建时 master 基线是 HEAD ancestor。

### Visual / Interaction

- 使用临时静态 Mock 直接渲染真实页面与现有 Provider/CSS；无真实 ERP、Driver、PLC 请求，临时文件已删除。
- 1280×720 下 document/body/shell 无页面级滚动；筛选控件、数据行和关闭按钮均为 44px。
- 八列单行显示、表格内容区滚动、分页固定在底部。
- Drawer `x=384,width=896,height=720`，即 viewport 的 70%；mask 为 1280×720，底层 hit test 均命中 mask。
- 概要 8 items/2 rows；参数/操作区域扣除 16px gap 后符合 64%/36%；长操作内容仅在详情区滚动。
- light/dark Portal token 均解析；点击、Enter、Space 打开，关闭按钮/Escape 关闭，动画后焦点返回原行。

## Final Cumulative Review（最终累计审查）

- Critical：无。
- Important：无。
- Minor：无。
- 前后端固定 SHA 范围均经独立 reviewer 检查 correctness/security/regression；SQL、Service/API、client、page、App 的端到端契约一致。

## Remaining Non-blocking Environment Risks（剩余非阻塞环境风险）

- Mapper contract 主要为 source contract，没有连接真实数据库；遵守无真实系统探测边界，后续仅在受控部署验证中只读确认 explain/runtime 行为。
- 前端单 chunk 大于 500kB，以及后端既有 Lombok/unchecked/Druid 警告不属于本变更阻塞项。

## Delivery Gate（交付门）

- `verify_result` 可记录为 `pass`。
- `branch_status` 必须保持 `pending`。
- Archive、merge、push 均未执行；下一步必须先取得用户单独的 Archive 确认。

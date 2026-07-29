# Brainstorm Summary

- Change: include-running-press-jobs-in-history
- Date: 2026-07-29

## Confirmed Facts and Constraints

- “历史作业”同时承担按作业身份查询操作记录的职责，进行中作业必须进入现有列表和详情，避免新增重复日志查询。
- 查询范围只扩展到 `status=1/3`，排除待开始、暂停和终止。
- 跨日进行中作业与所选日期区间相交时仍需显示；现有设备隔离、真实作业主键、父作业关联和脱敏边界保持不变。
- 不新增接口、数据库结构、轮询、实时计时器或视觉体系。

## Confirmed Technical Approach

在现有 Mapper 查询中使用状态分支，已完成分支保留 `end_time` 半开区间，进行中分支使用 `start_time < endTime` 表达尚未结束区间的相交；使用 `CASE` 排序让进行中置顶，再按各自业务时间和 `id` 稳定倒序。详情仅把状态限制放宽为 `IN ('1','3')`。前端只补齐状态与缺失字段文案，继续复用现有 Drawer、参数表和操作时间线。

替代方案：

1. `UNION ALL` 分别查询进行中和已完成后统一排序：SQL 更长、分页和字段维护重复，本次没有必要。
2. 新增设备级操作日志查询入口：重复现有详情能力，并削弱可靠父作业关联，不采用。

## Key Trade-offs and Risks

- 单条 SQL 的 `OR` 分支可能降低索引利用率；当前有认证设备和最多 31 日查询边界，先保持无迁移方案，只有真实查询计划证明需要时再单独加索引。
- 详情是请求时快照；作业随后完成不会自动刷新。本次不引入轮询，重新打开或重新查询即可取得新状态。
- `status=1` 且 `start_time` 为空的异常记录不展示，不以其他时间字段猜测业务起点。

## Testing Strategy

- ERP RED/GREEN：Mapper 合同锁定状态分支、跨日相交、稳定排序和详情状态；Controller 测试锁定进行中列表/详情白名单与设备隔离。
- QT RED/GREEN：状态映射、状态列名、进行中完成时间/时长、详情摘要和通用空状态。
- 回归：相关 ERP 模块测试、完整 Vitest、TypeScript、生产构建、strict OpenSpec 和 `git diff --check`。

## Spec Patches

None。Open phase delta spec 已覆盖进行中范围、跨日相交、排序、详情和展示边界。

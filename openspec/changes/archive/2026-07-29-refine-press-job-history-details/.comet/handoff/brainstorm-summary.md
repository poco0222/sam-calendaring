# Brainstorm Summary

- Change: refine-press-job-history-details
- Date: 2026-07-28

## Confirmed Technical Approach

### ERP

- `recordPressJobParametersForQt` 与仍在使用相同历史 JSON 字段的 `recordStartParams/generateParameterRecords` 两条写入链路，都从服务端信号定义生成 `valueKind: "state" | "scalar"`，原始 `signalValue` 不变；客户端不能提交该分类。
- Java 侧使用一个最小共享分类入口，锁定与实时参数一致的 `registerType` / `dataType` 白名单，避免两条写入路径和历史回退规则漂移。
- 历史详情沿用认证上下文的 `deviceId`，通过现有信号服务一次加载该设备全部现存定义，包括停用行；分别建立 ID 索引和仅包含唯一 code 的索引。
- 只有精确文本 `state` / `scalar` 是合法快照标记。缺失或非法时先按 `signalId`、再按设备内唯一 `signalCode` 回退；重复 code、畸形身份、无法匹配或配置查询失败均省略分类并保留原值。
- 非法分类或身份只影响当前参数行的分类，不得把整侧参数记录降级为格式异常；历史响应只增加可选 `valueKind`，继续剔除信号身份、寄存器类型和完整配置。

### QT App

- `erpClient` 只收窄 `state` / `scalar` 两个合法值，并从前端操作记录模型删除 `content`。
- `alignHistoryParameters` 继续让开始/完工两列共用 `formatHistoryParameterValue`；仅 `state` 的 `0` / `1` / `false` / `true` 转为“否/是”。
- 筛选项保留现有 label DOM，仅用 CSS 改为水平 Flex，固定统一描述列，现有控件、44px 高度和无障碍名称不变。
- `HistoryDetailContent` 保存局部操作页码，固定页长 5，切片渲染并在作业或详情记录变化时恢复第一页；复用现有 Ant Design Pagination。
- 操作列表自身滚动、分页固定在区块底部；每项缩为两行，用既有 `li` 伪元素绘制当前页相邻节点竖线，不新增时间线组件。

## Key Trade-offs and Risks

- 旧记录只能用当前同设备信号定义解释；新记录持久化分类后不再受配置变化影响。
- 配置查询增加一次数据库读取；失败时安全降级为原值，不阻断详情。
- `signalCode` 若在同设备内重复则不能可靠回退，只允许稳定 ID 或唯一 code 命中。
- 前端分页只控制固定视口展示，不减少接口响应体；只有数据规模成为实际问题时才升级服务端分页。
- 保留后端 `content` 是兼容取舍，前端不再接收和展示它。

## Testing Strategy

- ERP Service 测试先覆盖两条写入路径的开始/完工、`state` / `scalar` 和原始值不变，再实现共享分类。
- ERP Controller 测试覆盖新标记优先、旧记录 ID/code 回退、重复 code、停用定义、跨设备、非法标记、畸形身份、查询失败降级及安全白名单。
- QT `erpClient` 测试覆盖 `valueKind` 白名单和 `content` 剔除；页面测试覆盖两列统一格式化、非状态 `0/1`、提示删除、5 条分页、页码重置和组合文案。
- CSS 契约与 1280×720 浅/深主题人工核验覆盖水平筛选、固定分页底栏、缩短行高、无横线和有竖线。
- 最后运行 Java 8 Maven 定向测试与构建、Vitest、TypeScript、production build 和 OpenSpec 严格校验。

## Spec Patches

- 明确两个仍在使用 `start_parameter_records/end_parameter_records` 的写入入口都要为后续记录保存分类。
- 只有精确的 `state` / `scalar` 是合法分类；非法分类进入身份回退且不得损坏整侧投影。
- `signalId` 可匹配认证设备内停用定义；`signalCode` 只有在认证设备内唯一时才能回退，重复时省略分类。
- 操作列表局部滚动，Pagination 固定在操作面板底部，不随记录滚走。

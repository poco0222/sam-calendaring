## 1. ERP 参数分类与安全投影

- [x] 1.1 在 `PressMouldJobInfoServiceImplQtTest` 增加失败测试，覆盖 `recordPressJobParametersForQt` 与 `recordStartParams/generateParameterRecords` 两条路径的开始/完工参数按现有 `registerType`、`dataType` 规则保存 `state` / `scalar`，且原始参数值保持不变
- [x] 1.2 在 `QtPressWorkingControllerTest` 增加失败测试，覆盖新记录合法标记优先、旧记录按认证设备内 `signalId` / 唯一 `signalCode` 回退、停用定义、重复 code、非法标记、畸形身份、配置不可用时保留原值，以及响应不泄露信号身份和配置
- [x] 1.3 用一个最小共享分类入口为两条参数写入路径保存 `valueKind`，并在历史详情中用一次当前设备全部信号定义查询完成旧记录回退；单行匹配失败安全降级，不新增数据库迁移或外部接口

## 2. QT App 响应收窄与统一格式化

- [x] 2.1 在 `erpClient.test.ts` 增加失败测试，再让历史参数只接受可选的 `state` / `scalar`，丢弃未知 `valueKind`，并停止把操作记录 `content` 收窄到前端 View Model（视图模型）
- [x] 2.2 在 `PressJobHistoryPage.test.tsx` 增加失败测试，覆盖开始/完工两列统一显示“否/是”、非状态 `0/1` 保持原值、删除参数缺失提示，以及保留格式异常提示
- [x] 2.3 复用一个历史参数格式化入口处理两列，仅对 `valueKind === "state"` 的 `0/1/false/true` 转换“否/是”

## 3. 历史详情布局与操作分页

- [x] 3.1 在 `PressJobHistoryPage.test.tsx` 增加失败测试，覆盖筛选描述与控件水平排列、操作内容不展示、班组/作业人员组合、每页 5 条、切换作业重置页码及分页固定底栏
- [x] 3.2 将筛选项改为统一的水平 Flex（弹性布局），保留单行筛选、44px 控件高度、现有查询按钮和无障碍名称
- [x] 3.3 收紧操作项为操作/结果与“班组 / 作业人员”两行，删除水平分割线，复用 Ant Design Timeline（时间轴）内置相邻节点竖线；列表局部滚动，并复用 Pagination（分页）作为固定底栏每页显示 5 条

## 4. 验证与范围保护

- [ ] 4.1 使用 Java 8 运行 ERP 的 `PressMouldJobInfoServiceImplQtTest`、`QtPressWorkingControllerTest` 及受影响模块构建，确认未改动现有未跟踪 SQL 文件、日志关联和敏感信息边界
- [ ] 4.2 运行 QT App 的 `erpClient.test.ts`、`PressJobHistoryPage.test.tsx`、TypeScript（类型检查）和 production build（生产构建）
- [ ] 4.3 在 1280×720 浅色/深色视口核对单行水平筛选、参数表可见区域、5 条操作时间线连接及 Drawer（抽屉）局部滚动，并执行 OpenSpec strict validation（严格校验）

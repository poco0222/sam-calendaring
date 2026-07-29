## 1. ERP 查询契约

- [x] 1.1 先修改 Mapper 和 Controller 聚焦测试，证明列表允许 `status=1/3`、跨日进行中作业按区间相交返回且置顶，并证明详情允许同设备进行中作业；运行测试取得预期 RED（失败）证据
- [x] 1.2 最小修改 `PressMouldJobInfoMapper` 列表与详情 SQL，保留认证设备、半开时间、稳定分页和父作业身份边界，使 1.1 测试转为 GREEN（通过）

## 2. QT App 展示契约

- [x] 2.1 先修改 `PressJobHistoryPage` 聚焦测试，锁定“进行中/已完成”状态映射、“作业状态”列名、进行中完成时间/时长和通用空状态文案；运行测试取得预期 RED 证据
- [x] 2.2 最小修改历史列表与详情展示，复用现有类型、Tag、Drawer、参数缺失和操作时间线实现，使 2.1 测试转为 GREEN

## 3. 回归验证

- [ ] 3.1 运行 ERP 历史 Mapper/Controller 聚焦测试及相关模块测试，确认设备隔离、已完成查询和详情操作日志关联不回归
- [ ] 3.2 运行 QT App 历史页测试、完整 Vitest、TypeScript 检查、生产构建、`git diff --check` 和 OpenSpec strict validation（严格校验），记录真实结果

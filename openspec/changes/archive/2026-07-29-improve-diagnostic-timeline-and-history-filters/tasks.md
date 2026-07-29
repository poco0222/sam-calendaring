## 1. 修复诊断日志时间线

- [x] 1.1 先扩展 `DiagnosticLogsPage.test.tsx`，覆盖关联日志正序、Ant Design Timeline item（时间轴项）、内建连接线结构、可访问选中状态以及不再出现手写 marker（圆点）类名
- [x] 1.2 在 `DiagnosticLogsPage.tsx` 中用现有 Ant Design `Timeline` 替换 `<ol>/<li>` 手写结构，保留当前详情选择、中文白名单字段和 Drawer（抽屉）交互
- [x] 1.3 删除 `DiagnosticLogsPage.css` 中仅供手写列表、圆点和连接线使用的规则，只保留内容密度、焦点和滚动样式，不覆盖 Ant Design rail（连接轨道）几何样式，并运行诊断页面定向测试

## 2. 统一历史作业筛选控件和候选范围

- [x] 2.1 先扩展 `PressJobHistoryPage.test.tsx`，覆盖默认班组但不默认人员、班组切换清空人员、只展示当前班组候选、迟到响应失效、全量用户仅用于名称翻译，以及班组不进入历史 query（查询）
- [x] 2.2 在 `App.tsx` 向历史页面注入现有 `pressJobLookupData`、`loadPressJobTeamOptions` 和 `searchPressMoldCandidates`，不新增 ERP API、请求字段或数据加载入口
- [x] 2.3 在 `PressJobHistoryPage.tsx` 中把模具号改为复用现有 popup 样式、远程候选合同和 `NumericKeypad（数字小键盘）` 的受控 Select（选择器），仅允许选中候选写入 `mouldCode`，并以独立版本号拒绝过期响应
- [x] 2.4 在 `PressJobHistoryPage.tsx` 中增加班组 Select，将筛选标签“作业人员”改为“人员”，复用压机作业的默认班组和班组人员级联逻辑，同时保持列表/详情名称翻译、已提交查询快照和单行 1280×720 布局

## 3. 验证与范围核对

- [x] 3.1 运行 `DiagnosticLogsPage`、`PressJobHistoryPage`、`NumericKeypad` 和 `App` 相关 Vitest（测试），再执行完整前端测试，确认既有压机作业筛选和模具锁定流程无回归
- [x] 3.2 执行 TypeScript `tsc --noEmit`、Vite production build（生产构建）和 `git diff --check`，并核对浅色/深色 1280×720 视口下筛选单行、模具候选、小键盘和诊断时间线连接线
- [x] 3.3 执行 `openspec validate improve-diagnostic-timeline-and-history-filters --strict`，复核改动仅限既有 QT App 前端与本 change 产物，且没有后端、数据库、设备请求、敏感日志或新依赖变化

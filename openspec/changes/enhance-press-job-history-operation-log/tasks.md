> Editor: PopoY
> Edited: 2026-07-27 08:46:41

## 1. 最小日志表与端点

- [ ] 1.1 为 `modbus_handle_log` 仅增加 nullable `press_job_info_id`、`team_id` 和 `(device_id, press_job_info_id, handle_time, id)` 索引，保留既有字段语义与旧入口兼容性
- [ ] 1.2 扩展现有 Domain（领域模型）和 Mapper（映射器）读写，新增按认证设备与父作业时间正序查询，并在查询时关联现有班组、用户主数据
- [ ] 1.3 新增最薄 QT operation-log endpoint（操作日志端点），只接受六字段请求、固定操作码和 Boolean 结果，复用 `press-job-id-*` 直连或现有 Qt `START` 会话映射且不要求作业仍进行中，无法关联时保存 device-only log

## 2. QT post-action 上报

- [ ] 2.1 为 `START`、`PARAMETER_START`、`PARAMETER_END`、`LINE_IN`、`LINE_OUT`、`COMPLETE` 增加最小请求类型和客户端调用
- [ ] 2.2 在每个真实操作结果确定后 best-effort（尽力而为）异步上报；START/参数/COMPLETE 在各自 ERP 调用边界按结果码判断，入线/出线仅整体 `OK` 记成功，`PARTIAL_OK` / `FAILED` 记失败；保持主结果不变，日志失败只写脱敏诊断，不增加队列、重试、补偿或回填
- [ ] 2.3 增加定向测试，覆盖刷新后的 `press-job-id-*`、完成后日志、完成后出线、ERP 错误结果正常返回、`PARTIAL_OK`、正常返回的 `FAILED`、敏感字段缺失和日志失败隔离

## 3. 历史投影与 UI

- [ ] 3.1 历史详情由 `mouldJobId` 取得父 `pressJobInfoId`，按认证设备与父作业查询新日志；无新日志时整组降级现有 Qt 生命周期记录
- [ ] 3.2 返回并展示时间、操作、结果、内容、班组、作业人员，缺失字段显示“未记录”，兄弟模具共享父作业时间线
- [ ] 3.3 完成单行筛选、查询图标与文字、最近 1/3/7/30 个本地自然日、80% Drawer、JSON Boolean 翻译和诊断日志 Timeline CSS 复用
- [ ] 3.4 增加历史投影和前端定向测试，覆盖新日志优先、旧作业降级、缺失主数据、日期范围和展示契约

## 4. 验证

- [ ] 4.1 运行 SAM ERP 相关自动化测试、Java 8 Maven（构建工具）编译、Liquibase 和 Mapper 契约检查
- [ ] 4.2 运行 QT frontend（前端）定向测试、TypeScript（类型检查）和生产构建
- [ ] 4.3 核对请求/响应敏感信息边界、六个操作码、父作业共享时间线和旧数据不迁移；只使用 Mock（模拟）或安全测试数据，不向真实 PLC（可编程逻辑控制器）发送请求

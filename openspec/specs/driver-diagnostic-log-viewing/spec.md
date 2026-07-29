# driver-diagnostic-log-viewing Specification

## Purpose
TBD - created by archiving change improve-diagnostic-timeline-and-history-filters. Update Purpose after archive.
## Requirements
### Requirement: 诊断日志关联链使用标准时间线

QT App MUST 在操作员打开诊断日志时间线 Drawer（抽屉）时，仅收集与当前日志具有相同非空 `correlationId（关联 ID）` 的日志，MUST 按 `createdAt ASC` 展示时间、状态、分类、事件名称和中文说明，并 MUST 使用已安装的 Ant Design `Timeline（时间轴）` 内建节点和相邻连接线。页面 MUST NOT 手写圆点、伪元素或连接线几何样式，且不得改变现有日志查询、表格分页、详情选择或敏感信息边界。

#### Scenario: 打开具有完整关联链的时间线

- **WHEN** 操作员从一条具有相同 `correlationId` 的 `RequestReceived`、`ActionCompleted` 和 `ResponseSent` 日志打开时间线
- **THEN** Drawer 按创建时间正序渲染三个 Ant Design Timeline item（时间轴项）
- **AND** 当前可见片段中的相邻节点由 Ant Design 内建 rail（连接轨道）连接，最后一个节点不向 Drawer 底部延伸
- **AND** 页面不渲染自定义 marker（圆点）或手写连接线

#### Scenario: 在时间线中切换当前日志

- **WHEN** 操作员点击、触控或使用键盘激活某个时间线条目
- **THEN** 系统把该条日志设为当前详情并保留时间线 Drawer
- **AND** 当前条目提供可访问的选中状态，其他关联日志及其顺序保持不变

#### Scenario: 时间线保持脱敏展示

- **WHEN** 时间线展示关联日志
- **THEN** 页面只展示既有白名单字段和中文说明，不直接展示 `correlationId`
- **AND** 页面不得展示完整 `signedLease`、`signature`、`signature payload`、`signalConfig`、`privateKey`、`credential`、`sessionToken`、裸 `ip`、`port`、`deviceId` 或第三方异常正文

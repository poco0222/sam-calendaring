# Driver Service Tech Stack

> @file Driver Service 技术栈规则
> @author PopoY
> @created 2026-06-25
> @purpose 仅固化当前阶段已确定的 Driver Service 技术栈选择。

## 已确定

`Driver Service` 运行在 `Windows` 工控机上，作为本地常驻服务。

主技术栈采用：

```text
.NET 10 LTS + Worker Service + Windows Service
+ ASP.NET Core Minimal API + SQLite + NModbus
```

其中：

1. `.NET 10 LTS` 是默认运行时。
2. `Worker Service` 是默认服务模板。
3. `Windows Service` 是默认部署形态。
4. `ASP.NET Core Minimal API` 是默认本地接口承载方式。
5. `SQLite` 是默认本地持久化方案。
6. `NModbus` 是默认 `Modbus TCP` 通信库。
7. `System.Security.Cryptography` 是默认加密与验签能力来源。
8. `System.Text.Json` 是默认 `JSON` 序列化方案。
9. `ILogger` 是默认日志抽象。

## Windows 工控机约束

1. `Driver Service` 必须按 `Windows Service` 形态设计，支持开机自启、服务停止、服务重启和故障恢复。
2. 本机通信方式后续单独定稿；默认不把服务设计成对局域网开放的远程服务。
3. 触屏能力只影响 `QT App` 的 UI 设计，不影响 `Driver Service` 的技术栈选择。
4. `Driver Service` 不做桌面窗口、不做托盘程序、不承载触屏交互。
5. 本地配置方式以后续设计为准；如采用 `.NET` 默认配置体系，优先使用 `appsettings.json`。

## 本地存储约束

默认使用：

```text
SQLite + WAL
```

当前阶段只确定 `SQLite` 作为本地持久化基础，不提前定稿表结构。

先不引入：

1. `MySQL`
2. `PostgreSQL`
3. `Redis`
4. `RabbitMQ`
5. `Kafka`
6. 外部配置中心

## 接口承载约束

如需要本机诊断、状态查询或控制入口，默认使用 `ASP.NET Core Minimal API` 承载轻量 `HTTP JSON API`。

当前阶段只确定接口承载技术，不定稿具体 API 路由、请求体和响应体。

先不引入：

1. `MVC Controller`
2. `gRPC`
3. `GraphQL`
4. `Swagger` 强依赖
5. `API Gateway`

## Modbus 约束

1. `Modbus TCP` 通信使用成熟库 `NModbus`。
2. 不手写 `Modbus TCP` 协议栈。
3. 不在 `QT App` 或前端页面中实现 `Modbus TCP` 协议栈。
4. 当前已有真实 `Modbus Device` 可接入，开发阶段允许直接接真实设备联调。
5. 真实设备端点必须来自 `ERP Server` 签发的 `signed connection lease`，不在代码中硬编码 `ip` 或 `port`。
6. 具体设备点位、地址范围、批量读写策略以后续 `signal config` 为准，不在技术栈文档中展开。

## 安全与序列化约束

1. 加密、签名、哈希和验签优先使用 `.NET` 官方 `System.Security.Cryptography`。
2. `JSON` 序列化优先使用 `.NET` 官方 `System.Text.Json`。
3. 当前阶段不提前选择第三方 `JWT`、`JOSE`、`BouncyCastle` 或自定义密码学库。
4. 如果后续签名算法超出官方库能力，再单独评估第三方库。

## 当前不采用

当前不把以下技术作为 Driver 主栈：

1. `Go`
2. `Rust`
3. `Node.js`
4. `Python`
5. `Java / Spring Boot`
6. `C++ / Qt Service`
7. `Electron`

说明：

1. `Go` 和 `Rust` 仍可作为备选，但在 `Windows-only` 工控机场景下不作为默认主栈。
2. `Node.js`、`Python`、`Electron` 不作为生产 Driver 技术栈。
3. `Java / Spring Boot` 对本地单机 Driver 偏重。
4. `C++ / Qt Service` 容易让 Driver 与 UI 耦合，当前不作为默认方案。

## 未定

以下内容当前不在本规则内定稿：

1. 具体 API 路由
2. 请求体和响应体结构
3. SQLite 表结构
4. `Modbus TCP` 点位模型
5. 离线验签的具体签名算法
6. 服务安装脚本
7. 日志文件路径
8. 配置文件目录
9. Driver 与 `QT App` 的启动顺序
10. Driver 与 `QT App` 的进程监控方式
11. Driver 与 `QT App` 的最终通信协议

开发前接口、状态、线程和错误边界见：

```text
docs/development-boundary-constraints.md
```

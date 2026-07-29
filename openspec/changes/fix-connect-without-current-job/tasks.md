## 1. Regression Test（回归测试）

- [x] 1.1 增加设备占位行无 `status` 时 `CONNECT` 前置校验通过的 Vitest 用例，并确认修复前失败。

## 2. Implementation（实现）

- [x] 2.1 修改共享前置校验，使当前作业状态检查仅拦截非 `CONNECT` 动作。

## 3. Verification（验证）

- [x] 3.1 运行目标回归测试、相关前端测试、前端完整测试和生产构建。

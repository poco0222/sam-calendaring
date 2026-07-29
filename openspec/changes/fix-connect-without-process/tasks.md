## 1. Regression Test（回归测试）

- [x] 1.1 增加未选择预选工艺时 `CONNECT` 前置校验通过的 Vitest 用例，并确认修复前失败。

## 2. Implementation（实现）

- [x] 2.1 修改共享前置校验，使 `processId` 只拦截非 `CONNECT` 动作。

## 3. Verification（验证）

- [x] 3.1 运行目标测试、完整前端测试、TypeScript 类型检查、生产构建和 OpenSpec strict validation（严格校验）。

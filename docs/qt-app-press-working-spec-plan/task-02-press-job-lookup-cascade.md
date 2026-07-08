# Task 02: Press Job Lookup Cascade

> @file QT App 压机作业 lookup data（查询数据）级联任务
> @author PopoY
> @created 2026-06-30
> @purpose 接入 sam-erp `PressWorkingTimeFeedback` 的班组、人员、预选工艺数据展示与班组级联逻辑。

## Scope（范围）

参考 `sam-erp` 的 `PressWorkingTimeFeedback`：

1. 首屏读取 `getPlnListByDept2(30)` 展示班组选项。
2. 首屏读取 `getQtUserInfo()` 得到默认 `plineCode（班组编码）` 和 `userName（用户名）`。
3. 默认班组存在时读取 `getQtUserList2(plineCode)` 和 `getCraftByPlineIdAndDeviceType(plineCode, "0")` 展示人员与预选工艺。
4. 班组变更时清空人员和预选工艺当前选择，并通过 App shell（应用外壳）注入的 loader（加载函数）读取新班组的人员与工艺。
5. `PressJobPage（压机作业页）` 不直接 import（导入）`erpClient（企业资源计划客户端）`，不直接读取 `sessionToken（会话令牌）`，不记录敏感信息。

## Progress（进度）

- `2026-06-30`: Step 1 started（开始）- 梳理 sam-erp `PressWorkingTimeFeedback` 参考接口和当前 `PressJobPage` 接入边界。
- `2026-06-30`: Step 1 completed（完成）- 确认接口为 `/fm/pline/getPlnListByDept2/30`、`/rel/qtrel/getQtUserInfo`、`/rel/qtrel/getQtUserList2/{plineCode}`、`/samMesPlineCraft/samMesPlineCraftController/getCraftByPlineIdAndDeviceType/{plineCode}/0`。
- `2026-06-30`: Step 2 started（开始）- 编写 focused RED tests（聚焦失败测试），锁定 lookup data（查询数据）和 cascade state（级联状态）。
- `2026-06-30`: Step 2 completed（完成）- focused RED tests（聚焦失败测试）按预期失败，缺少 `fetchPressJobLookupData`、`fetchPressJobTeamOptions`、`createPressJobTeamChangeState`，当前进度 `2/7`。
- `2026-06-30`: Step 3 completed（完成）- 新增 `domain/pressJob.ts`，定义班组、人员、预选工艺 lookup data（查询数据）最小模型，当前进度 `3/7`。
- `2026-06-30`: Step 4 completed（完成）- `erpClient.ts` 已接入 sam-erp 四个读取接口并压缩字段，当前进度 `4/7`。
- `2026-06-30`: Step 5 completed（完成）- `App.tsx` 已注入按班组读取人员/工艺的 loader（加载函数），当前进度 `5/7`。
- `2026-06-30`: Step 6 completed（完成）- `PressJobPage.tsx` 已渲染 lookup options（查询选项）并在班组变更时清空人员和预选工艺，当前进度 `6/7`。
- `2026-06-30`: Step 7 completed（完成）- focused tests（聚焦测试）、full frontend tests（完整前端测试）和 build（构建）已通过；Vite（构建工具）保留 chunk size warning（包体积警告），当前进度 `7/7`。

## Steps（步骤）

- [x] **Step 1: Read reference implementation（读取参考实现）**

Reference files（参考文件）:

```text
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/views/sam-smes2/prd/partsOrder/pressWorking/pressWorkingTimeFeedback.vue
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/api/smes2/fm/pline.js
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/api/smes2/rel/qtrel.js
/Users/PopoY/workingFiles/Projects/SAM/sam-erp/sam-erp-fe/src/api/smes2/fm/equipment.js
```

- [x] **Step 2: Write RED tests（编写失败测试）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx
```

Expected（预期）: fail（失败）because `fetchPressJobLookupData（压机作业查询数据加载）`, `fetchPressJobTeamOptions（班组选项加载）`, and `createPressJobTeamChangeState（班组级联状态创建）` do not exist yet.

- [x] **Step 3: Add domain types（新增领域类型）**

Create:

```text
qt-app/frontend/src/domain/pressJob.ts
```

- [x] **Step 4: Implement ERP lookup reads（实现 ERP 查询读取）**

Modify:

```text
qt-app/frontend/src/services/erpClient.ts
```

- [x] **Step 5: Wire App shell loader（接入应用外壳加载函数）**

Modify:

```text
qt-app/frontend/src/App.tsx
```

- [x] **Step 6: Render options and cascade state（渲染选项并实现级联状态）**

Modify:

```text
qt-app/frontend/src/components/PressJobPage.tsx
```

- [x] **Step 7: Verify（验证）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx
pnpm build
```

Verification record（验证记录）:

```text
2026-06-30 ./node_modules/.bin/vitest run src/services/erpClient.test.ts src/components/PressJobPage.test.tsx src/App.test.tsx
PASS: 3 test files passed（测试文件通过）, 19 tests passed（测试通过）.

2026-06-30 pnpm test
PASS: 16 test files passed（测试文件通过）, 101 tests passed（测试通过）.

2026-06-30 pnpm build
PASS: vite build exit 0（退出码 0）. Warning（警告）: one JS chunk is larger than 500 kB after minification.
```

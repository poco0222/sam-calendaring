# Task 03: Unlock Drawer UI

> @file QT App 解锁模具抽屉界面任务
> @author PopoY
> @created 2026-07-02
> @purpose 在 PressJobPage（压机作业页）中新增 unlock mold（解锁模具）按钮、Drawer（抽屉）、Table（表格）和 single/batch unlock（单套/批量解锁）交互。

## Goal（目标）

Render the unlock mold（解锁模具）entry in the Current Job section header（当前作业标题栏）, not in the top action area（顶部操作区）. The Drawer（抽屉） loads locked molds（已锁定模具） once on open, supports row unlock（行内解锁） and batch unlock（批量解锁）, and never adds a manual refresh button（手动刷新按钮）.

## Status（状态）

- `Completed（已完成）`: Task3 Unlock Drawer UI（解锁抽屉界面）已完成并通过自动化验证。

## Progress（进度）

- `2026-07-02`: 计划已落库，当前进度 `0/8`。
- `2026-07-02`: Step 1 completed（已完成），已新增 unlock Drawer UI（解锁抽屉界面）contract tests（契约测试），当前进度 `1/8`。
- `2026-07-02`: Step 2 completed（已完成），`./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 按预期 RED：新增 3 个 unlock UI（解锁界面）测试失败，当前进度 `2/8`。
- `2026-07-02`: Step 3 completed（已完成），`PressJobPageProps（页面属性）` 与 unlock Drawer local state（本地状态）已接入，当前进度 `3/8`。
- `2026-07-02`: Step 4 completed（已完成），当前作业标题栏已加入“解锁模具”入口，并接入 Drawer one-time load（抽屉一次性加载）与 reset/cancel（重置/关闭），当前进度 `4/8`。
- `2026-07-02`: Step 5 completed（已完成），已渲染 unlock Drawer（解锁抽屉）、status bar（状态条）、8 列 locked mold table（已锁定模具表）与 footer actions（底部操作），当前进度 `5/8`。
- `2026-07-02`: Step 6 completed（已完成），row unlock（行内解锁）和 batch unlock（批量解锁）已共用 confirm/submit helper（确认/提交辅助函数），当前进度 `6/8`。
- `2026-07-02`: Step 7 completed（已完成），已新增 unlock Drawer compact CSS（紧凑样式），未新增 cards（卡片）、gradient（渐变）或 decorative effects（装饰效果），当前进度 `7/8`。
- `2026-07-02`: Step 8 completed（已完成），focused tests（聚焦测试）`./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx` 通过 `42/42`，`pnpm build` 通过且仅有既有 chunk-size warning（包体积告警）。额外 regression（回归）`pnpm test` 通过 `150/150`，当前进度 `8/8`。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify: `qt-app/frontend/src/components/PressJobPage.css`
- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`

## UI Contract（界面契约）

```text
当前作业信息 header（标题栏）
  title（标题）: 当前作业信息
  button（按钮）: 解锁模具

Drawer（抽屉） title: 解锁模具
  status bar（状态条）: 已锁定 N 套 / 加工中需保留 1 套 / 已选 N 套
  table（表格）: selection（复选框选择） + 8 business columns（业务列） + row action（行操作）
  footer（底部）: 取消 / 确认解锁 N 套
```

## Steps（步骤）

- [x] **Step 1: Write RED UI contract tests（编写失败的界面契约测试）**

Modify `qt-app/frontend/src/components/PressJobPage.test.tsx`.

Add tests（测试） for:

1. “解锁模具” button（按钮） appears inside `aria-label="当前作业信息"` section header（区块标题栏）.
2. Top action area（顶部操作区） still contains “锁定模具” but not “解锁模具”.
3. `moldNo（模具号）` column render remains plain text; no button/link action is added to the current job table（当前作业表）.
4. Opening the Drawer（抽屉） calls `loadPressLockedMolds（查询已锁定模具）` once with `correlationId（关联 ID）`.
5. Drawer Table（抽屉表格） contains 模具号、工序号、制造令号、工艺名称、工时类型、开始时间、作业员、操作.
6. Drawer（抽屉） does not contain “刷新”.
7. Row “解锁” and footer “确认解锁 N 套” both call the same confirm helper（确认辅助函数）.
8. Unlock success closes Drawer（抽屉） and calls `refreshPressJobCurrentJobs（刷新当前作业）`.

Expected RED（预期失败）:

```text
解锁模具 button（按钮） and Drawer（抽屉） do not exist yet.
```

- [x] **Step 2: Run focused tests and confirm RED（运行聚焦测试并确认失败）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
FAIL（失败） because unlock UI（解锁界面） is not implemented.
```

- [x] **Step 3: Add props and local state（新增属性与本地状态）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Extend `PressJobPageProps（页面属性）`:

```ts
loadPressLockedMolds?: (input: {
  correlationId: string;
}) => Promise<PressLockedMoldRow[]>;
unlockPressMolds?: (
  request: PressMoldUnlockRequest,
) => Promise<PressMoldUnlockResult>;
recordPressMoldUnlockDiagnostic?: (
  summary: PressMoldUnlockDiagnosticSummary,
) => void;
```

Add local state（本地状态）:

```ts
const [isMoldUnlockDrawerOpen, setIsMoldUnlockDrawerOpen] = useState(false);
const [lockedMoldRows, setLockedMoldRows] = useState<PressLockedMoldRow[]>([]);
const [selectedUnlockMoldNos, setSelectedUnlockMoldNos] = useState<string[]>([]);
const [lockedMoldsLoading, setLockedMoldsLoading] = useState(false);
const [moldUnlockSubmitting, setMoldUnlockSubmitting] = useState(false);
const lockedMoldLoadVersionRef = useRef(0);
```

Rules:

1. Do not add `sessionToken（会话令牌）` to props（属性）.
2. Do not reuse mold lock（锁模）candidate state for unlock（解锁）.
3. Do not add a `state store（状态仓库）`.

- [x] **Step 4: Add header entry and one-time Drawer load（新增标题栏入口与一次性加载）**

Modify the Current Job section header（当前作业区块标题栏）:

```tsx
<header className="press-job-page__section-title press-job-page__section-title--with-action">
  <Typography.Text strong>当前作业信息</Typography.Text>
  <Button
    color="danger"
    disabled={!hasUnlockableCurrentMold(currentJobRows)}
    onClick={openMoldUnlockDrawer}
    variant="outlined"
  >
    解锁模具
  </Button>
</header>
```

Add helper（辅助函数）:

```ts
/**
 * @brief 判断当前作业是否存在可解锁 moldNo（模具号）。
 * @author PopoY
 */
function hasUnlockableCurrentMold(
  currentJobRows: PressJobCurrentJobRow[],
): boolean {
  return currentJobRows.some((row) => row.moldNo?.trim());
}
```

Add open handler（打开处理函数）:

```ts
/**
 * @brief 打开 Unlock Drawer（解锁抽屉）并只查询一次 locked molds（已锁定模具）。
 * @author PopoY
 */
const openMoldUnlockDrawer = () => {
  if (!hasUnlockableCurrentMold(currentJobRows)) {
    messageApi.warning("当前没有可解锁模具。");
    return;
  }

  setIsMoldUnlockDrawerOpen(true);
  loadLockedMoldsOnce();
};
```

Add one-time query and reset helpers（一次性查询与重置辅助函数）:

```ts
/**
 * @brief 查询 Unlock Drawer（解锁抽屉）需要的 locked molds（已锁定模具），并忽略 stale response（过期响应）。
 * @author PopoY
 */
const loadLockedMoldsOnce = () => {
  const loadVersion = lockedMoldLoadVersionRef.current + 1;
  lockedMoldLoadVersionRef.current = loadVersion;
  setLockedMoldsLoading(true);
  setLockedMoldRows([]);
  setSelectedUnlockMoldNos([]);

  if (!loadPressLockedMolds) {
    setLockedMoldsLoading(false);
    return;
  }

  void loadPressLockedMolds({
    correlationId: createPressMoldUnlockCorrelationId(),
  })
    .then((nextRows) => {
      if (lockedMoldLoadVersionRef.current === loadVersion) {
        setLockedMoldRows(nextRows);
      }
    })
    .catch(() => {
      if (lockedMoldLoadVersionRef.current === loadVersion) {
        setLockedMoldRows([]);
        messageApi.error("已锁定模具查询失败，请稍后重试。");
      }
    })
    .finally(() => {
      if (lockedMoldLoadVersionRef.current === loadVersion) {
        setLockedMoldsLoading(false);
      }
    });
};

/**
 * @brief 清理 Unlock Drawer（解锁抽屉）的本地 selection（选择）和数据。
 * @author PopoY
 */
const resetMoldUnlockDrawerState = () => {
  setLockedMoldRows([]);
  setSelectedUnlockMoldNos([]);
  setLockedMoldsLoading(false);
};

/**
 * @brief 关闭 Unlock Drawer（解锁抽屉）。
 * @author PopoY
 */
const cancelMoldUnlockDrawer = () => {
  setIsMoldUnlockDrawerOpen(false);
  resetMoldUnlockDrawerState();
};
```

- [x] **Step 5: Render Drawer, status bar, table, and footer（渲染抽屉、状态条、表格与底部）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Add Drawer（抽屉） after the mold lock Drawer（锁模抽屉）:

```tsx
<Drawer
  className="press-job-page__mold-unlock-drawer"
  onClose={cancelMoldUnlockDrawer}
  open={isMoldUnlockDrawerOpen}
  size={960}
  title="解锁模具"
>
  <div className="press-job-page__mold-unlock-layout">
    <div className="press-job-page__mold-unlock-status">
      <Tag>已锁定 {lockedMoldRows.length} 套</Tag>
      <Tag>加工中需保留 1 套</Tag>
      <Tag color="processing">已选 {selectedUnlockMoldNos.length} 套</Tag>
    </div>
    <Table<PressLockedMoldRow>
      className="press-job-page__mold-unlock-table"
      columns={lockedMoldColumns}
      dataSource={lockedMoldRows}
      loading={lockedMoldsLoading}
      locale={{ emptyText: "暂无已锁定模具" }}
      pagination={false}
      rowKey="moldNo"
      rowSelection={lockedMoldRowSelection}
      size="small"
    />
    <div className="press-job-page__mold-unlock-footer">
      <Button onClick={cancelMoldUnlockDrawer}>取消</Button>
      <Button
        disabled={selectedUnlockMoldNos.length === 0 || moldUnlockSubmitting}
        danger
        loading={moldUnlockSubmitting}
        onClick={() => confirmMoldUnlock(selectedUnlockMoldNos)}
        type="primary"
      >
        确认解锁 {selectedUnlockMoldNos.length} 套
      </Button>
    </div>
  </div>
</Drawer>
```

Table columns（表格列） must include:

```ts
const lockedMoldColumns: NonNullable<TableProps<PressLockedMoldRow>["columns"]> = [
  { title: "模具号", dataIndex: "moldNo", width: 140 },
  { title: "工序号", dataIndex: "stages", width: 100 },
  { title: "制造令号", dataIndex: "makeOrderNumber", width: 140 },
  { title: "工艺名称", dataIndex: "craftName", width: 140 },
  { title: "工时类型", dataIndex: "workTimeTypeText", width: 120 },
  { title: "开始时间", dataIndex: "startedAt", width: 170 },
  { title: "作业员", dataIndex: "operatorName", width: 120 },
  {
    title: "操作",
    key: "action",
    width: 100,
    render: (_value, row) => (
      <Button
        color="danger"
        onClick={() => confirmMoldUnlock([row.moldNo])}
        size="small"
        variant="outlined"
      >
        解锁
      </Button>
    ),
  },
];
```

Table selection（表格选择）:

```ts
const lockedMoldRowSelection: TableProps<PressLockedMoldRow>["rowSelection"] = {
  selectedRowKeys: selectedUnlockMoldNos,
  onChange: (nextSelectedRowKeys) => {
    setSelectedUnlockMoldNos(nextSelectedRowKeys.map(String));
  },
};
```

- [x] **Step 6: Wire confirm and submit（接入确认与提交）**

Modify `qt-app/frontend/src/components/PressJobPage.tsx`.

Add shared confirm helper（共用确认辅助函数）:

```ts
/**
 * @brief 对 single/batch unlock（单套/批量解锁）执行统一校验和确认。
 * @author PopoY
 */
const confirmMoldUnlock = (moldNos: string[]) => {
  const validationMessage = validatePressMoldUnlockSelection({
    lockedMolds: lockedMoldRows,
    selectedMoldNos: moldNos,
    currentJobRows,
  });

  if (validationMessage) {
    messageApi.warning(validationMessage);
    return;
  }

  const request = createPressMoldUnlockRequest(
    filters,
    moldNos,
    createPressMoldUnlockCorrelationId(),
  );

  modal.confirm({
    title: `是否确认解锁「${moldNos.join("、")}」模具？`,
    okText: "确认解锁",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk: () => submitPressMoldUnlockRequest(request),
  });
};
```

Add correlation ID helper（关联 ID 辅助函数）:

```ts
/**
 * @brief 创建 unlock mold（解锁模具）的 correlationId（关联 ID）。
 * @author PopoY
 */
function createPressMoldUnlockCorrelationId(): string {
  return `press-mold-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

Add submit handler（提交处理函数）:

```ts
/**
 * @brief 执行解锁提交、关闭 Drawer（抽屉）并刷新 current jobs（当前作业）。
 * @author PopoY
 */
const submitPressMoldUnlockRequest = async (
  request: PressMoldUnlockRequest,
) => {
  setMoldUnlockSubmitting(true);

  try {
    const status = await submitPressMoldUnlockWithRefresh({
      request,
      unlockPressMolds,
      refreshPressJobCurrentJobs,
      recordPressMoldUnlockDiagnostic,
    });

    if (status === "CURRENT_JOB_REFRESH_FAILED") {
      messageApi.warning("解锁完成，当前作业刷新失败，请手动切换页面后确认。");
    } else {
      messageApi.success("解锁完成");
    }

    setIsMoldUnlockDrawerOpen(false);
    resetMoldUnlockDrawerState();
  } catch (caughtError) {
    messageApi.error(resolvePressMoldUnlockErrorMessage(caughtError));
  } finally {
    setMoldUnlockSubmitting(false);
  }
};
```

- [x] **Step 7: Add compact styles（新增紧凑样式）**

Modify `qt-app/frontend/src/components/PressJobPage.css`.

Add styles（样式）:

```css
.press-job-page__section-title--with-action {
  justify-content: space-between;
  gap: 8px;
}

.press-job-page__section-title--with-action .ant-btn {
  min-height: 32px;
}

.press-job-page__mold-unlock-drawer .ant-drawer-body {
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}

.press-job-page__mold-unlock-layout {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.press-job-page__mold-unlock-status,
.press-job-page__mold-unlock-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.press-job-page__mold-unlock-status {
  justify-content: flex-start;
}

.press-job-page__mold-unlock-table {
  min-height: 0;
  overflow: auto;
}

.press-job-page__mold-unlock-table .ant-table-thead > tr > th,
.press-job-page__mold-unlock-table .ant-table-tbody > tr > td {
  padding-block: 5px;
}
```

Rules:

1. Do not create nested cards（嵌套卡片）.
2. Do not add gradients（渐变） or decorative effects（装饰效果）.
3. Keep table body（表格内容） locally scrollable.

- [x] **Step 8: Run focused tests and build（运行聚焦测试与构建）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx src/App.test.tsx
pnpm build
```

Expected（预期）:

```text
PASS（通过） focused tests.
PASS（通过） build, with existing Vite chunk-size warning（包体积告警） allowed.
```

## Acceptance Criteria（验收标准）

1. “解锁模具” button（按钮） is in the Current Job section header（当前作业标题栏）.
2. Top action area（顶部操作区） does not contain “解锁模具”.
3. `moldNo（模具号）` column stays plain text.
4. Drawer（抽屉） loads locked molds（已锁定模具） once when opened.
5. Drawer Table（抽屉表格） contains all 8 required business fields（业务字段）.
6. Drawer（抽屉） has no refresh button（刷新按钮）.
7. Single unlock（单套解锁） and batch unlock（批量解锁） share the same confirm/submit helpers（确认/提交辅助函数）.
8. Unlock success closes Drawer（抽屉） and refreshes current jobs（当前作业） only.

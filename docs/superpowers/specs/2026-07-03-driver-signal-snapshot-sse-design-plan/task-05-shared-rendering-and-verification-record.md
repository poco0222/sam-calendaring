# Task 05: Shared Rendering and Verification Record

> @file 共享渲染与验证记录任务
> @author PopoY
> @created 2026-07-03
> @purpose 验证 Bootstrap Dashboard（启动仪表盘）与 PressJobPage（压机作业页）共用 driverSession（驱动会话）状态，并落库最终验证记录。

## Goal（目标）

Prove the implementation did not create a second frontend refresh path（刷新路径）: both views keep reading `driverSession.data.signalSnapshot.signalValues`, existing manual refresh（手动刷新） still works, and pressDownCount monitor（下压计数监测） named events still work.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/6`。
- `2026-07-03`: PopoY 本轮开始执行 Task 05（任务五），确认当前 workspace（工作区）不是 Git repository（Git 仓库），先按步骤补齐共享渲染回归验证。
- `2026-07-03`: Step 1 完成，`App.test.tsx` 已新增共享 driverSession（驱动会话）渲染断言；`pnpm test -- src/App.test.tsx -t "applies pushed signal snapshots through the shared driver session"` 通过，当前进度 `1/6`。
- `2026-07-03`: Step 2 完成，`PressJobPage.test.tsx` 已新增实时信号来自 driverSession（驱动会话）的断言；`pnpm test -- src/components/PressJobPage.test.tsx -t "renders real-time signals from driver session data"` 通过，当前进度 `2/6`。
- `2026-07-03`: Step 3 完成，`cd driver-service && dotnet test` 通过（172/172 tests），`cd driver-service && dotnet build` 通过（0 warning/0 error），当前进度 `3/6`。
- `2026-07-03`: Step 4 完成，`cd qt-app/frontend && pnpm test` 通过（185/185 tests），`cd qt-app/frontend && pnpm build` 通过；Vite（构建工具）仅提示 chunk size advisory（分块大小建议），当前进度 `4/6`。
- `2026-07-03`: Step 5 完成，`verification-record.md` 已更新 backend/frontend（后端/前端）完整门禁、Task 05 聚焦门禁、manual smoke（手动冒烟）待验证边界，当前进度 `5/6`。
- `2026-07-03`: Step 6 完成，`git status --short --branch` 返回 `fatal: not a git repository`，按计划记录 commit skipped（提交跳过），当前进度 `6/6`。
- `2026-07-03`: Review fix（审查修复）完成，App shared state（共享状态）断言改为 event-to-state-to-render（事件到状态再到渲染）链路，并收口 pressDownCount monitor（下压计数监测）async error（异步错误）；完整门禁复跑通过：backend（后端）172/172 tests，frontend（前端）186/186 tests，build（构建）通过。
- `2026-07-03`: Review fix 2（第二轮审查修复）完成，verification record（验证记录）补充 publisher failure throttle（发布器失败节流）和 frontend forbidden keys（前端禁止字段）聚焦门禁；完整门禁复跑通过：backend（后端）173/173 tests，frontend（前端）186/186 tests，build（构建）通过。

## Files（文件）

- Modify only if assertions need explicit coverage: `qt-app/frontend/src/App.test.tsx`
- Modify only if existing signal fixture needs event-updated values: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Create: `docs/superpowers/specs/2026-07-03-driver-signal-snapshot-sse-design-plan/verification-record.md`

## Steps（步骤）

- [x] **Step 1: Add shared state regression assertion（新增共享状态回归断言）**

Update `qt-app/frontend/src/App.test.tsx` with a test that uses the existing fake EventSource（事件源） or adds the same minimal fake from `driverDeviceEventsClient.test.ts`:

```tsx
/**
 * @brief signalSnapshotChanged（信号快照变化）应刷新 App Shell（应用外壳）持有的 driverSession（驱动会话），不触发 bootstrap retry（启动重试）。
 * @author PopoY
 */
it("applies pushed signal snapshots through the shared driver session", async () => {
  const retrySpy = vi.fn();
  render(<App />);

  createdEventSources[0].emit(
    "signalSnapshotChanged",
    JSON.stringify({
      eventId: "evt-snapshot-001",
      correlationId: "signal-snapshot-publisher-001",
      eventName: "signalSnapshotChanged",
      commandName: "signalSnapshotPublisher",
      resultCode: "OK",
      occurredAt: "2026-07-03T00:00:00Z",
      snapshotValues: [{ signalCode: "pressure", value: 135 }],
    }),
  );

  expect(await screen.findByText("135")).toBeInTheDocument();
  expect(retrySpy).not.toHaveBeenCalled();
});
```

If `App.test.tsx` already has a different bootstrap fixture pattern, keep the same fixture style and only add the `signalSnapshotChanged` emit plus assertion.

- [x] **Step 2: Add PressJobPage regression assertion only if needed（必要时新增压机作业页回归断言）**

If existing `PressJobPage.test.tsx` does not already assert signal rendering from props, add:

```tsx
/**
 * @brief PressJobPage（压机作业页）继续从 driverSession（驱动会话）读取实时信号。
 * @author PopoY
 */
it("renders real-time signals from driver session data", () => {
  render(
    <PressJobPage
      {...createPressJobPageProps({
        driverSession: {
          status: "success",
          data: {
            applyResult: connectedApplyResult,
            signalSnapshot: {
              correlationId: "signal-snapshot-publisher-001",
              resultCode: "OK",
              signalValues: { pressure: 135 },
            },
          },
          error: null,
          retry: vi.fn(),
          refreshSnapshot: vi.fn(),
        },
      })}
    />,
  );

  expect(screen.getByText("135")).toBeInTheDocument();
});
```

If the local helper is named differently, use the existing helper and keep the assertion to signal value `135`.

- [x] **Step 3: Run complete backend gates（运行完整后端门禁）**

Run:

```bash
cd driver-service
dotnet test
dotnet build
```

Expected（期望）: both commands PASS. If a failure is unrelated to this task, record the exact test name and failure reason in `verification-record.md`; do not claim green.

- [x] **Step 4: Run complete frontend gates（运行完整前端门禁）**

Run:

```bash
cd qt-app/frontend
pnpm test
pnpm build
```

Expected（期望）: both commands PASS. If dependencies are missing, run the existing package manager install command already used by this repo, then rerun the same gates and record both commands.

- [x] **Step 5: Write verification record（写入验证记录）**

Create `docs/superpowers/specs/2026-07-03-driver-signal-snapshot-sse-design-plan/verification-record.md`:

```markdown
# Driver Signal Snapshot SSE Verification Record

> @file Driver Signal Snapshot SSE 验证记录
> @author PopoY
> @created 2026-07-03
> @purpose 记录主动 signal snapshot（信号快照）SSE 推送实现后的自动化验证、手动冒烟和剩余风险。

## Automated Gates（自动化门禁）

| Command（命令） | Result（结果） | Evidence（证据） |
| --- | --- | --- |
| `cd driver-service && dotnet test` | Not Run（未运行） | 等待执行 |
| `cd driver-service && dotnet build` | Not Run（未运行） | 等待执行 |
| `cd qt-app/frontend && pnpm test` | Not Run（未运行） | 等待执行 |
| `cd qt-app/frontend && pnpm build` | Not Run（未运行） | 等待执行 |

## Manual Smoke（手动冒烟）

| Check（检查项） | Result（结果） | Notes（备注） |
| --- | --- | --- |
| Driver Service（驱动服务）有效租约后 10 秒内推送 `signalSnapshotChanged` | Not Run（未运行） | 等待 PopoY 或现场环境验证 |
| Bootstrap Dashboard（启动仪表盘）信号快照刷新 | Not Run（未运行） | 等待 PopoY 或现场环境验证 |
| PressJobPage（压机作业页）实时信号同源刷新 | Not Run（未运行） | 等待 PopoY 或现场环境验证 |
| device timeout（设备超时）写节流失败日志 | Not Run（未运行） | 等待 PopoY 或现场环境验证 |
| 恢复后写一次 `SignalSnapshotPublisherRecovered` | Not Run（未运行） | 等待 PopoY 或现场环境验证 |

## Security Boundary（安全边界）

- SSE payload（服务器发送事件载荷）不得包含 `signedLease`, `signature`, `signaturePayload`, `signalConfig`, `privateKey`, `credential`, `sessionToken`, `targetEndpoint`, raw `ip`, raw `port`, raw `deviceId`, `registerAddress`, `writeValue`, `rawRegisters`.
- diagnostic log（诊断日志）不得包含完整第三方异常堆栈或敏感 payload（敏感载荷）。
- automatic success tick（自动成功计时读取）不得写 `audit_log（审计日志表）` 或逐条成功 `diagnostic_log（诊断日志表）`.

## Remaining Risks（剩余风险）

- Manual smoke（手动冒烟）依赖现场设备或可控 Modbus（工业通信协议）模拟环境。
- Login/session（登录/会话）相关浏览器流程不属于本规格范围。
```

After running gates, update each row from `Not Run（未运行）` to `PASS（通过）`, `FAIL（失败）`, or `BLOCKED（阻塞）` with exact command output summary.

- [x] **Step 6: Commit or record skip（提交或记录跳过）**

Run:

```bash
git status --short --branch
```

Expected（期望）:

- If this directory is a Git repository（Git 仓库）, commit with:

```bash
git add qt-app/frontend/src docs/superpowers/specs/2026-07-03-driver-signal-snapshot-sse-design-plan/verification-record.md
git commit -m "test: 验证 signal snapshot SSE 共享刷新链路"
```

- If command returns `fatal: not a git repository`, update this task progress with commit skipped（提交跳过） because workspace（工作区） is not a Git repository.

# Task 05: Tests And Visual Verification

> @file QT App 压机作业 Tour guidance（漫游式指导）验证任务
> @author PopoY
> @created 2026-07-03
> @purpose 对三条 guidance（指导）执行 focused tests（聚焦测试）、regression gates（回归门禁）和 1280x720 visual verification（视觉验证）记录。

## Goal（目标）

Verify the final implementation end to end without expanding scope. This task should only adjust tests or docs if verification finds a real gap; it must not add new guidance features（指导功能） beyond the source spec（来源规格）.

## Status（状态）

- `Completed（已完成）`

## Progress（进度）

- `2026-07-03`: 计划已落库，当前进度 `0/6`。
- `2026-07-03`: Task5 开始执行；确认当前 `qt-app/frontend` 执行 `git status --short --branch` 返回 `fatal: not a git repository (or any of the parent directories): .git`，按验收标准记录无 Git repository（Git 仓库）状态。
- `2026-07-03`: Step 1 完成，已在 `PressJobPage.test.tsx` 新增 Tour guidance（漫游式指导）source-safety（源码安全）测试，当前进度 `1/6`。
- `2026-07-03`: Step 2 首次运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 失败，`67 tests | 1 failed`；失败点为新增测试对整份 `PressJobPage.tsx` 扫描 `sessionToken`，而既有 sanitizer（脱敏器）禁止词列表本身包含该字符串，需将测试范围收窄到 Tour guidance source（漫游指导源码）。
- `2026-07-03`: Step 2 重新运行 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 通过，`Test Files 1 passed (1)`, `Tests 67 passed (67)`，当前进度 `2/6`。
- `2026-07-03`: Step 3 运行 `pnpm test` 通过，`Test Files 18 passed (18)`, `Tests 204 passed (204)`，当前进度 `3/6`。
- `2026-07-03`: Step 4 运行 `pnpm build` 通过，Vite build（构建）完成并产出 `dist/assets/index-Xb52NUE6.js 1,123.67 kB`；仅出现计划允许的 chunk-size warning（包体积告警），当前进度 `4/6`。
- `2026-07-03`: Review（评审）指出 source-safety（源码安全）需补齐 `signature/deviceId/selectedRows/ip/port` sensitive-data boundary（敏感数据边界）；已最小修改 `PressJobPage.test.tsx` 和本任务 Step 1 示例，重跑 `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` 通过，`Tests 67 passed (67)`。
- `2026-07-03`: Step 5 完成 1280x720 visual smoke（视觉冒烟）；通过 Playwright + Chrome channel（浏览器通道）runtime mock（运行时模拟）验证 Start/Complete/Unlock Tour（开始/完成/解锁漫游）步骤顺序、关闭入口、顶部布局、真实生产按钮仍位于 action row（操作区）和 sensitive-data boundary（敏感数据边界）；截图保存至 `.playwright-cli/task5-press-tour-pending-1280x720.png` 与 `.playwright-cli/task5-press-tour-running-unlock-1280x720.png`，当前进度 `5/6`。
- `2026-07-03`: Step 6 完成，已创建 `verification-record.md`；最终自动化门禁重新确认：focused tests（聚焦测试）`67 passed`, regression（回归）`204 passed`, build（构建）`✓ built in 193ms` 且仅有允许的 chunk-size warning（包体积告警），当前进度 `6/6`。
- `2026-07-03`: Review fix（复核修复）完成：先运行新增 RED tests（失败测试），结果 `69 tests | 2 failed`，失败点对应 `Finish（完成）` guard（条件检查）缺失和 Unlock Drawer（解锁抽屉）关闭未同步 Tour（漫游）；修复后 focused tests（聚焦测试）`69 passed`，frontend regression（前端回归）`206 passed`，build（构建）通过且仅有既有 chunk-size warning（包体积告警）。`verification-record.md` 已补充 File Boundary（文件边界）和 Visual Smoke（视觉冒烟）可审计证据。
- `2026-07-03`: Secondary review fix（二次复核修复）完成：补强 `finishPressJobTour` source contract（源码契约），断言 warning（警告）分支的 `return` 位于 `closePressJobTour()` 之前；重跑 focused tests（聚焦测试）`69 passed`、frontend regression（前端回归）`206 passed`、build（构建）`✓ built in 313ms` 且仅有既有 chunk-size warning（包体积告警）。

## Files（文件）

- Modify: `qt-app/frontend/src/components/PressJobPage.test.tsx`
- Modify if needed（必要时修改）: `qt-app/frontend/src/components/PressJobPage.tsx`
- Modify if needed（必要时修改）: `qt-app/frontend/src/components/PressJobPage.css`
- Create: `docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/verification-record.md`

## Steps（步骤）

- [x] **Step 1: Add final source-safety tests（新增最终源码安全测试）**

Modify `PressJobPage.test.tsx`.

Add:

```tsx
/**
 * @brief 断言 Tour guidance（漫游式指导）不新增敏感日志和生产自动提交路径。
 * @author PopoY
 */
it("keeps tour guidance separate from production submits and sensitive data", () => {
  // @author PopoY: 仅扫描 Tour guidance（漫游式指导）相关源码，避免命中既有 sanitizer（脱敏器）禁止词列表。
  const tourGuidanceSource = [
    extractSourceBetween(pageSource, "const startTourSteps =", "const activeTourSteps ="),
    extractSourceBetween(pageSource, "const openPressJobTour =", "const advancePressJobTour ="),
    extractSourceBetween(pageSource, 'className="press-job-page__guidance-launchers"', "</Form>"),
    extractSourceBetween(
      pageSource,
      'className="press-job-page__mold-unlock-drawer"',
      "</Drawer>",
    ),
  ].join("\n");

  expect(pageSource).toContain('openPressJobTour("start")');
  expect(pageSource).toContain('openPressJobTour("complete")');
  expect(pageSource).toContain('openPressJobTour("unlock")');
  expect(tourGuidanceSource).not.toContain("guidanceSelectedRows");
  expect(tourGuidanceSource).not.toContain("console.log");
  expect(tourGuidanceSource).not.toContain("logTour");
  expect(tourGuidanceSource).not.toContain("sessionToken");
  expect(tourGuidanceSource).not.toContain("signedLease");
  expect(tourGuidanceSource).not.toContain("signature");
  expect(tourGuidanceSource).not.toContain("privateKey");
  expect(tourGuidanceSource).not.toContain("credential");
  expect(tourGuidanceSource).not.toContain("signalConfig");
  expect(tourGuidanceSource).not.toContain("selectedRows");
  expect(tourGuidanceSource).not.toContain("deviceId");
  expect(tourGuidanceSource).not.toContain('"ip"');
  expect(tourGuidanceSource).not.toContain("ip:");
  expect(tourGuidanceSource).not.toContain('"port"');
  expect(tourGuidanceSource).not.toContain("port:");
});
```

- [x] **Step 2: Run focused component tests（运行组件聚焦测试）**

Run:

```bash
cd qt-app/frontend
./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx
```

Expected（预期）:

```text
PASS（通过） PressJobPage focused tests（压机作业页聚焦测试）.
```

If it fails, fix only the smallest relevant implementation/test gap and rerun this command.

- [x] **Step 3: Run frontend regression tests（运行前端回归测试）**

Run:

```bash
cd qt-app/frontend
pnpm test
```

Expected（预期）:

```text
PASS（通过） frontend regression（前端回归）.
```

- [x] **Step 4: Run frontend build（运行前端构建）**

Run:

```bash
cd qt-app/frontend
pnpm build
```

Expected（预期）:

```text
PASS（通过） Vite build（构建）. Existing chunk-size warning（既有包体积告警） is allowed if no new build error appears.
```

- [x] **Step 5: Perform 1280x720 visual smoke（执行视觉冒烟检查）**

Run:

```bash
cd qt-app/frontend
pnpm dev
```

Verify in browser（浏览器） at `1280x720 viewport（视口）`:

1. Top filters（顶部筛选） stay on one row and do not overlap.
2. “开始加工指导” and “完成加工指导” are right-aligned.
3. Real “开始加工” and “完成加工” buttons remain in the production action row（生产操作区）.
4. Start Tour（开始漫游） highlights team/operator/process/current job/planned duration/start button in order.
5. Complete Tour（完成漫游） highlights current job/signal snapshot/complete button in order.
6. Unlock Drawer（解锁抽屉） status tags（状态标签） stay left and “解锁模具指导” stays right.
7. Unlock Tour（解锁漫游） highlights locked count/keep-one tag/selected count/table/confirm button.
8. Tour close（关闭） is visible and returns the page to normal operation.

- [x] **Step 6: Create verification record（创建验证记录）**

Create `docs/superpowers/specs/2026-07-03-press-working-tour-guidance-design-plan/verification-record.md`:

```markdown
# Press Working Tour Guidance Verification Record

> @file QT App 压机作业 Tour guidance（漫游式指导）验证记录
> @author PopoY
> @created 2026-07-03
> @purpose 记录 `2026-07-03-press-working-tour-guidance-design-plan` 自动化验证和 1280x720 visual smoke（视觉冒烟）结果。

## Status（状态）

- `Pending（待验证）`

## Automated Gates（自动化门禁）

| Gate（门禁） | Command（命令） | Result（结果） | Notes（备注） |
| --- | --- | --- | --- |
| Focused component tests（组件聚焦测试） | `./node_modules/.bin/vitest run src/components/PressJobPage.test.tsx` | Pending（待执行） |  |
| Frontend regression（前端回归） | `pnpm test` | Pending（待执行） |  |
| Frontend build（前端构建） | `pnpm build` | Pending（待执行） |  |

## Visual Smoke（视觉冒烟）

| Check（检查项） | Result（结果） | Notes（备注） |
| --- | --- | --- |
| 1280x720 top filters（顶部筛选）不换行、不遮挡 | Pending（待执行） |  |
| Top guidance buttons（顶部指导按钮）右对齐 | Pending（待执行） |  |
| Start Tour（开始漫游）步骤顺序正确 | Pending（待执行） |  |
| Complete Tour（完成漫游）步骤顺序正确 | Pending（待执行） |  |
| Unlock Drawer（解锁抽屉）状态行左右分布正确 | Pending（待执行） |  |
| Unlock Tour（解锁漫游）步骤顺序正确 | Pending（待执行） |  |
| Close control（关闭入口）可见 | Pending（待执行） |  |

## Sensitive Data Boundary（敏感数据边界）

- No `sessionToken（会话令牌）`, `signedLease（签名租约）`, `signature（签名）`, `signalConfig（信号配置）`, `privateKey（私钥）`, `credential（凭据）`, raw `ip/port/deviceId（网络和设备字段）`, or full selected rows（完整选中行） observed in UI/log assertions.
```

Update the pending rows with exact command output after running the gates.

## Acceptance Criteria（验收标准）

1. Focused tests（聚焦测试） pass.
2. `pnpm test` passes.
3. `pnpm build` passes or only has known non-blocking warning（非阻塞告警）.
4. 1280x720 visual smoke（视觉冒烟） is recorded.
5. `verification-record.md` contains exact evidence（精确证据）, not generic claims（泛化声明）.
6. If no Git repository（Git 仓库） is available, task progress records the exact `git status --short --branch` failure.

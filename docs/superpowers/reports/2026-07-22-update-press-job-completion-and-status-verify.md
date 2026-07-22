<!--
@file 2026-07-22-update-press-job-completion-and-status-verify.md - Press job completion and processing-status verification report（压机完工与加工状态验证报告）
@author PopoY
@created 2026-07-22 09:13:57
@purpose Record traceable OpenSpec, test, build, review, and security verification evidence（记录可追溯的规格、测试、构建、审查与安全验证证据）。
-->

# Verification Report: update-press-job-completion-and-status

- Workflow: `tweak`
- Base ref: `5dc43b6d5fef7b62cb69182395540c7c47bef192`
- Verified source ref: `bd0b7ded3b311d2d30efe9d75236a7d5670bdebc`
- Verified at: `2026-07-22 09:22:07 +0800`
- Verify mode: `full`

## Summary

| Dimension | Status | Evidence |
| --- | --- | --- |
| Completeness | PASS | 3/3 tasks completed; 2/2 requirements and 11/11 scenarios mapped to implementation and test evidence. |
| Correctness | PASS | Completion skips only its `processId` check, while start and independent actions retain their process preflight; current-job rows render and color ERP `status` directly. |
| Coherence | PASS | Implementation follows all three decisions in `design.md`; no delta-spec/design contradiction was found. |
| Security | PASS | No Driver Service, request whitelist, logging, credential, token, network-address, device-ID, or raw signal-configuration changes. |
| Review | PASS | Independent review and focused re-review ended with Critical 0, Important 0, and `Ready to merge: Yes`. |

## Requirement and Scenario Coverage

### Completion does not depend on a preselected process

- `PressJobPage.tsx:3083-3088` calls the shared workflow preflight with `requiresProcessId=false` only for completion.
- `PressJobPage.tsx:4023-4049` preserves team, operator, current-job-state, and Driver lease validation and conditionally checks `processId`.
- `PressJobPage.tsx:3094-3111` preserves Driver connection, running-job status, locked-mold, and local-session-ID validation.
- `PressJobPage.test.tsx:2903-2993` proves start still requires a process and completion does not, while retaining other completion guards.
- `PressJobPage.test.tsx:3183-3248` runs completion without `processId` and verifies the exact order `finalSnapshot -> parameter-end -> erpComplete -> cleanupDeviceSession`.
- `PressJobPage.tsx:3544-3559` and `PressJobPage.test.tsx:3448-3480` preserve the independent `moveOut` process preflight before confirmation or side effects.

Result: all 3 completion-preflight scenarios are covered.

### Current-job processing status and action-area line status

- `PressJobPage.tsx:1304-1315` renders the `加工状态` column from each ERP row: `0 -> 待加工`, `1 -> 进行中`, otherwise the original value.
- `PressJobPage.tsx:2503-2517` assigns pending/running row classes from ERP status.
- `PressJobPage.tsx:5123-5128` retains the existing `-` placeholder for an empty status.
- `PressJobPage.css:249-270` applies deterministic yellow/green backgrounds to every cell in light and dark themes and covers both `:hover` and Ant Design's `ant-table-cell-row-hover` state.
- `PressJobPage.tsx:5482-5531` preserves action-area line-status parsing for scalar, direct-object, metadata-located, and unknown signal values.
- `PressJobPage.test.tsx:1634-1717` covers line-in, line-out, metadata lookup, and unknown line status.
- `PressJobPage.test.tsx:1723-1787` covers ERP status text, row classes, theme/hover CSS selectors, unknown status behavior, and continued ERP-status lifecycle use.

Result: all 8 processing-status and line-status scenarios are covered.

## Design and Proposal Adherence

| Decision or goal | Result |
| --- | --- |
| Make process selection explicit in the shared preflight | PASS — start passes `true`, completion passes `false`, and independent outer actions retain their own preflight. |
| Read current-job status directly from ERP rows | PASS — the table no longer substitutes the PLC line-status value. |
| Use Ant Design `rowClassName` for full-row semantic backgrounds | PASS — pending/running classes color every cell and survive application-theme and hover changes. |
| Keep request/API/data-model scope unchanged | PASS — production changes are limited to `PressJobPage.tsx` and `PressJobPage.css`; tests are limited to `PressJobPage.test.tsx`. |
| Locate associated Superpowers Design Doc | N/A — the `tweak` workflow intentionally has no separate `docs/superpowers/specs/` Design Doc; the repo-local `design.md` was fully verified. |

## Executed Verification

The following auditable command completed with exit code `0` and was recorded through `comet state record-check ... verify`:

```bash
pnpm --dir qt-app/frontend test && pnpm --dir qt-app/frontend exec tsc --noEmit && pnpm --dir qt-app/frontend build && openspec validate update-press-job-completion-and-status --strict && git diff --check 5dc43b6d5fef7b62cb69182395540c7c47bef192...HEAD
```

Results:

- Vitest: 20/20 files and 291/291 tests passed; `PressJobPage.test.tsx` passed 117/117 tests.
- TypeScript: `tsc --noEmit` passed with exit code `0`.
- Production build: Vite transformed 1,020 modules and completed successfully. The existing JavaScript chunk-size warning above 500 kB remains non-blocking.
- OpenSpec: strict validation reported `Change 'update-press-job-completion-and-status' is valid`.
- Diff check: no whitespace errors.
- Targeted TDD evidence: the new status/hover and running change-mold move-out tests failed before their fixes and passed afterward.

The first archive attempt safely stopped because five existing scenario headings in the modified delta block had been translated instead of retaining their exact main-spec identities. Commit `bd0b7de` restored only those five headings, preserving every scenario body and all three newly added current-job scenarios. The complete verification command above was then rerun successfully and recorded again.

The build-phase guard could not infer the nested `qt-app/frontend` package build and its command-record step encountered a stale Comet Run projection after tasks reached 3/3. The guard's duplicate build probe was bypassed once through its compatibility environment flag only after the real production build had passed. This bypass is not used as verification evidence; the successful command above is the recorded verify evidence.

## Security and Worktree Boundary

- No new or modified logging was introduced.
- No raw `signedLease`, `signature`, `signalConfig`, private key, credential, session token, `ip`, `port`, or `deviceId` field was added or transmitted.
- The untracked root file `logo.png` is unrelated to this change and remains untouched and excluded from every commit.
- Verify-phase dirty tracked files are limited to Comet state/evidence files for this active change.

## Issues by Priority

### CRITICAL

None.

### WARNING

None.

### SUGGESTION

None.

## Final Assessment

All completeness, correctness, coherence, build, test, OpenSpec, security, and review checks passed. The change is ready for final archive confirmation.

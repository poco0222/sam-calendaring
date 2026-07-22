<!--
@file tasks.md - Press job completion preflight and current-job status tasks
@author PopoY
@created 2026-07-22 08:45:17
@purpose Track the minimal tests and implementation for completion validation, processing status, and row backgrounds.
-->

## 1. Completion preflight

- [x] 1.1 Add failing `PressJobPage.test.tsx` coverage proving completion works without a selected process while start processing still requires one; then minimally adjust the shared preflight so only completion skips `processId` validation.

## 2. Current-job processing status

- [x] 2.1 Add failing `PressJobPage.test.tsx` coverage for `status=0` rendering `待加工` with a yellow row class, `status=1` rendering `进行中` with a green row class, and unknown status receiving no class; then minimally update `PressJobPage.tsx` and `PressJobPage.css` while preserving action-area line status.

## 3. Verification

- [ ] 3.1 Run targeted Vitest, full `pnpm test`, TypeScript checking, production build, strict OpenSpec validation, and `git diff --check`; confirm the sensitive-information boundary and minimal change scope.

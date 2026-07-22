<!--
@file proposal.md - Press job completion preflight and processing status proposal
@author PopoY
@created 2026-07-22 08:45:17
@purpose Define the boundary for removing the completion process-selection dependency and restoring ERP processing status in the current-job table.
-->

## Why

The completion request does not use the preselected process, but the shared page preflight still requires one and blocks an otherwise valid running job from completing. The current-job table also replaces ERP processing status with live line-in/line-out status, so operators cannot distinguish pending and running jobs by the status value and row background used by sam-erp.

## What Changes

- Stop validating `processId` for completion while preserving the existing process-selection requirement for start processing and other independent actions.
- Rename the current-job table column to `加工状态` and read each ERP row's `status` directly: `0` renders `待加工`, and `1` renders `进行中`.
- Give running rows a green background and pending rows a yellow background; do not add a background for other statuses.
- Keep the action area's `当前状态` driven by the `是否出线` PLC signal, including its line-in, line-out, and unknown results.

## Capabilities

### New Capabilities

- `press-job-completion-preflight`: Defines completion without a preselected process while preserving every other completion safety precondition.

### Modified Capabilities

- `press-job-current-state-duration`: Changes the current-job table to ERP processing status and status-based row backgrounds while keeping line status in the action area only.

## Impact

- Only the QT App `PressJobPage`, its styles, and frontend tests are affected.
- ERP client, Driver Service, request fields, database schema, and dependencies remain unchanged.
- The change does not add or transmit `signalConfig`, raw `ip`, `port`, `deviceId`, credentials, or session tokens.

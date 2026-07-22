<!--
@file spec.md - Press job completion preflight delta specification
@author PopoY
@created 2026-07-22 08:45:17
@purpose Specify completion without process selection while preserving start-processing and safety preconditions.
-->

## ADDED Requirements

### Requirement: Completion does not depend on a preselected process

The QT App press-job page MUST allow an operator to complete a running current job when no `processId` is selected. The system MUST continue to validate team, operator, current-job status, Driver lease, Driver session, locked mold, and local job session ID. Completion request fields and execution order MUST remain unchanged.

#### Scenario: Complete without a selected process

- **WHEN** the current job is running, no process is selected, and every other completion precondition is satisfied
- **THEN** the page MUST NOT return `请先选择预选工艺`
- **AND** the page MUST continue through final signal snapshot, completion parameter recording, ERP completion, and device cleanup

#### Scenario: Preserve completion safety preconditions

- **WHEN** no process is selected and any other completion precondition is not satisfied
- **THEN** the page MUST return the corresponding Chinese validation message
- **AND** removing process validation MUST NOT bypass any other safety validation

#### Scenario: Start processing still requires a process

- **WHEN** an operator starts processing without selecting a process
- **THEN** the page MUST block start processing
- **AND** the page MUST instruct the operator to select a process

<!--
@file spec.md - Press current-job processing status delta specification
@author PopoY
@created 2026-07-22 08:45:17
@purpose Change the current-job table to ERP processing status while preserving action-area line status.
-->

## MODIFIED Requirements

### Requirement: 当前状态由是否出线信号统一展示

The QT App press-job action area MUST locate the `是否出线` signal in the redacted Driver Service signal snapshot and render device line status. The current-job table MUST read each ERP row's `status` directly as `加工状态` and MUST NOT replace processing status with the `是否出线` signal. Signal lookup MUST support a directly named map key and a `signalCode` key whose value object identifies the signal through `signalName`, `name`, or `semanticKey`.

#### Scenario: Action-area signal indicates line-in

- **WHEN** the `是否出线` scalar or object `value` is `false`, `0`, `"0"`, or `"false"`
- **THEN** the action area MUST render a green `已入线` Tag

#### Scenario: Action-area signal indicates line-out

- **WHEN** the `是否出线` scalar or object `value` is `true`, `1`, `"1"`, or `"true"`
- **THEN** the action area MUST render a red `已出线` Tag

#### Scenario: Locate action-area line status through signal metadata

- **WHEN** the signal snapshot map key is `signalCode` and its value object's `signalName`, `name`, or `semanticKey` equals `是否出线`
- **THEN** the action area MUST use that object's `value` to determine line-in or line-out status
- **AND** the page MUST NOT require the map key itself to equal `是否出线`

#### Scenario: Action-area line status is missing or unrecognized

- **WHEN** the signal snapshot has no identifiable `是否出线` signal or its value is not a supported boolean or `0/1`
- **THEN** the action area MUST render a neutral `未知` Tag
- **AND** the page MUST NOT report an unknown value as `已入线` or `已出线`

#### Scenario: Current job is pending

- **WHEN** a current-job row's ERP `status` is `0`
- **THEN** the table's `加工状态` column MUST render `待加工`
- **AND** every cell in that row MUST use a yellow background

#### Scenario: Current job is running

- **WHEN** a current-job row's ERP `status` is `1`
- **THEN** the table's `加工状态` column MUST render `进行中`
- **AND** every cell in that row MUST use a green background

#### Scenario: Current-job status is unrecognized

- **WHEN** a current-job row's ERP `status` is neither `0` nor `1`
- **THEN** the table MUST render a non-empty status unchanged and use the existing placeholder for an empty status
- **AND** the row MUST NOT receive the pending or running background

#### Scenario: Job lifecycle decisions continue to use ERP status

- **WHEN** the page starts processing, completes processing, calculates actual duration, or makes another job lifecycle decision
- **THEN** the page MUST continue to use ERP `status`
- **AND** the action-area `是否出线` signal MUST NOT participate in job lifecycle decisions

<!--
@file design.md - Press job completion preflight and current-job processing status design
@author PopoY
@created 2026-07-22 08:45:17
@purpose Describe the minimal action-specific process validation and ERP status-based table rendering.
-->

## Context

`PressJobPage` shares a preflight between start processing and completion, so completion is blocked by a `processId` that is not part of the completion request. The current-job response already narrows ERP `status` into `PressJobCurrentJobRow.status`, but the table's `当前状态` column ignores that value and renders the status derived from the `是否出线` signal for every row.

sam-erp's `PressCurrentJobTable.vue` passes `row.status` directly to its status dictionary and uses the same value for row styles. This project has no equivalent dictionary options, so the minimal implementation reuses the existing `0`/`1` business meanings without adding an endpoint or another status data source.

## Goals / Non-Goals

**Goals:**

- Allow completion without a preselected process to enter the existing final-snapshot, parameter-recording, ERP-completion, and device-cleanup flow.
- Continue requiring team, operator, and process for start processing.
- Render `待加工` or `进行中` from each current job's ERP `status`, with yellow or green full-row backgrounds respectively.
- Keep the action area's line-in/line-out status unchanged.

**Non-Goals:**

- Do not change the completion body, ERP API, Driver Service, data model, or status transitions.
- Do not add a sam-erp dictionary request, a general status system, or a new UI component.
- Do not copy the reference component's blue background for `status=0`, which conflicts with this request's yellow pending state.

## Decisions

### 1. Make the shared preflight explicit about process selection

Add one boolean parameter to the existing shared preflight to control whether `processId` is required. Start processing passes `true`; completion passes `false`. This preserves the validation order for team, operator, job state, and device authorization, while avoiding the regression that would result from deleting the process check globally.

Do not change `buildPressJobCompleteRequest`, because it already excludes `processId`.

### 2. Render the current-job table from each ERP row status

Rename the table column from `当前状态` to `加工状态`. Its renderer reads the current row's `status`: `0` renders `待加工`, `1` renders `进行中`, other non-empty values render unchanged, and an empty value uses the existing placeholder. The action area continues to render `pressJobLineStatus` as `已入线`, `已出线`, or `未知`.

Do not add a status dictionary request. Existing workflow guards already use the same `0`/`1` values, so direct reuse avoids competing data sources.

### 3. Use the native Ant Design Table row class hook

The Table `rowClassName` returns stable pending or running class names from `row.status`. CSS applies the background to the row's `td` elements and overrides Ant Design's `ant-table-cell-row-hover` state so the semantic color remains visible. Light and dark application themes use explicit yellow and green colors instead of the operating system's `Canvas` color, keeping text readable when application and system themes differ. Other statuses receive no class.

## Risks / Trade-offs

- [ERP returns an unrecognized status] → Render the non-empty value unchanged and add no row background, avoiding a false pending or running status.
- [Line-out or move-out reuses completion] → The reused completion subflow also stops checking process selection, while each outer action keeps its own preconditions.
- [Ant Design hover overrides the row background] → Cover normal, `:hover`, and `ant-table-cell-row-hover` cell backgrounds in CSS.
- [Application and operating-system themes differ] → Use explicit light/dark semantic backgrounds instead of system `Canvas` color.

## Migration Plan

1. Add failing tests for completion, status text, and row classes.
2. Apply the minimal page and CSS changes, then run targeted tests, the full frontend suite, TypeScript checking, and a production build.
3. No data migration is required; reverting the frontend commit restores the previous behavior.

## Open Questions

None. Existing code and this request define the status source, `0`/`1` meanings, and colors.

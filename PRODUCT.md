# Product

## Register

product

## Users

The primary users are Chinese factory-floor operators working on fixed 10-inch Windows touch IPC devices at 1280x720 resolution. They need to see whether the local QT App, ERP Server, Driver Service, and Modbus Device bootstrap chain is ready before production work continues.

Secondary users are on-site maintenance, integration, and development staff who diagnose ERP auto-login, lease authorization, Driver Service connection, signal snapshot, and sanitized error states during rollout and field support.

## Product Purpose

QT App V1 Bootstrap is a Qt WebEngine desktop app surface that proves the shortest safe startup chain:

QT App reads protected local machine config, calls ERP auto-login, obtains signedLease and signalConfig, applies them to the local Driver Service, then displays driver, device, lease, signal snapshot, and error status.

Success means an operator can quickly tell whether the station is bound, ERP login succeeded, authorization is present, Driver Service accepted the lease, and the first signal snapshot is readable. Success also means unsafe shortcuts are visible by absence: no password login page, no raw device endpoint overrides, no English full-page fallback, and no raw sensitive authorization payloads.

## Brand Personality

Reliable, restrained, and field-readable.

The interface should still show design care. It should feel deliberately composed through clear hierarchy, compact touch-friendly structure, readable state color, and consistent Ant Design component vocabulary, not through decorative motion, oversized visuals, or dark-dashboard spectacle.

## Anti-references

Avoid traditional ERP-heavy form walls where every field has equal visual weight and operators must search for the current state.

Avoid over-styled dark dashboards that look impressive in screenshots but reduce trust, readability, or touch accuracy on field hardware.

Avoid low-contrast gray text, ambiguous status color, raw English runtime errors, ordinary account/password login screens, and any UI that suggests operators can manually override ip, port, or deviceId outside the signedLease and signalConfig path.

Avoid decorative cards, nested cards, broad shadows, gradient text, glass effects, and visual flourishes that do not help an operator answer the startup-state question faster.

## Design Principles

Make the safe path obvious: the UI should make ERP auto-login, signedLease, signalConfig, Driver Service, and signal snapshot progress legible without exposing unsafe controls.

Optimize for the field viewport: every primary status, retry action, and error message must work inside the fixed 1280x720 touch IPC baseline.

Prefer diagnostic clarity over visual drama: visual design should make status, ownership, timing, and failure cause easy to scan.

Use one component language: Ant Design provides the baseline for buttons, tables, descriptions, cards, tags, alerts, segmented controls, spacing, and feedback.

Show craft through restraint: the design should look intentional through spacing, alignment, hierarchy, state treatment, and Chinese copy, not through extra decoration.

## Accessibility & Inclusion

Target WCAG 2.1 AA contrast and focus expectations where they apply to the Qt WebEngine surface.

The field environment requires stronger practical constraints: readable Chinese text under factory lighting, touch targets suitable for 10-inch IPC operation, no reliance on color alone for critical state, clear focus and disabled states, and reduced-motion-safe behavior.

The UI must avoid low-contrast placeholders, tiny controls, English-only failure paths, and interactions that require precise mouse behavior unavailable on touch hardware.

# P4 real-host acceptance

## ChatBI public Beta rehearsal

Date: 2026-07-17. Source host commit: `be43e45`. A detached worktree was used so the maintained ChatBI branch and its existing Alpha lockfile were not modified.

Exact public npm dependencies:

- `@agentic-chat/adapter-chatbi@0.1.0-beta.1`;
- `@agentic-chat/react@0.1.0-beta.2`;
- `@agentic-chat/react-ui@0.1.0-beta.2`.

Results:

- npm install/audit: passed, zero reported vulnerabilities;
- frontend unit tests: 14/14 passed;
- strict TypeScript and Vite production build: passed;
- real desktop/mobile Chromium E2E: 10 passed, 2 environment-dependent PostgreSQL cases skipped;
- covered keyboard focus, upload/query/result/chart/table/session restore, cancellation, refresh recovery, invalid upload and mobile layout;
- no `file:`, `workspace:` or source alias was used.

This is Beta evidence, not final RC acceptance. The exact registry RC must repeat the same path and either provide the PostgreSQL fixture or record its explicit exclusion.

## Non-ChatBI AI SDK public registry host

The repository provides `pnpm verify:host:ai-sdk`. It creates a clean directory outside the workspace graph, installs exact registry versions, adapts a complete AI SDK UI Message Stream, dispatches it into runtime and runs strict TypeScript plus Vite production build with the default React UI.

Beta evidence records the exact versions printed by the command. RC acceptance must rerun the command after all three package manifests point at the published `1.0.0-rc.*` line.

## Remaining independent acceptance

- a developer outside the core implementation group must time and record Quick Start, custom adapter and custom renderer completion;
- ChatBI and the AI SDK host must rerun against exact registry RC packages;
- diagnostics, failure recovery and any required migration feedback must be entered in the compatibility ledger;
- external NVDA/Edge results will be appended before `1.0.0 latest`.

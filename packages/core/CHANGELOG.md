# @agentic-chat/core

## 0.1.0-beta.2

### Minor Changes

- 6121677: Add immutable Run retry attempts, derived Activity hierarchy indexes and selectors, retry conformance fixtures, attempt history, and accessible collapsible subagent UI.
- bb18219: Add durable Human-in-the-loop requests, explicit expiry, idempotent runtime responses, structured default controls, recovery history, and HITL conformance checks.
- db51706: Add the explicit canonical snapshot 0.2 wire schema, legacy snapshot migration, revisioned Task replacement and patches, and runtime initialization from canonical snapshots.
- c27369a: Add canonical Artifact lifecycle, immutable version and provenance metadata, snapshot migration, selectors and hooks, conformance checks, provenance navigation, and an explicit deny-by-default lazy preview registry. Correct ChatBI's Artifact capability until its backend payload contract is implemented.

### Patch Changes

- bb28f40: Diagnose and ignore future canonical event types instead of incorrectly cancelling an active Run.
- a90182a: Harden terminal child lifecycles, Task validation, intervention idempotency, retry topology, expanded-state accessibility, public API/CSS baselines, and exact prerelease package compatibility.
- 81ae67d: Ship package READMEs and LICENSE files, and verify every tarball through isolated ESM, SSR, TypeScript, and production Vite consumers.

## 0.1.0-alpha.1

### Patch Changes

- 61ea79d: Add bounded long-run replay metadata, explicit stream compaction, stable SSR snapshots, reusable workspace UI primitives, safe Markdown rendering, and accessible tool and composer interactions.

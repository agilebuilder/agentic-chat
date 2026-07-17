# Canonical Schema 1.0

Canonical Schema 1.0 defines the stable Agentic Chat contract shared by adapters, runtime, snapshots and UI. The specification version is independent from package and wire versions. Its current supported wire formats are Event `0.1` and Snapshot `0.2`.

## Event envelope

Every canonical event contains:

| Field | Rule |
|---|---|
| `schemaVersion` | Exactly `0.1` |
| `eventId` | Stable, non-empty, unique source identity |
| `type` | A documented canonical event type |
| `threadId` | Conversation scope |
| `runId` | Ordering and replay scope |
| `sequence` | Positive contiguous per-Run position beginning at 1 |
| `timestamp` | ISO-8601 source timestamp |
| `data` | Event-specific payload; never a raw protocol envelope |
| `source` | Recommended adapter/source identifier |

`strict-per-run` means the source supplies the canonical sequence. `synthesized-stream-order` means the adapter supplies it deterministically. Unordered canonical streams are not supported.

Duplicate `eventId` and events at or below a compaction watermark are idempotently ignored. A gap blocks that Run until the missing event or an authoritative snapshot is supplied. Ordering is independent between Runs.

## Lifecycle groups

- Run: `run.started`, `run.status.changed`, `run.completed`, `run.failed`, `run.cancelled`.
- Activity and tool: `status.delta`, `activity.started`, `activity.completed`, `tool.started`, `tool.args.delta`, `tool.completed`, `tool.failed`.
- Result and conversation: `result.delta`, `result.available`. They maintain `results[runId]` and the assistant Message `result:<runId>` in its Thread.
- HITL: `intervention.requested`, `intervention.resolved`, `intervention.expired`.
- Artifact: `artifact.created`, `artifact.available`, `artifact.failed`, `artifact.expired`.
- Tasks: `tasks.snapshot`, `task.patched`, guarded by monotonic task revisions.
- Source compatibility: `source.observed`, which is intentionally payload-free.

The TypeScript declarations in `@agentic-chat/core` are normative for each event payload. Reducer transition rules are normative for lifecycle behavior; adapters must pass the corresponding `@agentic-chat/testkit` conformance checks.

## Unknown and invalid input

- Unsupported `schemaVersion`: reject, emit `unsupported_schema`, do not consume sequence.
- Unknown event type in Event `0.1`: consume its valid sequence and emit `unknown_event`, without terminating the Run.
- Known source event with no canonical model: adapter emits `source.observed` and a payload-free adapter diagnostic.
- Raw source payloads and secrets must not be copied to canonical extensions or runtime inspection.

## Snapshot wire schema

New snapshots use `schemaVersion: '0.2'` and persist explicit entity arrays, task revisions and per-Run stream checkpoints. They do not serialize internal indexes, seen-event caches, diagnostics or connection state. Import rebuilds all derived indexes and validates references, cycles, versions and terminal-state invariants.

Snapshot `0.1` is import-only. Importing `0.1` and writing again produces `0.2`. Unknown snapshot versions fail closed. A restored checkpoint compacts all events through `lastSequence`; replay resumes at the next sequence.

## Extension boundary

Core has no arbitrary extension bag. Business-renderable values use a stable, namespaced `RenderableContent.kind`, for example `chatbi.query-result`. Protocol-specific raw data, transport metadata and diagnostics remain outside canonical state. A new core field requires evidence from at least two real event sources.

## SemVer effect

After package 1.0, removing or narrowing event variants, required fields, status unions, capabilities, snapshots or stable root exports requires a new major version. Additive union members may also break exhaustive consumers and are therefore reviewed as breaking unless the API explicitly provides an unknown fallback.

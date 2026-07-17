# Migrating from 0.1 Alpha/Beta to 1.0

## Package installation

During Beta, pin `@beta` or exact versions. During RC, pin the exact `1.0.0-rc.*` versions. Do not rely on `latest` until the 1.0 release is explicitly announced.

## Sequence capability breaking change

`sequence: 'unordered'` has been removed. Choose one of:

```ts
sequence: 'strict-per-run'            // source supplies contiguous per-Run sequence
sequence: 'synthesized-stream-order'  // adapter deterministically supplies it
```

If the source cannot establish authoritative order, keep that information in adapter diagnostics or a host side channel. Do not dispatch it as a canonical event.

## Event and snapshot versions

Do not change valid event literals from `schemaVersion: '0.1'` merely because package versions become 1.0. New snapshots remain `0.2`. Legacy snapshot `0.1` can still be imported but is never emitted.

Unsupported event schema versions are now rejected without consuming sequence. If an adapter previously cast arbitrary source objects to `CanonicalEvent`, validate and map them first.

## Threads, messages and results

Result replay now creates the Thread/Run association and one assistant message named `result:<runId>`. Existing consumers of `state.results[runId]` continue to work. Snapshot comparisons that asserted empty `threads` or `messages` after a result must update to include the canonical associations.

## Experimental APIs

Runtime inspection exports and the default Inspector are experimental. Do not build a stable persistence format around their shape. Payloads remain intentionally absent and retention is bounded.

# ADR-0012: Canonical Schema 1.0 stability boundary

## Status

Accepted for the P4.1 release-candidate baseline.

## Decision

Canonical Schema 1.0 is the version of the public specification, not a forced renaming of every wire format. Package SemVer, canonical event wire version and snapshot wire version are independent axes:

- packages move from `0.1.0-beta.*` to `1.0.0-rc.*` and then `1.0.0`;
- canonical events continue to use `schemaVersion: '0.1'`;
- newly written snapshots continue to use `schemaVersion: '0.2'`;
- legacy snapshot `0.1` remains import-only and is never emitted.

Changing a wire literal without changing its shape would create migration work without improving compatibility. A future incompatible event or snapshot shape must introduce a new wire version and an explicit migration path.

The reducer rejects unsupported event schema versions before consuming sequence or changing domain state. Unknown event types in the supported event schema consume their sequence and produce an `unknown_event` diagnostic. Adapters use payload-free `source.observed` events when a known source event must preserve sequence but has no canonical representation.

Canonical streams are always contiguous per Run. A source may provide a native strict sequence or an adapter may synthesize stream order. There is no unordered canonical mode; sources that cannot establish authoritative order stay in adapter diagnostics or an application side channel.

`Thread` and `Message` are stable canonical entities. `run.started` establishes the Thread/Run association. Result events maintain one deterministic assistant Message (`result:<runId>`) whose content mirrors `state.results[runId]`. This rule is supported by both ChatBI result events and AI SDK text streams. User and historical messages may be supplied by a trusted snapshot or host integration; the run event slice does not invent unavailable source data.

Arbitrary source extensions are not persisted in core. Renderable business data uses a namespaced `RenderableContent.kind`; raw protocol data remains adapter- or host-owned. This keeps snapshots bounded and prevents accidental secret retention.

## Compatibility consequences

- Removing `sequence: 'unordered'` is an intentional Beta breaking change.
- Unsupported event schemas now produce `unsupported_schema` without advancing the cursor.
- Replaying result events now populates `threads` and `messages`; the existing `results` projection remains available.
- Adding a canonical event union member, required capability, required public field, or narrowing an existing union is treated as breaking after 1.0.

## Evidence required before RC

- ChatBI and AI SDK adapter conformance fixtures;
- event replay and snapshot-plus-delta equality;
- legacy snapshot import with new snapshot writes remaining `0.2`;
- API report, changeset and migration checks;
- Node, React, TypeScript, SSR/hydration and browser support matrices.

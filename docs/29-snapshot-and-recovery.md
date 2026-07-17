# Snapshot, replay and recovery

Use `createSnapshot(state, revision)` only from an unblocked state. Persist the returned Snapshot `0.2` object, not `AgenticState`, runtime diagnostics or framework store internals.

On restore:

1. fetch the authoritative snapshot;
2. call `importSnapshot` or construct runtime with `initialSnapshot`;
3. reconnect each Run after its stored `lastSequence`;
4. replay the suffix with stable event IDs;
5. replace the local snapshot if a gap cannot be repaired incrementally.

Snapshot import validates entity IDs, references, parent/retry/version cycles, revisions, terminal child state, intervention fields and Artifact provenance. Invalid snapshots fail closed. Legacy Snapshot `0.1` imports are supported only for migration; all new writes remain `0.2`.

`serverSnapshot` is a React external-store hydration view, not the persistence wire format. Reuse the same request-local runtime snapshot for SSR and first hydration; never share mutable runtime or renderer registry instances between requests.

# HITL and Artifact integration

## Human-in-the-loop

An adapter declares `intervention: true` only when it also supplies the `respond` command. `intervention.requested` is durable canonical state; snapshot and replay must preserve its pending/resolved/expired status.

Use stable idempotency keys for responses. The runtime coalesces the same logical response and key, rejects conflicting reuse, and allows a failed transport attempt to retry with the same submission identity. The UI must disable duplicate approval while a command is pending and keep a failed response retryable.

Choice interventions need at least two unique options. Form fields need unique names; select fields need non-empty options. A terminal Run expires pending interventions.

## Artifacts

Artifact lifecycle is `created → available|failed`, with optional later `expired`. Each Artifact has a positive version and explicit provenance. Versions form one linear predecessor chain; a generating predecessor cannot be versioned and one predecessor cannot have multiple successors.

Artifact previews are host-authorized. `SandboxedArtifactFrame` requires an `allowUri` callback and uses a sandboxed iframe. Do not render arbitrary HTML, URLs or source payloads without an allowlist and content-security policy.

Before declaring `artifacts: true`, pass `checkArtifactConformance` with source-backed fixtures. A terminal Run cannot complete while an Artifact is still generating.

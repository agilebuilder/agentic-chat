# Security, performance and troubleshooting

## Security defaults

- Runtime inspection is opt-in, bounded and payload-free.
- Markdown supports a safe subset; unsafe URLs and raw HTML are not rendered.
- Artifact iframe previews require host authorization and sandboxing.
- Keep credentials, protocol envelopes and personal data outside canonical state and diagnostics.
- Validate source events in the adapter before dispatch and use `source.observed` only as a payload-free sequence placeholder.

## Performance budgets

The repository gates 1,000 Activity ingestion/selectors/Inspector behavior and package compressed sizes. Core and default UI are close to their budgets, so optional diagnostics, protocol adapters and documentation remain separate packages or apps. Hosts should virtualize very long transcript views and compact replay metadata after authoritative persistence.

## Troubleshooting

- `sequence_gap`: reconnect after the last accepted sequence or restore an authoritative snapshot.
- `unsupported_schema`: update/replace the adapter; the event was not consumed.
- `unknown_event`: update the adapter if the event should affect UI; the sequence was preserved.
- `invalid_transition`: inspect lifecycle ordering and open child Activity/tool/HITL/Artifact state.
- hydration warning: ensure server and first client render receive the same `serverSnapshot`, and avoid cross-request singletons.
- missing renderer: register a namespaced kind or rely on the safe fallback; do not parse source payload in UI components.
- package resolution mismatch: pin all `@agentic-chat/*` packages to one reviewed release family and remove workspace/file aliases from real-host acceptance.

# P4 stable-candidate engineering acceptance

Date: 2026-07-17. Branch: `codex/p4-stability`. This report covers the repository-local P4.1-P4.5 candidate. It does not claim RC or 1.0 publication.

## Completed scope

- P4.1: canonical schema 1.0 specification, stable/experimental API lifecycle, migration guidance, reducer consistency and merge-base API governance;
- P4.2: versioned static documentation build, executable adapter/renderer/AI SDK examples and documentation CI;
- P4.3: contribution, security, support and maintainer governance plus package release metadata;
- P4.4: React 18/19, TypeScript 5.4/current, Node 20/22, Chromium/Firefox/WebKit and SSR hydration gates;
- P4.5 rehearsal: exact public Beta packages in ChatBI and a clean non-ChatBI AI SDK host without local aliases.

## Verification evidence

| Gate | Result |
|---|---|
| `pnpm verify` | passed; 19 test files and 135/135 tests |
| `pnpm quality:browser` | passed; 66/66 across Chromium, Firefox and WebKit |
| React 18.2 + TypeScript 5.4 seven-tarball consumer | passed |
| clean registry AI SDK host | passed against published Beta |
| ChatBI frontend unit/typecheck/build | passed; 14/14 tests |
| ChatBI desktop/mobile E2E | 10 passed, 2 environment-dependent PostgreSQL cases skipped |

Package size gates pass, but `@agentic-chat/core` is at 99% of its budget. Until 1.0, additions to core require offsetting size reductions or a separately reviewed budget decision.

## Remaining release gates

- merge this candidate only after GitHub CI is green;
- complete the independent documentation usability exercise;
- configure and test protected Trusted Publishing for RC/stable;
- publish an exact `1.0.0-rc.*` only after explicit maintainer approval;
- repeat both real-host paths against registry RC packages;
- observe the documented 7-14 natural-day RC stability period with no unresolved blocker/high;
- append the delegated NVDA/Edge conclusion before moving `latest` to 1.0.

No Git tag, GitHub Release, RC, `latest` movement or 1.0 publication is authorized or performed by this report.

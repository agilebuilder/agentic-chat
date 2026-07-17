# P4 development log

## P4.0 Beta transition

Completed. Seven public packages are available from npm Beta with integrity and provenance; `adapter-ag-ui` remains private. See [Beta release readiness](22-p4-beta-release-readiness.md).

## P4.1 contract freeze

- Added Canonical Schema 1.0, API lifecycle/support policy and Beta-to-1.0 migration guide.
- Kept Event `0.1` and Snapshot `0.2` as independent wire versions under the 1.0 specification.
- Rejected unsupported event schemas without consuming sequence.
- Removed the non-functional unordered canonical sequence mode.
- Made result replay maintain Thread/Run and assistant Message associations for ChatBI results and AI SDK text streams.
- Required API Extractor release tags for every root export.
- Added merge-base API/CSS governance requiring Changesets and, for breaking diffs, ADR plus migration material.

## P4.2 documentation and developer experience

- Corrected public Alpha references to the published Beta line.
- Added a private, versioned static documentation app with guides, reviewed API reports and live minimal demo.
- Added documentation link/status checking to `pnpm verify` and a GitHub Pages build/deploy workflow.

## P4.3 governance and trusted release

- Added contribution, conduct, security, support and maintainer policies; CODEOWNERS; PR and structured issue forms; Dependabot configuration.
- Added homepage, bugs, keywords and Node engine metadata to every public package and enforced them in the release gate.
- Removed the completed one-time adapter bootstrap token workflow and script.
- Beta Trusted Publishing remains main-only, protected and provenance-enabled.
- Added a main-only, protected OIDC/provenance workflow for package-specific RC versions and unified `1.0.0`, plus production-license auditing, immutable Action pins, stability ledger and release/rollback runbook. The `npm-release` environment and seven matching npm Trusted Publishers must be configured before P4.6.

## P4.4 compatibility evidence

- Current Node 20/22 and React 19 verification retained.
- Added isolated seven-tarball consumer for React 18.2, TypeScript 5.4 and Vite 5.
- Expanded Playwright quality from Chromium-only to Chromium, Firefox and WebKit: 66/66 locally green, including SSR hydration. Visual pixel baselines remain Chromium-only; WebKit automation is not a claim of physical Safari acceptance.
- Added reconnect/cancel gap repair, cancel/complete race and compacted replay coverage. The canonical reducer suite now has 135 passing tests overall.
- External NVDA/Edge remains delegated and will be appended before `latest`.

## P4.5 Beta host rehearsal

- Installed exact public Beta packages into a detached ChatBI worktree: install/audit, 14 unit tests, production build and 10 desktop/mobile E2E cases passed; two PostgreSQL-dependent cases were explicitly skipped.
- Added a clean non-ChatBI AI SDK registry host and passed strict TypeScript plus Vite production build using exact public Beta package versions.
- Neither host used a workspace or local source alias. Both paths must be repeated against the exact published RC before P4.5 is complete.

## Remaining gates

- Complete ChatBI and non-ChatBI RC host acceptance without workspace aliases.
- Obtain an independent developer timing record for Quick Start, custom adapter and custom renderer.
- Generalize the protected Trusted Publishing workflow for RC/stable and configure the required environment/publisher permissions.
- Run the real 7–14 day RC observation period with no unresolved blocker/high.
- Obtain explicit approval before RC/1.0 publish, dist-tag movement, tags or GitHub Releases.

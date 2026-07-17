# Public API lifecycle and support policy

## Stability classes

- Stable: public root exports without an `Experimental`/`experimental` name. They follow SemVer from 1.0.
- Experimental: exports and options explicitly named `Experimental` or `experimental`. They may change between minor releases, with a changeset and compatibility-ledger entry.
- Deprecated: retained with `@deprecated`, a named replacement and at least one minor release of overlap. Stable removals occur only in a major release.
- Internal: implementation details that are not exported from a documented package entry point.

`LegacyCanonicalSnapshot` and `checkRunConformance` are deprecated migration helpers. `ExperimentalInspection*`, `experimentalInspection` and the default UI Inspector remain experimental. `AgenticState`, stream cursors and selectors remain stable because headless consumers and snapshot initialization already depend on them.

## Change rules

- Removing an export, narrowing a union, changing a signature, adding a required field or changing runtime meaning is breaking.
- Adding an export or optional field requires a changeset and compatibility review.
- A deliberate Beta breaking change requires an ADR, a `BREAKING CHANGE:` changeset section and migration instructions.
- CSS theme tokens and `.ac-*` hooks follow the same policy as TypeScript exports.
- `api:update` is an approval action, not a way to bypass review.

## Supported baseline for 1.0 candidates

| Dimension | Supported/verified target |
|---|---|
| Node.js | 20 and 22 |
| Module format | ESM; Node and bundler root imports |
| React | 18.2 and 19 |
| TypeScript | 5.4 minimum and 5.9 current |
| SSR | `renderToString`, request isolation and matching `serverSnapshot` hydration |
| Browsers | Current Chromium/Edge, Firefox and WebKit automation; WebKit is not a substitute for physical Safari acceptance |

Exact validation evidence is recorded in the P4 acceptance reports. A target is not advertised as supported until its CI or independent acceptance path is green.

# Contributing to Agentic Chat

Thank you for helping improve Agentic Chat. Please use a focused branch and pull request; direct changes to `main` are reserved for repository recovery.

## Development

Requirements: Node.js 20 or 22 and pnpm 10.13.1.

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm quality:browser
```

Keep `@agentic-chat/adapter-ag-ui` private. Do not add host-specific fields to core. A new canonical field needs evidence from at least two real sources.

## Changesets and compatibility

Every user-visible package change needs a Changeset. Public API or CSS contract changes also require reviewed API reports. Breaking Beta changes require:

- a `BREAKING CHANGE:` section in the Changeset;
- an ADR explaining the decision;
- migration instructions and compatibility-ledger entry.

Stable, experimental and deprecated behavior follows [the API lifecycle policy](docs/25-api-lifecycle-and-support.md). Never run `pnpm api:update` merely to make CI green.

## Pull requests

- Explain the problem and compatibility impact.
- Add or update tests and documentation.
- Keep generated files and package metadata in sync.
- Confirm `pnpm verify` and relevant browser/host checks.
- Do not publish npm packages, move dist-tags, create tags or releases from a contribution branch.

Security reports must follow [SECURITY.md](SECURITY.md), not a public issue.

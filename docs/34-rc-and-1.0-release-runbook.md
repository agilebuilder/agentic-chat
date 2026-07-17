# RC and 1.0 release runbook

This runbook is executable only from a reviewed commit on `main`. Every npm publish, dist-tag change, Git tag and GitHub Release requires explicit maintainer approval through the protected `npm-release` environment. Local rehearsal does not grant publication approval.

## One-time repository and npm setup

1. Create the GitHub Environment `npm-release`, restrict deployment to `main`, require the designated maintainer reviewers and prevent self-review where the team policy requires it.
2. Immediately before the first approved RC, edit each public package's existing Trusted Publisher from workflow `publish-beta.yml` / environment `npm-beta` to workflow `publish-release.yml` / environment `npm-release`. npm permits only one Trusted Publisher per package, so this intentionally retires the automated Beta channel.
3. Keep `@agentic-chat/adapter-ag-ui` private and without a Trusted Publisher.
4. Enable GitHub Pages with GitHub Actions as its source. Protect `main` with the Node 20/22, compatibility, browser, OSV and documentation checks required before merge.

No npm token is stored by the workflow. It uses GitHub OIDC and npm provenance.

For all seven npm package settings, the final values are: provider GitHub Actions; organization `agilebuilder`; repository `agentic-chat`; workflow filename `publish-release.yml` (filename only); environment `npm-release`; allowed action `npm publish`. Do not change `@agentic-chat/adapter-ag-ui`.

## Beta to first RC version preparation

Perform this on a dedicated versioning branch only after explicit approval:

```bash
pnpm changeset:pre-exit
pnpm exec changeset pre enter rc
pnpm version:packages
pnpm install --lockfile-only
pnpm release:check
pnpm verify
pnpm quality:browser
```

The isolated 2026-07-17 rehearsal produced these exact first-RC versions:

| Package group | Expected version |
|---|---|
| core, runtime, react, react-ui | `1.0.0-rc.3` |
| testkit, adapter-chatbi, adapter-ai-sdk | `1.0.0-rc.2` |
| private adapter-ag-ui | unchanged at `0.1.0-alpha.0` |

Changesets preserves each package's previous prerelease counter, so differing RC suffixes are intentional. Review generated changelogs and exact internal dependency versions before merging.

## Publish RC

After the version PR is merged and all main checks pass, dispatch `Publish npm RC or stable` with:

- channel: `rc`;
- confirmation: `publish-rc-reviewed`.

The protected job rebuilds, publishes all unpublished reviewed tarballs to `rc`, verifies registry manifests and provenance, and asserts that every existing `latest` tag is unchanged. RC publication does not create a Git tag or GitHub Release.

Immediately populate `release/stability.json` with the package versions, publication time, an observation end at least 7 natural days later, registry ChatBI/AI SDK evidence links and issue severity ledger. A breaking change restarts the observation window. A blocker or high requires a new RC after the fix.

## Promote source to stable 1.0

After 7-14 natural days, both exact-registry RC hosts, the independent documentation exercise and the delegated accessibility conclusion must be recorded. With explicit approval, prepare stable versions on a dedicated branch:

```bash
pnpm changeset:pre-exit
pnpm version:packages
pnpm install --lockfile-only
pnpm release:check
pnpm verify
pnpm quality:browser
```

All seven public packages must converge on `1.0.0`; `.changeset/pre.json` must be removed. Set the stability ledger to `approved` with no blocker/high and a named maintainer approval. After merging and rechecking main, dispatch the workflow with:

- channel: `latest`;
- confirmation: `publish-latest-1.0.0`.

The job publishes `1.0.0` to `latest`, verifies all seven registry manifests, then creates immutable tag `v1.0.0` and the GitHub Release. Perform a clean registry install/typecheck/production build and verify the documentation site immediately afterward.

## Failure and rollback

- Before any package is published: fix the reviewed branch and rerun; do not move tags.
- Partial publication: rerun the same workflow and commit. It skips matching versions and finishes the set; never reuse a version with different contents.
- Bad RC: publish a corrected RC. Do not unpublish unless security/legal necessity is approved.
- Bad stable with no security emergency: publish a patch and move `latest` through the protected workflow; do not overwrite `1.0.0`.
- Accidental `latest` movement during RC: stop, record the incident, and restore each previous exact version only with explicit maintainer approval.
- Compromised release: follow `SECURITY.md`, revoke the affected npm/GitHub authority, rotate credentials, preserve provenance evidence, and publish an advisory/fixed version.

Post-release monitoring lasts at least 72 hours. Record install failures, compatibility regressions, security reports and dist-tag state in the release acceptance report.

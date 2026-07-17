import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import {
  assertRegistryManifest,
  getRegistryManifest,
  publicPackageDirectories,
  readJson,
  root,
} from './check-beta-release.mjs'

export async function readStableReleaseState(channel = process.env.AGENTIC_CHAT_RELEASE_CHANNEL) {
  assert.ok(channel === 'rc' || channel === 'latest', 'release channel must be rc or latest')
  const packages = []
  for (const directory of publicPackageDirectories) {
    const manifest = await readJson(resolve(root, 'packages', directory, 'package.json'))
    assert.equal(manifest.private, undefined, `${manifest.name} must be public`)
    assert.equal(manifest.publishConfig?.access, 'public', `${manifest.name} must publish with public access`)
    const pattern = channel === 'rc' ? /^1\.0\.0-rc\.\d+$/u : /^1\.0\.0$/u
    assert.match(manifest.version, pattern, `${manifest.name} has an invalid ${channel} version`)
    packages.push({ directory, manifest })
  }

  if (channel === 'latest') {
    const versions = new Set(packages.map(({ manifest }) => manifest.version))
    assert.deepEqual([...versions], ['1.0.0'], 'all seven stable packages must converge on 1.0.0')
  }

  const agUi = await readJson(resolve(root, 'packages/adapter-ag-ui/package.json'))
  assert.equal(agUi.private, true, '@agentic-chat/adapter-ag-ui must remain private')

  const preState = await readJson(resolve(root, '.changeset/pre.json')).catch(() => undefined)
  if (channel === 'rc') {
    assert.equal(preState?.mode, 'pre', 'RC must remain in Changesets prerelease mode')
    assert.equal(preState?.tag, 'rc', 'RC Changesets tag must be rc')
  } else {
    assert.equal(preState, undefined, 'stable 1.0 must have exited Changesets prerelease mode')
    const stability = await readJson(resolve(root, 'release/stability.json'))
    assert.match(stability.candidate ?? '', /^1\.0\.0-rc\.\d+$/u, 'stability ledger must identify the observed RC')
    assert.equal(stability.status, 'approved', 'stability ledger must be approved before latest')
    assert.deepEqual(stability.openBlockers, [], 'latest cannot have open blockers')
    assert.deepEqual(stability.openHighs, [], 'latest cannot have open highs')
    assert.ok(Date.parse(stability.observationEndsAt) <= Date.now(), 'RC observation period has not ended')
    assert.ok(stability.hostEvidence.chatbi && stability.hostEvidence.aiSdk, 'both registry RC hosts need evidence')
    assert.ok(stability.accessibilityEvidence, 'accessibility conclusion is required before latest')
    assert.ok(stability.approvedBy, 'a maintainer must approve the stability ledger')
  }

  return { channel, packages, version: channel === 'latest' ? '1.0.0' : 'package-specific' }
}

async function main() {
  const state = await readStableReleaseState()
  for (const { manifest } of state.packages) {
    const published = await getRegistryManifest(manifest.name, manifest.version)
    if (published) assertRegistryManifest(manifest, published, state.packages)
    console.log(`${manifest.name}@${manifest.version}: ${published ? 'published and matching' : 'unpublished'}`)
  }
  console.log(`Validated reviewed ${state.channel} state for all seven public packages.`)
}

if (resolve(process.argv[1] ?? '') === resolve(root, 'scripts/check-stable-release.mjs')) await main()

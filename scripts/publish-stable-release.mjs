import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assertRegistryManifest, getRegistryManifest, root } from './check-beta-release.mjs'
import { readStableReleaseState } from './check-stable-release.mjs'

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'publishing is restricted to GitHub Actions')
assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'publishing is restricted to main')
assert.equal(process.env.AGENTIC_CHAT_RELEASE_APPROVED, 'true', 'protected environment approval is required')

const state = await readStableReleaseState()
const expectedConfirmation = state.channel === 'rc' ? 'publish-rc-reviewed' : 'publish-latest-1.0.0'
assert.equal(process.env.AGENTIC_CHAT_RELEASE_CONFIRMATION, expectedConfirmation)

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' })
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`)
}

async function getTags(name) {
  const response = await fetch(`https://registry.npmjs.org/-/package/${name.replace('/', '%2f')}/dist-tags`, { cache: 'no-store' })
  assert.equal(response.status, 200, `cannot read dist-tags for ${name}`)
  return response.json()
}

const npmVersion = spawnSync('npm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout.trim()
assert.ok(Number(npmVersion.split('.')[0]) >= 11, `npm 11 is required; found ${npmVersion}`)

const initialLatest = new Map()
for (const { manifest } of state.packages) initialLatest.set(manifest.name, (await getTags(manifest.name)).latest)

const packs = resolve(root, '.tmp/stable-release-packs')
await rm(packs, { recursive: true, force: true })
await mkdir(packs, { recursive: true })
for (const { directory, manifest } of state.packages) {
  const existing = await getRegistryManifest(manifest.name, manifest.version)
  if (existing) {
    assertRegistryManifest(manifest, existing, state.packages)
    continue
  }
  run('pnpm', ['--dir', `packages/${directory}`, 'pack', '--pack-destination', packs, '--silent'])
  const archive = (await readdir(packs)).find((file) => file.endsWith(`-${manifest.version}.tgz`))
  assert.ok(archive, `packed archive missing for ${manifest.name}`)
  run('npm', ['publish', resolve(packs, archive), '--access', 'public', '--tag', state.channel, '--provenance'])
}

for (const { manifest } of state.packages) {
  const published = await getRegistryManifest(manifest.name, manifest.version)
  assert.ok(published, `${manifest.name}@${manifest.version} was not published`)
  assertRegistryManifest(manifest, published, state.packages)
  const tags = await getTags(manifest.name)
  assert.equal(tags[state.channel], manifest.version)
  if (state.channel === 'rc') assert.equal(tags.latest, initialLatest.get(manifest.name), `${manifest.name} latest moved during RC`)
  else assert.equal(tags.latest, manifest.version, `${manifest.name} latest does not point at 1.0`)
}

console.log(`Published and verified all reviewed packages on the ${state.channel} dist-tag.`)

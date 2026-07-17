import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  assertRegistryManifest,
  getRegistryManifest,
  readReleaseState,
  root,
} from './check-beta-release.mjs'

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Beta publishing is restricted to GitHub Actions')
assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Beta publishing is restricted to the main branch')
assert.equal(process.env.AGENTIC_CHAT_RELEASE_APPROVED, 'true', 'The protected release job must explicitly enable publishing')

const { packages } = await readReleaseState()
const adapter = packages.find(({ manifest }) => manifest.name === '@agentic-chat/adapter-ai-sdk')
assert.ok(adapter)
const bootstrappedAdapter = await getRegistryManifest(adapter.manifest.name, adapter.manifest.version)
assert.ok(bootstrappedAdapter, `${adapter.manifest.name}@${adapter.manifest.version} must be bootstrapped before the trusted release`)
assertRegistryManifest(adapter.manifest, bootstrappedAdapter, packages)

async function getDistTags(name) {
  const encodedName = name.replace('/', '%2f')
  const response = await fetch(`https://registry.npmjs.org/-/package/${encodedName}/dist-tags`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  })
  assert.equal(response.status, 200, `cannot read dist-tags for ${name}: HTTP ${response.status}`)
  return response.json()
}

function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
  process.stdout.write(result.stdout ?? '')
}

const npmVersion = spawnSync('npm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout.trim()
const [npmMajor, npmMinor] = npmVersion.split('.').map(Number)
assert.ok(npmMajor > 11 || (npmMajor === 11 && npmMinor >= 5), `npm >=11.5.1 is required for trusted publishing; found ${npmVersion}`)

const initialLatest = new Map()
for (const { manifest } of packages) {
  const tags = await getDistTags(manifest.name)
  initialLatest.set(manifest.name, tags.latest)
}

const packsDirectory = resolve(root, '.tmp/beta-release-packs')
await rm(packsDirectory, { recursive: true, force: true })
await mkdir(packsDirectory, { recursive: true })

for (const { directory, manifest } of packages) {
  const published = await getRegistryManifest(manifest.name, manifest.version)
  if (published) {
    assertRegistryManifest(manifest, published, packages)
    console.log(`Skipping existing reviewed version ${manifest.name}@${manifest.version}.`)
    continue
  }

  run('pnpm', ['--dir', `packages/${directory}`, 'pack', '--pack-destination', packsDirectory, '--silent'])
  const expectedPrefix = `agentic-chat-${directory}-${manifest.version}`
  const archive = (await readdir(packsDirectory)).find((file) => file.startsWith(expectedPrefix) && file.endsWith('.tgz'))
  assert.ok(archive, `cannot find packed archive for ${manifest.name}@${manifest.version}`)
  run('npm', ['publish', resolve(packsDirectory, archive), '--access', 'public', '--tag', 'beta'])
}

for (const { manifest } of packages) {
  let published
  for (let attempt = 1; attempt <= 5 && !published; attempt += 1) {
    published = await getRegistryManifest(manifest.name, manifest.version)
    if (!published && attempt < 5) await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000))
  }
  assert.ok(published, `${manifest.name}@${manifest.version} was not published`)
  assertRegistryManifest(manifest, published, packages)
  const tags = await getDistTags(manifest.name)
  assert.equal(tags.beta, manifest.version, `${manifest.name} beta tag must point at the released version`)
  assert.equal(tags.latest, initialLatest.get(manifest.name), `${manifest.name} latest tag changed unexpectedly`)
}

console.log('All seven beta versions and dist-tags match the approved release state; latest was not moved.')

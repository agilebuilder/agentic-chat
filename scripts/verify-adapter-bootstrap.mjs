import assert from 'node:assert/strict'
import {
  assertRegistryManifest,
  getRegistryManifest,
  readReleaseState,
} from './check-beta-release.mjs'

const { packages } = await readReleaseState()
const adapter = packages.find(({ manifest }) => manifest.name === '@agentic-chat/adapter-ai-sdk')
assert.ok(adapter)

let published
for (let attempt = 1; attempt <= 5 && !published; attempt += 1) {
  published = await getRegistryManifest(adapter.manifest.name, adapter.manifest.version)
  if (!published && attempt < 5) await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000))
}
assert.ok(published, `${adapter.manifest.name}@${adapter.manifest.version} is not visible in the registry`)
assertRegistryManifest(adapter.manifest, published, packages)

const encodedName = adapter.manifest.name.replace('/', '%2f')
const response = await fetch(`https://registry.npmjs.org/-/package/${encodedName}/dist-tags`, {
  cache: 'no-store',
  headers: { 'cache-control': 'no-cache' },
})
assert.equal(response.status, 200)
const tags = await response.json()
assert.equal(tags.beta, adapter.manifest.version, 'adapter-ai-sdk beta tag must point at the bootstrapped version')
assert.ok(
  tags.latest === undefined || tags.latest === adapter.manifest.version,
  'adapter-ai-sdk bootstrap latest tag must be absent or point at the only published version',
)

const latestSummary = tags.latest === undefined
  ? 'did not create latest'
  : `created the registry-initialized latest=${tags.latest}`
console.log(`${adapter.manifest.name}@${adapter.manifest.version} is public on beta, matches the reviewed manifest, and ${latestSummary}.`)

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const publicPackageDirectories = [
  'core',
  'runtime',
  'react',
  'react-ui',
  'testkit',
  'adapter-chatbi',
  'adapter-ai-sdk',
]

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function readReleaseState() {
  const preState = await readJson(resolve(root, '.changeset/pre.json'))
  assert.equal(preState.mode, 'pre', 'Changesets must remain in prerelease mode')
  assert.equal(preState.tag, 'beta', 'Changesets prerelease tag must be beta')

  const packages = []
  for (const directory of publicPackageDirectories) {
    const manifest = await readJson(resolve(root, 'packages', directory, 'package.json'))
    assert.equal(manifest.private, undefined, `${manifest.name} must be public`)
    assert.equal(manifest.publishConfig?.access, 'public', `${manifest.name} must publish with public access`)
    assert.match(manifest.version, /^0\.1\.0-beta\.\d+$/u, `${manifest.name} must have an approved 0.1.0 beta version`)
    assert.deepEqual(manifest.files, ['dist'], `${manifest.name} must publish only dist`)
    assert.equal(manifest.license, 'MIT', `${manifest.name} must use the MIT license`)
    assert.ok(manifest.repository?.url?.includes('agilebuilder/agentic-chat'), `${manifest.name} must point at the canonical repository`)
    packages.push({ directory, manifest })
  }

  const agUi = await readJson(resolve(root, 'packages/adapter-ag-ui/package.json'))
  assert.equal(agUi.private, true, '@agentic-chat/adapter-ag-ui must remain private')
  assert.ok(!publicPackageDirectories.includes('adapter-ag-ui'), '@agentic-chat/adapter-ag-ui must not enter the public release set')

  return { packages, preState }
}

export function expectedPublishedDependencies(manifest, packages) {
  const versions = new Map(packages.map((entry) => [entry.manifest.name, entry.manifest.version]))
  return Object.fromEntries(Object.entries(manifest.dependencies ?? {}).map(([name, range]) => [
    name,
    name.startsWith('@agentic-chat/') ? versions.get(name) : range,
  ]))
}

export async function getRegistryManifest(name, version) {
  const encodedName = name.replace('/', '%2f')
  const response = await fetch(`https://registry.npmjs.org/${encodedName}/${version}`, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
    },
  })
  if (response.status === 404) return undefined
  assert.equal(response.status, 200, `registry lookup failed for ${name}@${version}: HTTP ${response.status}`)
  return response.json()
}

export function assertRegistryManifest(localManifest, registryManifest, packages) {
  assert.equal(registryManifest.name, localManifest.name)
  assert.equal(registryManifest.version, localManifest.version)
  assert.deepEqual(registryManifest.dependencies ?? {}, expectedPublishedDependencies(localManifest, packages))
  assert.equal(registryManifest.license, localManifest.license)
  assert.deepEqual(registryManifest.repository, localManifest.repository)
}

async function main() {
  const { packages } = await readReleaseState()
  console.log(`Validated local beta release state for ${packages.length} public packages.`)

  if (!process.argv.includes('--registry')) return
  for (const { manifest } of packages) {
    const published = await getRegistryManifest(manifest.name, manifest.version)
    if (published) {
      assertRegistryManifest(manifest, published, packages)
      console.log(`${manifest.name}@${manifest.version}: already published and matches the reviewed manifest`)
    } else {
      console.log(`${manifest.name}@${manifest.version}: unpublished`)
    }
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main()
}

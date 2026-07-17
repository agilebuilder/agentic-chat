import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFile(resolve(root, path), 'utf8')

const [manifestText, changesetsText, publishWorkflow] = await Promise.all([
  read('package.json'),
  read('.changeset/config.json'),
  read('.github/workflows/publish-beta.yml'),
])
const manifest = JSON.parse(manifestText)
const changesets = JSON.parse(changesetsText)

assert.equal(manifest.scripts['release:beta'], 'node scripts/publish-beta.mjs')
assert.ok(changesets.ignore.includes('@agentic-chat/adapter-ag-ui'))
assert.equal(changesets.privatePackages.version, false)
assert.equal(changesets.privatePackages.tag, false)

for (const workflow of [publishWorkflow]) {
  assert.match(workflow, /environment: npm-beta/u)
  assert.match(workflow, /id-token: write/u)
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u)
  assert.match(workflow, /npm@11\.18\.0/u)
  assert.match(workflow, /NPM_CONFIG_PROVENANCE/u)
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/u)
  assert.match(workflow, /pnpm\/action-setup@[0-9a-f]{40}/u)
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/u)
}

assert.doesNotMatch(publishWorkflow, /NODE_AUTH_TOKEN|NPM_BOOTSTRAP_TOKEN/u)
assert.match(publishWorkflow, /pnpm release:beta/u)

const publicPackages = ['core', 'runtime', 'react', 'react-ui', 'testkit', 'adapter-chatbi', 'adapter-ai-sdk']
for (const directory of publicPackages) {
  const packageManifest = JSON.parse(await read(`packages/${directory}/package.json`))
  assert.equal(packageManifest.private, undefined, `${packageManifest.name} must remain public`)
  assert.equal(packageManifest.publishConfig?.access, 'public', `${packageManifest.name} must publish publicly`)
  assert.equal(packageManifest.engines?.node, '>=20', `${packageManifest.name} must declare the Node support floor`)
  assert.equal(packageManifest.homepage, 'https://github.com/agilebuilder/agentic-chat#readme')
  assert.equal(packageManifest.bugs?.url, 'https://github.com/agilebuilder/agentic-chat/issues')
  assert.ok(Array.isArray(packageManifest.keywords) && packageManifest.keywords.length >= 4, `${packageManifest.name} needs searchable package keywords`)
}

const privateAgUi = JSON.parse(await read('packages/adapter-ag-ui/package.json'))
assert.equal(privateAgUi.private, true)

console.log('Release workflow and public package metadata use reviewed guards; experimental AG-UI remains private.')

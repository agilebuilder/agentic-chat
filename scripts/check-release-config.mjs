import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFile(resolve(root, path), 'utf8')

const [manifestText, changesetsText, publishWorkflow, bootstrapWorkflow] = await Promise.all([
  read('package.json'),
  read('.changeset/config.json'),
  read('.github/workflows/publish-beta.yml'),
  read('.github/workflows/bootstrap-adapter-ai-sdk.yml'),
])
const manifest = JSON.parse(manifestText)
const changesets = JSON.parse(changesetsText)

assert.equal(manifest.scripts['release:beta'], 'node scripts/publish-beta.mjs')
assert.ok(changesets.ignore.includes('@agentic-chat/adapter-ag-ui'))
assert.equal(changesets.privatePackages.version, false)
assert.equal(changesets.privatePackages.tag, false)

for (const workflow of [publishWorkflow, bootstrapWorkflow]) {
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
assert.match(bootstrapWorkflow, /NPM_BOOTSTRAP_TOKEN/u)
assert.match(bootstrapWorkflow, /publish-adapter-ai-sdk-beta/u)
assert.match(bootstrapWorkflow, /npm publish \.tmp\/bootstrap\/\*\.tgz --access public --tag beta/u)
assert.match(bootstrapWorkflow, /node scripts\/verify-adapter-bootstrap\.mjs/u)

console.log('Release workflows use reviewed action pins, main-only guards, protected OIDC, provenance, and explicit beta tags.')

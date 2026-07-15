import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = resolve(root, '.tmp/package-smoke')
const packsDirectory = resolve(temporaryRoot, 'packs')
const consumerDirectory = resolve(temporaryRoot, 'consumer')
const publicPackages = ['core', 'runtime', 'testkit', 'react', 'react-ui', 'adapter-chatbi', 'adapter-ai-sdk']

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
}

await rm(temporaryRoot, { recursive: true, force: true })
await mkdir(packsDirectory, { recursive: true })
await mkdir(consumerDirectory, { recursive: true })

for (const packageName of publicPackages) {
  run('pnpm', ['--dir', `packages/${packageName}`, 'pack', '--pack-destination', packsDirectory, '--silent'])
}

const archives = (await readdir(packsDirectory)).filter((file) => file.endsWith('.tgz'))
assert.equal(archives.length, publicPackages.length, 'every public package must produce one archive')

for (const archive of archives) {
  const manifestResult = spawnSync('tar', ['-xOf', resolve(packsDirectory, archive), 'package/package.json'], { encoding: 'utf8', shell: process.platform === 'win32' })
  assert.equal(manifestResult.status, 0, `cannot inspect packed manifest for ${archive}`)
  const manifest = JSON.parse(manifestResult.stdout)
  for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
    if (!dependency.startsWith('@agentic-chat/')) continue
    assert.match(range, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `${manifest.name} must pin internal dependency ${dependency} exactly`)
  }
}

const dependencies = {}
for (const archive of archives) {
  const match = /^agentic-chat-(.+)-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.tgz$/.exec(archive)
  assert.ok(match, `unexpected archive name: ${archive}`)
  dependencies[`@agentic-chat/${match[1]}`] = `file:${relative(consumerDirectory, resolve(packsDirectory, archive)).replaceAll('\\', '/')}`
}

const reactPackage = JSON.parse(await readFile(resolve(root, 'node_modules/react/package.json'), 'utf8'))
const reactDomPackage = JSON.parse(await readFile(resolve(root, 'node_modules/react-dom/package.json'), 'utf8'))
const typescriptPackage = JSON.parse(await readFile(resolve(root, 'node_modules/typescript/package.json'), 'utf8'))
const reactTypesPackage = JSON.parse(await readFile(resolve(root, 'node_modules/@types/react/package.json'), 'utf8'))
const reactDomTypesPackage = JSON.parse(await readFile(resolve(root, 'node_modules/@types/react-dom/package.json'), 'utf8'))
dependencies.react = reactPackage.version
dependencies['react-dom'] = reactDomPackage.version
dependencies.typescript = typescriptPackage.version
dependencies['@types/react'] = reactTypesPackage.version
dependencies['@types/react-dom'] = reactDomTypesPackage.version

const overrides = Object.fromEntries(Object.entries(dependencies).filter(([name]) => name.startsWith('@agentic-chat/')))
await writeFile(resolve(consumerDirectory, 'package.json'), `${JSON.stringify({ private: true, type: 'module', dependencies, pnpm: { overrides } }, null, 2)}\n`)
await writeFile(resolve(consumerDirectory, 'smoke.mjs'), `
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRuntime } from '@agentic-chat/runtime'
import { chatBiSuccessfulRun } from '@agentic-chat/testkit'
import { AgenticChatProvider } from '@agentic-chat/react'
import { RunStatus } from '@agentic-chat/react-ui'
import { adaptAiSdkUIMessageChunks } from '@agentic-chat/adapter-ai-sdk'
import { adaptChatBiEvent } from '@agentic-chat/adapter-chatbi'

const runtime = createRuntime()
for (const event of chatBiSuccessfulRun) runtime.dispatch(event)
const markup = renderToStaticMarkup(createElement(AgenticChatProvider, { runtime }, createElement(RunStatus, { runId: 'run-1' })))
assert.match(markup, /role="status"/)
assert.equal(runtime.getState().runs['run-1']?.status, 'completed')
const aiSdk = adaptAiSdkUIMessageChunks([{ type: 'start' }, { type: 'finish' }], { threadId: 'packed-thread', runId: 'packed-run' })
assert.deepEqual(aiSdk.events.map(event => event.type), ['run.started', 'run.completed'])
assert.equal(adaptChatBiEvent({ protocol_version: '1.0', event_id: 'e1', event_type: 'run.started', session_id: 't1', run_id: 'r1', sequence: 1, created_at: '2026-07-15T00:00:00Z', tool_call_id: null, payload: {} }).event?.type, 'run.started')
console.log('Packed package ESM, types, dependencies, and SSR import smoke test passed.')
`)
await writeFile(resolve(consumerDirectory, 'smoke.ts'), `
import type { CanonicalEvent } from '@agentic-chat/core'
import { createRuntime } from '@agentic-chat/runtime'
import { createRendererRegistry } from '@agentic-chat/react'
import { AgenticChat, type AgenticChatProps } from '@agentic-chat/react-ui'
import { checkAdapterConformance } from '@agentic-chat/testkit'
import { adaptChatBiEvent, chatBiCapabilities } from '@agentic-chat/adapter-chatbi'
import { adaptAiSdkUIMessageChunks } from '@agentic-chat/adapter-ai-sdk'

const event = adaptChatBiEvent({ protocol_version: '1.0', event_id: 'e1', event_type: 'run.started', session_id: 't1', run_id: 'r1', sequence: 1, created_at: '2026-07-15T00:00:00Z', tool_call_id: null, payload: {} }).event
if (event) createRuntime().dispatch(event satisfies CanonicalEvent)
void chatBiCapabilities
void createRendererRegistry()
void checkAdapterConformance(adaptAiSdkUIMessageChunks([{ type: 'start' }, { type: 'finish' }], { threadId: 't', runId: 'r' }).events)
const props = {} as AgenticChatProps
void AgenticChat
void props
`)
await writeFile(resolve(consumerDirectory, 'tsconfig.json'), `${JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, jsx: 'react-jsx', skipLibCheck: false }, include: ['smoke.ts'] }, null, 2)}\n`)

run('pnpm', ['install', '--ignore-workspace', '--prefer-offline', '--ignore-scripts', '--frozen-lockfile=false'], consumerDirectory)
run('node', ['smoke.mjs'], consumerDirectory)
run('pnpm', ['exec', 'tsc', '--noEmit'], consumerDirectory)

console.log(`Verified ${archives.length} installable package archives.`)

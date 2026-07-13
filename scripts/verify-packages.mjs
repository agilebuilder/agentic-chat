import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = resolve(root, '.tmp/package-smoke')
const packsDirectory = resolve(temporaryRoot, 'packs')
const consumerDirectory = resolve(temporaryRoot, 'consumer')
const publicPackages = ['core', 'runtime', 'testkit', 'react', 'react-ui', 'adapter-chatbi']

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

const dependencies = {}
for (const archive of archives) {
  const match = /^agentic-chat-(.+)-0\.1\.0-alpha\.0\.tgz$/.exec(archive)
  assert.ok(match, `unexpected archive name: ${archive}`)
  dependencies[`@agentic-chat/${match[1]}`] = `file:${relative(consumerDirectory, resolve(packsDirectory, archive)).replaceAll('\\', '/')}`
}

const reactPackage = JSON.parse(await readFile(resolve(root, 'node_modules/react/package.json'), 'utf8'))
const reactDomPackage = JSON.parse(await readFile(resolve(root, 'node_modules/react-dom/package.json'), 'utf8'))
dependencies.react = reactPackage.version
dependencies['react-dom'] = reactDomPackage.version

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

const runtime = createRuntime()
for (const event of chatBiSuccessfulRun) runtime.dispatch(event)
const markup = renderToStaticMarkup(createElement(AgenticChatProvider, { runtime }, createElement(RunStatus, { runId: 'run-1' })))
assert.match(markup, /role="status"/)
assert.equal(runtime.getState().runs['run-1']?.status, 'completed')
console.log('Packed package ESM, types, dependencies, and SSR import smoke test passed.')
`)

run('pnpm', ['install', '--ignore-workspace', '--offline', '--ignore-scripts', '--frozen-lockfile=false'], consumerDirectory)
run('node', ['smoke.mjs'], consumerDirectory)

console.log(`Verified ${archives.length} installable package archives.`)

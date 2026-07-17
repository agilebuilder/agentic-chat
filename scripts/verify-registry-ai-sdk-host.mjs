import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const consumer = resolve(root, '.tmp/registry-ai-sdk-host')
const manifest = async (name) => JSON.parse(await readFile(resolve(root, `packages/${name}/package.json`), 'utf8'))
const versions = {
  '@agentic-chat/adapter-ai-sdk': (await manifest('adapter-ai-sdk')).version,
  '@agentic-chat/runtime': (await manifest('runtime')).version,
  '@agentic-chat/react-ui': (await manifest('react-ui')).version,
}
const installedVersion = async (path) => JSON.parse(await readFile(resolve(root, `node_modules/${path}/package.json`), 'utf8')).version
const tools = {
  react: await installedVersion('react'),
  reactDom: await installedVersion('react-dom'),
  reactTypes: await installedVersion('@types/react'),
  reactDomTypes: await installedVersion('@types/react-dom'),
  typescript: await installedVersion('typescript'),
  vite: await installedVersion('vite'),
  viteReact: await installedVersion('@vitejs/plugin-react'),
}
for (const [name, version] of Object.entries(versions)) assert.match(version, /^(?:0\.1\.0-beta\.\d+|1\.0\.0-rc\.\d+|1\.0\.0)$/u, `${name} is not an accepted host-test release`)

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: consumer, encoding: 'utf8', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
}

await rm(consumer, { recursive: true, force: true })
await mkdir(resolve(consumer, 'src'), { recursive: true })
await writeFile(resolve(consumer, 'package.json'), `${JSON.stringify({ private: true, type: 'module', scripts: { build: 'tsc --noEmit && vite build' }, dependencies: { ...versions, react: tools.react, 'react-dom': tools.reactDom }, devDependencies: { '@types/react': tools.reactTypes, '@types/react-dom': tools.reactDomTypes, typescript: tools.typescript, vite: tools.vite, '@vitejs/plugin-react': tools.viteReact } }, null, 2)}\n`)
await writeFile(resolve(consumer, 'tsconfig.json'), `${JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: false, noEmit: true }, include: ['src', 'vite.config.ts'] }, null, 2)}\n`)
await writeFile(resolve(consumer, 'vite.config.ts'), "import react from '@vitejs/plugin-react'\nimport { defineConfig } from 'vite'\nexport default defineConfig({ plugins: [react()] })\n")
await writeFile(resolve(consumer, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n')
await writeFile(resolve(consumer, 'src/main.tsx'), `import { adaptAiSdkUIMessageChunks } from '@agentic-chat/adapter-ai-sdk'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { createRuntime } from '@agentic-chat/runtime'
import { createRoot } from 'react-dom/client'

const adapted = adaptAiSdkUIMessageChunks([
  { type: 'start' }, { type: 'text-start', id: 'answer' },
  { type: 'text-delta', id: 'answer', delta: 'Registry host works' },
  { type: 'text-end', id: 'answer' }, { type: 'finish' },
], { threadId: 'registry-thread', runId: 'registry-run', startedAt: '2026-07-17T00:00:00Z' })
if (adapted.diagnostics.length) throw new Error(JSON.stringify(adapted.diagnostics))
const runtime = createRuntime()
for (const event of adapted.events) runtime.dispatch(event)
createRoot(document.getElementById('root')!).render(<AgenticChat runtime={runtime} runId="registry-run" onSend={async () => undefined} />)
`)

run('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile=false'])
run('pnpm', ['build'])
console.log(`Verified non-ChatBI AI SDK registry host with ${Object.entries(versions).map(([name, version]) => `${name}@${version}`).join(', ')}.`)

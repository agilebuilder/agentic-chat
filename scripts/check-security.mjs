import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

async function sourceFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await sourceFiles(path))
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(path)
  }
  return files
}

const forbidden = [
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
  ['dynamic code evaluation', /\beval\s*\(|\bnew\s+Function\s*\(/],
]
const failures = []
for (const root of ['packages/core/src', 'packages/runtime/src', 'packages/react/src', 'packages/react-ui/src', 'packages/adapter-chatbi/src', 'packages/adapter-ag-ui/src', 'packages/adapter-ai-sdk/src']) {
  for (const file of await sourceFiles(resolve(root))) {
    const source = await readFile(file, 'utf8')
    for (const [label, pattern] of forbidden) if (pattern.test(source)) failures.push(`${file}: ${label}`)
  }
}

const uiFiles = await sourceFiles(resolve('packages/react-ui/src'))
const iframeSites = []
for (const file of uiFiles) {
  const source = await readFile(file, 'utf8')
  const count = (source.match(/<iframe\b/gu)?.length ?? 0) + (source.match(/(?:createElement|jsx|jsxs)\s*\(\s*['"]iframe['"]/gu)?.length ?? 0)
  iframeSites.push(...Array.from({ length: count }, () => file))
}
assert.deepEqual(iframeSites, [resolve('packages/react-ui/src/index.tsx')], 'Every Artifact iframe must use the single reviewed secure primitive')
const ui = await readFile(resolve('packages/react-ui/src/index.tsx'), 'utf8')
assert.match(ui, /sandbox=""/u, 'Artifact iframe must keep an empty sandbox')
assert.match(ui, /referrerPolicy="no-referrer"/u, 'Artifact iframe must not send a referrer')
assert.match(ui, /isSafeHttpUri\(uri\)\s*\|\|\s*!allowUri/u, 'Artifact iframe must enforce scheme and host policy')

const runtime = await readFile(resolve('packages/runtime/src/index.ts'), 'utf8')
assert.doesNotMatch(runtime, /ExperimentalInspectedEvent[^}]*\bdata\s*:/su, 'Inspection records must never retain event payloads')
assert.deepEqual(failures, [], `Security source checks failed:\n${failures.join('\n')}`)
console.log('Security source checks passed: no HTML injection/dynamic evaluation, iframe policy intact, inspection payload-free.')

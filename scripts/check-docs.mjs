import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const entryFiles = ['README.md', 'docs/09-renderer-guide.md', 'docs/10-quick-start.md', 'docs/11-theming.md', 'docs/12-adapter-guide.md', 'docs/24-canonical-schema-1.0.md', 'docs/25-api-lifecycle-and-support.md', 'docs/26-migration-to-1.0.md']
for (const file of entryFiles) {
  const text = await readFile(resolve(root, file), 'utf8')
  const links = [...text.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+\.md)(?:#[^)]+)?\)/gu)].map((match) => match[1])
  for (const link of links) await access(resolve(root, dirname(file), link))
}
const readme = await readFile(resolve(root, 'README.md'), 'utf8')
const quickStart = await readFile(resolve(root, 'docs/10-quick-start.md'), 'utf8')
assert.doesNotMatch(readme, /packages remain on the published Alpha/u)
assert.doesNotMatch(quickStart, /@agentic-chat\/(?:core|runtime|react-ui)@alpha/u)
console.log(`Validated ${entryFiles.length} public documentation entry points and relative links.`)

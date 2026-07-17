import { cp, mkdir, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'apps/docs/dist')
const content = resolve(output, 'content')
await mkdir(content, { recursive: true })
for (const file of await readdir(resolve(root, 'docs'))) {
  if (file.endsWith('.md')) await cp(resolve(root, 'docs', file), resolve(content, file))
}
for (const file of await readdir(resolve(root, 'etc/api'))) {
  if (file.endsWith('.api.md')) await cp(resolve(root, 'etc/api', file), resolve(content, file))
}
await cp(resolve(root, 'apps/minimal/dist'), resolve(output, 'demo'), { recursive: true })
console.log('Assembled versioned documentation content, API reports, and live demo.')

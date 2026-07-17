import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
const protectedPackages = ['core', 'runtime', 'adapter-chatbi', 'adapter-ag-ui', 'adapter-ai-sdk']
const forbiddenImports = /from\s+['"](?:react|react-dom|vue)(?:\/[^'"]*)?['"]|import\s*\(['"](?:react|react-dom|vue)/
const forbiddenCoreGlobals = /\b(?:window|document|localStorage)\b/
const violations = []

async function visit(directory, packageName) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await visit(path, packageName)
    else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      const source = await readFile(path, 'utf8')
      if (forbiddenImports.test(source)) violations.push(`${packageName}: framework import in ${path}`)
      if (packageName === 'core' && forbiddenCoreGlobals.test(source)) violations.push(`core: browser global in ${path}`)
    }
  }
}

for (const packageName of protectedPackages) await visit(join(root, 'packages', packageName, 'src'), packageName)
if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}
console.log('Package dependency boundaries are valid.')

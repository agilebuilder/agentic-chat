import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const budgets = JSON.parse(await readFile(resolve('scripts/package-size-budgets.json'), 'utf8'))

async function directorySize(directory) {
  let bytes = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    bytes += entry.isDirectory() ? await directorySize(path) : (await stat(path)).size
  }
  return bytes
}

const failures = []
for (const [packageName, budget] of Object.entries(budgets)) {
  const bytes = await directorySize(resolve('packages', packageName, 'dist'))
  const percentage = Math.round((bytes / budget) * 100)
  console.log(`${packageName.padEnd(16)} ${String(bytes).padStart(7)} / ${String(budget).padStart(7)} bytes (${percentage}%)`)
  if (bytes > budget) failures.push(`${packageName}: ${bytes} > ${budget}`)
}

assert.deepEqual(failures, [], `Package size budgets exceeded:\n${failures.join('\n')}`)
console.log('Package size budget check passed.')

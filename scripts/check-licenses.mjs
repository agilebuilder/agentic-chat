import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const result = spawnSync('pnpm', ['licenses', 'list', '--json', '--prod'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
})
assert.equal(result.status, 0, result.stderr || 'pnpm license inventory failed')

const inventory = JSON.parse(result.stdout)
const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'])
const rejected = Object.keys(inventory).filter((license) => !allowed.has(license))
assert.deepEqual(rejected, [], `production dependencies contain unreviewed licenses: ${rejected.join(', ')}`)

const count = Object.values(inventory).flat().length
console.log(`Production dependency license audit passed for ${count} package records.`)

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const stylesheet = resolve('packages/react-ui/src/styles.css')
const source = (await readFile(stylesheet, 'utf8')).replaceAll(/\/\*[\s\S]*?\*\//g, '')
const violations = []
let selectorCount = 0

function closingBrace(input, open) {
  let depth = 1
  for (let index = open + 1; index < input.length; index += 1) {
    if (input[index] === '{') depth += 1
    if (input[index] === '}') depth -= 1
    if (depth === 0) return index
  }
  throw new Error('Unbalanced CSS braces')
}

function inspectRules(input) {
  let cursor = 0
  while (cursor < input.length) {
    const open = input.indexOf('{', cursor)
    if (open === -1) break
    const prelude = input.slice(cursor, open).trim()
    const close = closingBrace(input, open)
    const body = input.slice(open + 1, close)
    if (/^@(media|supports|container|layer)\b/.test(prelude)) {
      inspectRules(body)
    } else if (/^@keyframes\s+ac-[a-z0-9_-]+$/i.test(prelude)) {
      // Component-owned animations are allowed; their declarations are not selectors.
    } else if (/^@/.test(prelude)) {
      violations.push(`Unsupported global at-rule: ${prelude}`)
    } else {
      for (const selector of prelude.split(',').map((item) => item.trim()).filter(Boolean)) {
        selectorCount += 1
        if (!/^\.ac-[a-z0-9_-]+(?:$|[\s.#[>:~+*])/i.test(selector)) violations.push(selector)
      }
    }
    cursor = close + 1
  }
}

inspectRules(source)
assert.ok(selectorCount > 0, 'no selectors found')
assert.deepEqual(violations, [], `React UI CSS must be scoped to .ac-* selectors:\n${violations.join('\n')}`)
console.log(`CSS scope check passed for ${selectorCount} selectors.`)

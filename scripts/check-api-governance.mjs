import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const explicitBase = process.env.API_GOVERNANCE_BASE
const base = explicitBase || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : '')

if (!base) {
  console.log('API governance merge-base check skipped outside a pull request; api:check still validates the reviewed baseline.')
  process.exit(0)
}

try { git('rev-parse', '--verify', base) } catch {
  console.error(`API governance base ${base} is unavailable. CI must fetch full history.`)
  process.exit(1)
}

const committed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/u).filter(Boolean)
const worktree = git('diff', '--name-only', base).split(/\r?\n/u).filter(Boolean)
const untracked = git('ls-files', '--others', '--exclude-standard').split(/\r?\n/u).filter(Boolean)
const changed = [...new Set([...committed, ...worktree, ...untracked])]
const apiChanges = changed.filter((file) => file.startsWith('etc/api/'))
if (apiChanges.length === 0) {
  console.log(`No public API baseline changes relative to ${base}.`)
  process.exit(0)
}

const changesets = changed.filter((file) => /^\.changeset\/(?!README\.md|pre\.json|config\.json).+\.md$/u.test(file))
if (changesets.length === 0) {
  console.error('Public API or CSS baseline changed without a changeset.')
  process.exit(1)
}

const diff = git('diff', '--unified=0', base, '--', ...apiChanges)
const removedContract = diff.split(/\r?\n/u).some((line) => /^-(?!-{2})/u.test(line) && (/^-(?:export |    |[-*] `--ac-|[-*] `ac-)/u.test(line)))
if (removedContract) {
  const breakingDocumented = changesets.some((file) => readFileSync(file, 'utf8').includes('BREAKING CHANGE:'))
  const hasAdr = changed.some((file) => /^docs\/adr\/\d+-.+\.md$/u.test(file))
  const hasMigration = changed.some((file) => /migration/i.test(file))
  if (!breakingDocumented || !hasAdr || !hasMigration) {
    console.error('A potentially breaking API diff requires a BREAKING CHANGE changeset, ADR and migration document.')
    process.exit(1)
  }
}

console.log(`API governance passed for ${apiChanges.length} baseline file(s) with ${changesets.length} changeset(s).`)

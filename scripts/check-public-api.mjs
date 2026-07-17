import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const packages = ['core', 'runtime', 'react', 'react-ui', 'testkit', 'adapter-chatbi', 'adapter-ai-sdk']
const update = process.argv.includes('--update')
let failed = false

await mkdir(resolve('etc/api'), { recursive: true })
await mkdir(resolve('.tmp/api-reports'), { recursive: true })

for (const packageName of packages) {
  const config = ExtractorConfig.loadFileAndPrepare(resolve('packages', packageName, 'api-extractor.json'))
  const result = Extractor.invoke(config, { localBuild: update, showVerboseMessages: false })
  if (!result.succeeded) failed = true
}

const css = await readFile(resolve('packages/react-ui/src/styles.css'), 'utf8')
const cssVariables = [...new Set(css.match(/--ac-[a-z0-9-]+/gu) ?? [])].sort()
const cssClasses = [...new Set((css.match(/\.ac-[a-z0-9-]+/gu) ?? []).map((value) => value.slice(1)))].sort()
const cssReport = `# @agentic-chat/react-ui CSS contract\n\nThis reviewed Beta baseline covers the public theme tokens and class hooks shipped by the default stylesheet.\n\n## Theme tokens\n\n${cssVariables.map((value) => `- \`${value}\``).join('\n')}\n\n## Class hooks\n\n${cssClasses.map((value) => `- \`${value}\``).join('\n')}\n`
const cssReportPath = resolve('etc/api/react-ui.css.md')
if (update) await writeFile(cssReportPath, cssReport, 'utf8')
else {
  const baseline = await readFile(cssReportPath, 'utf8').catch(() => '')
  if (baseline !== cssReport) {
    console.error('React UI CSS contract changed. Review the diff, then run pnpm api:update.')
    failed = true
  }
}

if (failed) {
  console.error(update ? 'Public API baseline generation failed.' : 'Public API changed. Review the diff, add a changeset, then run pnpm api:update.')
  process.exitCode = 1
} else {
  console.log(update ? 'Public API baselines updated.' : 'Public API baselines match the reviewed reports.')
}

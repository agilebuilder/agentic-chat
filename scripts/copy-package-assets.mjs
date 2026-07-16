import { copyFile, mkdir } from 'node:fs/promises'

const publicPackages = ['core', 'runtime', 'testkit', 'react', 'react-ui', 'adapter-chatbi', 'adapter-ai-sdk']
const rootLicense = new URL('../LICENSE', import.meta.url)
const packages = new URL('../packages/', import.meta.url)

for (const packageName of publicPackages) {
  const output = new URL(`${packageName}/dist/`, packages)
  await mkdir(output, { recursive: true })
  await copyFile(rootLicense, new URL('LICENSE', output))
}

await copyFile(new URL('react-ui/src/styles.css', packages), new URL('react-ui/dist/styles.css', packages))

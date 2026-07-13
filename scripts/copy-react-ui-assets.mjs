import { copyFile, mkdir } from 'node:fs/promises'

const packageRoot = new URL('../packages/react-ui/', import.meta.url)
await mkdir(new URL('dist/', packageRoot), { recursive: true })
await copyFile(new URL('src/styles.css', packageRoot), new URL('dist/styles.css', packageRoot))

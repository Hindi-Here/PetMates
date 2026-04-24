// script for auto update icons folder in React app from assets-root folder
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')

function findRepoRoot(startDir) {
  let current = resolve(startDir)
  while (true) {
    if (existsSync(join(current, '.git'))) return current
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }
  throw new Error(`Repository root not found: ${startDir}`)
}

const webRoot = resolve(__dirname, '..')
const repoRoot = findRepoRoot(webRoot)
const SOURCE = resolve(repoRoot, 'assets/icons')
const DEST = resolve(webRoot, 'src/assets/icons')

if (!existsSync(SOURCE)) process.exit(1)

mkdirSync(DEST, { recursive: true })
readdirSync(SOURCE).forEach((file) => {
  if (file.endsWith('.svg')) {
    copyFileSync(join(SOURCE, file), join(DEST, file))
  }
})
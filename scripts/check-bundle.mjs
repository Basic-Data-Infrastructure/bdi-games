import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const dist = join('apps', 'web', 'dist', 'assets')
const files = await readdir(dist)
const banned = ['dev-only-secret', 'dev-tick-secret']
for (const file of files) {
  if (!file.endsWith('.js')) continue
  const text = await readFile(join(dist, file), 'utf8')
  for (const word of banned) {
    if (text.includes(word)) {
      console.error(`Secret-like string in bundle: ${word}`)
      process.exit(1)
    }
  }
}
console.log('Bundle has no service secrets.')

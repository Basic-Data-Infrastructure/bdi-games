// Decodes the newest CDP Page.captureScreenshot dump (or a given file) into an image.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const [output, input] = process.argv.slice(2)
const dir = join(homedir(), '.cursor', 'browser-logs')
const source = input ?? readdirSync(dir)
  .filter((name) => name.startsWith('cdp-response-Page.captureScreenshot'))
  .map((name) => join(dir, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
const body = JSON.parse(readFileSync(source, 'utf8'))
writeFileSync(output, Buffer.from(body.data ?? body.result?.data, 'base64'))
console.log(output)

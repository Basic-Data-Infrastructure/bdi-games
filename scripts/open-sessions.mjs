import { chromium } from '@playwright/test'

const sessions = Number(process.argv.includes('--sessions') ? process.argv[process.argv.indexOf('--sessions') + 1] : 1)
const gameId = process.argv.includes('--game')
  ? process.argv[process.argv.indexOf('--game') + 1]
  : 'logistics'
const base = process.env.WEB_URL ?? 'http://localhost:5173'

const browser = await chromium.launch({ headless: false })
for (let index = 0; index < sessions; index++) {
  const host = await browser.newContext()
  const page = await host.newPage()
  await page.goto(`${base}/#/`)
  await page.getByTestId(`game-${gameId}`).click()
  await page.getByTestId('start-session').click()
  await page.getByTestId('session-code').waitFor()
}
console.log(`Opened ${sessions} host window(s) for game "${gameId}". Join from extra browser profiles via the QR or session code.`)
await new Promise(() => {})

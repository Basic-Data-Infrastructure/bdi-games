import { expect, type Browser, type Page } from '@playwright/test'

export type Org = 'buyer' | 'seller' | 'carrier' | 'delivery'
export const ORGS: Org[] = ['buyer', 'seller', 'carrier', 'delivery']

export const PHONE_SIZES: Record<Org, { width: number; height: number }> = {
  buyer: { width: 360, height: 640 },
  seller: { width: 390, height: 844 },
  carrier: { width: 430, height: 932 },
  delivery: { width: 360, height: 640 },
}

export async function openHost(browser: Browser, startMode: 'new' | 'bdi' = 'new') {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  await page.goto('/#/')
  await page.getByTestId('game-logistics').click()
  if (startMode === 'new') await page.getByTestId('start-session').click()
  else await page.getByRole('button', { name: 'Direct de BDI-ronde' }).click()
  await expect(page.getByTestId('session-code')).toBeVisible()
  const code = (await page.getByTestId('session-code').innerText()).trim()
  return { context, page, code }
}

export async function joinPhone(browser: Browser, code: string, org: Org) {
  const context = await browser.newContext({ viewport: PHONE_SIZES[org], isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto(`/#/join?code=${code}`)
  await page.getByTestId(`free-${org}`).click()
  await page.getByTestId('claim-role').click()
  await expect(page.getByTestId(`phone-${org}`)).toBeVisible()
  await page.getByTestId('ready').click()
  await expect(page.getByTestId('ready-wait')).toBeVisible()
  return { context, page }
}

export async function expectNoScroll(page: Page, axis: 'x' | 'both' = 'both') {
  const size = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    w: window.innerWidth,
    h: window.innerHeight,
  }))
  expect(size.sw, 'no horizontal scroll').toBeLessThanOrEqual(size.w)
  if (axis === 'both') expect(size.sh, 'no vertical scroll').toBeLessThanOrEqual(size.h)
}

export async function clickThroughIntro(host: Page) {
  const next = host.getByTestId('intro-continue')
  await expect(next).toBeVisible()
  while (await next.isVisible().catch(() => false)) {
    await next.click()
    await host.waitForTimeout(700)
  }
}

/**
 * Plays whatever the phones are asked until `done` holds. A tile marked available (BDI) is
 * picked first; otherwise untried tiles are tried in order, like a player guessing.
 */
export async function playUntil(phones: Record<Org, Page>, done: () => Promise<boolean>, limitMs = 4 * 60_000) {
  const deadline = Date.now() + limitMs
  const tried: Record<string, Set<string>> = {}
  const lastPrompt: Record<string, string> = {}
  let wrong = 0
  while (!(await done())) {
    if (Date.now() > deadline) {
      const screens = await Promise.all(ORGS.map(async (org) => `${org}: ${(await phones[org].locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 240)}`))
      throw new Error(`game did not reach the expected state in time\n${screens.join('\n')}`)
    }
    for (const org of ORGS) {
      const page = phones[org]
      const task = page.getByTestId('task')
      if (!(await task.isVisible().catch(() => false))) continue
      const enabled = page.locator('button[data-testid^="option-"]:not([disabled])')
      if ((await enabled.count()) === 0) continue
      const prompt = await task.locator('h2').first().innerText({ timeout: 1000 }).catch(() => '')
      if (lastPrompt[org] !== prompt) {
        lastPrompt[org] = prompt
        tried[org] = new Set()
      }
      const ids = await enabled.evaluateAll((els) => els.map((el) => ({
        id: el.getAttribute('data-testid')!,
        available: el.classList.contains('is-available'),
      })))
      let pick = ids.find((item) => item.available && !tried[org].has(item.id)) ?? ids.find((item) => !tried[org].has(item.id))
      // After a refused tap (presentation hold, conflict) every option can sit in `tried` while the step is still open.
      if (!pick && ids.length > 0) {
        tried[org] = new Set()
        pick = ids.find((item) => item.available) ?? ids[0]
      }
      if (!pick) continue
      tried[org].add(pick.id)
      const response = page.waitForResponse((res) => res.url().includes('/actions'), { timeout: 4000 }).catch(() => null)
      const clicked = await page.getByTestId(pick.id).click({ timeout: 2000 }).then(() => true, () => false)
      if (!clicked) {
        tried[org].delete(pick.id)
        continue
      }
      const res = await response
      if (process.env.E2E_VERBOSE) {
        const outcome = res ? (res.ok() ? ((await res.json().catch(() => ({}))) as { output?: { outcome?: string } }).output?.outcome : `${res.status()} ${(await res.json().catch(() => ({}))).error}`) : 'no request'
        console.log(`[${org}] ${prompt} -> ${pick.id}: ${outcome}`)
      }
      await page.waitForTimeout(400)
      if (await page.locator('[data-testid="phone-feedback"].bad').isVisible().catch(() => false)) wrong += 1
    }
    await phones.buyer.waitForTimeout(400)
  }
  return { wrong }
}

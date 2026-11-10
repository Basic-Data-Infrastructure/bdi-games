import { expect, test, type Page } from '@playwright/test'
import { clickThroughIntro, expectNoScroll, joinPhone, openHost, ORGS, playUntil, type Org } from './helpers'

test('two rounds with a beamer and four separate phones', async ({ browser }) => {
  const host = await openHost(browser)
  await expectNoScroll(host.page)

  const phones = {} as Record<Org, Page>
  for (const org of ORGS) phones[org] = (await joinPhone(browser, host.code, org)).page
  for (const org of ORGS) await expect(host.page.getByTestId(`qr-${org}`)).toContainText('Klaar')

  const start = host.page.getByTestId('start-round')
  await expect(start).toBeEnabled()
  await start.click()
  await clickThroughIntro(host.page)
  await expect(host.page.getByTestId('training-question')).toBeVisible()
  await expectNoScroll(host.page)
  for (const org of ORGS) await expectNoScroll(phones[org], 'x')

  await expect(phones.seller.getByTestId('waiting')).toBeVisible()
  await expect(phones.buyer.getByTestId('task')).toBeVisible()

  let reloaded = false
  const nextRound = host.page.getByRole('button', { name: 'Start ronde 2 — Met BDI' })
  await playUntil(phones, async () => {
    if (!reloaded && await phones.carrier.getByTestId('task').isVisible().catch(() => false)) {
      reloaded = true
      await phones.carrier.reload()
      await expect(phones.carrier.getByTestId('phone-carrier')).toBeVisible()
    }
    return nextRound.isVisible().catch(() => false)
  })
  expect(reloaded, 'a phone reload during the round keeps its role').toBe(true)
  await expect(host.page.getByTestId('training-question')).toContainText('Afgeleverd')
  await expect(phones.buyer.getByTestId('delivered')).toBeVisible()

  await nextRound.click()
  await expect(host.page.locator('.hud-pill.round-bdi')).toBeVisible()
  await clickThroughIntro(host.page)
  // Registers and dossiers stay hidden until the host reveals them.
  await host.page.getByTestId('toggle-dossiers').click()
  await expect(host.page.locator('.registry-strip')).toBeVisible()

  await playUntil(phones, () => host.page.getByTestId('comparison').isVisible().catch(() => false), 5 * 60_000)
  const comparison = host.page.getByTestId('comparison')
  await expect(comparison).toContainText('Ronde 1')
  await expect(comparison).toContainText('Ronde 2')
  const noticesRow = comparison.locator('tr', { hasText: 'Meldingen ontvangen' })
  const cells = await noticesRow.locator('td').allInnerTexts()
  expect(Number(cells[1])).toBe(0)
  expect(Number(cells[2])).toBeGreaterThan(0)
  const wrong = await comparison.locator('tr', { hasText: 'Foute pogingen' }).locator('td').allInnerTexts()
  expect(Number(wrong[2]), 'fetching from the source avoids guessing').toBeLessThan(Number(wrong[1]))

  await phones.seller.getByTestId('tab-notices').click()
  await expect(phones.seller.getByTestId('notices').locator('.notice').first()).toBeVisible()
  await expectNoScroll(host.page)
})

test('a taken role shows the free roles instead', async ({ browser }) => {
  const host = await openHost(browser)
  await joinPhone(browser, host.code, 'buyer')

  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true })
  const page = await context.newPage()
  await page.goto(`/#/join?code=${host.code}&role=buyer`)
  await expect(page.getByTestId('claim-error')).toBeVisible()
  await expect(page.getByTestId('claim-role')).toHaveCount(0)
  await expect(page.getByTestId('free-seller')).toBeVisible()
  await expect(page.getByTestId('free-buyer')).toHaveCount(0)
})

test('the host can pause, review history and resume with the keyboard', async ({ browser }) => {
  const host = await openHost(browser)
  const phones = {} as Record<Org, Page>
  for (const org of ORGS) phones[org] = (await joinPhone(browser, host.code, org)).page
  await host.page.getByTestId('start-round').click()
  await clickThroughIntro(host.page)
  await phones.buyer.getByTestId('option-camera').click()
  await expect(phones.seller.getByTestId('task')).toBeVisible()

  await host.page.keyboard.press('ArrowLeft')
  await expect(host.page.getByTestId('review-banner')).toBeVisible()
  await expect(host.page.getByTestId('hud-resume')).toBeVisible()
  await expect(phones.seller.getByText('Het spel is gepauzeerd.')).toBeVisible()

  await host.page.keyboard.press('Escape')
  await expect(host.page.getByTestId('review-banner')).toHaveCount(0)
  await expect(host.page.getByTestId('hud-resume')).toHaveCount(0)
  await expect(phones.seller.getByTestId('task')).toBeVisible()

  await host.page.keyboard.press(' ')
  await expect(host.page.getByTestId('hud-resume')).toBeVisible()
  await host.page.getByTestId('hud-resume').click()
  await expect(host.page.getByTestId('hud-resume')).toHaveCount(0)

  await host.page.keyboard.press('Escape')
  await expect(host.page.getByTestId('manage-drawer')).toBeVisible()
})

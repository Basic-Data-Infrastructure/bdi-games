import { expect, test, type Browser, type Page } from '@playwright/test'
import { expectNoScroll } from './helpers'

const ACCESS_ORGS = ['admin', 'owner', 'registry', 'provider', 'consumer'] as const
type AccessOrg = (typeof ACCESS_ORGS)[number]
const PREDICTORS = ['admin', 'owner', 'registry', 'consumer'] as const

const PHONE_SIZES: Record<AccessOrg, { width: number; height: number }> = {
  admin: { width: 360, height: 640 },
  owner: { width: 390, height: 844 },
  registry: { width: 360, height: 640 },
  provider: { width: 430, height: 932 },
  consumer: { width: 360, height: 640 },
}

async function openAccessHost(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  await page.goto('/#/')
  await page.getByTestId('game-access').click()
  await page.getByTestId('start-session').click()
  await expect(page.getByTestId('session-code')).toBeVisible()
  const code = (await page.getByTestId('session-code').innerText()).trim()
  return { context, page, code }
}

async function joinAccess(browser: Browser, code: string, org: AccessOrg) {
  const context = await browser.newContext({ viewport: PHONE_SIZES[org], isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto(`/#/join?code=${code}`)
  await page.getByTestId(`free-${org}`).click()
  await page.getByTestId('claim-role').click()
  await expect(page.getByTestId(`phone-${org}`)).toBeVisible()
  await page.getByTestId('ready').click()
  return { context, page }
}

/** Waits for the presentation hold to end: the next actor's task appears again. */
async function tap(page: Page, testId: string) {
  const button = page.getByTestId(testId)
  await expect(button).toBeEnabled({ timeout: 20_000 })
  await button.click()
}

type Phones = Record<AccessOrg, Page>

async function playRequest(host: Page, phones: Phones, cardId: string, expectDelivered: boolean) {
  await tap(phones.consumer, `pick-${cardId}`)
  for (const org of PREDICTORS) {
    await tap(phones[org], `predict-${expectDelivered ? 'delivered' : 'policy'}`)
    await expect(phones[org].getByTestId('access-predicted')).toBeVisible()
  }
  for (const source of ['association', 'orchestration', 'policy']) {
    await tap(phones.provider, `lookup-${source}`)
    await expect(phones.provider.getByTestId(`lookup-${source}`)).toBeDisabled()
    const failed = await phones.provider.getByTestId(`lookup-${source}`).evaluate((el) => el.classList.contains('is-wrong'))
    if (failed) break
  }
  await tap(phones.provider, expectDelivered ? 'decide-deliver' : 'decide-refuse')
  await expect(host.getByTestId('access-feedback')).toContainText(expectDelivered ? 'levert' : 'Geweigerd')
}

test('access game: onboarding, registration, per-request checks, change and suspension', async ({ browser }) => {
  test.setTimeout(7 * 60_000)
  const host = await openAccessHost(browser)
  const phones = {} as Phones
  for (const org of ACCESS_ORGS) {
    phones[org] = (await joinAccess(browser, host.code, org)).page
  }
  if (await host.page.getByTestId('start-round').isVisible().catch(() => false)) {
    await host.page.getByTestId('start-round').click()
  }
  await expect(host.page.getByTestId('access-board')).toBeVisible({ timeout: 15_000 })
  await expect(host.page.getByTestId('phase-once')).toHaveClass(/is-active/)

  for (const item of ['identity', 'mandate', 'terms', 'access']) {
    await phones.consumer.getByTestId(`dossier-${item}`).check()
  }
  await tap(phones.consumer, 'submit-dossier')
  await tap(phones.admin, 'option-admit')
  await expect(phones.admin.getByTestId('access-feedback')).toContainText('Niet toelaten')
  await expect(host.page.getByTestId('access-card')).toContainText('Niet toelaten')
  await tap(phones.admin, 'option-return')

  await expect(phones.consumer.getByTestId('dossier-access')).toBeChecked({ timeout: 20_000 })
  await phones.consumer.getByTestId('dossier-access').uncheck()
  await tap(phones.consumer, 'submit-dossier')
  await tap(phones.admin, 'option-admit')

  await expect(host.page.getByTestId('phase-shipment')).toHaveClass(/is-active/, { timeout: 20_000 })
  await tap(phones.owner, 'option-register')
  await tap(phones.registry, 'option-record')
  await expect(phones.owner.getByTestId('set-policy')).toBeVisible({ timeout: 20_000 })
  await phones.owner.getByTestId('policy-loading').check()
  await tap(phones.owner, 'set-policy')

  await expect(host.page.getByTestId('phase-request')).toHaveClass(/is-active/, { timeout: 20_000 })
  await playRequest(host.page, phones, 'r-load-101', true)
  await expect(phones.consumer.getByTestId('received-r-load-101')).toBeVisible()
  await playRequest(host.page, phones, 'r-fin-101', false)
  await playRequest(host.page, phones, 'r-load-102', false)
  await playRequest(host.page, phones, 'r-old-101', false)

  await tap(phones.owner, 'option-update')
  await tap(phones.registry, 'option-record')
  await playRequest(host.page, phones, 'r-again-101', false)
  await expect(phones.consumer.getByTestId('received-r-load-101')).toContainText('Eerder ontvangen')
  await playRequest(host.page, phones, 'r-load-103', true)

  await tap(phones.admin, 'option-suspend')
  await playRequest(host.page, phones, 'r-update-103', false)

  await expect(host.page.getByTestId('access-debrief')).toBeVisible({ timeout: 20_000 })
  await expect(host.page.getByTestId('phase-request')).toContainText('7×')
  await expect(phones.consumer.getByTestId('access-phone-debrief')).toBeVisible()
  await expectNoScroll(host.page)
  for (const org of ACCESS_ORGS) await expectNoScroll(phones[org], 'x')
})

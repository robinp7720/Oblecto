import { test, expect } from '@playwright/test'

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const movie = { id: 1, movieName: 'Arrival', runtime: 116, Files: [] }
const series = { id: 2, seriesName: 'The Observatory' }

async function boot (page) {
  await page.route('**oblecto.test/**', route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (/\/(poster|fanart|banner)$/.test(url.pathname)) return route.fulfill({ status: 404, headers })
    let data = []
    if (url.pathname === '/api/v1/me') data = { id: 1, username: 'viewer', preferences: {}, permissions: [] }
    if (url.pathname === '/movies/list/createdAt') data = [movie]
    if (url.searchParams.get('mode') === 'browse') data = { items: [url.pathname.startsWith('/series') ? series : movie], facets: { genres: [] }, pageInfo: { hasNextPage: false } }
    if (url.pathname === '/movie/1/info') data = movie
    if (url.pathname.endsWith('/related')) data = { items: [] }
    if (url.pathname.endsWith('/extras')) data = { trailers: [], certifications: [], unavailable: false }
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.addInitScript(() => {
    localStorage.setItem('oblecto.accessToken', 'test-token')
    localStorage.setItem('oblecto.host', 'http://oblecto.test')
  })
  await page.goto('/')
  await expect(page.locator('.home .hero-title')).toHaveText('Arrival')
}

for (const mediaType of ['series', 'movies']) {
  test(`@desktop @phone outgoing Home and ${mediaType} pages keep their geometry throughout navigation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await boot(page)
    // Stretch the fade so assertions reliably sample the outgoing page, even
    // on a busy runner. Leave the actual transform and layout rules intact.
    await page.addStyleTag({ content: '.page-fade-leave-active { transition-duration: 1s !important; }' })
    for (const [path, outgoing, incoming] of [[`/library/${mediaType}`, '.home', '.library'], ['/', '.library', '.home']]) {
      await expect(page.locator('.page-fade-enter-active, .page-fade-leave-active')).toHaveCount(0)
      await page.evaluate(() => window.scrollTo(0, 0))
      const measurements = await page.evaluate(async ({ path, outgoing }) => {
        const el = document.querySelector(outgoing)
        const rect = () => { const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width } }
        const before = rect()
        await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        return { before, after: rect(), leaving: Boolean(el.closest('.page-fade-leave-active')) }
      }, { path, outgoing })
      expect(measurements.leaving).toBe(true)
      expect(measurements.after.x).toBeCloseTo(measurements.before.x, 1)
      expect(measurements.after.width).toBeCloseTo(measurements.before.width, 1)
      // The intentional fade translates up by at most 6px; page padding must
      // not add the former 24px/40px jump on top of that motion.
      expect(measurements.after.y - measurements.before.y).toBeGreaterThanOrEqual(-6.1)
      expect(measurements.after.y - measurements.before.y).toBeLessThanOrEqual(0.1)
      await expect(page.locator(incoming)).toBeVisible()
      await expect(page.locator('.page-fade-enter-active, .page-fade-leave-active')).toHaveCount(0)
      const layout = await page.locator(incoming).evaluate(el => {
        const main = document.querySelector('#main-content').getBoundingClientRect()
        const box = el.getBoundingClientRect()
        return { x: box.x, top: box.top - main.top, width: box.width, viewport: innerWidth }
      })
      if (incoming === '.home') {
        expect(layout.x).toBe(0)
        expect(layout.top).toBe(0)
        expect(layout.width).toBe(layout.viewport)
      } else {
        expect(layout.x).toBeCloseTo(Math.max(20, Math.min(layout.viewport * 0.04, 80)), 1)
        expect(layout.top).toBe(layout.viewport <= 760 ? 24 : 40)
      }
    }
  })
}

test('@desktop @phone reduced-motion navigation and card detail/back preserve page spacing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await page.locator('.primary-nav').getByRole('link', { name: 'Movies', exact: true }).click()
  await expect(page.locator('.library')).toBeVisible()
  await expect(page.locator('.page-fade-enter-active, .page-fade-leave-active')).toHaveCount(0)
  const before = await page.locator('.library').boundingBox()
  // Also exercise the shared-element path, whose Vue CSS transition is disabled.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('.results-grid').getByRole('link', { name: 'Arrival', exact: true }).click()
  await expect(page.locator('.detail-hero h1')).toHaveText('Arrival')
  await expect(page.locator('html')).not.toHaveClass(/vt-card/)
  expect((await page.locator('.detail-page').boundingBox()).x).toBe(0)
  await page.goBack()
  await expect(page.locator('.library')).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/vt-card/)
  const after = await page.locator('.library').boundingBox()
  expect(after.x).toBeCloseTo(before.x, 1)
  expect(after.width).toBeCloseTo(before.width, 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

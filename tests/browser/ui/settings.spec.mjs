import { test, expect } from '@playwright/test'
import { account } from './accounts.mjs'
const API = 'http://oblecto.test'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
const config = () => ({
  indexer: { runAtBoot: false }, cleaner: { runAtBoot: false }, files: { doHash: false }, fileExtensions: { video: ['mkv'] },
  assets: { storeWithFile: false, showPosterLocation: '/shows', episodeBannerLocation: '/episodes', moviePosterLocation: '/posters', movieFanartLocation: '/fanart' },
  artwork: Object.fromEntries(['poster', 'fanart', 'banner'].map(key => [key, { small: 100, medium: 300, large: 800 }])),
  themoviedb: { key: 'saved-key' }, tvdb: { key: '' }, 'fanart.tv': { key: '' },
  movies: { directories: [{ path: '/movies' }], movieIdentifiers: [], movieUpdaters: [], doReIndex: false, indexBroken: false },
  tvshows: { directories: [], seriesIdentifiers: [], episodeIdentifiers: [], seriesUpdaters: [], episodeUpdaters: [], doReIndex: false, indexBroken: false, ignoreSeriesMismatch: true }
})
async function boot (page, path, handle = () => false) {
  await page.route('**oblecto.test/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const url = new URL(route.request().url())
    if (await handle(route, url)) return
    if (url.pathname === '/api/v1/me') return reply(route, account())
    if (url.pathname === '/api/v1/status/seedbox') return reply(route, { queue: { idle: true, length: 0, running: 0 } })
    if (url.pathname === '/api/v1/settings') return reply(route, config())
    if (url.pathname === '/api/v1/system/capabilities') return reply(route, { movies: { identifiers: ['tmdb'], updaters: ['tmdb'] }, tvshows: { seriesIdentifiers: ['tvdb'], episodeIdentifiers: ['tvdb'], seriesUpdaters: ['tvdb'], episodeUpdaters: ['tvdb'] } })
    return reply(route, [])
  })
  await page.addInitScript(api => { localStorage.setItem('oblecto.host', api); localStorage.setItem('oblecto.accessToken', 'test-token') }, API)
  await page.goto(path)
}

test.describe('@desktop settings', () => {
  test('blocks editing while loading and retries failed loads', async ({ page }) => {
    let held
    let failed = true
    await boot(page, '/settings/indexer', async (route, url) => {
      if (url.pathname !== '/api/v1/settings') return false
      if (failed) { held = route; return true }
      return false
    })
    const control = page.getByLabel('Run indexer on startup')
    await expect(control).toBeDisabled()
    await expect.poll(() => Boolean(held)).toBe(true)
    await reply(held, { error: 'Unavailable' }, 503)
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
    await expect(control).toBeDisabled()
    failed = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(control).toBeEnabled()
  })
  test('serializes rapid edits and retains only changed fields', async ({ page }) => {
    const pending = []
    const bodies = []
    await boot(page, '/settings/indexer', async route => {
      if (route.request().method() !== 'PATCH') return false
      bodies.push(route.request().postDataJSON()); pending.push(route); return true
    })
    await page.getByLabel('Run indexer on startup').check()
    await expect.poll(() => pending.length).toBe(1)
    await page.getByLabel('Run cleaner on startup').check()
    expect(pending.length).toBe(1)
    await reply(pending[0], config())
    await expect.poll(() => pending.length).toBe(2)
    expect(bodies[0]).toEqual({ indexer: { runAtBoot: true } })
    expect(bodies[1]).toEqual({ cleaner: { runAtBoot: true } })
    await reply(pending[1], config())
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Revert', exact: true })).toHaveCount(0)
  })
  test('keeps failures editable, warns before leaving, retries and reverts', async ({ page }) => {
    let fail = true
    await boot(page, '/settings/indexer', async route => {
      if (route.request().method() !== 'PATCH') return false
      await reply(route, fail ? { error: 'Disk full' } : config(), fail ? 500 : 200); return true
    })
    const checkbox = page.getByLabel('Run indexer on startup')
    await checkbox.check()
    await expect(page.getByText('Could not save: Disk full')).toBeVisible()
    await page.getByRole('link', { name: 'Artwork', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Revert', exact: true }).click()
    await expect(checkbox).not.toBeChecked()
    await checkbox.check()
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  })
  test('validates widths, searches fields, and opens advanced settings', async ({ page }) => {
    let saves = 0
    await boot(page, '/settings/artwork', async route => {
      if (route.request().method() === 'PATCH') { saves++; await reply(route, config()); return true }
      return false
    })
    const width = page.getByLabel('Small poster width')
    await width.fill('-1'); await width.blur()
    await expect(width).toHaveAttribute('aria-invalid', 'true')
    expect(saves).toBe(0)
    await page.getByRole('button', { name: 'Revert', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Find a setting' }).fill('series identifiers')
    await page.locator('.settings-search-results').getByRole('link', { name: 'Series identifiers', exact: true }).click()
    await expect(page.locator('#setting-tvshows-seriesIdentifiers')).toBeFocused()
    await expect(page.locator('details[open]')).toHaveCount(1)
  })
  test('masks provider keys and tests saved credentials', async ({ page }) => {
    await boot(page, '/settings/metadata', async (route, url) => {
      if (url.pathname.endsWith('/themoviedb/test')) { await reply(route, { ok: true, message: 'Connection successful using the saved key.' }); return true }
      return false
    })
    const key = page.getByLabel('TMDB API key')
    await expect(key).toHaveValue('saved-key')
    await expect(key).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Reveal TMDB key' }).click()
    await expect(key).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Test TMDB connection' }).click()
    await expect(page.getByText('Connection successful using the saved key.')).toBeVisible()
  })
  test('overview retains successful sections and marks job data stale on failure', async ({ page }) => {
    let jobsFail = false
    let problemsFail = true
    const job = { id: 'cached', action: 'scan', target: 'movies', state: 'running', createdAt: new Date().toISOString(), total: 2, completed: 1, failed: 0 }
    await boot(page, '/settings', async (route, url) => {
      if (url.pathname === '/api/v1/system/maintenance/jobs') { await reply(route, jobsFail ? {} : [job], jobsFail ? 503 : 200); return true }
      if (url.pathname === '/files/problematic') { await reply(route, problemsFail ? {} : [], problemsFail ? 503 : 200); return true }
      return false
    })
    await expect(page.getByText('1 movie folder · 0 TV show folders')).toBeVisible()
    await expect(page.getByText('Library scan · Movies', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry problem files' })).toBeVisible()
    problemsFail = false
    await page.getByRole('button', { name: 'Retry problem files' }).click()
    await expect(page.getByText('No problem files need attention.')).toBeVisible()
    jobsFail = true
    await expect(page.getByText(/Displayed jobs may be out of date/)).toBeVisible({ timeout: 6000 })
    await expect(page.getByText('Library scan · Movies', { exact: true })).toBeVisible()
  })
  test('seedbox save failure keeps the dialog draft available for retry', async ({ page }) => {
    let fail = true
    await boot(page, '/settings/seedboxes', async (route, url) => {
      if (url.pathname !== '/api/v1/settings/seedboxes') return false
      if (route.request().method() === 'PATCH') { await reply(route, fail ? { error: 'Disk full' } : [], fail ? 500 : 200); return true }
      await reply(route, []); return true
    })
    await page.getByRole('button', { name: 'Add seedbox', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('My downloads')
    await page.getByLabel('Host', { exact: true }).fill('downloads.example')
    await page.getByRole('dialog').getByRole('button', { name: 'Add seedbox', exact: true }).click()
    await expect(page.getByRole('dialog').getByText('Could not save seedbox settings: Disk full')).toBeVisible()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My downloads')
    fail = false
    await page.getByRole('dialog').getByRole('button', { name: 'Add seedbox', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'My downloads', exact: true })).toBeVisible()
  })
  test('overview links to setup and maintenance keeps job progress across reloads', async ({ page }) => {
    const job = { id: '1', action: 'scan', target: 'series', state: 'running', createdAt: new Date().toISOString(), total: 4, completed: 1, failed: 0 }
    await boot(page, '/settings', async (route, url) => {
      if (url.pathname === '/api/v1/system/maintenance/jobs') { await reply(route, [job]); return true }
      return false
    })
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    await expect(page.getByText('1 movie folder · 0 TV show folders')).toBeVisible()
    await page.screenshot({ path: '/tmp/oblecto-settings-overview.png' })
    await page.getByRole('link', { name: 'Run maintenance', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Scan TV shows' })).toBeDisabled()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Scan TV shows' })).toBeDisabled()
    job.state = 'completed'; job.finishedAt = new Date().toISOString(); job.completed = 4
    await expect(page.getByRole('button', { name: 'Scan TV shows' })).toBeEnabled({ timeout: 6000 })
    await expect(page.getByText(/4 completed, 0 failed/)).toBeVisible()
  })
})

test('@phone settings section picker and search fit the viewport', async ({ page }) => {
  await boot(page, '/settings')
  await page.getByLabel('Settings section', { exact: true }).selectOption('ArtworkSettings')
  await expect(page.getByRole('heading', { name: 'Artwork', exact: true })).toBeVisible()
  await expect(page.getByLabel('Small poster width')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/oblecto-settings-phone.png' })
})

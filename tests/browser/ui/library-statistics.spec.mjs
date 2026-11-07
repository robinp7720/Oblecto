import { test, expect } from '@playwright/test'
import { account } from './accounts.mjs'
const API = 'http://oblecto.test'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })

async function boot (page, { hold = false, permissions = ['libraries.manage'], empty = false } = {}) {
  const state = { hold, pending: [], requests: [], fail: false, movies: empty ? [] : [{ path: '/media/' + 'long-folder-name/'.repeat(12) }], shows: [] }
  state.rows = () => [...state.movies.map(folder => ({ type: 'movies', ...folder, movies: 3, files: 4, localBytes: 1024 ** 3, missingSize: 1, problematicFiles: 2 })), ...state.shows.map(folder => ({ type: 'tvshows', ...folder, series: 0, episodes: 0, files: 0, localBytes: 0, missingSize: 0, problematicFiles: 0 }))]
  await page.route('**oblecto.test/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const url = new URL(route.request().url())
    state.requests.push(url.pathname)
    if (url.pathname === '/api/v1/me') return reply(route, account({ permissions }))
    if (url.pathname === '/api/v1/libraries/statistics') {
      if (state.hold) { state.pending.push(route); return }
      return reply(route, state.fail ? { message: 'Unavailable' } : { libraries: state.rows() }, state.fail ? 503 : 200)
    }
    if (url.pathname === '/api/v1/libraries/movies') return reply(route, state.movies)
    if (url.pathname === '/api/v1/libraries/tvshows') return reply(route, state.shows)
    if (url.pathname === '/api/v1/libraries/movies/paths') {
      const { path } = route.request().postDataJSON()
      state.movies = route.request().method() === 'DELETE' ? state.movies.filter(folder => folder.path !== path) : [...state.movies, { path }]
      return reply(route, state.movies)
    }
    if (url.pathname === '/api/v1/system/capabilities') return reply(route, { movies: { identifiers: [], updaters: [] }, tvshows: { seriesIdentifiers: [], episodeIdentifiers: [], seriesUpdaters: [], episodeUpdaters: [] } })
    // A library manager need not have permission to read general settings.
    if (url.pathname === '/api/v1/settings') return reply(route, { message: 'Forbidden' }, 403)
    return reply(route, [])
  })
  await page.addInitScript(api => { localStorage.setItem('oblecto.host', api); localStorage.setItem('oblecto.accessToken', 'test-token') }, API)
  await page.goto('/settings/libraries')
  return state
}

test('library managers can retry folder statistics independently of settings @desktop @phone', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const state = await boot(page, { hold: true })
  await expect(page.getByText('Loading library statistics…', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add movie library', exact: true })).toBeEnabled()
  state.hold = false
  state.fail = true
  await expect.poll(() => state.pending.length).toBeGreaterThan(0)
  for (const route of state.pending.splice(0)) await reply(route, { message: 'Unavailable' }, 503)
  await expect(page.getByText('Could not load library statistics.', { exact: true })).toBeVisible()
  state.fail = false
  await page.getByRole('button', { name: 'Retry library statistics', exact: true }).click()
  await expect(page.locator('.library-metrics').getByText('1 GiB', { exact: true })).toBeVisible()
  await expect(page.getByText('No TV show libraries configured.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(state.requests.some(path => path.startsWith('/api/v1/statistics/server/'))).toBe(false)
  expect(errors).toEqual([])
  await page.screenshot({ path: `/tmp/oblecto-library-settings-${test.info().project.name}.png`, fullPage: true })
})

test('folder additions and removals refresh counts and discard older responses @desktop', async ({ page }) => {
  const state = await boot(page, { empty: true })
  await expect(page.getByText('No movie libraries configured.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh library statistics', exact: true })).toBeEnabled()
  state.hold = true
  await page.getByRole('button', { name: 'Refresh library statistics', exact: true }).click()
  await expect.poll(() => state.pending.length).toBe(1)
  const older = state.pending.shift()
  state.hold = false
  await page.getByRole('button', { name: 'Add movie library', exact: true }).click()
  await page.getByLabel('Path', { exact: true }).fill('/new')
  await page.getByRole('button', { name: 'Add library', exact: true }).click()
  await expect(page.locator('.library-metrics')).toHaveCount(1)
  await reply(older, { libraries: [] })
  await expect(page.locator('.library-metrics')).toHaveCount(1)
  await page.getByRole('button', { name: 'Remove /new', exact: true }).click()
  await page.getByRole('button', { name: 'Remove path', exact: true }).click()
  await expect(page.getByText('No movie libraries configured.', { exact: true })).toBeVisible()
  await expect(page.locator('.library-metrics')).toHaveCount(0)
})

test('ordinary members and statistics-only viewers cannot request manager statistics @desktop', async ({ page }) => {
  for (const permissions of [[], ['statistics.view']]) {
    await page.unrouteAll({ behavior: 'wait' })
    const state = await boot(page, { permissions })
    await expect(page).toHaveURL(/\/settings\/account$/)
    expect(state.requests).not.toContain('/api/v1/libraries/statistics')
  }
})

for (const action of ['permission loss', 'logout']) {
  test(`folder statistics discard in-flight responses after ${action} @desktop`, async ({ page }) => {
    const state = await boot(page)
    await expect(page.locator('.library-metrics')).toHaveCount(1)
    state.hold = true
    await page.getByRole('button', { name: 'Refresh library statistics', exact: true }).click()
    await expect.poll(() => state.pending.length).toBe(1)
    await page.evaluate(async action => {
      const { useAuthStore } = await import('/src/stores/auth.js')
      const auth = useAuthStore()
      if (action === 'logout') await auth.logout()
      else auth.setMe({ ...auth.me, permissions: [] })
    }, action)
    for (const route of state.pending) await reply(route, { libraries: state.rows() })
    await expect(page.locator('.library-metrics')).toHaveCount(0)
  })
}

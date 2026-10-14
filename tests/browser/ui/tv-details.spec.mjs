import { test, expect } from '@playwright/test'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
const crew = [{ person: { id: 10, name: 'Composer Example' }, roles: [{ job: 'Composer', department: 'Sound' }] }]
const show = { id: 8, seriesName: 'The Observatory', genre: '["Drama","Mystery"]', tmdbid: 123, tvdbid: 456, imdbid: 'tt1234567', status: 'Returning Series', overview: 'A team of astronomers discovers a signal from beyond the solar system.', credits: { cast: [], crew } }
const episodes = [1, 2, 3].map(number => ({ id: number, episodeName: `Secret title ${number}`, overview: `Secret synopsis ${number}`, airedSeason: '1', airedEpisodeNumber: String(number), runtime: 45, Files: [{ id: number, duration: 2700 }], TrackEpisodes: [{ progress: number === 1 ? 1 : 0, time: 0 }] }))
async function boot (page, path, handler, spoilers = 'off', permissions = []) {
  await page.route('**oblecto.test/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (await handler(route, url)) return
    if (url.pathname === '/api/v1/me') return reply(route, { id: 1, username: 'viewer', preferences: { episodeSpoilers: spoilers }, permissions })
    if (/\/(poster|fanart|banner)$/.test(url.pathname)) return route.fulfill({ status: 404, headers })
    if (url.pathname.endsWith('/related')) return reply(route, { items: [] })
    return reply(route, [])
  })
  await page.addInitScript(() => {
    localStorage.setItem('oblecto.accessToken', 'test-token')
    localStorage.setItem('oblecto.host', 'http://oblecto.test')
  })
  await page.goto(path)
}
async function spyPlayback (page) {
  await page.evaluate(async () => {
    const { useAppStore } = await import('/src/stores/app.js')
    window.episodePlays = []
    useAppStore().playEpisode = (...args) => window.episodePlays.push(args)
  })
}

test('@desktop @phone series additions preserve focused actions, saved lists, scoped season tools without library diagnostics', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const state = { favourite: false, watchlist: false }
  const rows = structuredClone(episodes)
  const writes = []
  const browse = []
  let failSeason = true
  await boot(page, '/series/8', async (route, url) => {
    if (url.pathname === '/series/8/info') { await reply(route, { ...show, userState: state }); return true }
    if (url.pathname === '/series/8/episodes') { await reply(route, rows); return true }
    if (url.pathname === '/series/8/extras') {
      await reply(route, { trailers: [{ name: 'Trailer', site: 'YouTube', key: 'abc123DEF_-' }], certifications: [{ country: 'DE', certification: '12' }], unavailable: false, catalogUpdatedAt: '2026-10-10', catalog: { episodes: [
        ...rows.map(row => ({ tmdbid: row.id, season: 1, number: Number(row.airedEpisodeNumber), name: row.episodeName, airDate: '2026-01-01' })),
        { tmdbid: 4, season: 1, number: 4, name: 'Missing reveal', airDate: '2026-01-01' },
        { tmdbid: 5, season: 2, number: 1, name: 'Future reveal', airDate: '2099-01-01' },
        { tmdbid: 6, season: 2, number: 2, name: 'TBA reveal', airDate: null }
      ] } }); return true
    }
    for (const field of ['favourite', 'watchlist']) if (url.pathname === `/series/8/${field}`) {
      state[field] = route.request().postDataJSON()[field]; await reply(route, { [field]: state[field] }); return true
    }
    if (url.pathname === '/series/8/seasons/1/watched') {
      writes.push(route.request().postDataJSON())
      if (failSeason) await reply(route, { message: 'Temporary failure' }, 503)
      else {
        for (const row of rows) row.TrackEpisodes = [{ progress: 1, time: 0, updatedAt: new Date().toISOString() }]
        await reply(route, { watched: true, episodes: rows.map(row => ({ id: row.id, track: row.TrackEpisodes[0] })) })
      }
      return true
    }
    if (url.searchParams.get('mode') === 'browse') {
      browse.push(url.searchParams.get('list')); await reply(route, { items: [show], facets: { genres: [] }, pageInfo: { hasNextPage: false } }); return true
    }
  })
  await expect(page.getByRole('heading', { name: show.seriesName, exact: true })).toBeVisible()
  await expect(page.locator('.detail-hero')).toHaveClass(/focused/)
  await expect(page.getByText('1 of 3 library episodes watched', { exact: true })).toBeVisible()
  await expect(page.getByText(/announced episodes watched/)).toHaveCount(0)
  await expect(page.getByText('Episode availability')).toHaveCount(0)
  await expect(page.getByText('About 1h 30m remaining', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add to watchlist', exact: true }).click()
  await page.getByRole('button', { name: 'More series actions', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Library tools', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add to favourites', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'More series actions', exact: true })).toBeFocused()
  const seasonMenu = page.getByRole('button', { name: 'Actions for season 1', exact: true })
  await seasonMenu.click()
  await spyPlayback(page)
  await page.getByRole('button', { name: 'Play first unwatched', exact: true }).click()
  expect(await page.evaluate(() => window.episodePlays)).toEqual([[2]])
  await seasonMenu.click()
  await page.getByRole('button', { name: 'Mark season watched', exact: true }).click()
  await expect(page.getByText('Mark all 3 library episodes in season 1 watched?', { exact: true })).toBeVisible()
  expect(writes).toEqual([])
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.locator('.season-error')).toBeVisible()
  failSeason = false
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('3 of 3 library episodes watched', { exact: true })).toBeVisible()
  await expect(seasonMenu).toHaveAttribute('aria-expanded', 'false')
  await page.getByLabel('Certification region').selectOption('DE')
  await expect(page.locator('.regional-certification')).toContainText('12')
  await page.getByText('Full crew (1)', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Composer Example', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('series-additions.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Remove from watchlist', exact: true })).toBeVisible()
  await page.locator('.back-link').click()
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click()
  await expect(page).toHaveURL(/library\/series\?list=watchlist/)
  await expect.poll(() => browse.at(-1)).toBe('watchlist')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Watchlist', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('@desktop @phone episode spoilers cover hero and nearby previews while chapters play the chosen offset', async ({ page }, testInfo) => {
  const errors = []
  const banners = []
  let favourite = false
  page.on('pageerror', error => errors.push(error.message))
  await boot(page, '/episode/2', async (route, url) => {
    if (url.pathname === '/episode/2/info') {
      await reply(route, { ...episodes[1], Series: show, imdbid: 'tt2222222', tvdbid: 789, credits: { cast: [], crew }, userState: { favourite }, TrackEpisodes: [{ progress: 0.5, time: 1350 }], Files: [{ id: 20, name: 'Episode.mkv', duration: 2700, chapters: [{ start: 0, end: 90, title: 'Cold open' }, { start: 90, end: 2700, title: 'The secret' }] }] }); return true
    }
    if (url.pathname === '/episode/2/context') {
      await reply(route, { previous: episodes[0], next: episodes[2], nextUnwatched: episodes[2], nearby: episodes, season: { number: 1, position: 2, episodeCount: 3, watchedCount: 1, runtimeMinutes: 135 } }); return true
    }
    if (url.pathname === '/episode/2/favourite') { favourite = route.request().postDataJSON().favourite; await reply(route, { favourite }); return true }
    if (/\/episode\/\d+\/banner$/.test(url.pathname)) banners.push(url.pathname)
  }, 'hide-titles')
  await expect(page.getByRole('heading', { name: 'Episode 2', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(/Episode 2/)
  await expect(page.getByText('23 min left', { exact: true })).toBeVisible()
  await expect(page.getByText(/Finish at/)).toBeVisible()
  await expect(page.locator('.detail-hero .detail-backdrop')).toHaveCount(0)
  await expect(page.locator('.nearby-episodes .current')).toContainText('Current episode')
  await expect(page.getByRole('link', { name: 'Next › S1 E3 · Episode 3' })).toBeVisible()
  expect(banners).not.toContain('/episode/2/banner')
  expect(banners).not.toContain('/episode/3/banner')
  await page.getByText('Chapters 2', { exact: true }).click()
  await expect(page.getByRole('button', { name: /01:30 Chapter 2/ })).toBeVisible()
  await expect(page.getByText('The secret', { exact: true })).toHaveCount(0)
  await spyPlayback(page)
  await page.getByRole('button', { name: /01:30 Chapter 2/ }).click()
  expect(await page.evaluate(() => window.episodePlays)).toEqual([[2, { fileId: 20, position: 90 }]])
  await page.getByRole('button', { name: 'Spoilers hidden · Reveal episode details', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Secret title 2', exact: true })).toBeVisible()
  await expect(page.getByText('Secret synopsis 2', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Next › S1 E3 · Episode 3' })).toBeVisible()
  await page.getByRole('button', { name: 'Add to favourites', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove from favourites', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Secret title 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'More episode actions', exact: true }).click()
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  expect(await page.evaluate(() => window.episodePlays)).toEqual([[2, { fileId: 20, position: 90 }], [2, { position: 0 }]])
  await expect(page.getByRole('link', { name: 'TMDB ↗', exact: true })).toHaveAttribute('href', 'https://www.themoviedb.org/tv/123/season/1/episode/2')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('episode-additions.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Episode 2', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove from favourites', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})


test('@desktop @phone library workspace compares episode orders, separates specials, and respects spoiler preferences', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const local = { id: 1, tmdbid: 5892111, airedSeason: '2', airedEpisodeNumber: '1', episodeName: 'Maomao and Maomao', Files: [{ id: 1 }] }
  const catalog = { tmdbid: 5892111, season: 1, number: 25, name: local.episodeName, airDate: '2025-01-10' }
  const result = { series: { ...show, seriesName: 'The Apothecary Diaries' }, catalogAvailable: true, catalogUpdatedAt: '2026-10-10', unavailable: false, rows: [
    { key: 'local-1', local, catalog, special: false, status: 'matched', reason: 'Exact TMDB episode ID' },
    { key: 'catalog-1', local: null, catalog: { ...catalog, tmdbid: 10, number: 1, name: 'Absent episode' }, special: false, status: 'absent', reason: 'No library episode with this TMDB ID' },
    { key: 'catalog-2', local: null, catalog: { ...catalog, tmdbid: 11, season: 0, number: 1, name: 'Special episode' }, special: true, status: 'absent', reason: 'No library episode with this TMDB ID' },
    { key: 'local-2', local: { ...local, id: 2, tmdbid: null, airedEpisodeNumber: '2', episodeName: 'Unknown episode' }, catalog: null, special: false, status: 'review', reason: 'No TMDB episode ID' },
    { key: 'catalog-3', local: null, catalog: { ...catalog, number: 49, name: 'Future episode', airDate: '2099-01-01' }, special: false, status: 'upcoming', reason: 'Future air date in TMDB' }
  ] }
  let fail = true
  await boot(page, '/series/8', async (route, url) => {
    if (url.pathname === '/series/8/info') { await reply(route, show); return true }
    if (url.pathname === '/series/8/episodes') { await reply(route, episodes); return true }
    if (url.pathname === '/series/8/extras') { await reply(route, { trailers: [], certifications: [] }); return true }
    if (url.pathname === '/series/8/library') { await reply(route, fail ? {} : result, fail ? 503 : 200); return true }
  }, 'hide-titles', ['libraries.manage'])
  await page.getByRole('button', { name: 'More series actions', exact: true }).click()
  await page.getByRole('link', { name: 'Library tools', exact: true }).click()
  await expect(page.getByText('Episode matching couldn’t be loaded.')).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('1 library episode matched by ID', { exact: true })).toBeVisible()
  await expect(page.getByText('Maomao and Maomao')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show episode titles' }).click()
  await expect(page.locator('.match-results')).toContainText('Maomao and Maomao')
  await expect(page.locator('.match-results')).toContainText('S2 E1')
  await expect(page.locator('.match-results')).toContainText('S1 E25')
  await page.locator('.match-results summary').click()
  await expect(page.locator('.match-results').getByText('Library TMDB ID', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Not in library 1', exact: true }).click()
  await expect(page.locator('.match-results')).toContainText('Absent episode')
  await expect(page.locator('.match-results')).not.toContainText('Special episode')
  await expect(page.locator('.match-results')).not.toContainText('Future episode')
  await page.getByRole('button', { name: 'Needs review 1', exact: true }).click()
  await expect(page.locator('.match-results')).toContainText('Unknown episode')
  await page.getByText('Specials · 1 entry', { exact: true }).click()
  await expect(page.getByText('Special episode', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('series-library-workspace.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Needs review 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Unknown episode', { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('@desktop @phone regular viewers cannot open the library workspace', async ({ page }) => {
  let requested = false
  await boot(page, '/settings/libraries/series/8', async (route, url) => {
    if (url.pathname === '/series/8/library') { requested = true; await reply(route, {}); return true }
  })
  await expect(page).toHaveURL(/settings\/account/)
  expect(requested).toBe(false)
})

import { test, expect } from '@playwright/test'

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
const movie = { id: 1, movieName: 'Newly Arrived', runtime: 100 }
const olderMovie = { id: 2, movieName: 'Keep Watching', runtime: 100, TrackMovies: [{ time: 1200, progress: 0.2, updatedAt: '2026-01-01T12:00:00Z' }] }
const episode = { id: 3, episodeName: 'The Turning Point', airedSeason: 2, airedEpisodeNumber: 4, runtime: 42, Series: { id: 8, seriesName: 'The Long Road' }, TrackEpisodes: [{ time: 600, progress: 0.25, updatedAt: '2026-02-01T12:00:00Z' }] }

async function boot (page, path, handler = () => false) {
  await page.route('**oblecto.test/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (await handler(route, url)) return
    if (/\/(poster|fanart|banner)$/.test(url.pathname)) return route.fulfill({ status: 404, headers })
    if (url.pathname === '/api/v1/libraries/movies') return reply(route, [{ path: '/media/movies' }])
    if (url.pathname === '/movies/list/createdAt') return reply(route, [movie])
    if (url.searchParams.get('mode') === 'browse') return reply(route, { items: [movie], facets: { genres: ['Drama'] }, pageInfo: { hasNextPage: false } })
    return reply(route, [])
  })
  await page.addInitScript(() => {
    localStorage.setItem('oblecto.accessToken', 'test-token')
    localStorage.setItem('oblecto.host', 'http://oblecto.test')
  })
  await page.goto(path)
}

test('@desktop @phone Home waits for watch history, then features the most recently played unfinished item', async ({ page }) => {
  let heldEpisodes
  await boot(page, '/', async (route, url) => {
    if (url.pathname === '/movies/watching') { await reply(route, [olderMovie]); return true }
    if (url.pathname === '/episodes/watching') { heldEpisodes = route; return true }
    if (url.pathname === '/episodes/next') { await reply(route, [episode]); return true }
    return false
  })
  await expect.poll(() => Boolean(heldEpisodes)).toBe(true)
  await expect(page.locator('.hero-title')).toHaveCount(0)
  await reply(heldEpisodes, [episode])
  await expect(page.locator('.hero-title')).toHaveText(episode.episodeName)
  await expect(page.locator('.hero .eyebrow')).toContainText('CONTINUE WATCHING')
  await expect(page.locator('.hero .playback-button button').first()).toContainText('Resume')
  await page.locator('.hero').getByRole('link', { name: 'More Info' }).click()
  await expect(page).toHaveURL(/\/episode\/3$/)
})

test('@desktop @phone live progress can promote a different unfinished title', async ({ page }) => {
  await boot(page, '/', async (route, url) => {
    if (url.pathname === '/movies/watching') { await reply(route, [olderMovie]); return true }
    if (url.pathname === '/episodes/watching') { await reply(route, [episode]); return true }
    return false
  })
  await expect(page.locator('.hero-title')).toHaveText(episode.episodeName)
  await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/media.js')
    useMediaStore().applyProgress({ type: 'movie', id: 2, track: { time: 1800, progress: 0.3, updatedAt: '2026-03-01T12:00:00Z' } })
  })
  await expect(page.locator('.hero-title')).toHaveText(olderMovie.movieName)
  await expect(page.locator('.hero .eyebrow')).toContainText('CONTINUE WATCHING')
})

test('@desktop @phone Home uses Next Up, then silently falls back when SQLite reports it unavailable', async ({ page }) => {
  let nextAvailable = true
  await boot(page, '/', async (route, url) => {
    if (url.pathname === '/episodes/next') { await reply(route, nextAvailable ? [episode] : { error: 'Not supported' }, nextAvailable ? 200 : 501); return true }
    return false
  })
  await expect(page.locator('.hero-title')).toHaveText(episode.episodeName)
  await expect(page.locator('.hero .eyebrow')).toContainText('UP NEXT')
  nextAvailable = false
  await page.reload()
  await expect(page.locator('.hero-title')).toHaveText(movie.movieName)
  await expect(page.locator('.hero .eyebrow')).toContainText('NEW IN YOUR LIBRARY')
  await expect(page.getByText('Could not load next up.')).toHaveCount(0)
})

test('@desktop @phone Discover has dedicated popular and rated shelves', async ({ page }) => {
  await boot(page, '/discover', async (route, url) => {
    if (url.pathname === '/movies/list/popularity') { await reply(route, [movie]); return true }
    if (url.pathname === '/series/list/siteRating') { await reply(route, [{ id: 8, seriesName: 'Rated Show' }]); return true }
    return false
  })
  await expect(page.getByRole('heading', { name: 'Popular Movies' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Top Rated Series' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Recently Added/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Popular Films/ })).toBeVisible()
})

test('@desktop @phone Library keeps quick controls visible and counts loaded titles', async ({ page }) => {
  await boot(page, '/library/movies?sort=popularity', async (route, url) => {
    if (url.searchParams.get('mode') !== 'browse') return false
    if (url.searchParams.has('cursor')) await reply(route, { items: [{ ...movie, id: 4, movieName: 'Another Arrival' }], pageInfo: { hasNextPage: false } })
    else await reply(route, { items: [movie], facets: { genres: ['Drama'] }, pageInfo: { hasNextPage: true, nextCursor: 'next' } })
    return true
  })
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Watch state' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Sort direction' })).toBeHidden()
  await expect(page.getByText('Showing 1 title · more available')).toBeVisible()
  await page.getByRole('button', { name: 'Load More' }).click()
  await expect(page.getByText('Showing 2 titles')).toBeVisible()
  await page.getByRole('combobox', { name: 'Watch state' }).selectOption('watched')
  await expect(page).toHaveURL(/watched=watched/)
  await page.getByRole('button', { name: /Filters \(/ }).click()
  await expect(page.getByRole('combobox', { name: 'Sort direction' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('@desktop @phone four seasons show compact jump links and episode watch controls', async ({ page }) => {
  await boot(page, '/series/8?season=3', async (route, url) => {
    if (url.pathname === '/series/8/info') { await reply(route, { id: 8, seriesName: 'The Long Road' }); return true }
    if (url.pathname === '/series/8/episodes') {
      await reply(route, [1, 2, 3, 4].flatMap(season => Array.from({ length: 6 }, (_, index) => ({
        id: season * 10 + index + 1, airedSeason: String(season), airedEpisodeNumber: String(index + 1), episodeName: `Part ${season}.${index + 1}`, overview: 'This synopsis belongs on the detail page.', runtime: 42
      })))); return true
    }
    return false
  })
  await expect(page.getByRole('navigation', { name: 'Jump to season' }).getByRole('link')).toHaveCount(4)
  await expect(page.getByRole('region', { name: 'Season 3' }).getByRole('article')).toHaveCount(6)
  await expect(page.getByText('This synopsis belongs on the detail page.')).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Jump to season' }).getByRole('link', { name: 'Season 4' }).click()
  await expect(page).toHaveURL(/#show-season-4$/)
  const watch = page.getByRole('region', { name: 'Season 4' }).getByRole('button', { name: 'Mark Part 4.1 watched' })
  const box = await watch.boundingBox()
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

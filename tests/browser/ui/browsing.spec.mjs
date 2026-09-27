import { test, expect, chromium, firefox, webkit } from '@playwright/test'

const API = 'http://oblecto.test'
const movie = { id: 1, movieName: 'A very long movie title for testing the library layout', runtime: 100, TrackMovies: [{ time: 1200, progress: 0.2 }] }
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
async function boot (page, path = '/', handler = () => false, authenticated = true) {
  await page.route('**oblecto.test/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (await handler(route, url)) return
    if (/\/(poster|fanart|banner)$/.test(url.pathname)) return route.fulfill({ status: 404, headers })
    if (url.pathname === '/api/v1/libraries/movies') return reply(route, [{ path: '/media/movies' }])
    if (url.searchParams.get('mode') === 'browse') return reply(route, { items: [movie], facets: { genres: ['Drama'] }, pageInfo: { hasNextPage: false } })
    if (url.pathname === '/movies/list/createdAt') return reply(route, [movie])
    return reply(route, [])
  })
  await page.addInitScript(({ api, authenticated }) => {
    if (authenticated) localStorage.setItem('oblecto.accessToken', 'test-token')
    localStorage.setItem('oblecto.host', api)
  }, { api: API, authenticated })
  await page.goto(path)
}

test.describe('@desktop browsing', () => {
  test('partial home failure keeps resume shelves and retries independently', async ({ page }) => {
    let fails = true
    let movieRequests = 0
    await boot(page, '/', async (route, url) => {
      if (url.pathname === '/movies/watching') { movieRequests++; await reply(route, [movie]); return true }
      if (url.pathname === '/episodes/watching') { await reply(route, [{ id: 2, episodeName: 'An episode', TrackEpisodes: [{ time: 60, progress: 0.1 }] }]); return true }
      if (url.pathname === '/movies/list/createdAt') { await reply(route, fails ? {} : [movie], fails ? 500 : 200); return true }
      return false
    })
    await expect(page.getByRole('heading', { name: 'Continue Watching Movies' })).toBeVisible()
    await expect(page.getByText('Could not load recently added movies.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Resume · 80 min left/ }).first()).toBeVisible()
    const headings = await page.locator('.shelf h2').allTextContents()
    expect(headings.slice(0, 2)).toEqual(['Continue Watching Movies', 'Continue Watching Episodes'])
    fails = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { name: 'Recently Added Movies' })).toBeVisible()
    expect(movieRequests).toBe(1)
  })

  test('search ignores earlier responses and clearing invalidates pending searches', async ({ page }) => {
    const held = []
    await boot(page, '/search?q=old', async (route, url) => {
      if (url.pathname.includes('/search/old')) { held.push(route); return true }
      if (url.pathname.includes('/search/new')) { await reply(route, url.pathname.startsWith('/movies/') ? [{ ...movie, movieName: 'New result' }] : []); return true }
      return false
    })
    await expect.poll(() => held.length).toBe(4)
    await page.getByRole('searchbox', { name: 'Search all media' }).fill('new')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText('1 result', { exact: true })).toBeVisible()
    for (const route of held.splice(0)) await reply(route, [{ ...movie, movieName: 'Old result' }])
    await expect(page.getByText('Old result', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'New result', exact: true })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search all media' }).fill('old')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect.poll(() => held.length).toBe(4)
    await page.getByRole('searchbox', { name: 'Search all media' }).fill('')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    for (const route of held) await reply(route, [movie])
    await expect(page.locator('.shelf')).toHaveCount(0)
    await expect(page.getByText('Searching the catalog…')).toHaveCount(0)
  })

  test('pagination retries retain existing cards', async ({ page }) => {
    let fails = true
    await boot(page, '/library/movies', async (route, url) => {
      if (url.searchParams.get('mode') !== 'browse') return false
      if (url.searchParams.has('cursor')) await reply(route, fails ? {} : { items: [{ ...movie, id: 2, movieName: 'Second movie' }], pageInfo: { hasNextPage: false } }, fails ? 500 : 200)
      else await reply(route, { items: [movie], pageInfo: { hasNextPage: true, nextCursor: 'next' } })
      return true
    })
    await page.getByRole('button', { name: 'Load More' }).click()
    await expect(page.getByRole('button', { name: 'Retry loading more' })).toBeVisible()
    await expect(page.locator('.results-grid .media-card')).toHaveCount(1)
    fails = false
    await page.getByRole('button', { name: 'Retry loading more' }).click()
    await expect(page.locator('.results-grid .media-card')).toHaveCount(2)
  })

  test('device selection is shared and disconnect restores local selection', async ({ page }) => {
    await boot(page)
    await page.evaluate(async () => {
      const state = await import('/src/remote/state.js')
      state.applyDevices([{ deviceId: 'tv', name: 'Living Room', capabilities: ['playback'], state: { status: 'idle' } }])
    })
    const picker = page.getByRole('combobox', { name: 'Playback device', exact: true })
    await picker.selectOption('tv')
    await expect(picker).toHaveValue('tv')
    await expect(page.getByRole('button', { name: 'Resume · 80 min left on Living Room', exact: true })).toBeVisible()
    await expect(page.locator('.player-root')).toHaveCount(0)
    await expect(page.getByText('Playing on Living Room', { exact: true })).toHaveCount(0)
    await page.evaluate(async () => {
      const state = await import('/src/remote/state.js')
      state.applyDevices([{ deviceId: 'tv', name: 'Living Room', capabilities: ['playback'], state: { status: 'playing' } }])
    })
    await expect(page.locator('.playback-button .destination')).toHaveText('Living Room')
    await page.evaluate(async () => (await import('/src/remote/state.js')).applyDevices([]))
    await expect(picker).toHaveValue('local')
    await expect(page.locator('.playback-button .destination')).toHaveCount(0)
  })
})

test.describe('@phone browsing', () => {
  test('compact filters, selected chips, clear and URL navigation', async ({ page }, testInfo) => {
    await boot(page, '/library/movies')
    const toggle = page.getByRole('button', { name: 'Filters (0)', exact: true })
    await expect(toggle).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Watch state' })).toBeVisible()
    await toggle.click()
    await page.getByRole('combobox', { name: 'Watch state' }).selectOption('unwatched')
    await expect(page).toHaveURL(/watched=unwatched/)
    await expect(page.getByRole('button', { name: 'Remove unwatched filter' })).toBeVisible()
    await page.getByRole('button', { name: 'Drama', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Drama', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
    await expect(page).toHaveURL(/\/library\/movies$/)
    await page.getByRole('searchbox', { name: 'Filter titles' }).fill('test')
    await expect(page).toHaveURL(/q=test/)
    await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/library/movies?q=other'))
    await expect(page.getByRole('searchbox', { name: 'Filter titles' })).toHaveValue('other')
    await page.goBack()
    await expect(page.getByRole('searchbox', { name: 'Filter titles' })).toHaveValue('test')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const play = page.locator('.media-card .play-button').first()
    const box = await play.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: testInfo.outputPath('library-phone.png'), fullPage: true })
  })

  test('unconfigured and filtered empty states offer appropriate actions', async ({ page }) => {
    await boot(page, '/library/movies', async (route, url) => {
      if (url.pathname === '/api/v1/libraries/movies') { await reply(route, []); return true }
      if (url.searchParams.get('mode') === 'browse') { await reply(route, { items: [] }); return true }
      return false
    })
    await expect(page.getByRole('link', { name: 'Add a library' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Filter titles' }).fill('missing')
    await expect(page.getByText('No titles match these filters.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add a library' })).toHaveCount(0)
  })
})


test('@desktop library ignores stale filter responses', async ({ page }) => {
  let oldRequest
  await boot(page, '/library/movies?q=old', async (route, url) => {
    if (url.searchParams.get('mode') !== 'browse') return false
    if (url.searchParams.get('q') === 'old') { oldRequest = route; return true }
    await reply(route, { items: [{ ...movie, movieName: 'Current movie' }] })
    return true
  })
  await expect.poll(() => Boolean(oldRequest)).toBe(true)
  await page.getByRole('searchbox', { name: 'Filter titles' }).fill('new')
  await expect(page.getByRole('link', { name: 'Current movie', exact: true })).toBeVisible()
  await reply(oldRequest, { items: [{ ...movie, movieName: 'Stale movie' }] })
  await expect(page.getByRole('link', { name: 'Current movie', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Stale movie', exact: true })).toHaveCount(0)
})

test('@desktop resume labels match the player completion threshold', async ({ page }) => {
  await boot(page, '/library/movies', async (route, url) => {
    if (url.searchParams.get('mode') !== 'browse') return false
    await reply(route, { items: [
      { ...movie, movieName: 'In progress' },
      { ...movie, id: 2, movieName: 'Completed', TrackMovies: [{ time: 5700, progress: 0.95 }] },
      { ...movie, id: 3, movieName: 'Unknown duration', runtime: null }
    ] })
    return true
  })
  await expect(page.getByRole('button', { name: 'Resume · 80 min left In progress', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Watch again Completed', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Resume Unknown duration', exact: true })).toHaveCount(1)
})

test('@phone home handles missing artwork, keyboard focus and reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await expect(page.locator('.hero-title')).toContainText(movie.movieName)
  await expect(page.locator('.artwork-fallback').first()).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  const height = await page.locator('.hero').evaluate(node => getComputedStyle(node).minHeight)
  expect(height).toBe('360px')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('home-phone.png'), fullPage: true })
})

test('@desktop Discover empty state is independent of unrelated home errors', async ({ page }) => {
  await boot(page, '/discover', async (route, url) => {
    if (url.pathname === '/movies/watching') { await reply(route, {}, 500); return true }
    if (url.pathname === '/movies/list/createdAt') { await reply(route, []); return true }
    return false
  })
  await expect(page.getByText('No titles to discover yet.')).toBeVisible()
})

test('@phone login keeps configured server editable', async ({ page }) => {
  await boot(page, '/login', () => false, false)
  await expect(page.getByText(`Server address: ${API}`)).toBeVisible()
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Server address' })).toHaveValue(API)
})


test('@desktop library settings keep advanced options collapsed', async ({ page }, testInfo) => {
  await boot(page, '/settings/libraries', async (route, url) => {
    if (url.pathname === '/api/v1/system/capabilities') {
      await reply(route, { movies: { identifiers: [], updaters: [] }, tvshows: { seriesIdentifiers: [], episodeIdentifiers: [], seriesUpdaters: [], episodeUpdaters: [] } })
      return true
    }
    if (url.pathname.startsWith('/api/v1/settings/')) { await reply(route, {}); return true }
    return false
  })
  await expect(page.getByRole('button', { name: 'Add movie library' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '/media/movies', exact: true })).toBeVisible()
  await expect(page.getByText('Identifiers', { exact: true })).toBeHidden()
  await page.getByText('Advanced indexing options', { exact: true }).first().click()
  await expect(page.getByText('Identifiers', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('settings-desktop.png'), fullPage: true })
})

test('@desktop @phone split play button separates playback from device selection', async ({ page }, testInfo) => {
  await boot(page)
  await page.evaluate(async () => {
    const { applyDevices } = await import('/src/remote/state.js')
    applyDevices([{ deviceId: 'tv', name: 'Living Room', capabilities: ['playback'], state: { status: 'idle' } }])
    window.playActions = []
    const { useAppStore } = await import('/src/stores/app.js')
    useAppStore().playMovie = async id => { window.playActions.push(['playMovie', id]) }
  })
  const picker = page.getByRole('combobox', { name: 'Playback device', exact: true })
  await picker.selectOption('tv')
  expect(await page.evaluate(() => window.playActions)).toEqual([])
  const play = page.getByRole('button', { name: 'Resume · 80 min left on Living Room', exact: true })
  await play.focus()
  await page.keyboard.press('Tab')
  await expect(picker).toBeFocused()
  const trigger = await picker.boundingBox()
  const action = await play.boundingBox()
  expect(trigger.width).toBeGreaterThanOrEqual(44)
  expect(trigger.height).toBeGreaterThanOrEqual(44)
  expect(Math.abs(trigger.x - action.x - action.width)).toBeLessThanOrEqual(2)
  await play.click()
  expect(await page.evaluate(() => window.playActions)).toEqual([['playMovie', 1]])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('split-play-button.png'), fullPage: true })
})

for (const browserName of ['chromium', 'firefox', 'webkit']) {
  test.describe(`${browserName} split button layout`, () => {
    test('@desktop split button reserves room for short and resume labels', async ({ baseURL }, testInfo) => {
      const browser = await ({ chromium, firefox, webkit })[browserName].launch()
      const page = await browser.newPage({ baseURL })
      try {
        let currentMovie = { ...movie, TrackMovies: [] }
        await boot(page, '/', async (route, url) => {
          if (url.pathname === '/movies/list/createdAt' || url.pathname === '/movie/1/info') {
            await reply(route, url.pathname.endsWith('/info') ? currentMovie : [currentMovie])
            return true
          }
          return false
        })
        for (const width of [1280, 1024, 800, 390]) {
          await page.setViewportSize({ width, height: 900 })
          for (const label of ['Play', 'Resume · 80 min left']) {
            currentMovie = label === 'Play' ? { ...movie, TrackMovies: [] } : movie
            for (const path of ['/', '/movie/1']) {
              await page.goto(path)
              await expect(page.locator('.playback-button .copy > span').first()).toHaveText(label)
              const layout = await page.locator('.playback-button').evaluate(node => {
                const label = node.querySelector('.copy > span')
                const range = document.createRange()
                range.selectNodeContents(label)
                const text = range.getBoundingClientRect()
                const play = node.querySelector('.play').getBoundingClientRect()
                const arrow = node.querySelector('.device-toggle').getBoundingClientRect()
                const button = node.getBoundingClientRect()
                return { lines: range.getClientRects().length, textRight: text.right, playRight: play.right, arrowLeft: arrow.left, arrowRight: arrow.right, buttonRight: button.right }
              })
              expect(layout.lines, `${width}px ${path} ${label} stays on one line`).toBe(1)
              expect(layout.textRight, `${width}px ${path} ${label} fits inside play area`).toBeLessThanOrEqual(layout.playRight - 10)
              expect(layout.arrowLeft).toBeGreaterThanOrEqual(layout.playRight)
              expect(layout.arrowRight).toBeLessThanOrEqual(layout.buttonRight + 1)
            }
          }
        }
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.screenshot({ path: testInfo.outputPath('desktop-play-layout.png'), fullPage: true })
      } finally {
        await browser.close()
      }
    })
  })
}

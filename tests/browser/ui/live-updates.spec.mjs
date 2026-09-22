import { test, expect } from '@playwright/test'

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
const movie = { id: 1, movieName: 'Live movie', runtime: 100, TrackMovies: [{ time: 0, progress: 0, updatedAt: '2026-01-01T00:00:00.000Z' }] }
async function boot (page, path, handler) {
  await page.route('**oblecto.test/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (await handler(route, url)) return
    if (/\/(poster|fanart|banner)$/.test(url.pathname)) return route.fulfill({ status: 404, headers })
    if (url.pathname.startsWith('/api/v1/libraries/')) return reply(route, [{ path: '/media/movies' }])
    if (url.pathname === '/movie/1/info') return reply(route, movie)
    if (url.pathname.endsWith('/related')) return reply(route, { items: [] })
    return reply(route, [])
  })
  await page.addInitScript(() => {
    localStorage.setItem('oblecto.accessToken', 'test-token')
    localStorage.setItem('oblecto.host', 'http://oblecto.test')
  })
  await page.goto(path)
}

// Deliver through Socket.IO's inbound dispatcher so the production listeners run.
async function receive (page, event, payload) {
  await page.evaluate(async ({ event, payload }) => {
    const { getSocket } = await import('/src/socket.js')
    getSocket().emitEvent([event, payload])
  }, { event, payload })
}

test('@desktop @phone progress updates home cards and details, rejects old events, and reconnect restores saved state', async ({ page }) => {
  await boot(page, '/', async (route, url) => {
    if (url.pathname === '/movies/list/createdAt') { await reply(route, [movie]); return true }
    return false
  })
  const shelf = page.getByRole('region', { name: 'Recently Added Movies', exact: true })
  await expect(shelf.getByRole('link', { name: 'Live movie', exact: true })).toBeVisible()
  await receive(page, 'devices', [{ deviceId: 'tv', capabilities: ['playback'], state: {
    media: { kind: 'movie', id: '1' }, position: 3000, duration: 6000, updatedAt: Date.now()
  } }])
  await expect(shelf.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  await receive(page, 'media:progress', { type: 'movie', id: 1, track: { time: 1200, progress: 0.2, updatedAt: '2026-01-01T00:00:00.000Z' } })
  await expect(shelf.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  await shelf.getByRole('link', { name: 'Live movie', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume · 50 min left', exact: true })).toBeVisible()
  await receive(page, 'media:progress', { type: 'movie', id: 1, track: { time: 0, progress: 1, updatedAt: new Date(Date.now() + 1000).toISOString() } })
  await expect(page.getByRole('button', { name: 'Watch again', exact: true })).toBeVisible()
  await receive(page, 'connect')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('@desktop imports arriving during a home request are retained and events are batched', async ({ page }) => {
  // Keep the client's one-second request timeout from racing our assertions.
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  let held
  let requests = 0
  let imported = false
  await boot(page, '/', async (route, url) => {
    if (url.pathname !== '/movies/list/createdAt') return false
    requests++
    if (requests === 1) held = route
    else await reply(route, imported ? [movie, { id: 2, movieName: 'Just imported' }] : [movie])
    return true
  })
  await expect.poll(() => Boolean(held)).toBe(true)
  imported = true
  for (let i = 0; i < 8; i++) await receive(page, 'indexer', { event: 'added', type: 'movie', id: 2 })
  await page.clock.runFor(750)
  await expect.poll(() => page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/media.js')
    return useMediaStore().home.sections['recent-movies'].refreshPending
  })).toBe(true)
  await reply(held, [movie])
  await expect(page.getByRole('link', { name: 'Just imported', exact: true })).toBeVisible()
  expect(requests).toBe(2)
})

test('@desktop library refresh preserves filters and loaded pages', async ({ page }) => {
  const requests = []
  let imported = false
  await boot(page, '/library/movies?genre=Drama', async (route, url) => {
    if (url.searchParams.get('mode') !== 'browse') return false
    requests.push({ genre: url.searchParams.get('genre'), cursor: url.searchParams.get('cursor') })
    const second = url.searchParams.has('cursor')
    await reply(route, {
      items: second ? [{ id: 2, movieName: 'Second page movie' }] : [movie, ...(imported ? [{ id: 3, movieName: 'New arrival' }] : [])],
      facets: { genres: ['Drama'] }, pageInfo: { hasNextPage: !second, nextCursor: second ? null : 'page-two' }
    }); return true
  })
  await page.getByRole('button', { name: 'Load More', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Second page movie', exact: true })).toBeVisible()
  imported = true
  await receive(page, 'indexer', { event: 'added', type: 'movie', id: 3 })
  await expect(page.getByRole('link', { name: 'New arrival', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Second page movie', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/genre=Drama/)
  expect(requests).toEqual([
    { genre: 'Drama', cursor: null }, { genre: 'Drama', cursor: 'page-two' },
    { genre: 'Drama', cursor: null }, { genre: 'Drama', cursor: 'page-two' }
  ])
})

test('@desktop saved progress refreshes Continue Watching after live playback has already updated cards', async ({ page }) => {
  let saved = false
  let watchingRequests = 0
  await boot(page, '/', async (route, url) => {
    if (url.pathname === '/movies/list/createdAt') { await reply(route, [movie]); return true }
    if (url.pathname === '/movies/watching') {
      watchingRequests++
      await reply(route, saved ? [{ ...movie, TrackMovies: [{ time: 3000, progress: 0.5 }] }] : [])
      return true
    }
    return false
  })
  const recent = page.getByRole('region', { name: 'Recently Added Movies', exact: true })
  await expect(recent.getByRole('link', { name: 'Live movie', exact: true })).toBeVisible()
  const updatedAt = Date.now()
  await receive(page, 'devices', [{ deviceId: 'tv', capabilities: ['playback'], state: {
    media: { kind: 'movie', id: '1' }, position: 3000, duration: 6000, updatedAt
  } }])
  await expect(recent.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  await expect.poll(() => watchingRequests).toBe(2)
  saved = true
  await receive(page, 'media:progress', { type: 'movie', id: 1, track: { time: 3000, progress: 0.5, updatedAt: new Date(updatedAt + 1).toISOString() } })
  await expect(page.getByRole('region', { name: 'Continue Watching Movies', exact: true }).getByRole('link', { name: 'Live movie', exact: true })).toBeVisible()
  expect(watchingRequests).toBe(3)
})

test('@desktop downloaded artwork replaces a missing-image fallback without reloading the page', async ({ page }) => {
  await boot(page, '/', async (route, url) => {
    if (url.pathname === '/movies/list/createdAt') { await reply(route, [movie]); return true }
    if (url.pathname === '/movie/1/poster' && url.searchParams.has('v')) {
      await route.fulfill({ status: 200, headers, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15"><rect width="10" height="15" fill="blue"/></svg>' })
      return true
    }
    return false
  })
  const shelf = page.getByRole('region', { name: 'Recently Added Movies', exact: true })
  await expect(shelf.locator('.artwork-fallback')).toBeVisible()
  await receive(page, 'indexer', { event: 'artwork', type: 'movie', id: 1 })
  await expect(shelf.locator('img')).toBeVisible()
  await expect(shelf.locator('img')).toHaveAttribute('src', /\/poster\?v=\d+/)
  await expect(shelf.locator('.artwork-fallback')).toHaveCount(0)
})

test('@desktop seedbox transfer events update the Pinia-backed settings view', async ({ page }) => {
  await boot(page, '/settings/seedboxes', async (route, url) => {
    if (url.pathname === '/api/v1/status/seedbox') {
      await reply(route, { queue: { idle: true, length: 0, running: 0 } }); return true
    }
    return false
  })
  await expect(page.getByRole('heading', { name: 'Import Status', exact: true })).toBeVisible()
  await receive(page, 'seedbox', { event: 'import_progress', origin: 'new-movie.mkv', progress: 0.25 })
  await expect(page.getByText('25.0%', { exact: true })).toBeVisible()
  await receive(page, 'seedbox', { event: 'import_success', origin: 'new-movie.mkv' })
  await expect(page.getByText('Imported', { exact: true })).toBeVisible()
  await expect(page.getByText('25.0%', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear finished', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Transfers', exact: true })).toHaveCount(0)
})

test('@desktop @phone an open season receives new episodes and saved progress', async ({ page }) => {
  let imported = false
  await boot(page, '/series/1', async (route, url) => {
    if (url.pathname === '/series/1/info') { await reply(route, { id: 1, seriesName: 'Live show' }); return true }
    if (url.pathname === '/series/1/episodes') {
      await reply(route, [
        { id: 1, episodeName: 'Pilot', airedSeason: '1', airedEpisodeNumber: '1' },
        ...(imported ? [{ id: 2, episodeName: 'Fresh episode', airedSeason: '2', airedEpisodeNumber: '1' }] : [])
      ]); return true
    }
    return false
  })
  await expect(page.getByRole('link', { name: 'Pilot', exact: true })).toBeVisible()
  imported = true
  await receive(page, 'indexer', { event: 'added', type: 'episode', id: 2 })
  await expect(page.getByRole('link', { name: 'Fresh episode', exact: true })).toBeVisible()
  await receive(page, 'media:progress', { type: 'episode', id: 2, track: { time: 0, progress: 1, updatedAt: new Date().toISOString() } })
  await expect(page.getByRole('button', { name: 'Mark Fresh episode unwatched' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Season 2', exact: true }).getByText('1 episode · 1 watched')).toBeVisible()
})

test('@desktop sign-out clears Pinia data and late responses cannot restore it', async ({ page }) => {
  let held
  await boot(page, '/', async (route, url) => {
    if (url.pathname === '/movies/list/createdAt') { held = route; return true }
    return false
  })
  await expect.poll(() => Boolean(held)).toBe(true)
  await receive(page, 'media:progress', { type: 'movie', id: 1, track: { time: 100, progress: 0.1, updatedAt: new Date().toISOString() } })
  await page.evaluate(async () => {
    const { getSocket } = await import('/src/socket.js')
    window.signedOutSocket = getSocket()
    const { useAuthStore } = await import('/src/stores/auth.js')
    await useAuthStore().logout()
    window.signedOutSocket.emitEvent(['media:progress', { type: 'movie', id: 9, track: { time: 10, progress: 0.5, updatedAt: new Date().toISOString() } }])
    if (useAuthStore().isAuthenticated || getSocket()) throw new Error('Session was not cleared')
  })
  await reply(held, [movie])
  await expect.poll(() => page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/media.js')
    const store = useMediaStore()
    return { progress: store.progress, sections: store.home.sections }
  })).toEqual({ progress: {}, sections: {} })
  await expect(page.getByRole('link', { name: 'Live movie', exact: true })).toHaveCount(0)
})

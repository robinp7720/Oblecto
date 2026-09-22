import { test, expect } from '@playwright/test'

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
async function boot (page, path, handler) {
  await page.route('**oblecto.test/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (await handler(route, url)) return
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
const movie = { id: 1, movieName: 'Arrival', genres: '["Drama"]', siteRating: 8, siteRatingSource: 'tvdb', Files: [] }

test('@desktop @phone detail title renders while collections are pending and retries only the failed section', async ({ page }) => {
  let held
  let infoRequests = 0
  let setsRequests = 0
  await boot(page, '/movie/1', async (route, url) => {
    if (url.pathname === '/movie/1/info') { infoRequests++; await reply(route, movie); return true }
    if (url.pathname === '/movie/1/sets') {
      setsRequests++
      if (setsRequests === 1) held = route
      else await reply(route, [])
      return true
    }
    return false
  })
  await expect(page.getByRole('heading', { name: 'Arrival', exact: true })).toBeVisible()
  await expect(page.getByText('TVDB 8', { exact: true })).toBeVisible()
  await expect(page.getByText('Loading collections…')).toBeVisible()
  await reply(held, {}, 503)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('This content is unavailable. Please try again.')).toHaveCount(0)
  expect(infoRequests).toBe(1)
  expect(setsRequests).toBe(2)
  await page.getByRole('link', { name: 'Drama', exact: true }).click()
  await expect(page).toHaveURL(/library\/movies\?genre=Drama/)
})

test('@desktop @phone series suggests the latest unfinished episode and falls back from fanart to poster', async ({ page }) => {
  const imageRequests = []
  await boot(page, '/series/1', async (route, url) => {
    if (/\/(fanart|poster)$/.test(url.pathname)) imageRequests.push(url.pathname)
    if (url.pathname === '/series/1/info') { await reply(route, { id: 1, seriesName: 'Example show', siteRating: 7 }); return true }
    if (url.pathname === '/series/1/episodes') {
      await reply(route, [
        { id: 1, episodeName: 'Old episode', airedSeason: '1', airedEpisodeNumber: '1', TrackEpisodes: [{ progress: 0.5, time: 100, updatedAt: '2026-01-01' }] },
        { id: 2, episodeName: 'Continue here', airedSeason: '2', airedEpisodeNumber: '1', TrackEpisodes: [{ progress: 0.3, time: 200, updatedAt: '2026-02-01' }] },
        { id: 3, episodeName: 'Special', airedSeason: '0', airedEpisodeNumber: '1', TrackEpisodes: [{ progress: 0.1, time: 100, updatedAt: '2026-03-01' }] }
      ]); return true
    }
    return false
  })
  await expect(page.getByRole('button', { name: 'Resume S2 E1', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Season 1', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Season 2', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Specials', exact: true })).toBeVisible()
  await expect(page.locator('.detail-subtitle')).toContainText('Community rating 7')
  await expect.poll(() => imageRequests.includes('/series/1/fanart') && imageRequests.includes('/series/1/poster')).toBe(true)
  await expect(page.locator('.detail-backdrop')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Old episode', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume S2 E1', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const { applyDevices } = await import('/src/remote/state.js')
    applyDevices([{ deviceId: 'other', capabilities: ['playback'], state: {
      media: { kind: 'episode', id: '2' }, position: 950, duration: 1000, updatedAt: Date.now()
    } }])
  })
  await expect(page.getByRole('button', { name: 'Resume S1 E1', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Season 2', exact: true }).getByText('1 episode · 1 watched')).toBeVisible()

})

test('@desktop @phone movie explains recommendations and summarizes playable media', async ({ page }) => {
  let watchedBody
  await boot(page, '/movie/1', async (route, url) => {
    if (url.pathname === '/movie/1/info') {
      await reply(route, {
        ...movie,
        TrackMovies: [{ progress: 1, time: 0 }],
        credits: { cast: Array.from({ length: 11 }, (_, index) => ({ person: { id: index + 10, name: `Person ${index + 1}` }, character: 'Character' })), crew: [] },
        Files: [{ id: 1, Streams: [
        { codec_type: 'video', width: 3840, color_transfer: 'smpte2084' },
        { codec_type: 'audio', channels: 6, tags_language: 'eng' }
        ] }]
      }); return true
    }
    if (url.pathname === '/movie/1/sets') { await reply(route, []); return true }
    if (url.pathname === '/movie/1/related') {
      await reply(route, { items: [{ ...movie, id: 2, movieName: 'Connected title', relationship: { sharedPeople: [{ id: 4, name: 'Amy Adams' }] } }] }); return true
    }
    if (url.pathname === '/movie/1/watched' && route.request().method() === 'PUT') {
      watchedBody = route.request().postDataJSON()
      await reply(route, { watched: false, track: { progress: 0, time: 0 } }); return true
    }
    return false
  })
  await expect(page.getByText('4K', { exact: true })).toBeVisible()
  await expect(page.getByText('HDR10', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'With Amy Adams', exact: true })).toHaveAttribute('href', '/person/4')
  await expect(page.getByRole('button', { name: 'Watch again', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mark unwatched', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mark watched', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Person 11/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show all 11', exact: true }).click()
  await expect(page.getByRole('link', { name: /Person 11/ })).toBeVisible()
  expect(watchedBody).toEqual({ watched: false })
})

test('@desktop @phone series filters every season from URL state and changes watch status on the card', async ({ page }) => {
  const watchBodies = []
  await boot(page, '/series/1?season=1&q=Return&watched=watched', async (route, url) => {
    if (url.pathname === '/series/1/info') { await reply(route, { id: 1, seriesName: 'Searchable show' }); return true }
    if (url.pathname === '/series/1/episodes') {
      await reply(route, [
        { id: 1, episodeName: 'Pilot', overview: 'The story starts.', airedSeason: '1', airedEpisodeNumber: '1', TrackEpisodes: [] },
        { id: 2, episodeName: 'The Return', overview: 'Back together.', airedSeason: '2', airedEpisodeNumber: '1', TrackEpisodes: [{ progress: 1, time: 0 }] }
      ]); return true
    }
    if (url.pathname === '/episode/1/watched' && route.request().method() === 'PUT') {
      watchBodies.push(route.request().postDataJSON())
      if (watchBodies.length === 1) await reply(route, {}, 503)
      else await reply(route, { watched: true, track: { progress: 1, time: 0 } })
      return true
    }
    return false
  })
  await expect(page.getByLabel('Watch state')).toHaveValue('watched')
  await expect(page.getByRole('link', { name: 'The Return', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pilot', exact: true })).toHaveCount(0)
  await expect(page.getByText('1 match across all seasons', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page).toHaveURL(/season=1/)
  await expect(page).not.toHaveURL(/(?:\?|&)q=/)
  await expect(page).not.toHaveURL(/(?:\?|&)watched=/)
  await expect(page.getByRole('link', { name: 'Pilot', exact: true })).toBeVisible()
  const pilot = page.getByRole('article').filter({ has: page.getByRole('link', { name: 'Pilot', exact: true }) })
  await pilot.getByRole('button', { name: 'Mark Pilot watched', exact: true }).click()
  await expect(pilot.getByRole('status')).toBeVisible()
  await expect(pilot.getByRole('button', { name: 'Mark Pilot watched', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await pilot.getByRole('button', { name: 'Mark Pilot watched', exact: true }).click()
  await expect(pilot.getByRole('button', { name: 'Mark Pilot unwatched', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Season 1', exact: true }).getByText('1 episode · 1 watched')).toBeVisible()
  expect(watchBodies).toEqual([{ watched: true }, { watched: true }])
})

test('@desktop @phone all season shelves scroll independently and season links reveal the requested row', async ({ page }, testInfo) => {
  await boot(page, '/series/1?season=2', async (route, url) => {
    if (url.pathname === '/series/1/info') {
      await reply(route, { id: 1, seriesName: 'The Long Way Home', overview: 'A small crew follows a mysterious signal beyond the edge of the known world.', genre: '["Drama", "Adventure"]', network: 'Oblecto' }); return true
    }
    if (url.pathname === '/series/1/episodes') {
      await reply(route, [1, 2, 0].flatMap(season => Array.from({ length: season === 0 ? 2 : 8 }, (_, index) => ({
        id: season * 10 + index + 1, episodeName: ['The Signal', 'Open Water', 'A Familiar Voice', 'The Crossing', 'After the Storm', 'On the Horizon', 'A Place to Stay', 'Home Again'][index],
        airedSeason: String(season), airedEpisodeNumber: String(index + 1), runtime: 42,
        overview: 'An unexpected discovery sends the crew in a new direction. Old promises begin to surface.',
        TrackEpisodes: index === 0 ? [{ progress: 1, time: 0 }] : []
      })))); return true
    }
    return false
  })
  const first = page.getByRole('region', { name: 'Season 1', exact: true })
  const second = page.getByRole('region', { name: 'Season 2', exact: true })
  await expect(second.getByRole('heading')).toBeInViewport()
  await expect.poll(async () => {
    const heading = await second.getByRole('heading').boundingBox()
    const header = await page.locator('.shell-header').boundingBox()
    return heading.y >= header.y + header.height
  }).toBe(true)
  await expect(first.getByRole('article')).toHaveCount(8)
  await expect(second.getByRole('article')).toHaveCount(8)
  await expect(page.getByRole('region', { name: 'Specials', exact: true }).getByRole('article')).toHaveCount(2)
  await expect(page.getByLabel('Watch state')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Mark season watched' })).toHaveCount(0)
  await second.getByRole('button', { name: 'More episodes in Season 2', exact: true }).click()
  await expect.poll(() => second.locator('.track').evaluate(el => el.scrollLeft)).toBeGreaterThan(100)
  expect(await first.locator('.track').evaluate(el => el.scrollLeft)).toBeLessThanOrEqual(2)
  await second.locator('.track').focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => second.locator('.track').evaluate(el => el.scrollLeft)).toBeLessThanOrEqual(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await second.getByRole('heading').click()
  await page.screenshot({ path: testInfo.outputPath('season-shelves.png'), fullPage: true })
  await page.getByRole('button', { name: 'Find an episode', exact: true }).click()
  await page.getByLabel('Find an episode', { exact: true }).fill('S02E05')
  await expect(page.getByText('1 match across all seasons', { exact: true })).toBeVisible()
  await expect(second.getByRole('link', { name: 'After the Storm', exact: true })).toBeVisible()
})

test('@desktop @phone episode shows season context and adjacent navigation', async ({ page }) => {
  await boot(page, '/episode/2', async (route, url) => {
    if (url.pathname === '/episode/2/info') {
      await reply(route, { id: 2, episodeName: 'Middle', airedSeason: '1', airedEpisodeNumber: '2', Series: { id: 8, seriesName: 'Show' }, Files: [] }); return true
    }
    if (url.pathname === '/episode/2/context') {
      await reply(route, {
        previous: { id: 1, episodeName: 'Before', airedSeason: '1', airedEpisodeNumber: '1' },
        next: { id: 3, episodeName: 'After', airedSeason: '1', airedEpisodeNumber: '3' },
        season: { number: '1', position: 2, episodeCount: 8, watchedCount: 1, runtimeMinutes: 360, averageRating: 8.2 }
      }); return true
    }
    return false
  })
  await expect(page.getByText(/Season 1 · Episode 2 of 8/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Previous.*Before/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Next.*After/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'All episodes', exact: true })).toHaveAttribute('href', '/series/8?season=1')
})

test('@desktop detail navigation discards stale collections and related-title responses', async ({ page }) => {
  let heldSets
  let heldRelated
  await boot(page, '/movie/1', async (route, url) => {
    if (url.pathname === '/movie/1/info') { await reply(route, movie); return true }
    if (url.pathname === '/movie/1/sets') { heldSets = route; return true }
    if (url.pathname === '/movie/1/related') { heldRelated = route; return true }
    if (url.pathname === '/movie/2/info') { await reply(route, { ...movie, id: 2, movieName: 'Current title' }); return true }
    return false
  })
  await expect.poll(() => Boolean(heldSets && heldRelated)).toBe(true)
  await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/movie/2'))
  await expect(page.getByRole('heading', { name: 'Current title', exact: true })).toBeVisible()
  await reply(heldSets, [{ id: 9, setName: 'Stale collection', Movies: [movie] }])
  await reply(heldRelated, { items: [{ ...movie, id: 3, movieName: 'Stale recommendation' }] })
  await expect(page.getByText('Stale collection')).toHaveCount(0)
  await expect(page.getByText('Stale recommendation')).toHaveCount(0)
})


test('@desktop detail navigation ignores a stale core response', async ({ page }) => {
  let held
  await boot(page, '/movie/1', async (route, url) => {
    if (url.pathname === '/movie/1/info') { held = route; return true }
    if (url.pathname === '/movie/2/info') { await reply(route, { ...movie, id: 2, movieName: 'Second title' }); return true }
    return false
  })
  await expect.poll(() => Boolean(held)).toBe(true)
  await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/movie/2'))
  await expect(page.getByRole('heading', { name: 'Second title', exact: true })).toBeVisible()
  await reply(held, movie)
  await expect(page.getByRole('heading', { name: 'Arrival', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Second title', exact: true })).toBeVisible()
})

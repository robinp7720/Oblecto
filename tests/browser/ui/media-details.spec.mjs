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
  await expect(page.getByLabel('Select season')).toHaveValue('2')
  await expect(page.locator('.detail-subtitle')).toContainText('Community rating 7')
  await expect.poll(() => imageRequests.includes('/series/1/fanart') && imageRequests.includes('/series/1/poster')).toBe(true)
  await expect(page.locator('.detail-backdrop')).toHaveCount(0)
  const seasonButton = page.getByRole('button', { name: /Season 1.*watched/ })
  if (await seasonButton.isVisible()) await seasonButton.click()
  else await page.getByLabel('Select season').selectOption('1')
  await expect(page.getByRole('link', { name: 'Old episode', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume S2 E1', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const { applyDevices } = await import('/src/remote/state.js')
    applyDevices([{ deviceId: 'other', capabilities: ['playback'], state: {
      media: { kind: 'episode', id: '2' }, position: 950, duration: 1000, updatedAt: Date.now()
    } }])
  })
  await expect(page.getByRole('button', { name: 'Resume S1 E1', exact: true })).toBeVisible()
  await expect(page.getByLabel('Select season')).toHaveValue('1')

})

test('@desktop @phone movie explains recommendations and summarizes playable media', async ({ page }) => {
  await boot(page, '/movie/1', async (route, url) => {
    if (url.pathname === '/movie/1/info') {
      await reply(route, { ...movie, Files: [{ id: 1, Streams: [
        { codec_type: 'video', width: 3840, color_transfer: 'smpte2084' },
        { codec_type: 'audio', channels: 6, tags_language: 'eng' }
      ] }] }); return true
    }
    if (url.pathname === '/movie/1/sets') { await reply(route, []); return true }
    if (url.pathname === '/movie/1/related') {
      await reply(route, { items: [{ ...movie, id: 2, movieName: 'Connected title', relationship: { sharedPeople: [{ id: 4, name: 'Amy Adams' }] } }] }); return true
    }
    return false
  })
  await expect(page.getByText('4K', { exact: true })).toBeVisible()
  await expect(page.getByText('HDR10', { exact: true })).toBeVisible()
  await expect(page.getByText('With Amy Adams', { exact: true })).toBeVisible()
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

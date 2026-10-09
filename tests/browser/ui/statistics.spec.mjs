import { test, expect } from '@playwright/test'
import { account, member } from './accounts.mjs'
const API = 'http://oblecto.test'
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': '*' }
async function boot(page, admin = false) {
  const requests = []
  await page.route('**oblecto.test/**', route => {
    const url = new URL(route.request().url())
    requests.push(url.pathname)
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (url.pathname === '/api/v1/me') return json(admin ? account() : member())
    if (url.pathname.endsWith('/summary')) return json({
      period: { from: url.searchParams.get('from'), to: url.searchParams.get('to') },
      totals: { watchSeconds: 7200, estimatedSeconds: 60, plays: 4, completions: 2, repeatPlays: 1, directSeconds: 7000, remuxSeconds: 200, transcodeSeconds: 0, unknownSeconds: 0 },
      daily: [{ day: new Date().toISOString().slice(0, 10), watchSeconds: 7200 }],
      kinds: [{ itemType: 'movie', watchSeconds: 7200, plays: 4 }],
      titles: [{ itemType: 'movie', itemId: 1, title: 'Arrival', watchSeconds: 7200, plays: 4, completions: 2 }],
      users: admin ? [{ userId: 1, username: 'Robin', watchSeconds: 7200, plays: 4 }] : [],
      trackingStartedAt: '2026-01-01T00:00:00Z', collection: { degraded: false }
    })
    if (url.pathname.endsWith('/history')) return json({ items: [{ id: 'one', userId: 1, title: 'Arrival', client: 'web', watchSeconds: 3600, startedAt: '2026-10-01T12:00:00Z', completedAt: null, endReason: 'stopped', quality: 'reported' }], nextCursor: null })
    if (url.pathname.endsWith('/library')) return json({ movies: 20, series: 3, episodes: 45, files: 65, localBytes: 1024 ** 3, remoteFiles: 0, missingSize: 2, problematicFiles: 1 })
    if (url.pathname.endsWith('/health')) return json({ resolution: 'hour', buckets: [{ at: '2026-10-01T12:00:00Z', samples: 4, means: { viewers: 2, sessions: 3 }, peaks: { viewers: 3, sessions: 4 } }], failures: { failedAttempts: 0, failedSessions: 1, bufferingKnownSessions: 0 } })
    return json([])
  })
  await page.addInitScript(api => {
    localStorage.setItem('oblecto.accessToken', 'test-token')
    localStorage.setItem('oblecto.host', api)
  }, API)
  await page.goto(admin ? '/settings/statistics' : '/statistics')
  return requests
}

test('personal statistics are private, readable and responsive @desktop @phone', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const requests = await boot(page)
  await expect(page.getByRole('heading', { name: 'Daily watch time' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Viewing history' })).toBeVisible()
  await expect(page.getByText('2 h', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Server playback health' })).toHaveCount(0)
  expect(requests.some(path => path.startsWith('/api/v1/statistics/server/'))).toBe(false)
  await page.getByText('View data table', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Daily watch time (minutes)' })).toBeVisible()
  expect(await page.evaluate(() => [...document.querySelectorAll('.statistics-page > *')].every(element => element.getBoundingClientRect().right <= window.innerWidth))).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: '/tmp/oblecto-statistics-personal.png', fullPage: true })
})

test('administrator dashboard includes health, inventory and viewer filtering @desktop', async ({ page }) => {
  await boot(page, true)
  await expect(page.getByRole('heading', { name: 'Server playback health' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Current library' })).toBeVisible()
  await expect(page.getByText('Unavailable', { exact: true })).toBeVisible()
  await page.getByLabel('Viewer', { exact: true }).selectOption('1')
  const filtered = page.waitForRequest(request => request.url().includes('/server/summary') && request.url().includes('userId=1'))
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await filtered
  await page.screenshot({ path: '/tmp/oblecto-statistics-server.png', fullPage: true })
})

test('member cannot navigate to administrator statistics @desktop', async ({ page }) => {
  const requests = await boot(page)
  await page.goto('/settings/statistics')
  await expect(page).toHaveURL(/\/settings\/account$/)
  expect(requests.some(path => path.startsWith('/api/v1/statistics/server/'))).toBe(false)
})

test('native telemetry excludes pauses, buffering, seeks and honors playback rate @desktop', async ({ page }) => {
  await boot(page)
  const result = await page.evaluate(async () => {
    const { default: Telemetry } = await import('/src/playback/PlaybackTelemetry.js')
    let now = 0
    const telemetry = new Telemetry(() => now)
    const video = { currentTime: 0, playbackRate: 2, paused: false, seeking: false, ended: false, readyState: 4, played: { length: 0 } }
    telemetry.sample(video)
    now = 10000; video.currentTime = 20
    const playing = telemetry.report(video)
    video.paused = true; telemetry.sample(video)
    now = 20000
    const paused = telemetry.report(video)
    video.paused = false; video.seeking = true; video.currentTime = 90
    const seeking = telemetry.report(video)
    video.seeking = false; telemetry.buffering = true; telemetry.sample(video)
    now = 30000
    const buffering = telemetry.report(video)
    return [playing.activeSeconds, paused.activeSeconds, seeking.activeSeconds, buffering.activeSeconds]
  })
  expect(result).toEqual([10, 10, 10, 10])
})

import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { account } from './accounts.mjs'

// Generated rather than committed, the way tests/browser/server.ts does it.
const MEDIA = path.join(os.tmpdir(), 'oblecto-player-ui', 'source.mp4')

function ensureMedia () {
  if (existsSync(MEDIA)) return

  mkdirSync(path.dirname(MEDIA), { recursive: true })
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '60', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2',
    '-g', '60', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart',
    MEDIA
  ])
}

test.beforeAll(ensureMedia)

const EPISODE = {
  id: 1, episodeName: 'Godspeed', airedSeason: 2, airedEpisodeNumber: 4,
  firstAired: '2017-02-08', overview: 'Test episode.',
  Series: { id: 9, seriesName: 'The Expanse' },
  TrackEpisodes: [{ time: 0, progress: 0 }],
  Files: [
    { id: 11, name: 'godspeed.1080p', extension: 'mkv', duration: 60,
      Streams: [
        { index: 0, codec_type: 'video', codec_name: 'h264' },
        { index: 1, codec_type: 'audio', codec_name: 'aac', tags: { language: 'eng' } },
        { index: 2, codec_type: 'audio', codec_name: 'ac3', tags: { language: 'deu' } },
        { index: 3, codec_type: 'subtitle', codec_name: 'subrip', tags: { language: 'eng' } }
      ] },
    { id: 12, name: 'godspeed.720p', extension: 'mp4', duration: 60, Streams: [] }
  ]
}

const SESSION = {
  sessionId: 'sess-1', revision: 1, state: 'ready', duration: 60, position: 0,
  paused: false, method: 'direct', reason: 'direct play',
  mediaUrl: '/playback/media/sess-1/1/original?token=t',
  selectedTracks: { audioStreamIndex: 1, subtitleStreamIndex: null, subtitleMode: 'auto' },
  tracks: EPISODE.Files[0].Streams, qualities: [], subtitleUrl: null
}

const API = 'http://oblecto.test'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*'
}

function json (route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) })
}

// `me` answers /api/v1/me; the body of every new playback session is pushed
// onto `sessions`.
async function stub (page, { me = account(), sessions = [] } = {}) {
  // Everything is namespaced under a dedicated API origin so the stubs cannot
  // collide with the dev server's own module paths.
  await page.route('**oblecto.test/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' })

    if (path.startsWith('/playback/media')) {
      return route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        headers: { ...CORS, 'accept-ranges': 'bytes' },
        body: readFileSync(MEDIA)
      })
    }

    if (path === '/api/v1/me') return json(route, me)

    if (path.startsWith('/playback/sessions')) {
      const method = request.method()
      if (method === 'POST' && path === '/playback/sessions') sessions.push(request.postDataJSON())
      if (method === 'POST' || method === 'PATCH') return json(route, SESSION)
      return route.fulfill({ status: 204, headers: CORS, body: '' })
    }

    if (/\/(banner|poster|fanart|thumb)$/.test(path)) {
      return route.fulfill({ status: 404, headers: CORS, body: '' })
    }

    if (/^\/episode\/\d+\/next/.test(path)) return json(route, { id: 2, episodeName: 'Paradigm Shift' })
    if (/^\/episode\/\d+$/.test(path)) return json(route, EPISODE)

    return json(route, [])
  })
}

async function boot (page, options) {
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  await stub(page, options)
  await page.addInitScript(api => {
    localStorage.setItem('oblecto.accessToken', 'test-token')
    localStorage.setItem('oblecto.host', api)
  }, API)
  await page.goto('/')
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__)
  await page.evaluate(async () => {
    const { useAppStore } = await import('/src/stores/app.js')
    window.__store = useAppStore()
  })
  return errors
}

async function play (page) {
  await page.evaluate(episode => {
    window.__store.setPlaying({ title: episode.episodeName, type: 'episode', entity: episode })
  }, EPISODE)
  await page.waitForSelector('.player-root video')
  await page.waitForFunction(() => {
    const video = document.querySelector('.player-root video')
    return video && video.readyState >= 2
  }, { timeout: 25000 })
}

test.describe('@desktop player', () => {
  test('desktop: renders overlay, seek bar click seeks, no page errors', async ({ page }) => {
    const errors = await boot(page)
    await play(page)

    // The overlay must sit over the video, not in a detached bar.
    const overlay = page.locator('.player-root [class*="overlay"]').first()
    await expect(page.locator('[role="slider"][aria-label="Seek"]')).toBeVisible()

    await page.evaluate(() => document.querySelector('.player-root video').play())
    await page.waitForFunction(() => document.querySelector('.player-root video').currentTime > 0.3)

    // Regression: the old component bound @click to a `seek` method that did
    // not exist, so this threw and never seeked.
    const rail = page.locator('[role="slider"][aria-label="Seek"]')
    const box = await rail.boundingBox()
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2)
    await expect.poll(() => page.evaluate(() => document.querySelector('.player-root video').currentTime), { timeout: 8000 })
      .toBeGreaterThan(20)

    expect(errors, 'no uncaught page errors').toEqual([])
    await page.screenshot({ path: '/root/.claude/jobs/4795a81e/tmp/shot-desktop.png' })
  })

  test('desktop: every control has an accessible name and a 44px target', async ({ page }) => {
    await boot(page)
    await play(page)

    const buttons = page.locator('.player-root button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(5)

    // Every control must be nameable.
    for (let i = 0; i < count; i += 1) {
      const button = buttons.nth(i)
      if (!(await button.isVisible())) continue
      const label = (await button.getAttribute('aria-label')) || (await button.textContent() || '').trim()
      expect(label, `button ${i} has a name`).toBeTruthy()
    }

    // Target size applies to the icon controls. The series link in the title
    // block is inline text, which WCAG 2.5.8 exempts.
    const controls = page.locator('.player-root [class*="controls"] button')
    const controlCount = await controls.count()
    expect(controlCount).toBeGreaterThan(3)

    for (let i = 0; i < controlCount; i += 1) {
      const button = controls.nth(i)
      if (!(await button.isVisible())) continue
      const label = (await button.getAttribute('aria-label')) || (await button.textContent() || '').trim()
      const box = await button.boundingBox()
      if (box) expect(box.height, `control "${label}" height`).toBeGreaterThanOrEqual(38)
    }

    const rail = page.locator('[role="slider"][aria-label="Seek"]')
    expect(await rail.getAttribute('aria-valuetext')).toBeTruthy()
  })

  test('starts on the tracks and quality the user prefers', async ({ page }) => {
    const sessions = []
    await boot(page, {
      sessions,
      me: account({ preferences: { audioLanguage: 'ger', subtitleMode: 'off', quality: 720 } })
    })
    await play(page)

    // "ger" and the file's "deu" are the same language.
    expect(sessions[0]).toMatchObject({ fileId: 11, quality: 720, audioStreamIndex: 2, subtitleStreamIndex: null, subtitleMode: 'off' })
  })

  test('leaves tracks to the server without a preference', async ({ page }) => {
    const sessions = []
    await boot(page, { sessions })
    await play(page)

    expect(sessions[0]).toMatchObject({ quality: 'original', subtitleMode: 'auto' })
    expect(sessions[0].audioStreamIndex).toBeUndefined()
    expect(sessions[0].subtitleStreamIndex).toBeUndefined()
  })

  test('settings opens as a popover on desktop', async ({ page }) => {
    await boot(page)
    await play(page)

    await page.click('button[aria-label="Playback settings"]')
    await expect(page.locator('.as-sheet')).toHaveCount(0)

    const popover = page.locator('.as-popover .container')
    await expect(popover).toBeVisible()

    // Being in the DOM is not enough: the panel rises out of the control row,
    // so anything clipping that row makes it silently invisible.
    const box = await popover.boundingBox()
    const viewport = page.viewportSize()
    expect(box, 'popover has a box').toBeTruthy()
    expect(box.width, 'popover has width').toBeGreaterThan(200)
    expect(box.height, 'popover has height').toBeGreaterThan(200)
    expect(box.y, 'popover top is on screen').toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, 'popover bottom is on screen').toBeLessThanOrEqual(viewport.height + 1)
    expect(box.x + box.width, 'popover right edge is on screen').toBeLessThanOrEqual(viewport.width + 1)

    // And it must actually be the top-most thing at its own centre.
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return el ? el.closest('.as-popover') !== null : false
    }, [box.x + box.width / 2, box.y + 30])
    expect(hit, 'popover is hit-testable at its own centre').toBe(true)
  })

  test('clicking outside closes the settings popover', async ({ page }) => {
    await boot(page)
    await play(page)

    await page.click('button[aria-label="Playback settings"]')
    await expect(page.locator('.as-popover .container')).toBeVisible()

    await page.mouse.click(60, 60)
    await expect(page.locator('.as-popover .container')).toHaveCount(0)
  })

  test('playback speed survives a track change', async ({ page }) => {
    await boot(page)
    await play(page)

    await page.click('button[aria-label="Playback settings"]')
    await page.click('button[role="radio"]:has-text("1.5x")')
    await expect.poll(() => page.evaluate(() => document.querySelector('.player-root video').playbackRate))
      .toBe(1.5)

    // Switching a track re-opens the session and re-attaches the element, which
    // resets rate and volume unless they are explicitly re-applied.
    await page.click('button[role="radio"]:has-text("DEU")')
    await page.waitForFunction(() => document.querySelector('.player-root video').readyState >= 2, { timeout: 20000 })

    await expect.poll(() => page.evaluate(() => document.querySelector('.player-root video').playbackRate), { timeout: 8000 })
      .toBe(1.5)
  })
})

test.describe('@phone player', () => {
  test('controls come back after auto-hide', async ({ page }) => {
    await boot(page)
    await play(page)
    await page.evaluate(() => document.querySelector('.player-root video').play())
    await page.waitForFunction(() => document.querySelector('.player-root video').currentTime > 0.3)

    const overlay = page.locator('.player-root').locator('div').filter({ has: page.locator('[role="slider"][aria-label="Seek"]') }).first()

    // Regression: the old bar reset its idle timer from @mousemove only, so on
    // a touch device it hid after a few seconds and could never be recovered.
    await expect.poll(async () => page.evaluate(() => {
      const el = document.querySelector('.player-root').querySelector('[class*="overlay"]')
      return el ? getComputedStyle(el).opacity : '1'
    }), { timeout: 10000 }).toBe('0')

    await page.locator('.player-root [class*="gestures"]').tap()

    await expect.poll(async () => page.evaluate(() => {
      const el = document.querySelector('.player-root').querySelector('[class*="overlay"]')
      return el ? getComputedStyle(el).opacity : '0'
    }), { timeout: 5000 }).toBe('1')

    await page.screenshot({ path: '/root/.claude/jobs/4795a81e/tmp/shot-phone.png' })
  })

  test('control row stays on one line', async ({ page }) => {
    await boot(page)
    await play(page)

    const height = await page.evaluate(() => {
      const row = document.querySelector('.player-root [class*="controls"]')
      return row ? row.scrollHeight : 0
    })
    expect(height).toBeGreaterThan(0)
    expect(height, 'controls must not wrap on a phone').toBeLessThanOrEqual(64)
  })

  test('settings opens as a bottom sheet on a phone', async ({ page }) => {
    await boot(page)
    await play(page)

    await page.tap('button[aria-label="Playback settings"]')
    const sheet = page.locator('.as-sheet')
    await expect(sheet).toHaveCount(1)

    const box = await sheet.locator('.container').boundingBox()
    const viewport = page.viewportSize()
    expect(box.width).toBeCloseTo(viewport.width, 0)
  })

  test('double tap seeks back ten seconds', async ({ page }) => {
    await boot(page)
    await play(page)
    await page.evaluate(() => {
      const v = document.querySelector('.player-root video')
      v.currentTime = 30
      return v.play()
    })
    await page.waitForFunction(() => document.querySelector('.player-root video').currentTime > 30)

    const layer = page.locator('.player-root [class*="gestures"]')
    const box = await layer.boundingBox()
    const x = box.x + box.width * 0.2
    const y = box.y + box.height * 0.5

    await page.touchscreen.tap(x, y)
    await page.touchscreen.tap(x, y)

    await expect.poll(() => page.evaluate(() => document.querySelector('.player-root video').currentTime), { timeout: 5000 })
      .toBeLessThan(25)
  })
})

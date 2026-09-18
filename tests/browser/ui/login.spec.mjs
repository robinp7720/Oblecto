import { test, expect } from '@playwright/test'
const API = 'http://oblecto.test'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
const names = ['Alice Smith', 'Bob', 'Carol Danvers', 'Dave', 'Eve Online', 'Frank', 'Grace Hopper']
const profiles = () => names.map((name, index) => ({ id: index + 1, username: name.split(' ')[0].toLowerCase(), name, avatar: null, passwordless: index === 0 }))

// `options` is what /auth/login-options answers (or a status code to fail with);
// every POST /auth/login body is collected in `logins`.
async function boot (page, options) {
  const logins = []
  await page.route('**oblecto.test/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/login-options') return typeof options === 'number' ? reply(route, { message: 'nope' }, options) : reply(route, options)
    if (url.pathname === '/auth/login') {
      const body = route.request().postDataJSON()
      logins.push(body)
      if (body.userId === 2 && body.password !== 'hunter2') return reply(route, { code: 401, message: 'Password is incorrect' }, 401)
      return reply(route, { accessToken: 'test-token' })
    }
    if (url.pathname === '/api/v1/status/seedbox') return reply(route, { queue: { idle: true, length: 0, running: 0 } })
    return reply(route, [])
  })
  await page.addInitScript(api => { localStorage.setItem('oblecto.host', api) }, API)
  await page.goto('/login')
  return logins
}

const rowsOf = async tiles => {
  const boxes = await tiles.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()).map(box => ({ top: Math.round(box.top), left: box.left, right: box.right })))
  const rows = new Map()
  for (const box of boxes) rows.set(box.top, [...(rows.get(box.top) || []), box])
  return [...rows.values()]
}

test.describe('@desktop login', () => {
  test('shows public profiles centred and wrapping instead of the form', async ({ page }) => {
    await boot(page, { local: true, profilePicker: true, users: profiles() })
    const tiles = page.locator('.profile-tile')
    await expect(tiles).toHaveCount(names.length)
    await expect(page.getByLabel('Username')).toHaveCount(0)
    await expect(tiles.first()).toContainText('Alice Smith')
    await expect(tiles.first().locator('.initials')).toHaveText('AS')

    const rows = await rowsOf(tiles)
    expect(rows.length).toBeGreaterThan(1)
    const panel = await page.locator('.picker-panel').boundingBox()
    const centre = panel.x + panel.width / 2
    for (const row of rows) {
      const middle = (row[0].left + row[row.length - 1].right) / 2
      expect(Math.abs(middle - centre)).toBeLessThan(4)
    }
    await page.screenshot({ path: 'test-results/login-picker-desktop.png' })
  })

  test('signs a password-less profile in with one click', async ({ page }) => {
    const logins = await boot(page, { local: true, profilePicker: true, users: profiles() })
    await page.getByRole('button', { name: 'Alice Smith' }).click()
    await expect(page).not.toHaveURL(/\/login/)
    expect(logins).toEqual([{ userId: 1 }])
    expect(await page.evaluate(() => localStorage.getItem('oblecto.accessToken'))).toBe('test-token')
  })

  test('asks for the password of other profiles', async ({ page }) => {
    const logins = await boot(page, { local: true, profilePicker: true, users: profiles() })
    await page.getByRole('button', { name: 'Bob' }).click()
    const password = page.getByLabel('Password for Bob')
    await expect(password).toBeFocused()
    await password.fill('wrong')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await password.fill('hunter2')
    await password.press('Enter')
    await expect(page).not.toHaveURL(/\/login/)
    expect(logins).toEqual([{ userId: 2, password: 'wrong' }, { userId: 2, password: 'hunter2' }])
  })

  test('switches between profiles and the full form', async ({ page }) => {
    const logins = await boot(page, { local: true, profilePicker: true, users: profiles() })
    await page.getByRole('button', { name: 'Sign in with another account' }).click()
    await expect(page.locator('.profile-tile')).toHaveCount(0)
    await page.getByRole('button', { name: 'Back to profiles' }).click()
    await expect(page.locator('.profile-tile')).toHaveCount(names.length)
    await page.getByRole('button', { name: 'Sign in with another account' }).click()
    await page.getByLabel('Username').fill('hidden')
    await page.getByLabel('Password', { exact: true }).fill('secret')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).not.toHaveURL(/\/login/)
    expect(logins).toEqual([{ username: 'hidden', password: 'secret' }])
  })

  test('shows only the form away from the local network', async ({ page }) => {
    await boot(page, { local: false, profilePicker: false, users: [] })
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.locator('.profile-tile')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Back to profiles' })).toHaveCount(0)
  })

  test('falls back to the form when the server has no login options', async ({ page }) => {
    await boot(page, 404)
    await expect(page.getByLabel('Username')).toBeVisible()
  })
})

test.describe('@phone login', () => {
  test('wraps profiles into rows that fit the screen', async ({ page }) => {
    await boot(page, { local: true, profilePicker: true, users: profiles() })
    const tiles = page.locator('.profile-tile')
    await expect(tiles).toHaveCount(names.length)
    const viewport = page.viewportSize()
    for (const row of await rowsOf(tiles)) {
      expect(row[0].left).toBeGreaterThanOrEqual(0)
      expect(row[row.length - 1].right).toBeLessThanOrEqual(viewport.width)
    }
    expect((await rowsOf(tiles)).length).toBeGreaterThan(2)
    await page.screenshot({ path: 'test-results/login-picker-phone.png', fullPage: true })
  })
})

test.describe('@desktop session expiry', () => {
  test('returns to sign-in with a notice when the server rejects the saved token', async ({ page }) => {
    await page.route('**oblecto.test/**', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      const url = new URL(route.request().url())
      if (url.pathname === '/auth/login-options') return reply(route, { local: false, users: [] })
      return reply(route, { message: 'Your session has expired. Please sign in again.' }, 401)
    })
    await page.addInitScript(api => {
      localStorage.setItem('oblecto.host', api)
      localStorage.setItem('oblecto.accessToken', 'stale-token')
    }, API)
    await page.goto('/movies')

    await expect(page).toHaveURL(/\/login\?redirect=\/library\/movies&expired=1/)
    await expect(page.locator('.login-error').first()).toContainText('Your session has ended')
    expect(await page.evaluate(() => localStorage.getItem('oblecto.accessToken'))).toBeNull()
  })
})

import { test, expect } from '@playwright/test'
import { account, member } from './accounts.mjs'

const API = 'http://oblecto.test'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
const reply = (route, body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })

const PERMISSIONS = [
  { key: 'settings.manage', description: 'Change server settings (providers, sign-in, federation, seedboxes)' },
  { key: 'users.manage', description: 'Create, edit and delete users and groups' },
  { key: 'libraries.manage', description: 'Manage libraries, sets, artwork and problem files' },
  { key: 'system.manage', description: 'Run maintenance and imports, view seedbox status' }
]
const groups = () => [
  { id: 1, name: 'Administrators', permissions: PERMISSIONS.map(permission => permission.key), builtIn: true, members: 1 },
  { id: 2, name: 'Users', permissions: [], builtIn: true, members: 1 },
  { id: 3, name: 'Family', permissions: ['libraries.manage'], builtIn: false, members: 0 }
]

// `me` answers /api/v1/me (a number fails it with that status). Requests to
// the account and group endpoints are recorded in `calls`.
async function boot (page, path, me, handle = () => false) {
  const calls = []
  let current = me

  await page.route('**oblecto.test/**', async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const url = new URL(request.url())
    if (/^\/api\/v1\/(me|groups|permissions)|^\/user/.test(url.pathname) && request.method() !== 'GET') {
      calls.push({ method: request.method(), path: url.pathname, body: request.postDataJSON() })
    }
    if (await handle(route, url, request)) return
    if (url.pathname === '/api/v1/me' && request.method() === 'GET') {
      return typeof current === 'number' ? reply(route, { message: 'Not Found' }, current) : reply(route, current)
    }
    if (url.pathname === '/api/v1/me' && request.method() === 'PATCH') {
      const body = request.postDataJSON()
      current = { ...current, ...body, preferences: { ...current.preferences, ...body.preferences } }
      return reply(route, current)
    }
    if (url.pathname === '/api/v1/permissions') return reply(route, PERMISSIONS)
    if (url.pathname === '/api/v1/groups') return reply(route, groups())
    if (url.pathname === '/users') return reply(route, [account(), member()])
    if (url.pathname === '/api/v1/status/seedbox') return reply(route, { queue: { idle: true, length: 0, running: 0 } })
    if (url.pathname === '/api/v1/settings') return reply(route, {})
    return reply(route, [])
  })
  await page.addInitScript(api => { localStorage.setItem('oblecto.host', api); localStorage.setItem('oblecto.accessToken', 'test-token') }, API)
  await page.goto(path)

  return calls
}

const sidebar = page => page.getByRole('navigation', { name: 'Settings sections' })

test.describe('@desktop account and permissions', () => {
  test('members only see their own account', async ({ page }) => {
    await boot(page, '/settings/libraries', member())

    await expect(page).toHaveURL(/\/settings\/account$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()
    await expect(sidebar(page).getByRole('link')).toHaveText(['Profile', 'Password', 'Language & playback'])

    await page.locator('.account-menu summary').click()
    await expect(page.getByRole('link', { name: 'Your account' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0)
  })

  test('groups decide which server pages are listed', async ({ page }) => {
    await boot(page, '/settings/sets', member({ group: { id: 3, name: 'Family' }, permissions: ['libraries.manage'] }))

    await expect(page.getByRole('heading', { level: 1, name: 'Sets' })).toBeVisible()
    await expect(sidebar(page).getByRole('link')).toHaveText(['Profile', 'Password', 'Language & playback', 'Problem files', 'Libraries', 'Sets'])

    await page.goto('/settings/users')
    await expect(page).toHaveURL(/\/settings\/account$/)
  })

  test('administrators see everything, headed as server settings', async ({ page }) => {
    await boot(page, '/settings/groups', account())

    await expect(page.getByText('Server settings', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Groups' })).toBeVisible()
    await expect(sidebar(page).getByRole('link', { name: 'Maintenance' })).toBeVisible()
  })

  test('servers without accounts keep every page', async ({ page }) => {
    await boot(page, '/settings/indexer', 404)

    await expect(page.getByRole('heading', { level: 1, name: 'Indexer' })).toBeVisible()
    await expect(sidebar(page).getByRole('link', { name: 'Users' })).toBeVisible()
  })

  test('edits the profile', async ({ page }) => {
    const calls = await boot(page, '/settings/account', member())

    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Bob')
    await expect(page.getByText('Users', { exact: true })).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill('Robert')
    await page.getByLabel('E-mail address').fill('robert@example.com')
    await page.getByRole('button', { name: 'Save profile' }).click()

    await expect(page.getByText('Profile saved')).toBeVisible()
    expect(calls).toEqual([{ method: 'PATCH', path: '/api/v1/me', body: { name: 'Robert', email: 'robert@example.com' } }])
    await expect(page.getByRole('button', { name: 'Save profile' })).toBeDisabled()
  })

  test('changes the password after checking the new one', async ({ page }) => {
    const calls = await boot(page, '/settings/account/password', member(), async (route, url, request) => {
      if (url.pathname !== '/api/v1/me/password') return false
      const body = request.postDataJSON()
      if (body.currentPassword !== 'hunter2') { await reply(route, { message: 'Current password is incorrect' }, 403); return true }
      await reply(route, member()); return true
    })

    await page.getByLabel('Current password').fill('wrong')
    await page.getByLabel('New password', { exact: true }).fill('secret')
    await page.getByLabel('Repeat the new password').fill('secrets')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('The two new passwords are different.')).toBeVisible()
    expect(calls).toEqual([])

    await page.getByLabel('Repeat the new password').fill('secret')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Could not change your password: Current password is incorrect')).toBeVisible()

    await page.getByLabel('Current password').fill('hunter2')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText(/Password changed/)).toBeVisible()
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue('')
    expect(calls.at(-1).body).toEqual({ currentPassword: 'hunter2', newPassword: 'secret' })
  })

  test('accounts without a password are not asked for one', async ({ page }) => {
    await boot(page, '/settings/account/password', member({ hasPassword: false }))

    await expect(page.getByText('Your account has no password yet.', { exact: false })).toBeVisible()
    await expect(page.getByLabel('Current password')).toHaveCount(0)
  })

  test('saves each playback preference as it changes', async ({ page }) => {
    const calls = await boot(page, '/settings/account/preferences', member())

    await expect(page.getByLabel('Interface language').locator('option')).toHaveText(['Same as this browser', 'English'])

    await page.getByLabel('Subtitles', { exact: true }).selectOption('off')
    await expect(page.getByLabel('Subtitle language')).toBeDisabled()
    await page.getByLabel('Audio language').selectOption('jpn')
    await page.getByLabel('Quality').selectOption('720')
    await page.getByLabel('Play the next episode automatically').uncheck()

    await expect.poll(() => calls.length).toBe(4)
    expect(calls.map(call => call.body)).toEqual([
      { preferences: { subtitleMode: 'off' } },
      { preferences: { audioLanguage: 'jpn' } },
      { preferences: { quality: 720 } },
      { preferences: { autoplayNext: false } }
    ])
    await expect(page.getByLabel('Audio language')).toHaveValue('jpn')
  })

  test('manages group permissions and reports refusals', async ({ page }) => {
    const calls = await boot(page, '/settings/groups', account(), async (route, url, request) => {
      if (url.pathname === '/api/v1/groups/3' && request.method() === 'PATCH') {
        await reply(route, { ...groups()[2], ...request.postDataJSON() }); return true
      }
      if (url.pathname === '/api/v1/groups/1' && request.method() === 'PATCH') {
        await reply(route, { code: 409, message: 'This change would leave nobody able to manage users' }, 409); return true
      }
      return false
    })

    const family = page.locator('.settings-card', { has: page.getByRole('textbox', { name: 'Rename' }) })
    await family.getByLabel('Run maintenance').check()
    await expect.poll(() => calls.length).toBe(1)
    expect(calls[0]).toEqual({ method: 'PATCH', path: '/api/v1/groups/3', body: { permissions: ['libraries.manage', 'system.manage'] } })

    const admins = page.locator('.settings-card', { hasText: 'Administrators' })
    await expect(admins.getByLabel('Manage users and groups')).toBeDisabled()
    await admins.getByLabel('Change server settings').uncheck()
    await expect(page.getByText('Could not update Administrators: This change would leave nobody able to manage users')).toBeVisible()
    await expect(admins.getByLabel('Change server settings')).toBeChecked()
  })

  test('moves a user to another group', async ({ page }) => {
    const calls = await boot(page, '/settings/users', account(), async (route, url, request) => {
      if (url.pathname === '/user/2' && request.method() === 'PUT') { await reply(route, member({ groupId: 3 })); return true }
      return false
    })

    await page.getByLabel('Group of bob').selectOption({ label: 'Family' })
    await expect.poll(() => calls.length).toBe(1)
    expect(calls[0]).toEqual({ method: 'PUT', path: '/user/2', body: { groupId: 3 } })
    await expect(page.getByLabel('Group of bob')).toHaveValue('3')
  })

  test('shows the signed-in user in the header', async ({ page }) => {
    await boot(page, '/settings/account', member())

    await page.locator('.account-menu summary').click()
    await expect(page.locator('.menu-identity')).toHaveText('Bob')
    await expect(page.locator('.account-menu summary .user-avatar')).toHaveText('BO')
  })
})

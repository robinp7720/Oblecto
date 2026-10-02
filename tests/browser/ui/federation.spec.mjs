import { test, expect } from '@playwright/test'
import { account } from './accounts.mjs'

async function boot(page) {
  const calls = []
  let config = { enable: true, address: 'media.example', uuid: 'local-id', key: '***', cert: '/test/cert.pem', dataPort: 9131, mediaPort: 9132, syncIntervalMs: 900000, servers: {}, clients: {} }
  const health = { running: true, peers: [], pairings: [] }
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }
  await page.route('**oblecto.test/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method()
    const reply = (body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (method !== 'GET') calls.push({ path: url.pathname, method, body: req.postData() ? req.postDataJSON() : null })
    if (url.pathname === '/api/v1/me') return reply(account())
    if (url.pathname === '/api/v1/settings/federation') {
      if (method === 'PATCH') {
        const body = req.postDataJSON()
        if (body.dataPort === 70000) return reply({ error: 'Check the highlighted settings.', fields: { 'federation.dataPort': 'Enter a port from 1 to 65535.' } }, 400)
        config = { ...config, ...body }
      }
      return reply(config)
    }
    if (url.pathname === '/api/v1/federation/status') return reply(health)
    if (url.pathname === '/api/v1/federation/identity') return reply({ uuid: 'local-id', publicKey: 'PUBLIC KEY' })
    if (url.pathname === '/api/v1/federation/invitations') return reply({ id: 'invite', expires: Date.now() + 600000, invitation: 'copy-this-invitation' })
    if (url.pathname === '/api/v1/federation/pairings') {
      health.pairings = [{ id: 'pairing', uuid: 'remote-id', state: 'active' }]
      health.peers = [{ id: 'remote-id', name: 'Remote server', address: 'remote.example', state: 'connected', enabled: true, count: 12 }]
      config.servers = { 'remote-id': { address: 'remote.example', ca: '/test/ca', dataPort: 9131, mediaPort: 9132 } }
      return reply({ operationId: 'pairing' }, 202)
    }
    if (url.pathname.startsWith('/api/v1/federation/peers/')) {
      if (method === 'DELETE') health.peers = []
      return reply({ operationId: 'sync', ok: true })
    }
    if (url.pathname === '/api/v1/status/seedbox') return reply({ queue: { idle: true } })
    return reply({})
  })
  await page.addInitScript(() => { localStorage.setItem('oblecto.host', 'http://oblecto.test'); localStorage.setItem('oblecto.accessToken', 'token') })
  await page.goto('/settings/federation')
  return calls
}
for (const viewport of ['@desktop', '@phone']) {
  test(`${viewport} federation setup, pairing, health and removal`, async ({ page }) => {
    const calls = await boot(page)
    await page.getByRole('button', { name: 'Prepare identity' }).click()
    await expect(page.getByText('Server ID: local-id')).toBeVisible()
    await page.getByRole('button', { name: 'Create invitation' }).click()
    await expect(page.locator('#federation-invitation')).toHaveValue('copy-this-invitation')
    await page.getByLabel('Invitation from another server').fill('remote-invitation')
    await page.getByRole('button', { name: 'Pair and share libraries' }).click()
    await expect(page.getByRole('heading', { name: 'Remote server' })).toBeVisible()
    await page.getByRole('button', { name: 'Sync now' }).click()
    await expect(page.getByText('Request accepted.')).toBeVisible()
    await page.getByRole('button', { name: 'Remove peer', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm removal' }).click()
    await expect(page.getByText('No peers configured.')).toBeVisible()
    expect(calls.some(call => call.path.endsWith('/pairings') && call.body.invitation === 'remote-invitation')).toBeTruthy()
    expect(calls.some(call => call.method === 'DELETE' && call.path.endsWith('/peers/remote-id'))).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  })
  test(`${viewport} federation settings validation retains the draft`, async ({ page }) => {
    await boot(page)
    await page.getByLabel('Data port', { exact: true }).first().fill('70000')
    await page.getByRole('button', { name: 'Save and apply' }).click()
    await expect(page.getByRole('alert')).toContainText('Enter a port from 1 to 65535.')
    await expect(page.getByLabel('Data port', { exact: true }).first()).toHaveValue('70000')
  })
}

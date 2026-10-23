// Run with node --import tsx scripts/benchmark-playback.mjs --baseline-ref <commit>.
// All fixtures, archived sources, generated bundles and caches live in one temporary directory.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL, fileURLToPath } from 'node:url'
import express from 'express'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

const exec = promisify(execFile)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const option = (name, fallback) => { const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1] }
const ref = option('--baseline-ref')
if (!ref) throw new Error('Supply --baseline-ref <commit> to compare against an immutable baseline.')
const runs = Number(option('--runs', '5'))
const playSeconds = Number(option('--play-seconds', '8'))
const profiles = option('--mbps', '0.75,1.5,3,10').split(',').map(Number)
if (!profiles.length || profiles.some(mbps => !Number.isFinite(mbps) || mbps <= 0 || mbps > 1000)) throw new Error('Use comma-separated positive Mbps values.')
if (!Number.isSafeInteger(runs) || runs < 1 || runs > 30 || !Number.isFinite(playSeconds) || playSeconds < 0 || playSeconds > 30) throw new Error('Use 1–30 runs and 0–30 playback seconds.')
process.env.OBLECTO_CONFIG_PATH = path.join(repo, 'tests/fixtures/config.json')
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-playback-benchmark-'))
const services = new Map()
let browser, server
try {
  const baseline = path.join(root, 'baseline'); await fs.mkdir(baseline)
  const archive = path.join(root, 'baseline.tar')
  await exec('git', ['archive', '--format=tar', '--output', archive, ref, 'src', 'res', 'package.json'], { cwd: repo })
  await exec('tar', ['xf', archive, '-C', baseline])
  await fs.symlink(path.join(repo, 'node_modules'), path.join(baseline, 'node_modules'), 'dir')
  const baselineCommit = (await exec('git', ['rev-parse', ref], { cwd: repo })).stdout.trim()
  const webCommit = (await exec('git', ['rev-parse', `${ref}:Oblecto-Web`], { cwd: repo })).stdout.trim()
  const baselineWeb = path.join(root, 'baseline-web'); await fs.mkdir(baselineWeb)
  await fs.writeFile(path.join(baselineWeb, 'package.json'), '{"type":"module"}')
  await fs.symlink(path.join(repo, 'Oblecto-Web/node_modules'), path.join(baselineWeb, 'node_modules'), 'dir')
  for (const file of ['PlaybackController.js', 'PlaybackTelemetry.js']) {
    const { stdout } = await exec('git', ['show', `${webCommit}:src/playback/${file}`], { cwd: path.join(repo, 'Oblecto-Web') })
    await fs.writeFile(path.join(baselineWeb, file), stdout)
  }
  const { PlaybackService: Current } = await import(pathToFileURL(path.join(repo, 'src/lib/playback/PlaybackService.ts')))
  const { PlaybackService: Baseline } = await import(pathToFileURL(path.join(baseline, 'src/lib/playback/PlaybackService.ts')))
  const { run } = await import(pathToFileURL(path.join(repo, 'src/lib/playback/process.ts')))
  const source = path.join(root, 'source.mp4')
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '60', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2', '-g', '120', '-pix_fmt', 'yuv420p', '-c:a', 'aac', source])
  const file = { id: 1, path: source, extension: 'mp4', host: 'local' }
  const bundles = new Map()
  for (const mode of ['baseline', 'segment', 'window']) {
    const Service = mode === 'baseline' ? Baseline : Current
    services.set(mode, new Service({ config: { ffmpeg: {}, streaming: { encoderMode: mode === 'window' ? 'window' : 'segment', cacheDirectory: path.join(root, `cache-${mode}`) }, transcoding: {} } }))
    const controller = mode === 'baseline' ? path.join(baselineWeb, 'PlaybackController.js') : path.join(repo, 'Oblecto-Web/src/playback/PlaybackController.js')
    const result = await build({ bundle: true, format: 'esm', write: false, stdin: { resolveDir: repo, contents: `
      import Controller, { browserCapabilities } from ${JSON.stringify(controller)};
      const video = document.querySelector('video');
      const json = async (url, options = {}) => { const r = await fetch(url, options); if (!r.ok) throw new Error(await r.text()); return r.status === 204 ? undefined : r.json(); };
      const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const client = {
        create: (fileId, options) => json('/api/${mode}/create', post(options)),
        progress: (id, body) => json('/api/${mode}/progress/' + id, post(body)),
        stop: id => json('/api/${mode}/stop/' + id, { method: 'DELETE' }),
        mediaUrl: url => url
      };
      window.controller = new Controller(client, state => { if (state.error) window.failure = state.error; });
      window.metrics = { firstPlaybackMs: null, rebufferDurationMs: 0 };
      let requested, stalledAt = null, started = false;
      video.addEventListener('waiting', () => { if (started && !video.paused && !video.seeking) stalledAt ??= performance.now(); });
      video.addEventListener('playing', () => {
        if (!started) { window.metrics.firstPlaybackMs = performance.now() - requested; started = true; }
        if (stalledAt !== null) { window.metrics.rebufferDurationMs += performance.now() - stalledAt; stalledAt = null; }
      });
      window.start = async quality => { requested = performance.now(); const s = await window.controller.open(1, { quality, capabilities: browserCapabilities(video), subtitleMode: 'off' }, requested); if (s) window.controller.attach(video); };
      window.ready = true;
    ` } })
    bundles.set(mode, result.outputFiles[0].text)
  }
  const app = express(); app.use(express.json())
  app.post('/api/:mode/create', async (req, res) => { const service = services.get(req.params.mode); const session = await service.create(file, 'benchmark', null, req.body); res.json(service.describe(session, `/media/${req.params.mode}`)) })
  app.post('/api/:mode/progress/:id', async (req, res) => { const service = services.get(req.params.mode); await service.report(service.get(req.params.id), req.body); res.sendStatus(204) })
  app.delete('/api/:mode/stop/:id', async (req, res) => { const service = services.get(req.params.mode); await service.stop(service.get(req.params.id)); res.sendStatus(204) })
  app.get('/media/:mode/:id/:revision/:asset', async (req, res) => { const service = services.get(req.params.mode); await service.serve(service.get(req.params.id), Number(req.params.revision), req.params.asset, req, res) })
  app.get('/:mode.js', (req, res) => res.type('application/javascript').send(bundles.get(req.params.mode)))
  app.get('/:mode', (req, res) => res.type('html').send(`<video muted playsinline></video><script type="module" src="/${req.params.mode}.js"></script>`))
  app.use((error, _req, res, _next) => { if (!res.headersSent) res.status(error.statusCode ?? 500).json({ message: error.message }) })
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  browser = await chromium.launch()
  const rows = []
  const candidateCommit = (await exec('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim()
  const candidateDirty = Boolean((await exec('git', ['status', '--porcelain=v1'], { cwd: repo })).stdout.trim())
  const ffmpeg = (await exec('ffmpeg', ['-version'])).stdout.split('\n')[0]
  console.log(JSON.stringify({ baselineCommit, webCommit, candidateCommit, candidateDirty, cpu: os.cpus()[0]?.model, node: process.version, ffmpeg, runs, playSeconds, fixture: 'synthetic 720p30 H.264/AAC, 60 seconds', latencyMs: 100 }))
  for (const quality of ['auto', 'original']) {
    for (const mbps of quality === 'auto' ? profiles : [10]) {
      for (let trial = 0; trial < runs; trial++) {
        for (const mode of ['baseline', 'segment', 'window']) {
          const page = await browser.newPage(); const client = await page.context().newCDPSession(page)
          try {
            await page.goto(`http://127.0.0.1:${server.address().port}/${mode}`)
            await page.waitForFunction(() => window.ready)
            await client.send('Network.enable')
            await client.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 1e6 / 8 })
            await page.evaluate(quality => window.start(quality), quality)
            await page.waitForFunction(() => window.metrics.firstPlaybackMs !== null || window.failure, null, { timeout: 45000 })
            if (quality === 'auto' && playSeconds) await page.waitForFunction(seconds => document.querySelector('video').currentTime >= seconds || window.failure, playSeconds, { timeout: 90000 })
            const metrics = await page.evaluate(() => ({ ...window.metrics, error: window.failure ?? null, height: document.querySelector('video').videoHeight }))
            const row = { mode, quality, mbps, trial, ...metrics }; rows.push(row); console.log(JSON.stringify(row))
            await page.evaluate(() => window.controller.destroy())
          } finally { await page.close() }
        }
      }
    }
  }
  const p95 = values => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null }
  for (const quality of ['auto', 'original']) for (const mbps of quality === 'auto' ? profiles : [10]) for (const mode of ['baseline', 'segment', 'window']) {
    const group = rows.filter(row => row.mode === mode && row.quality === quality && row.mbps === mbps)
    console.log(JSON.stringify({ summary: true, mode, quality, mbps, p95StartupMs: p95(group.map(row => row.firstPlaybackMs)), meanRebufferMs: group.reduce((sum, row) => sum + row.rebufferDurationMs, 0) / group.length, failures: group.filter(row => row.error).length }))
  }
} finally {
  await browser?.close()
  await Promise.allSettled([...services.values()].map(service => service.close()))
  if (server) await new Promise(resolve => server.close(resolve))
  await fs.rm(root, { recursive: true, force: true })
}

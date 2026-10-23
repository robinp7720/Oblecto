/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page, request }) => { await request.post('/debug/encoder', { data: { mode: 'segment' } }); await page.goto('/'); await page.waitForFunction(() => (window as any).ready); });
test.afterEach(async ({ page }) => { await page.evaluate(() => (window as any).controller.destroy()); });
test('original playback starts, seeks, resumes and cleans up', async ({ page, request }) => {
    await page.click('#start');
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0.2);
    await expect.poll(async () => {
        const sessions = await (await request.get('/debug')).json();
        return sessions[0]?.timings.firstPlaybackMs;
    }).toBeGreaterThan(0);
    await page.evaluate(() => { const video = document.querySelector('video')!; video.pause(); video.currentTime = 10; });
    await expect.poll(() => page.evaluate(() => document.querySelector('video')!.currentTime)).toBeCloseTo(10, 0);
    await page.evaluate(() => document.querySelector('video')!.play());
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 10.2);
    await page.click('#stop');
    await expect.poll(async () => (await request.get('/debug')).json()).toEqual([]);
});
test('adaptive playback seeks across qualities without resetting absolute position', async ({ page }) => {
    await page.evaluate(() => (window as any).start('auto', 5));
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 5.2);
    await page.evaluate(() => { const video = document.querySelector('video')!; video.currentTime = 13; });
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 13.2);
    await page.evaluate(() => (window as any).start(360, 8));
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 8.2 && document.querySelector('video')!.currentTime < 12);
    await expect(page.locator('#error')).toHaveText('');
});
test('rapid source changes discard obsolete sessions', async ({ page, request }) => {
    await page.evaluate(async () => { await Promise.all([(window as any).start('auto', 0), (window as any).start(360, 8)]); });
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 8.2);
    await expect.poll(async () => ((await request.get('/debug')).json()).then((sessions: unknown[]) => sessions.length)).toBe(1);
});
test('media failures stop retrying and expose an actionable error', async ({ page }) => {
    await page.route('**/*.ts?*', route => route.abort());
    await page.evaluate(() => (window as any).start('auto', 0));
    await expect(page.locator('#error')).not.toHaveText('', { timeout: 25000 });
    await page.unroute('**/*.ts?*');
    await page.evaluate(() => (window as any).controller.retry());
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0.2);
});

for (const mode of ['segment', 'window']) {
    test(`${mode}: Auto starts at zero and releases its startup quality cap`, async ({ page, request }) => {
        await request.post('/debug/encoder', { data: { mode } });
        await page.evaluate(() => (window as any).start('auto', 0));
        await page.waitForFunction(() => document.querySelector('video')!.currentTime > 2);
        expect(await page.evaluate(() => (window as any).controller.hls?.autoLevelCapping ?? -1)).toBe(-1);
        await expect(page.locator('#error')).toHaveText('');
    });
}

for (const mode of ['segment', 'window']) {
    for (const mbps of [0.75, 1.5, 3, 10]) {
        test(`${mode}: adaptive playback sustains ${mbps} Mbps with 100ms latency`, async ({ page, request, browserName }) => {
            test.skip(browserName !== 'chromium', 'Chromium CDP provides deterministic bandwidth emulation');
            test.setTimeout(45000);
            await request.post('/debug/encoder', { data: { mode } });
            const network = await page.context().newCDPSession(page);
            await network.send('Network.enable');
            await network.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 1e6 / 8 });
            await page.evaluate(() => (window as any).start('auto', 0));
            await page.waitForFunction(() => document.querySelector('video')!.currentTime > 8, null, { timeout: 30000 });
            const metrics = await page.evaluate(() => ({
                startupMs: (window as any).controller.firstPlaybackMs,
                rebufferMs: (window as any).controller.telemetry.rebufferDurationMs,
                level: (window as any).controller.hls.currentLevel,
                heights: (window as any).controller.hls.levels.map((level: any) => level.height)
            }));
            expect(metrics.startupMs).toBeGreaterThan(0);
            expect(metrics.startupMs).toBeLessThan(15000);
            expect(metrics.rebufferMs).toBeLessThan(2000);
            expect(metrics.heights[0]).toBe(240);
            await expect(page.locator('#error')).toHaveText('');
            await network.detach();
        });
    }
}
test('Auto responds to a bandwidth drop without restarting the session', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium CDP provides deterministic bandwidth emulation');
    test.setTimeout(90000);
    const network = await page.context().newCDPSession(page); await network.send('Network.enable');
    const profile = (mbps: number) => ({ offline: false, latency: 100, downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 1e6 / 8 });
    await network.send('Network.emulateNetworkConditions', profile(3));
    await page.evaluate(() => (window as any).start('auto', 0));
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 10);
    const id = await page.evaluate(() => (window as any).controller.session.sessionId);
    await network.send('Network.emulateNetworkConditions', profile(0.75));
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 35, null, { timeout: 60000 });
    expect(await page.evaluate(() => (window as any).controller.session.sessionId)).toBe(id);
    await expect(page.locator('#error')).toHaveText('');
    await network.detach();
});

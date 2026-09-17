/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.waitForFunction(() => (window as any).ready); });
test.afterEach(async ({ page }) => { await page.evaluate(() => (window as any).controller.destroy()); });
test('original playback starts, seeks, resumes and cleans up', async ({ page, request }) => {
    await page.click('#start');
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0.2);
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

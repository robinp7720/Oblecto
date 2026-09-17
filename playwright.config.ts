import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/browser', testMatch: '*.spec.ts', timeout: 45000, workers: 1,
    use: { baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
    projects: ['chromium', 'firefox', 'webkit'].map(name => ({ name, use: { browserName: name as 'chromium' | 'firefox' | 'webkit' } })),
    webServer: { command: 'node --import tsx tests/browser/server.ts', url: 'http://127.0.0.1:4187', timeout: 60000, reuseExistingServer: false }
});

import { defineConfig, devices } from '@playwright/test';

const UI_URL = 'http://127.0.0.1:8123';

export default defineConfig({
    timeout: 45000, workers: 1, trace: 'retain-on-failure' as never,
    projects: [
        // PlaybackController regression suite: drives the controller directly
        // against a real PlaybackService, no Vue app involved.
        ...['chromium', 'firefox', 'webkit'].map(name => ({
            name,
            testDir: './tests/browser',
            testMatch: '*.spec.ts',
            use: { browserName: name as 'chromium' | 'firefox' | 'webkit', baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' as const }
        })),
        // Player UI suite: the real Vue app against a stubbed session API.
        {
            name: 'player-desktop',
            testDir: './tests/browser/ui',
            testMatch: '*.spec.mjs',
            grep: /@desktop/,
            use: { ...devices['Desktop Chrome'], baseURL: UI_URL, trace: 'retain-on-failure' as const }
        },
        {
            name: 'player-phone',
            testDir: './tests/browser/ui',
            testMatch: '*.spec.mjs',
            grep: /@phone/,
            use: { ...devices['Pixel 7'], baseURL: UI_URL, trace: 'retain-on-failure' as const }
        }
    ],
    webServer: [
        // Reads the mocha fixture config, never the machine's /etc/oblecto.
        { command: 'node --import tsx tests/browser/server.ts', env: { OBLECTO_CONFIG_PATH: 'tests/fixtures/config.json' }, url: 'http://127.0.0.1:4187', timeout: 60000, reuseExistingServer: false },
        { command: 'npx vite --port 8123 --strictPort --host 127.0.0.1', cwd: 'Oblecto-Web', url: UI_URL, timeout: 120000, reuseExistingServer: true }
    ]
});

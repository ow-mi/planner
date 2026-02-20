import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 120000,
    expect: {
        timeout: 15000
    },
    use: {
        baseURL: 'http://127.0.0.1:5173',
        headless: true
    },
    webServer: {
        command: 'npm run serve',
        port: 5173,
        reuseExistingServer: true,
        timeout: 120000
    }
});

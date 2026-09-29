import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 120000,
  use: { baseURL: 'http://127.0.0.1:5178', channel: 'msedge', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5178 --strictPort', url: 'http://127.0.0.1:5178', reuseExistingServer: false, env: { VITE_API_PROXY_TARGET: 'http://127.0.0.1:5198' } },
})

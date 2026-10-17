import { defineConfig } from '@playwright/test';

const basePath = process.env.STILL_BASE_PATH || '/value-study/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) throw new Error('STILL_BASE_PATH must be an absolute directory path with a trailing slash.');
const publishedURL = process.env.STILL_DEPLOYMENT_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: 'deployment.spec.js',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: publishedURL || `http://127.0.0.1:5176${basePath}`,
    trace: 'retain-on-failure',
  },
  webServer: publishedURL ? undefined : {
    command: `npm run preview -- --host 127.0.0.1 --port 5176 --strictPort --base=${basePath}`,
    url: `http://127.0.0.1:5176${basePath}`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'ipad', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
  ],
});

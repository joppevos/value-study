import { test, expect } from '@playwright/test';

const photo = {
  name: 'deployment-study.svg', mimeType: 'image/svg+xml',
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="red"/></svg>'),
};
async function openPhoto(page) {
  await page.locator('#file').setInputFiles(photo);
  await expect(page.locator('#save')).toBeEnabled();
}
async function offlineReady(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
}

test('loads the processing worker and exports a study from the published path', async ({ page }) => {
  await page.goto('./');
  await openPhoto(page);
  await expect(page.locator('#status')).toContainText('Grayscale');
  await page.locator('[data-mode="color"]').tap();
  await expect(page.locator('#save')).toBeEnabled();
  expect(await page.locator('#preview').evaluate(canvas => [...canvas.getContext('2d').getImageData(10, 10, 1, 1).data])).toEqual([255, 0, 0, 255]);
  const download = page.waitForEvent('download');
  await page.locator('#save').tap();
  expect((await download).suggestedFilename()).toBe('still-color-study.png');
});

test('serves the manifest, icons and service worker under the same site path', async ({ page, request, baseURL }) => {
  await page.goto('./');
  await offlineReady(page);
  const root = new URL(baseURL);
  const manifestURL = await page.locator('link[rel="manifest"]').evaluate(link => link.href);
  expect(new URL(manifestURL).pathname).toBe(`${root.pathname}manifest.webmanifest`);
  const response = await request.get(manifestURL);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(new URL(manifest.start_url, manifestURL).href).toBe(root.href);
  expect(new URL(manifest.scope, manifestURL).href).toBe(root.href);
  for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, manifestURL).href)).ok()).toBe(true);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(root.href);
});

test('reloads offline and processes another image using the cached worker', async ({ page, context }) => {
  await page.goto('./');
  await offlineReady(page);
  await context.setOffline(true);
  try {
    await page.reload();
    await openPhoto(page);
    await page.locator('[data-mode="color"]').tap();
    await expect(page.locator('#save')).toBeEnabled();
    await page.locator('#palette').selectOption('5');
    await expect(page.locator('#palette-summary')).toContainText('1 chosen colors');
  } finally { await context.setOffline(false); }
});

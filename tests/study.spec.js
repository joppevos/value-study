import { test, expect } from '@playwright/test';

const fixture = {
  name: 'color-study.svg', mimeType: 'image/svg+xml',
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><path fill="#ff0000" d="M0 0h100v200H0z"/><path fill="#00ff00" d="M100 0h100v200H100z"/><path fill="#0000ff" d="M200 0h100v200H200z"/></svg>'),
};

async function load(page, image = fixture) {
  await page.goto('/');
  await page.locator('#file').setInputFiles(image);
  await expect(page.locator('#save')).toBeEnabled();
}
async function ready(page) {
  await expect(page.locator('#busy')).toBeHidden();
  await expect(page.locator('#save')).toBeEnabled();
}
async function pixel(page, x = 10, y = 10) {
  return page.locator('#preview').evaluate((canvas, [x, y]) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data], [x, y]);
}
async function range(page, id, value) {
  await page.locator(`#${id}`).evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  await ready(page);
}
async function sample(page, horizontal) {
  const box = await page.locator('#preview').boundingBox();
  await page.locator('#preview').click({ position: { x: box.width * horizontal, y: box.height / 2 } });
}

test('opens an image, switches views, and keeps adjustments', async ({ page }) => {
  await load(page);
  expect(await pixel(page)).toEqual([54, 54, 54, 255]);
  await page.locator('[data-level="3"]').click(); await ready(page);
  await range(page, 'brightness', 5);
  await page.locator('[data-mode="color"]').click(); await ready(page);
  expect(await pixel(page)).toEqual([255, 13, 13, 255]);
  await expect(page.locator('#value-controls')).toBeHidden();
  await page.locator('[data-mode="value"]').click(); await ready(page);
  await expect(page.locator('[data-level="3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#brightness')).toHaveValue('5');
  expect(await pixel(page)).toEqual([128, 128, 128, 255]);
});

test('moves boundaries, calculates areas, isolates groups, and keeps cutoffs per group count', async ({ page }) => {
  await load(page);
  await page.locator('[data-level="3"]').click(); await ready(page);
  await expect(page.locator('#group-buttons button')).toHaveCount(3);
  await expect(page.locator('#group-buttons button').nth(0)).toContainText('66.7%');
  await page.locator('#boundary-details summary').click();
  await range(page, 'boundary-0', 30);
  await expect(page.locator('#group-buttons button').nth(0)).toContainText('33.3%');
  await expect(page.locator('#boundary-1')).toHaveAttribute('min', '31');
  await page.locator('#group-buttons button').nth(0).click(); await ready(page);
  expect(await pixel(page)).toEqual([219, 225, 209, 255]);
  await expect(page.locator('#export-help')).toContainText('all groups');
  await page.locator('#show-groups').click(); await ready(page);
  expect(await pixel(page)).toEqual([128, 128, 128, 255]);
  await page.locator('[data-level="4"]').click(); await ready(page);
  await expect(page.locator('#boundaries input')).toHaveCount(3);
  await expect(page.locator('#group-buttons button')).toHaveCount(4);
  expect(await pixel(page)).toEqual([85, 85, 85, 255]);
  await range(page, 'boundary-0', 60);
  expect(await pixel(page)).toEqual([0, 0, 0, 255]);
  await page.locator('[data-level="5"]').click(); await ready(page);
  await page.locator('[data-level="4"]').click(); await ready(page);
  await expect(page.locator('#boundary-0')).toHaveValue('60');
  await page.locator('[data-level="3"]').click(); await ready(page);
  await expect(page.locator('#boundary-0')).toHaveValue('30');
  await page.locator('#even-boundaries').click(); await ready(page);
  await expect(page.locator('#boundary-0')).toHaveValue('64');
});

test('samples original and study colors, pins A, and compares B', async ({ page }) => {
  await load(page);
  await page.locator('#sample-toggle').click();
  expect(await pixel(page)).toEqual([255, 0, 0, 255]);
  await sample(page, 1 / 6);
  await expect(page.locator('#sample-cards')).toContainText('#FF0000');
  await page.locator('#pin').click();
  await sample(page, 5 / 6);
  await expect(page.locator('#sample-cards')).toContainText('#0000FF');
  await expect(page.locator('#sample-comparison')).toContainText('darker');
  await expect(page.locator('#wheel-a')).toBeVisible();
  await expect(page.locator('#wheel-b')).toBeVisible();
  await page.locator('#sample-source').selectOption('study');
  await expect(page.locator('#sample-cards')).toContainText('#121212');
  expect(await pixel(page)).toEqual([54, 54, 54, 255]);
  await page.locator('#clear-samples').click();
  await expect(page.locator('#pin')).toBeDisabled();
  await expect(page.locator('#wheel-a')).toBeHidden();
  await expect(page.locator('#sample-marker')).toBeHidden();
});

test('supports keyboard sampling and clears samples on a new image', async ({ page }) => {
  await load(page);
  await page.locator('#sample-toggle').click();
  await page.locator('#preview').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sample-cards')).toContainText('#00FF00');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#sample-marker')).toBeVisible();
  await page.locator('#pin').click();
  await page.locator('#file').setInputFiles(fixture); await ready(page);
  await expect(page.locator('#pin')).toBeDisabled();
  await expect(page.locator('#wheel-a')).toBeHidden();
});

test('filters color, compares with original, and resets all adjustments', async ({ page }) => {
  await load(page);
  await page.locator('[data-mode="color"]').click(); await ready(page);
  await range(page, 'median', 2);
  await range(page, 'brightness', -20);
  expect(await pixel(page)).toEqual([204, 0, 0, 255]);
  await page.locator('#compare').focus();
  await page.keyboard.down('Enter');
  expect(await pixel(page)).toEqual([255, 0, 0, 255]);
  await page.keyboard.up('Enter');
  expect(await pixel(page)).toEqual([204, 0, 0, 255]);
  await page.locator('#reset').click(); await ready(page);
  await expect(page.locator('#median')).toHaveValue('0');
  await expect(page.locator('[data-mode="value"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await pixel(page)).toEqual([54, 54, 54, 255]);
});

test('exports the study, not the original or group isolation view', async ({ page }) => {
  await load(page);
  await page.locator('[data-level="3"]').click(); await ready(page);
  await page.locator('#group-buttons button').nth(2).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('still-value-study.png');
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const output = Buffer.concat(chunks);
  expect(output.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const firstPixel = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(10, 10, 1, 1).data];
  }, output.toString('base64'));
  expect(firstPixel).toEqual([0, 0, 0, 255]);
});

test('fits a large image and sampler without horizontal scrolling', async ({ page }) => {
  await load(page, {
    name: 'large.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600"><rect width="2400" height="1600" fill="#889955"/></svg>'),
  });
  await expect(page.locator('#dimensions')).toHaveText('1600 × 1067');
  await page.locator('#sample-toggle').click();
  const sizes = await page.evaluate(() => {
    const canvas = document.getElementById('preview').getBoundingClientRect();
    const wrap = document.querySelector('.canvas-wrap').getBoundingClientRect();
    return { page: document.documentElement.scrollWidth, viewport: window.innerWidth, canvasWidth: canvas.width, canvasHeight: canvas.height, wrapWidth: wrap.width, wrapHeight: wrap.height };
  });
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.wrapWidth).toBeCloseTo(sizes.canvasWidth, 0);
  expect(sizes.wrapHeight).toBeCloseTo(sizes.canvasHeight, 0);
  expect(sizes.canvasWidth / sizes.canvasHeight).toBeCloseTo(1600 / 1067, 2);
  await sample(page, 0.5);
  await expect(page.locator('#sample-cards')).toContainText('#889955');
});

test('handles invalid images and quick successive adjustments', async ({ page }) => {
  await load(page);
  await page.locator('#file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.locator('#error')).toBeVisible();
  await page.locator('#brightness').evaluate(input => {
    for (let value = -20; value <= 20; value++) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await ready(page);
  expect(await pixel(page)).toEqual([105, 105, 105, 255]);
  await page.locator('#file').setInputFiles(fixture); await ready(page);
  await expect(page.locator('#error')).toBeHidden();
});

test('undo groups slider input, restores reset and boundaries, and clears redo after edits', async ({ page }) => {
  await load(page);
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('#redo')).toBeDisabled();
  await range(page, 'brightness', 10);
  await range(page, 'brightness', 20);
  await page.locator('#brightness').dispatchEvent('change');
  await page.locator('#undo').click(); await ready(page);
  await expect(page.locator('#brightness')).toHaveValue('0');
  expect(await pixel(page)).toEqual([54, 54, 54, 255]);
  await expect(page.locator('#undo')).toBeDisabled();
  await page.locator('#redo').click(); await ready(page);
  await expect(page.locator('#brightness')).toHaveValue('20');
  await page.locator('[data-level="4"]').click(); await ready(page);
  await page.locator('#boundary-details summary').click();
  await range(page, 'boundary-0', 60);
  await page.locator('#boundary-0').dispatchEvent('change');
  await page.locator('#reset').click(); await ready(page);
  await page.locator('#undo').click(); await ready(page);
  await expect(page.locator('[data-level="4"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#boundary-0')).toHaveValue('60');
  await expect(page.locator('#brightness')).toHaveValue('20');
  await page.locator('#undo').click(); await ready(page);
  await expect(page.locator('#boundary-0')).toHaveValue('43');
  await page.locator('[data-mode="color"]').click(); await ready(page);
  await expect(page.locator('#redo')).toBeDisabled();
  await page.locator('#undo').click(); await ready(page);
  await expect(page.locator('[data-mode="value"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#file').setInputFiles(fixture); await ready(page);
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('#redo')).toBeDisabled();
});

test('squint temporarily reduces the preview and restores it on release', async ({ page }) => {
  await load(page);
  const normal = await page.locator('#preview').boundingBox();
  await page.locator('#squint').focus();
  await page.keyboard.down('Space');
  await expect(page.locator('#squint')).toHaveAttribute('aria-pressed', 'true');
  const small = await page.locator('#preview').boundingBox();
  expect(small.width).toBeLessThan(normal.width);
  expect(await pixel(page)).toEqual([54, 54, 54, 255]);
  await page.keyboard.up('Space');
  await expect(page.locator('#squint')).toHaveAttribute('aria-pressed', 'false');
  expect((await page.locator('#preview').boundingBox()).width).toBe(normal.width);
});

async function reveal(page, id) {
  await page.locator(`#${id}`).evaluate(element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
  });
}
async function companionReady(page) {
  await expect(page.locator('#companion-status')).toContainText('study');
}

test('color simplification, chroma view and gamut feedback stay separate from value grouping', async ({ page }) => {
  await load(page);
  await page.locator('[data-mode="color"]').click(); await ready(page);
  await page.locator('#palette').selectOption('3'); await ready(page);
  await expect(page.locator('#palette-swatches span')).toHaveCount(3);
  await page.locator('#smoothing').selectOption('channels'); await ready(page);
  await range(page, 'chroma', 100);
  await expect(page.locator('#gamut-note')).toContainText('display limit');
  await page.locator('[data-mode="chroma"]').click(); await ready(page);
  await expect(page.locator('#chroma-help')).toBeVisible();
  const chromaPixel = await pixel(page); expect(chromaPixel[0]).toBeGreaterThan(100);
  expect(chromaPixel[0]).toBe(chromaPixel[1]);
  await page.locator('[data-mode="value"]').click(); await ready(page);
  expect(await pixel(page)).toEqual([54, 54, 54, 255]);
  await expect(page.locator('#histogram rect')).not.toHaveCount(0);
});

test('framing changes sampling coordinates, exports, and undo together', async ({ page }) => {
  await load(page); await reveal(page, 'flip');
  await page.locator('#flip').click(); await ready(page);
  expect(await pixel(page)).toEqual([18, 18, 18, 255]);
  await page.locator('#sample-toggle').click(); await sample(page, 1 / 6);
  await expect(page.locator('#sample-cards')).toContainText('#0000FF');
  await page.locator('#sample-toggle').click();
  await page.locator('#rotate').click(); await ready(page);
  await expect(page.locator('#dimensions')).toHaveText('200 × 300');
  await page.locator('#undo').click(); await ready(page);
  await expect(page.locator('#dimensions')).toHaveText('300 × 200');
  await range(page, 'cropLeft', 50); await page.locator('#cropLeft').dispatchEvent('change');
  await expect(page.locator('#dimensions')).toHaveText('150 × 200');
  await page.locator('#undo').click(); await ready(page);
  await expect(page.locator('#dimensions')).toHaveText('300 × 200');
});

test('comparison supports independent and linked adjustments and switching the edited photo', async ({ page }) => {
  await load(page); await reveal(page, 'add-companion');
  await page.locator('#companion-file').setInputFiles({ ...fixture, name: 'painting.svg' }); await companionReady(page);
  await range(page, 'brightness', 20); await companionReady(page);
  const secondPixel = () => page.locator('#companion-preview').evaluate(canvas => [...canvas.getContext('2d').getImageData(10, 10, 1, 1).data]);
  expect(await secondPixel()).toEqual([54, 54, 54, 255]);
  await page.locator('#link-adjustments').check(); await companionReady(page);
  expect(await secondPixel()).toEqual([105, 105, 105, 255]);
  await page.locator('#link-adjustments').uncheck(); await companionReady(page);
  await page.locator('#switch-images').click(); await ready(page); await companionReady(page);
  await expect(page.locator('#image-label')).toHaveText('painting.svg');
  await range(page, 'brightness', 0); await companionReady(page);
  expect(await secondPixel()).toEqual([105, 105, 105, 255]);
  await page.locator('#remove-companion').click();
  await expect(page.locator('#companion')).toBeHidden();
});

test('variations restore adjustments and compare beside the current study', async ({ page }) => {
  await load(page); await reveal(page, 'add-variation');
  await page.locator('#add-variation').click();
  await range(page, 'brightness', 20); await page.locator('#brightness').dispatchEvent('change');
  await page.locator('#variations').getByRole('button', { name: 'Compare', exact: true }).click(); await companionReady(page);
  await expect(page.locator('#companion-label')).toHaveText('Variation 1');
  await page.locator('#variations').getByRole('button', { name: 'Load', exact: true }).click(); await ready(page);
  await expect(page.locator('#brightness')).toHaveValue('0');
  await page.locator('#undo').click(); await ready(page);
  await expect(page.locator('#brightness')).toHaveValue('20');
});

test('local gallery stores adjustments only by default and persists photos only when selected', async ({ page }) => {
  await load(page); await reveal(page, 'save-local');
  await page.locator('#study-name').fill('Value study'); await page.locator('#save-local').click();
  await expect(page.locator('#gallery')).toContainText('Adjustments only');
  const stored = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('still-studies', 1);
    request.onsuccess = () => {
      const db = request.result, query = db.transaction('studies').objectStore('studies').getAll();
      query.onsuccess = () => { resolve(query.result.map(study => ({ photo: study.photo, name: study.name }))); db.close(); };
      query.onerror = () => reject(query.error);
    };
    request.onerror = () => reject(request.error);
  }));
  expect(stored).toEqual([{ photo: null, name: 'Value study' }]);
  await page.locator('#save-photo').check(); await page.locator('#save-local').click();
  await expect(page.locator('#gallery')).toContainText('Photo + adjustments');
  await page.locator('#gallery .saved-row').filter({ hasText: 'Photo + adjustments' }).getByRole('button', { name: 'Open', exact: true }).click(); await ready(page);
  await expect(page.locator('#storage-status')).toContainText('Opened the saved photo');
  await page.locator('#gallery .saved-row').filter({ hasText: 'Photo + adjustments' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('#gallery .saved-row')).toHaveCount(1);
  await page.locator('#remember-adjustments').check();
  await range(page, 'brightness', 25); await page.reload();
  await expect(page.locator('#brightness')).toHaveValue('25');
  await expect(page.locator('#save')).toBeDisabled();
});

test('grids and backgrounds are preview-only and focus view has an exit', async ({ page }) => {
  await load(page); await reveal(page, 'grid');
  const before = await pixel(page);
  await page.locator('#grid').selectOption('thirds');
  await expect(page.locator('#grid-overlay path')).toHaveCount(2);
  await page.locator('#surround').selectOption('dark');
  expect(await pixel(page)).toEqual(before);
  await page.locator('#focus-view').click();
  await expect(page.locator('aside')).toBeHidden();
  await page.locator('#exit-focus').click();
  await expect(page.locator('aside')).toBeVisible();
});

test('full-resolution export uses the native file and omits preview isolation', async ({ page }) => {
  await load(page, { name: 'native.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="100"><rect width="1800" height="100" fill="red"/></svg>') });
  await reveal(page, 'export-full');
  const downloading = page.waitForEvent('download');
  await page.locator('#export-full').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('still-value-full.png');
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.readUInt32BE(16)).toBe(1800); expect(bytes.readUInt32BE(20)).toBe(100);
});

test('color limit keeps a dominant muted green and explains the chosen palette', async ({ page }) => {
  await load(page, { name: 'muted-green.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="104" height="40"><path fill="#606760" d="M0 0h100v40H0z"/><path fill="#636160" d="M0 0h1v40H0z"/><path fill="#203020" d="M100 0h1v40h-1z"/><path fill="#405040" d="M101 0h1v40h-1z"/><path fill="#809080" d="M102 0h1v40h-1z"/><path fill="#c0d0c0" d="M103 0h1v40h-1z"/></svg>') });
  await page.locator('[data-mode="color"]').click(); await ready(page);
  await page.getByLabel('Color limit', { exact: true }).selectOption('5'); await ready(page);
  expect(await pixel(page)).toEqual([96, 103, 96, 255]);
  await expect(page.locator('#palette-summary')).toContainText('5 chosen colors');
  await expect(page.locator('#palette-help')).toContainText('after smoothing and adjustments');
  await expect(page.locator('#palette-swatches .palette-color').first()).toContainText('96.2%');
  await expect(page.locator('#palette-swatches span').first()).toHaveAttribute('aria-label', '#606760, 96.2 percent');
  await page.locator('#palette').selectOption('0'); await ready(page);
  await expect(page.locator('#palette-summary')).toContainText('No palette reduction');
  await expect(page.locator('#palette-swatches span')).toHaveCount(0);
});

test('keeps the preview in place when sidebar content changes', async ({ page }) => {
  await load(page, { name: 'landscape.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#678253"/></svg>') });
  // Compare document positions so the test does not confuse scrolling a control
  // into view on a phone with movement caused by the sidebar layout.
  const bounds = () => page.locator('#preview').evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
  });
  const original = await bounds();
  async function expectStable() {
    const current = await bounds();
    for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(current[key] - original[key])).toBeLessThan(1);
  }
  await page.locator('[data-mode="color"]').click(); await ready(page); await expectStable();
  await page.locator('#palette').selectOption('5'); await ready(page); await expectStable();
  await page.locator('[data-mode="chroma"]').click(); await ready(page); await expectStable();
  await page.locator('[data-mode="value"]').click(); await ready(page);
  await page.locator('[data-level="7"]').click(); await ready(page); await expectStable();
  await page.locator('#boundary-details summary').click(); await expectStable();
  await page.locator('#group-gray-details summary').click(); await expectStable();
  await page.locator('#sample-toggle').click(); await expectStable();
});

test('puts the photograph first on compact screens while keeping image replacement available', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('.empty')).toBeVisible();
  await expect(page.locator('#change-image')).toBeHidden();
  await page.locator('#file').setInputFiles({ name: 'compact.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#678253"/></svg>') });
  await ready(page);
  const compact = page.viewportSize().width <= 1100;
  if (compact) {
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('.intro')).toBeHidden();
    await expect(page.locator('footer')).toBeHidden();
    await expect(page.locator('#change-image')).toBeVisible();
    const layout = await page.evaluate(() => {
      const image = document.querySelector('#preview').getBoundingClientRect();
      const viewport = document.querySelector('#dropzone').getBoundingClientRect();
      const open = document.querySelector('#change-image').getBoundingClientRect();
      return { imageTop: image.top + scrollY, imageWidth: image.width, imageHeight: image.height, viewportHeight: viewport.height, openHeight: open.height, pageWidth: document.documentElement.scrollWidth, screenWidth: innerWidth };
    });
    expect(layout.imageTop).toBeLessThan(70);
    expect(layout.viewportHeight - layout.imageHeight).toBeLessThanOrEqual(18);
    expect(layout.openHeight).toBeGreaterThanOrEqual(44);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.screenWidth);
    const choosing = page.waitForEvent('filechooser');
    await page.locator('#change-image').click();
    await (await choosing).setFiles(fixture); await ready(page);
    await expect(page.locator('#image-label')).toHaveText(fixture.name);
    await page.locator('[data-mode="color"]').click(); await ready(page);
    await expect(page.locator('#change-image')).toBeVisible();
  } else {
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('.intro')).toBeVisible();
    await expect(page.locator('#change-image')).toBeHidden();
  }
});

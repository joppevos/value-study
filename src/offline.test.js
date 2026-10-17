import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import configuration from '../vite.config.js';

function serviceWorker() {
  const emitted = [];
  configuration.plugins[0].generateBundle.call({ emitFile(file) { emitted.push(file); } }, {}, {
    'assets/app.js': { code: 'app' }, 'assets/worker.js': { code: 'worker' }, 'assets/style.css': { source: 'css' },
  });
  return emitted[0].source;
}

test('offline shell caches index, worker, styles and manifest without caching photo requests', async () => {
  const listeners = new Map(), cacheContents = new Map();
  let installedURLs;
  const cache = {
    async addAll(urls) { installedURLs = urls; for (const url of urls) cacheContents.set(url, { url }); },
    async match(request) { return cacheContents.get(typeof request === 'string' ? request : request.url); },
  };
  vm.runInNewContext(serviceWorker(), {
    self: { location: { origin: 'https://still.test' }, addEventListener: (name, handler) => listeners.set(name, handler), skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => [] }, URL, Response,
    fetch: async () => { throw new Error('Offline'); },
  });
  let completion;
  listeners.get('install')({ waitUntil(promise) { completion = promise; } }); await completion;
  assert.ok(installedURLs.includes('./index.html'));
  assert.ok(installedURLs.includes('./assets/worker.js'));
  assert.ok(installedURLs.includes('./assets/style.css'));
  assert.ok(installedURLs.includes('./manifest.webmanifest'));
  let response;
  listeners.get('fetch')({ request: { url: 'https://still.test/', method: 'GET', mode: 'navigate' }, respondWith(promise) { response = promise; } });
  assert.equal((await response).url, './index.html');
  let intercepted = false;
  listeners.get('fetch')({ request: { url: 'https://elsewhere.test/image.jpg', method: 'GET' }, respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
  listeners.get('fetch')({ request: { url: 'https://still.test/upload', method: 'POST' }, respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
  assert.ok(!installedURLs.some(url => /photo|study-image/.test(url)));
});

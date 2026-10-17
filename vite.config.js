import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: process.env.STILL_BASE_PATH || '/',
  plugins: [{
    name: 'still-offline-shell',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(name => !name.endsWith('.map'));
      if (!files.includes('index.html')) files.push('index.html');
      files.push('manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png');
      const publicContent = ['index.html', 'public/manifest.webmanifest', 'public/icon.svg', 'public/icon-192.png', 'public/icon-512.png'].map(name => readFileSync(new URL(name, import.meta.url)));
      const hash = createHash('sha256').update(files.join('\n') + Object.values(bundle).map(file => file.code ?? file.source ?? '').join(''));
      for (const bytes of publicContent) hash.update(bytes);
      const revision = hash.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'still-shell-${revision}';
const URLS = ${JSON.stringify(files.map(name => './' + name))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('still-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Only invariant public app files are cached. Origin-varying server headers
    // must not prevent a cached module or stylesheet from loading offline.
    const cached = await cache.match(event.request, { ignoreVary: true });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      throw error;
    }
  }));
});` });
    },
  }],
});

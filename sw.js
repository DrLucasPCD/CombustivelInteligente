const CACHE_PREFIX = 'combustivel-inteligente-';
const CACHE = `${CACHE_PREFIX}v3`;
const ASSETS = ['./', './index.html', './styles.css', './src/app.js', './src/calculator.js',
  './src/vehicles.js', './src/maintenance.js', './src/maintenance-model.js', './src/maintenance-planner.js', './src/maintenance-schedule.js', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  ...[400, 500, 600, 700].map(weight => `./assets/fonts/dm-sans-${weight}.ttf`),
  ...[400, 500, 600, 700, 800].map(weight => `./assets/fonts/manrope-${weight}.ttf`)];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  // Cache only the app shell. Source/API links remain ordinary network requests.
  const known = ASSETS.some(asset => new URL(asset, self.registration.scope).href === url.href);
  if (!known && event.request.mode !== 'navigate') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return cached || (event.request.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }
  }));
});

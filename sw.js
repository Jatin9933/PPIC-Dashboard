// PPIC Dashboard — Service Worker
// Caches the static app shell so the installed app opens instantly and
// still loads (read-only, last-cached view) if the device is briefly offline.
// Live data always comes from Firebase over the network — this worker never
// caches or intercepts Firebase requests.

const CACHE_VERSION = 'ppic-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never touch cross-origin calls (Firebase Auth/Database/Analytics, gstatic SDK, etc.)
  // — always go straight to the network so data stays live and auth works correctly.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Only handle GET requests for same-origin static shell files.
  if (event.request.method !== 'GET') return;

  // Network-first for the HTML document so logic/rule updates are picked up
  // immediately when online; falls back to the cached shell when offline.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for icons/manifest — static and versioned by filename.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

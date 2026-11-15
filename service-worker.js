/* ==========================================================================
   FocalCalc — service-worker.js
   Caches the app shell so FocalCalc works offline.

   Strategy: stale-while-revalidate. Files are served instantly from the cache
   and refreshed from the network in the background, so an update appears the
   next time the app is opened.

   IMPORTANT: when you change any app file, bump CACHE_VERSION so that
   installed copies drop the old cache and fetch the new files.
   ========================================================================== */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `focalcalc-${CACHE_VERSION}`;

// Everything needed to run offline (paths are relative to this file)
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove caches from older versions and take control of open pages
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('focalcalc-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: answer from the cache, refresh it in the background
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(handleRequest(event, request));
});

async function handleRequest(event, request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  // Start a network fetch; on success, store a fresh copy
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);   // let the background refresh finish
    return cached;
  }

  const response = await network;
  if (response) return response;

  // Offline and not cached: fall back to the app page for navigations
  if (request.mode === 'navigate') {
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

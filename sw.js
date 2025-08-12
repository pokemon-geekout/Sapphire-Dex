const CACHE = 'hoenn-dex-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.v5.css',
  './app_all.v5.js',
  './app_data_all.json?v=5',
  './manifest.webmanifest?v=5',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('app_data_all.json') || url.searchParams.get('v') === '5') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(e.request);
      const networkFetch = fetch(e.request).then(resp => {
        cache.put(e.request, resp.clone());
        return resp;
      }).catch(() => null);
      return cached || networkFetch || fetch(e.request);
    })());
    return;
  }
  e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
});

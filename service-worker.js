const CACHE_NAME = "money-budget-cache-v6-1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=6.0",
  "./app.js?v=6.0",
  "./theme.js?v=6.0",
  "./manifest.json",
  "./service-worker.js",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

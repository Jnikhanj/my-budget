const CACHE_NAME = "money-budget-cache-v7-3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=7.2",
  "./app.js?v=7.2",
  "./theme.js?v=7.2",
  "./budget-pace.js?v=7.3",
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
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

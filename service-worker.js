const CACHE_NAME = "money-budget-v134-web";
const STATIC_ASSETS = [
  "./", "./index.html", "./style.css?v=10.4", "./app.js?v=10.4", "./theme.js?v=10.4",
  "./merchant-logos.js?v=2.1", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./logos/coles.png", "./logos/woolworths.png", "./logos/kmart.png", "./logos/toyota.png",
  "./logos/spotify.png", "./logos/netflix.png", "./logos/kfc.png", "./logos/hungry-jacks.png",
  "./logos/mcdonalds.png", "./logos/dominos.svg"
];
const MERCHANT_LOGO_SCRIPT = '<script src="./merchant-logos.js?v=2.1" data-auto-merchant-logos></script>';

function injectMerchantLogoScript(html) {
  if (!html || html.includes("data-auto-merchant-logos") || html.includes("merchant-logos.js")) return html;
  return html.replace("</body>", `${MERCHANT_LOGO_SCRIPT}\n</body>`);
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const isHtml = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    event.respondWith(
      fetch(request)
        .then(async response => {
          const html = injectMerchantLogoScript(await response.text());
          const result = new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", result.clone());
          return result;
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");
          return cached || new Response("Money Budget is unavailable offline.", { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(async response => {
      if (response.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    }))
  );
});

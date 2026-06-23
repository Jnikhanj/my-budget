const CACHE_NAME = "money-budget-dev-v8-logo-fix-15";
const MERCHANT_LOGO_SCRIPT = '<script src="./merchant-logos.js?v=1.5" data-auto-merchant-logos></script>';

function injectMerchantLogoScript(html) {
  if (!html || html.includes("data-auto-merchant-logos") || html.includes("merchant-logos.js")) return html;
  return html.replace("</body>", `${MERCHANT_LOGO_SCRIPT}\n</body>`);
}

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const accept = request.headers.get("accept") || "";
  const isHtmlRequest = request.mode === "navigate" || accept.includes("text/html");

  if (isHtmlRequest) {
    event.respondWith(
      fetch(request)
        .then(response => response.text())
        .then(html => new Response(injectMerchantLogoScript(html), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
        }))
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

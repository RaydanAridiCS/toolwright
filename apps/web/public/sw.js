/* Toolwright service worker: makes tools you have opened work offline.
 *  - /_next/static/*, /pdfjs/* (PDF.js fonts and character maps) and other build assets: cache-first (_next/static is content-hashed; /pdfjs is not, so bump CACHE_VERSION when pdfjs-dist is upgraded).
 *  - Page navigations: network-first, falling back to the cached page, then to /offline.html.
 *  - API calls and non-GET requests are never cached.
 * Bump CACHE_VERSION to invalidate everything.
 */
const CACHE_VERSION = "v1";
const STATIC_CACHE = `toolwright-static-${CACHE_VERSION}`;
const PAGE_CACHE = `toolwright-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("toolwright-") && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  const isAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pdfjs/") || /\.(?:js|css|woff2?|png|svg|ico|webmanifest|wasm)$/.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

// EventSphere service worker.
//
// Caching strategy (v4):
//  - HTML / navigation requests are NETWORK-FIRST, so a new build is picked up
//    immediately; the cached shell is only used when the network fails (offline).
//    The previous cache-first version kept serving a stale index.html + bundle
//    after every rebuild, which hid freshly deployed UI.
//  - Immutable build assets under /assets/ and other static files are
//    cache-first, which keeps repeat visits fast.
//  - API calls, Socket.IO, non-GET requests, cross-origin requests and local
//    dev-server module URLs (/src/...) are never intercepted or cached.
const CACHE = "eventsphere-v4";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

const STATIC_ASSET = /\.(?:css|mjs|js|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm)$/i;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: use the browser default
  if (url.pathname.startsWith("/api/")) return; // never cache API responses
  if (url.pathname.startsWith("/socket.io/")) return; // never cache realtime traffic

  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (request.mode === "navigate" || acceptsHtml) {
    // Network-first for the app shell so rebuilds appear on the next load.
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put("/index.html", fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match("/index.html")) ||
            (await caches.match("/")) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // Cache only immutable production assets; skip dev-server module paths.
  const isImmutable =
    url.pathname.startsWith("/assets/") ||
    (STATIC_ASSET.test(url.pathname) && !url.pathname.startsWith("/src/"));
  if (!isImmutable) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});

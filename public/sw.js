/* Service worker INFOSPRO — vanilla (pas Workbox).
 * Stratégies :
 *  - /_next/static + images : cache-first
 *  - navigations (pages)    : network-first avec repli cache, puis "/"
 *  - /admin/** et /api/**   : JAMAIS mis en cache (réseau uniquement)
 */
const VERSION = "infospro-v3";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const MAX_PAGES = 30;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("infospro-") && k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isNeverCache(url) {
  return (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth")
  );
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/media-") ||
    /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|css|js)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (isNeverCache(url)) return; // réseau pur

  // Stale-while-revalidate : assets statiques — réponse immédiate depuis
  // le cache, mise à jour en arrière-plan (le rechargement suivant voit
  // les nouveautés ; les URL /_next/static sont de toute façon hachées).
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        const response = await network;
        return response || Response.error();
      })(),
    );
    return;
  }

  // Network-first : navigations
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, response.clone());
            const keys = await cache.keys();
            if (keys.length > MAX_PAGES) await cache.delete(keys[0]);
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match("/")) || Response.error();
        }
      })(),
    );
  }
});

/* ── Notifications push ──────────────────────────────────────────────── */

self.addEventListener("push", (event) => {
  let payload = { title: "INFOSPRO", body: "Nouvelle publication", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* payload texte invalide → défauts */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: "infospro-publication",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});

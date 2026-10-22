// Facade Report service worker: lets field mode (/field) open with no signal.
// - /_next/static/* (build files, never change): cache first.
// - Page loads: network first; offline → the saved /field page.
// - Everything else (data, server actions, Supabase): straight to the network.

const SHELL_CACHE = "fr-shell-v1";
const STATIC_CACHE = "fr-static-v1";
const REFRESH_EVERY_MS = 10 * 60 * 1000;
let lastShellRefresh = 0;

// Saves /field and the build files it loads. Skipped when signed out (the
// request is redirected to /login); tried again on the next visit.
async function cacheShell() {
  const res = await fetch("/field", { credentials: "same-origin", cache: "no-store" });
  if (!res.ok || res.redirected || new URL(res.url).pathname !== "/field") return;
  const html = await res.clone().text();
  const shell = await caches.open(SHELL_CACHE);
  await shell.put("/field", res);

  const statics = await caches.open(STATIC_CACHE);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || []);
  await Promise.all(
    [...assets].map(async (url) => {
      if (await statics.match(url)) return;
      try {
        const r = await fetch(url);
        if (r.ok) await statics.put(url, r);
      } catch {
        // Will be cached when the page loads it.
      }
    }),
  );
  for (const url of ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/apple-touch-icon.png"]) {
    try {
      const r = await fetch(url);
      if (r.ok) await shell.put(url, r);
    } catch {
      // Not needed for capture.
    }
  }
  lastShellRefresh = Date.now();
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, STATIC_CACHE];
      for (const name of await caches.keys()) if (!keep.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

// Pages ask for a refresh while online, so a new deploy reaches field mode.
self.addEventListener("message", (event) => {
  if (event.data === "refresh-shell" && Date.now() - lastShellRefresh > REFRESH_EVERY_MS) {
    event.waitUntil(cacheShell().catch(() => {}));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const shell = await caches.match("/field", { ignoreSearch: true });
          return (
            shell ||
            new Response(
              "<!doctype html><meta name=viewport content='width=device-width'><title>Offline</title>" +
                "<p style='font:16px system-ui;padding:16px'>You're offline. Open a project once while online to use field mode.</p>",
              { headers: { "content-type": "text/html; charset=utf-8" } },
            )
          );
        }
      })(),
    );
    return;
  }

  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/")) {
    event.respondWith(fetch(req).catch(async () => (await caches.match(url.pathname)) || Response.error()));
  }
});

import { getAppVersion } from "@/lib/app-version";

export const dynamic = "force-static";

/**
 * Service worker gerado no build com a versão do deploy embutida.
 * Assim o browser detecta mudança a cada release (byte-diff do /sw.js).
 *
 * Ícones / favicon / manifest: network-first (atualiza a marca sem reinstall
 * do SW stale). Demais assets estáticos: stale-while-revalidate.
 */
export function GET() {
  const version = getAppVersion();
  const cache = `melza-${version}`;

  const body = `/* Melza SW ${version} — network-first brand + auto-update */
const CACHE = ${JSON.stringify(cache)};
const VERSION = ${JSON.stringify(version)};
const PRECACHE = [
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data === "GET_VERSION") {
    event.ports?.[0]?.postMessage({ version: VERSION });
  }
  if (event.data === "CLEAR_BRAND_CACHE") {
    event.waitUntil(
      caches.open(CACHE).then(async (cache) => {
        const keys = await cache.keys();
        await Promise.all(
          keys
            .filter((req) => {
              const p = new URL(req.url).pathname;
              return (
                p.startsWith("/icons/") ||
                p.startsWith("/brand/") ||
                p.startsWith("/favicon") ||
                p.endsWith(".webmanifest")
              );
            })
            .map((req) => cache.delete(req))
        );
      })
    );
  }
});

function isBrandAsset(pathname) {
  return (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".webmanifest")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // Marca / manifest: sempre tenta rede primeiro (ícone PWA e favicon novos)
  if (isBrandAsset(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  const isStaticAsset = url.pathname.startsWith("/_next/static/");

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.mode === "navigate") {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((r) => r || caches.match("/dashboard") || caches.match("/"))
      )
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Melza",
    body: "Você tem um aviso",
    url: "/dashboard",
    tag: "melza",
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {
    try {
      const text = event.data && event.data.text();
      if (text) data.body = text;
    } catch (__) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Melza", {
      body: data.body || "",
      icon: "/icons/icon-192.png?v=" + encodeURIComponent(VERSION),
      badge: "/icons/icon-192.png?v=" + encodeURIComponent(VERSION),
      tag: data.tag || "melza",
      data: { url: data.url || "/dashboard" },
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}

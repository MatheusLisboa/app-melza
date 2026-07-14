import { getAppVersion } from "@/lib/app-version";

export const dynamic = "force-static";

/**
 * Service worker gerado no build com a versão do deploy embutida.
 * Assim o browser detecta mudança a cada release (byte-diff do /sw.js).
 */
export function GET() {
  const version = getAppVersion();
  const cache = `melza-${version}`;

  const body = `/* Melza SW ${version} — network-first + auto-update */
const CACHE = ${JSON.stringify(cache)};
const VERSION = ${JSON.stringify(version)};
const PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/icon-180.png",
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
});

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

  const isStaticAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.startsWith("/favicon");

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
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}

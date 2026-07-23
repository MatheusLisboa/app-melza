"use client";

import { useEffect } from "react";

const STORAGE_KEY = "melza-app-version";
const BRAND_KEY = "melza-brand-assets";
const CHECK_MS = 60_000;

async function clearAppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

/**
 * Mantém o PWA na versão mais recente e força refresh de ícones/manifest:
 * - SW embute o commit do deploy (byte-diff a cada release)
 * - poll de /api/version → limpa cache + reload se mudou
 * - limpa cache de brand assets ao abrir a sessão
 * - checa no foco, ao voltar online e a cada 1 min
 *
 * Nota: ícone na home screen do iOS NÃO atualiza via web — só removendo
 * e adicionando de novo. Android/Chrome costuma atualizar após visitar o app.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    let disposed = false;

    const reloadOnce = () => {
      if (refreshing || disposed) return;
      refreshing = true;
      window.location.reload();
    };

    const onControllerChange = () => reloadOnce();
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    async function clearBrandCaches(reg: ServiceWorkerRegistration) {
      const worker = reg.active || reg.waiting || reg.installing;
      worker?.postMessage("CLEAR_BRAND_CACHE");
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys.map(async (name) => {
            const cache = await caches.open(name);
            const reqs = await cache.keys();
            await Promise.all(
              reqs
                .filter((req) => {
                  try {
                    const p = new URL(req.url).pathname;
                    return (
                      p.startsWith("/icons/") ||
                      p.startsWith("/brand/") ||
                      p.startsWith("/favicon") ||
                      p.endsWith(".webmanifest")
                    );
                  } catch {
                    return false;
                  }
                })
                .map((req) => cache.delete(req))
            );
          })
        );
      }
    }

    async function applyIfNewVersion(remoteVersion: string) {
      const local = localStorage.getItem(STORAGE_KEY);
      if (!local) {
        localStorage.setItem(STORAGE_KEY, remoteVersion);
        return false;
      }
      if (local === remoteVersion) return false;

      localStorage.setItem(STORAGE_KEY, remoteVersion);
      await clearAppCaches();
      return true;
    }

    async function checkVersion(): Promise<boolean> {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { version?: string };
        if (!data.version) return false;
        return applyIfNewVersion(data.version);
      } catch {
        return false;
      }
    }

    async function setup() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
          scope: "/",
        });

        const promote = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.postMessage("SKIP_WAITING");
        };

        if (reg.waiting) promote(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            if (
              incoming.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promote(incoming);
            }
          });
        });

        if (!sessionStorage.getItem(BRAND_KEY)) {
          sessionStorage.setItem(BRAND_KEY, "1");
          await clearBrandCaches(reg);
          try {
            await fetch(`/manifest.webmanifest?t=${Date.now()}`, {
              cache: "no-store",
            });
          } catch {
            /* ignore */
          }
        }

        const refresh = async () => {
          if (disposed) return;
          const versionChanged = await checkVersion();
          try {
            await reg.update();
          } catch {
            /* ignore */
          }
          if (reg.waiting) promote(reg.waiting);
          if (versionChanged) {
            await clearBrandCaches(reg);
            window.setTimeout(reloadOnce, 350);
          }
        };

        void refresh();

        const onFocus = () => void refresh();
        const onVisible = () => {
          if (document.visibilityState === "visible") void refresh();
        };
        const onOnline = () => void refresh();
        const onPageShow = (e: PageTransitionEvent) => {
          if (e.persisted) void refresh();
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("online", onOnline);
        window.addEventListener("pageshow", onPageShow);
        const interval = window.setInterval(() => void refresh(), CHECK_MS);

        return () => {
          window.removeEventListener("focus", onFocus);
          document.removeEventListener("visibilitychange", onVisible);
          window.removeEventListener("online", onOnline);
          window.removeEventListener("pageshow", onPageShow);
          window.clearInterval(interval);
        };
      } catch {
        return undefined;
      }
    }

    let cleanup: (() => void) | undefined;
    void setup().then((fn) => {
      cleanup = fn;
    });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
      cleanup?.();
    };
  }, []);

  return null;
}

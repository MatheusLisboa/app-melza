"use client";

import { useEffect } from "react";

const STORAGE_KEY = "melza-app-version";
const CHECK_MS = 3 * 60_000;

async function clearAppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

/**
 * Mantém o PWA (Add to Home Screen) na versão mais recente:
 * - SW embute o commit do deploy (byte-diff a cada release)
 * - poll de /api/version → limpa cache + reload se mudou
 * - checa no foco, ao voltar online e a cada 30s
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
            // Garante reload mesmo se controllerchange não vier (iOS)
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
          // iOS restaura do bfcache sem "focus"
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

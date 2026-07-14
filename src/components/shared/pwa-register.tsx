"use client";

import { useEffect } from "react";

/**
 * Registra o service worker e força atualização automática:
 * - verifica updates no load + ao focar a aba + a cada 60s
 * - novo SW → skipWaiting → reload quando assume o controle
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    async function setup() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
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

        const check = () => {
          void reg.update().catch(() => undefined);
        };
        check();
        const onFocus = () => check();
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
        const interval = window.setInterval(check, 60_000);

        return () => {
          window.removeEventListener("focus", onFocus);
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
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
      cleanup?.();
    };
  }, []);

  return null;
}

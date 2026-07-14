"use client";

import { useEffect } from "react";

/** Registra service worker para PWA (apenas em produção / HTTPS). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Em localhost também funciona (útil p/ testar)
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // silencioso
    });
  }, []);

  return null;
}

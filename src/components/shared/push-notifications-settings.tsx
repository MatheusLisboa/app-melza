"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn } from "@/components/design-system";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "loading" | "unsupported" | "denied" | "off" | "on" | "missing-config";

/**
 * Liga/desliga Web Push (notificações do sistema) no PWA.
 */
export function PushNotificationsSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const vapidRes = await fetch("/api/push/vapid");
      const vapid = (await vapidRes.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!vapid.configured || !vapid.publicKey) {
        setStatus("missing-config");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setMessage("Permissão negada. Ative nas configurações do celular.");
        return;
      }

      const vapidRes = await fetch("/api/push/vapid");
      const vapid = (await vapidRes.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!vapid.publicKey) {
        setStatus("missing-config");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Falha ao salvar");
      }

      setStatus("on");
      setMessage("Notificações ligadas neste aparelho.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível ativar");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Notificações desligadas neste aparelho.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao desligar");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Verificando notificações…</p>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador não suporta notificações push. No iPhone, adicione o Melza
        à tela inicial (iOS 16.4+).
      </p>
    );
  }

  if (status === "missing-config") {
    return (
      <p className="text-sm text-muted-foreground">
        Notificações ainda não configuradas no servidor (chaves VAPID).
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Permissão bloqueada. Libere notificações do Melza nas configurações do
        sistema.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Receba avisos de dívida Entre Nós (7+ dias), fatura vencendo e acerto
        registrado — mesmo com o app fechado.
      </p>
      <Btn
        variant={status === "on" ? "secondary" : "primary"}
        size="sm"
        disabled={busy}
        icon={
          status === "on" ? (
            <BellOff size={16} />
          ) : (
            <Bell size={16} />
          )
        }
        onClick={() => void (status === "on" ? disable() : enable())}
      >
        {busy
          ? "Aguarde…"
          : status === "on"
            ? "Desligar notificações"
            : "Ativar notificações"}
      </Btn>
      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}

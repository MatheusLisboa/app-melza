import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "mailto:hello@melza.app";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return Boolean(getVapid());
}

export function getVapidPublicKey(): string | null {
  return getVapid()?.publicKey ?? null;
}

let configured = false;

function ensureWebPush() {
  const vapid = getVapid();
  if (!vapid) throw new Error("VAPID não configurado");
  if (!configured) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    configured = true;
  }
}

export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  try {
    ensureWebPush();
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60 * 12,
      urgency: "normal",
    });
    return { ok: true };
  } catch (err) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode: number }).statusCode)
        : 0;
    if (status === 404 || status === 410) {
      return { ok: false, gone: true };
    }
    const message = err instanceof Error ? err.message : "Falha no push";
    return { ok: false, error: message };
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import { sendWebPush, type PushPayload, isPushConfigured } from "@/lib/push/web-push";

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Envia push para todos os devices do user. Remove subscriptions mortas. */
export async function notifyUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number }> {
  if (!isPushConfigured()) return { sent: 0 };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return { sent: 0 };

  let sent = 0;
  const goneIds: string[] = [];

  await Promise.all(
    (subs as SubRow[]).map(async (sub) => {
      const result = await sendWebPush(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      if (result.ok) sent += 1;
      if (result.gone) goneIds.push(sub.id);
    })
  );

  if (goneIds.length) {
    await admin.from("push_subscriptions").delete().in("id", goneIds);
  }

  return { sent };
}

/** Notifica o user_id de um workspace_member. */
export async function notifyMember(
  memberId: string,
  payload: PushPayload
): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member?.user_id) return { sent: 0 };
  return notifyUser(member.user_id, payload);
}

/**
 * Envia no máximo 1x por (user, kind, dedupeKey).
 * Retorna false se já foi enviado.
 */
export async function notifyUserOnce(
  userId: string,
  kind: string,
  dedupeKey: string,
  payload: PushPayload
): Promise<{ sent: number; skipped: boolean }> {
  if (!isPushConfigured()) return { sent: 0, skipped: true };

  const admin = createAdminClient();
  const { error } = await admin.from("push_notification_log").insert({
    user_id: userId,
    kind,
    dedupe_key: dedupeKey,
  });

  // unique violation → já notificado
  if (error) {
    if (error.code === "23505") return { sent: 0, skipped: true };
    // se log falhar, ainda tenta enviar
  }

  const { sent } = await notifyUser(userId, payload);
  return { sent, skipped: false };
}

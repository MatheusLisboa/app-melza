/**
 * Prévia confirmável para ações de escrita da IA.
 * O modelo recebe `previewId` no confirm=false e deve reenviá-lo
 * com confirm=true — não basta inventar confirm=true.
 */

type PendingWrite = {
  memberId: string;
  workspaceId: string;
  kind: string;
  signature: string;
  expiresAt: number;
};

const store = new Map<string, PendingWrite>();
const TTL_MS = 10 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const id of Array.from(store.keys())) {
    const row = store.get(id);
    if (row && row.expiresAt <= now) store.delete(id);
  }
}

export function signatureOf(payload: unknown): string {
  return JSON.stringify(payload);
}

export function stashAiWritePreview(input: {
  memberId: string;
  workspaceId: string;
  kind: string;
  payload: unknown;
}): string {
  prune();
  const id = crypto.randomUUID();
  store.set(id, {
    memberId: input.memberId,
    workspaceId: input.workspaceId,
    kind: input.kind,
    signature: signatureOf(input.payload),
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function consumeAiWritePreview(input: {
  previewId: string | undefined | null;
  memberId: string;
  workspaceId: string;
  kind: string;
  payload: unknown;
}): { ok: true } | { ok: false; error: string } {
  prune();
  if (!input.previewId?.trim()) {
    return {
      ok: false,
      error:
        "Falta previewId. Chame antes com confirm=false, mostre o preview e use o previewId retornado.",
    };
  }
  const row = store.get(input.previewId);
  if (!row) {
    return {
      ok: false,
      error: "Prévia expirada ou inválida. Peça confirmação de novo (confirm=false).",
    };
  }
  if (
    row.memberId !== input.memberId ||
    row.workspaceId !== input.workspaceId ||
    row.kind !== input.kind
  ) {
    return { ok: false, error: "Prévia não corresponde a esta ação." };
  }
  if (row.signature !== signatureOf(input.payload)) {
    return {
      ok: false,
      error:
        "Dados mudaram desde a prévia. Gere de novo com confirm=false.",
    };
  }
  store.delete(input.previewId);
  return { ok: true };
}

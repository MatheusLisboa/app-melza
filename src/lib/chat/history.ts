const KEY = (workspaceId: string) => `melza-chat:${workspaceId}`;
const MAX = 40;

export type StoredChatMsg = { role: "user" | "assistant"; content: string };

export function loadChatHistory(workspaceId: string): StoredChatMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChatMsg[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    );
  } catch {
    return [];
  }
}

export function saveChatHistory(workspaceId: string, messages: StoredChatMsg[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY(workspaceId), JSON.stringify(messages.slice(-MAX)));
  } catch {
    // quota
  }
}

export function clearChatHistory(workspaceId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY(workspaceId));
}

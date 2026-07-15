import type { WorkspaceType } from "@/types";

export const WORKSPACE_TYPE_LABELS: Record<WorkspaceType, string> = {
  PERSONAL: "Pessoal",
  COUPLE: "Casal",
  FAMILY: "Família",
  SHARED: "Compartilhado",
};

export const SHARED_WORKSPACE_TYPES: WorkspaceType[] = [
  "COUPLE",
  "FAMILY",
  "SHARED",
];

/** Accents Melza v2 — ink (#111) como único accent de marca */
export const WORKSPACE_TYPE_ACCENT: Record<
  WorkspaceType,
  { color: string; emoji: string }
> = {
  PERSONAL: { color: "#111111", emoji: "👤" },
  COUPLE: { color: "#111111", emoji: "❤️" },
  FAMILY: { color: "#111111", emoji: "🏠" },
  SHARED: { color: "#111111", emoji: "💼" },
};

export function workspaceTypeLabel(type: WorkspaceType | string | undefined) {
  if (!type) return "Workspace";
  return WORKSPACE_TYPE_LABELS[type as WorkspaceType] ?? type;
}

export function workspaceAccent(type: WorkspaceType | string | undefined) {
  const t = (type as WorkspaceType) || "PERSONAL";
  return WORKSPACE_TYPE_ACCENT[t] ?? WORKSPACE_TYPE_ACCENT.PERSONAL;
}

/** COUPLE / FAMILY / SHARED — telas como Entre Nós */
export function isSharedWorkspace(type: WorkspaceType | string | undefined) {
  return SHARED_WORKSPACE_TYPES.includes((type as WorkspaceType) || "PERSONAL");
}

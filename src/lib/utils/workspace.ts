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

/** Accents visuais Make por tipo (até schema ter emoji/color) */
export const WORKSPACE_TYPE_ACCENT: Record<
  WorkspaceType,
  { color: string; emoji: string }
> = {
  PERSONAL: { color: "#6366F1", emoji: "👤" },
  COUPLE: { color: "#EC4899", emoji: "❤️" },
  FAMILY: { color: "#14B8A6", emoji: "🏠" },
  SHARED: { color: "#F59E0B", emoji: "💼" },
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

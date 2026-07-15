import { z } from "zod";

/**
 * Boolean opcional para tools.
 * Evitar z.union/transform no schema — Groq falha com "Failed to call a function".
 */
export const toolBool = z.boolean().optional();

/** Aceita boolean ou string residual na execução (não use no inputSchema). */
export function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}
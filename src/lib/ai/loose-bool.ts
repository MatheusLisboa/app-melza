import { z } from "zod";

/** Groq/LLMs often pass booleans as "true"/"false" strings. */
export const looseBool = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === "boolean") return v;
    return v === "true" || v === "1";
  });

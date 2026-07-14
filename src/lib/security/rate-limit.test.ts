import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";
import { workspaceTypeLabel } from "@/lib/utils/workspace";

describe("rateLimit", () => {
  it("allows up to limit then blocks", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    const blocked = rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("workspaceTypeLabel", () => {
  it("maps known types", () => {
    expect(workspaceTypeLabel("PERSONAL")).toBe("Pessoal");
    expect(workspaceTypeLabel("COUPLE")).toBe("Casal");
    expect(workspaceTypeLabel("FAMILY")).toBe("Família");
    expect(workspaceTypeLabel("SHARED")).toBe("Compartilhado");
  });
});

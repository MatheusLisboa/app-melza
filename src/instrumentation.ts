export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertPublicEnv } = await import("@/lib/env");
    assertPublicEnv();
  }
}

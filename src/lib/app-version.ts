/**
 * Bump manual quando trocar favicon / ícones PWA / brand assets.
 * Combina com o SHA do deploy para cache-bust de ícones no manifest.
 */
export const BRAND_ASSET_VERSION = "20260723b";

/** Version do build — muda a cada deploy na Vercel. */
export function getAppVersion(): string {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "";
  if (sha) return sha.slice(0, 12);
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}

/** Versão usada em ?v= de ícones / favicon / lockup. */
export function getBrandAssetVersion(): string {
  return `${getAppVersion()}-${BRAND_ASSET_VERSION}`;
}

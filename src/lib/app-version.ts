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

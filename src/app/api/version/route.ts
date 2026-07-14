import { getAppVersion } from "@/lib/app-version";

export const dynamic = "force-static";

/** Versão do app no ar — o PWA polla isso e recarrega se mudou. */
export function GET() {
  return Response.json(
    { version: getAppVersion() },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}

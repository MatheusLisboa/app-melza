import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push/web-push";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { configured: false, publicKey: null },
      { status: 200 }
    );
  }
  return NextResponse.json({
    configured: true,
    publicKey: getVapidPublicKey(),
  });
}

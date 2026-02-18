import { NextResponse } from "next/server";
import { isAuthenticated, getRefreshToken, ensureBootstrapped } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrapped();
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const refreshToken = getRefreshToken();
  return NextResponse.json({
    hasRefreshToken: !!refreshToken,
    refreshToken: refreshToken ?? null,
  });
}

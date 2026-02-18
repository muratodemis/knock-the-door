import { NextResponse } from "next/server";
import { isAuthenticated, getRefreshToken } from "@/lib/google-auth";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const refreshToken = getRefreshToken();
  return NextResponse.json({
    hasRefreshToken: !!refreshToken,
    refreshToken: refreshToken ?? null,
  });
}

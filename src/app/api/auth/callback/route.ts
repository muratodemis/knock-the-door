import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google-auth";

const basePath = process.env.BASE_PATH || "";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL(`${basePath}/boss?error=no_code`, request.url));
  }

  try {
    await handleCallback(code);
    return NextResponse.redirect(new URL(`${basePath}/boss?google=connected`, request.url));
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL(`${basePath}/boss?error=auth_failed`, request.url));
  }
}

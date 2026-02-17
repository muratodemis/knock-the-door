import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google-auth";

const basePath = process.env.NODE_ENV === "production" ? "/knock" : "";

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3012";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const baseUrl = getBaseUrl(request);

  if (!code) {
    return NextResponse.redirect(`${baseUrl}${basePath}/boss?error=no_code`);
  }

  try {
    await handleCallback(code);
    return NextResponse.redirect(`${baseUrl}${basePath}/boss?google=connected`);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(`${baseUrl}${basePath}/boss?error=auth_failed`);
  }
}

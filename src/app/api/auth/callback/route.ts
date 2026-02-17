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
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = getBaseUrl(request);

  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(`${baseUrl}${basePath}/boss?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}${basePath}/boss?error=no_code`);
  }

  try {
    await handleCallback(code);
    return NextResponse.redirect(`${baseUrl}${basePath}/boss?google=connected`);
  } catch (err: any) {
    const msg = err?.message || "unknown_error";
    console.error("Google OAuth callback error:", msg, err);
    return NextResponse.redirect(`${baseUrl}${basePath}/boss?error=${encodeURIComponent(msg)}`);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google-auth";

const baseUrl = process.env.NODE_ENV === "production"
  ? "https://murat.org/knock"
  : "http://localhost:3012";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(`${baseUrl}/boss?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/boss?error=no_code`);
  }

  try {
    await handleCallback(code);
    return NextResponse.redirect(`${baseUrl}/boss?google=connected`);
  } catch (err: any) {
    const msg = err?.message || "unknown_error";
    console.error("Google OAuth callback error:", msg, err);
    return NextResponse.redirect(`${baseUrl}/boss?error=${encodeURIComponent(msg)}`);
  }
}

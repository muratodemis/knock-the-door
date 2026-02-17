import { NextRequest, NextResponse } from "next/server";
import { handleCallback, isAuthenticated } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({
      authenticated: isAuthenticated(),
      env: {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.NODE_ENV === "production"
          ? "https://murat.org/knock/api/auth/callback"
          : "http://localhost:3012/api/auth/callback",
        nodeEnv: process.env.NODE_ENV,
      },
    });
  }

  try {
    const tokens = await handleCallback(code);
    return NextResponse.json({
      success: true,
      authenticated: isAuthenticated(),
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 3),
    });
  }
}

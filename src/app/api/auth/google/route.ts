import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}

import { NextResponse } from "next/server";
import { isAuthenticated, ensureBootstrapped } from "@/lib/google-auth";

export async function GET() {
  await ensureBootstrapped();
  return NextResponse.json({ authenticated: isAuthenticated() });
}

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/google-auth";

export async function GET() {
  return NextResponse.json({ authenticated: isAuthenticated() });
}

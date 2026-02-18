import { NextResponse } from "next/server";
import { isAuthenticated, listCalendars, ensureBootstrapped } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrapped();
  if (!isAuthenticated()) {
    return NextResponse.json(
      { error: "Google hesabi bagli degil" },
      { status: 401 }
    );
  }

  try {
    const calendars = await listCalendars();
    return NextResponse.json({ calendars });
  } catch (error: any) {
    console.error("Calendar list error:", error);
    return NextResponse.json(
      { error: error.message || "Takvim listesi alinamadi" },
      { status: 500 }
    );
  }
}

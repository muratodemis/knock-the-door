import { NextResponse } from "next/server";
import { isAuthenticated, listCalendars } from "@/lib/google-auth";

export async function GET() {
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

import { NextResponse } from "next/server";
import { isAuthenticated, getTodayBusySlots, ensureBootstrapped } from "@/lib/google-auth";

export async function GET() {
  await ensureBootstrapped();
  if (!isAuthenticated()) {
    return NextResponse.json({ slots: [], connected: false });
  }

  try {
    const slots = await getTodayBusySlots();
    return NextResponse.json({ slots, connected: true });
  } catch (error: any) {
    console.error("Calendar events error:", error);
    return NextResponse.json(
      { error: error.message || "Takvim verileri alinamadi", slots: [], connected: true },
      { status: 500 }
    );
  }
}

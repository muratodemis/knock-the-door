import { NextResponse } from "next/server";
import { getSelectedCalendarId, setSelectedCalendarId } from "@/lib/google-auth";

export async function GET() {
  const selectedCalendarId = getSelectedCalendarId();
  return NextResponse.json({ selectedCalendarId });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId } = body;

    if (!calendarId || typeof calendarId !== "string") {
      return NextResponse.json(
        { error: "calendarId gerekli" },
        { status: 400 }
      );
    }

    setSelectedCalendarId(calendarId);
    return NextResponse.json({ success: true, selectedCalendarId: calendarId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Ayar kaydedilemedi" },
      { status: 500 }
    );
  }
}

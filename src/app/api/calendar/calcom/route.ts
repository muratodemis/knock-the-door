import { NextResponse } from "next/server";
import { getCalComUrl, setCalComUrl } from "@/lib/google-auth";

const DEFAULT_CAL_URL = "cal.com/muratodemis";

export async function GET() {
  const calComUrl = getCalComUrl() || DEFAULT_CAL_URL;
  return NextResponse.json({ calComUrl });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calComUrl } = body;

    if (!calComUrl || typeof calComUrl !== "string") {
      return NextResponse.json(
        { error: "calComUrl gerekli" },
        { status: 400 }
      );
    }

    setCalComUrl(calComUrl);
    return NextResponse.json({ success: true, calComUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Ayar kaydedilemedi" },
      { status: 500 }
    );
  }
}

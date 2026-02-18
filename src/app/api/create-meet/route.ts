import { NextResponse } from "next/server";
import { createGoogleMeet, isAuthenticated, ensureBootstrapped } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await ensureBootstrapped();
  if (!isAuthenticated()) {
    return NextResponse.json(
      { error: "Google hesabı bağlı değil" },
      { status: 401 }
    );
  }

  try {
    const meetLink = await createGoogleMeet();
    return NextResponse.json({ meetLink });
  } catch (error: any) {
    console.error("Meet creation error:", error);
    return NextResponse.json(
      { error: error.message || "Toplantı oluşturulamadı" },
      { status: 500 }
    );
  }
}

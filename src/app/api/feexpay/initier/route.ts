// This route is kept for backward compatibility but the new flow uses /api/sessions/[id]/payer
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Deprecated. Use /api/sessions/[id]/payer instead." },
    { status: 410 }
  );
}

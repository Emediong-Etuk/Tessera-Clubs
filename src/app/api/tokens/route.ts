import { NextResponse } from "next/server";
import { getTesseraTokens } from "@/lib/tessera";

export async function GET() {
  try {
    const tokens = await getTesseraTokens();
    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Tessera tokens" },
      { status: 502 }
    );
  }
}

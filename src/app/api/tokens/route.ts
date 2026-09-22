import { NextResponse } from "next/server";
import { getTokenOverviews } from "@/lib/tokenOverview";
import { humanizeChainError } from "@/lib/chainErrors";

export async function GET() {
  try {
    const tokens = await getTokenOverviews();
    return NextResponse.json({ tokens });
  } catch (err) {
    console.error("Failed to fetch token overviews:", err);
    return NextResponse.json({ error: humanizeChainError(err) }, { status: 502 });
  }
}

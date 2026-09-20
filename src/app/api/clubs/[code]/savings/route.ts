import { NextResponse } from "next/server";
import { buildSavingsPreview, getClubByCodeOrId } from "@/lib/club";
import { humanizeChainError } from "@/lib/chainErrors";

// The centerpiece screen's data source. Everything returned here traces
// back to a live Jupiter quote call or a live Solana RPC call made just
// now -- nothing is cached beyond the process lifetime of this request.
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  try {
    const preview = await buildSavingsPreview(club);
    if (!preview) {
      return NextResponse.json({ available: false, reason: "No pending contributions to compare yet" });
    }
    return NextResponse.json({
      available: true,
      source: "live Tessera token registry + live Jupiter quote data",
      memberCount: preview.memberCount,
      totalPendingUsdc: preview.totalPendingUsdc,
      comparison: preview.comparison,
    });
  } catch (err) {
    console.error("Failed to compute savings preview for club", club.id, err);
    return NextResponse.json({ error: humanizeChainError(err) }, { status: 502 });
  }
}

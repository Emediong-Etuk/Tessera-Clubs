import { notFound } from "next/navigation";
import {
  getClubByCodeOrId,
  getClubTTokenBalance,
  getMemberPositions,
  getPendingPoolTotal,
} from "@/lib/club";
import { explorerUrl, formatToken, formatUsd, truncateAddress } from "@/lib/format";
import { BackLink } from "@/components/BackLink";
import { NavLink } from "@/components/NavLink";

export const dynamic = "force-dynamic";

// A read-only, shareable view of a club's stats -- no wallet needed, no
// action buttons. Meant for sharing outside the group (e.g. on socials or
// with someone deciding whether to join) without exposing the
// join/contribute/exit controls.
export default async function PublicClubPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const club = await getClubByCodeOrId(code);
  if (!club) notFound();

  const [members, tTokenBalance] = await Promise.all([
    getMemberPositions(club),
    getClubTTokenBalance(club),
  ]);
  const pendingPoolUsdc = getPendingPoolTotal(club);
  const goalPct = club.fundingGoalUsd ? Math.min(100, (pendingPoolUsdc / club.fundingGoalUsd) * 100) : null;
  const activeMembers = members.filter((m) => !m.hasExited);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <BackLink href="/" label="Home" />
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Read-only club view</p>
        <h1 className="text-2xl font-bold">{club.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pooling toward {club.targetTokenSymbol} &middot; club wallet{" "}
          <a
            className="underline underline-offset-2"
            href={explorerUrl(club.clubWalletAddress, "address")}
            target="_blank"
            rel="noreferrer"
          >
            {truncateAddress(club.clubWalletAddress)}
          </a>
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Pending pool" value={formatUsd(pendingPoolUsdc)} />
          <Stat label={`${club.targetTokenSymbol} held`} value={formatToken(tTokenBalance)} />
          <Stat label="Active members" value={String(activeMembers.length)} />
        </div>
        {goalPct !== null && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full bg-emerald-500" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {formatUsd(pendingPoolUsdc)} of {formatUsd(club.fundingGoalUsd!)} goal
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Members ({activeMembers.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Wallet</th>
                <th className="px-4 py-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => (
                <tr key={m.membershipId} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">{truncateAddress(m.walletAddress)}</td>
                  <td className="px-4 py-2">{(m.entitlementPct * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {activeMembers.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-center text-zinc-500">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        This is a hackathon MVP with a custodial pooling model &mdash; funds sit in a
        server-controlled wallet, not a trustless on-chain vault.
      </section>

      <NavLink
        href={`/clubs/${club.inviteCode}`}
        className="text-sm font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
      >
        Join or manage this club &rarr;
      </NavLink>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

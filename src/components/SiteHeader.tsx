"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">Tessera Clubs</span>
          <span className="hidden text-xs text-zinc-500 sm:inline">
            pooled access to T-Tokens
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/clubs/new" className="hidden font-medium hover:underline sm:inline">
            Create a club
          </Link>
          <Link href="/clubs/join" className="hidden font-medium hover:underline sm:inline">
            Join a club
          </Link>
          <WalletMultiButton style={{ height: 40, fontSize: 14 }} />
        </nav>
      </div>
    </header>
  );
}

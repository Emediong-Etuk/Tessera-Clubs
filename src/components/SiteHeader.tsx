"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { NavLink } from "./NavLink";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-baseline gap-2 transition-opacity hover:opacity-80">
          <span className="text-lg font-semibold tracking-tight">Tessera Clubs</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            pooled access to T-Tokens
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <NavLink
            href="/clubs/new"
            className="hidden font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Create a club
          </NavLink>
          <NavLink
            href="/clubs/join"
            className="hidden font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Join a club
          </NavLink>
          <WalletMultiButton style={{ height: 40, fontSize: 14 }} />
        </nav>
      </div>
    </header>
  );
}

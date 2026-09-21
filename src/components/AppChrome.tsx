"use client";

import { usePathname } from "next/navigation";
import { WalletProviders } from "@/components/WalletProviders";
import { SiteHeader } from "@/components/SiteHeader";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

// Housefile routes are a separate product from Tessera Clubs and bring
// their own header/nav — skip the Solana wallet chrome there instead of
// mounting wallet providers no Housefile page uses.
function isHousefileRoute(pathname: string) {
  return pathname.startsWith("/host") || pathname.startsWith("/stays");
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isHousefileRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <WalletProviders>
      <DisclaimerBanner />
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-zinc-200 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Built for the Tessera &quot;Private Equities for Everyone&quot; hackathon track.
        Not investment advice. Hackathon MVP &mdash; see custody disclaimer above.
      </footer>
    </WalletProviders>
  );
}

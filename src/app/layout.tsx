import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";
import { SiteHeader } from "@/components/SiteHeader";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

// Sets `data-theme` on <html> before the page paints, so a saved
// preference (from ThemeToggle) applies immediately instead of flashing
// the OS-default theme first. Reads localStorage directly rather than
// waiting for React to hydrate.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("tessera-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tessera Clubs",
  description:
    "Tessera Clubs aggregate small buyers into a single on-chain position, giving anyone access to efficient recurring exposure to pre-IPO T-Tokens.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <WalletProviders>
          <DisclaimerBanner />
          <SiteHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">{children}</main>
          <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
            Built for the Tessera &quot;Private Equities for Everyone&quot; hackathon track.
            Not investment advice. Hackathon MVP &mdash; see custody disclaimer above.
          </footer>
        </WalletProviders>
      </body>
    </html>
  );
}

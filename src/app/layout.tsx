import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";
import { SiteHeader } from "@/components/SiteHeader";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

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

"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

// Next.js client-side navigation can take a moment (fetching the RSC
// payload for the target route) with zero visual feedback by default --
// which reads as "the button isn't responding" even when it's just doing
// its normal, brief work. useLinkStatus surfaces that pending state so we
// can show a spinner the instant a link is clicked.
function PendingSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
      aria-hidden
    />
  );
}

export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      <span className="inline-flex items-center">
        {children}
        <PendingSpinner />
      </span>
    </Link>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";

export default function JoinClubPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim()) router.push(`/clubs/${code.trim().toUpperCase()}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <BackLink href="/" label="Home" />
      <h1 className="mb-2 text-2xl font-bold">Join a club</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Enter the invite code someone shared with you.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. K7QX2WM"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-3 text-base uppercase tracking-widest dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          Go
        </button>
      </form>
    </div>
  );
}

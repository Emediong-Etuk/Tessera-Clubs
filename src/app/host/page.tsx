"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { getOrCreateHostId } from "@/lib/hostId";

export default function HostDashboardPage() {
  const [hostId, setHostId] = useState<string | null>(null);
  useEffect(() => setHostId(getOrCreateHostId()), []);

  const listings = useQuery(api.listings.listByHost, hostId ? { hostId } : "skip");
  const importListing = useAction(api.importListing.run);

  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!hostId || !url) return;
    setImporting(true);
    setError(null);
    try {
      await importListing({ hostId, sourceUrl: url });
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Housefile</h1>
      <p className="mt-1 text-sm text-zinc-500">Give your property a memory.</p>

      <form onSubmit={handleImport} className="mt-8 flex gap-2">
        <input
          type="url"
          required
          placeholder="Paste your Airbnb or Vrbo listing URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={importing || !hostId}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {importing ? "Importing…" : "Import"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-10 space-y-3">
        {listings === undefined && <p className="text-sm text-zinc-500">Loading…</p>}
        {listings?.length === 0 && (
          <p className="text-sm text-zinc-500">
            No properties yet — paste a listing URL above to start.
          </p>
        )}
        {listings?.map((listing) => (
          <Link
            key={listing._id}
            href={`/host/${listing._id}`}
            className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{listing.name}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  listing.readinessReady
                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {listing.readinessReady ? "Guest ready" : "Needs setup"}
              </span>
            </div>
            {listing.locationText && (
              <p className="mt-1 text-sm text-zinc-500">{listing.locationText}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { buttonClass, cardClass, inputClass } from "@/lib/ui";

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
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Join a club</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter the invite code someone shared with you.
      </p>
      <form onSubmit={handleSubmit} className={cardClass("flex gap-2")}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. K7QX2WM"
          className={inputClass("flex-1 uppercase tracking-widest")}
        />
        <button type="submit" className={buttonClass("primary", "lg")}>
          Go
        </button>
      </form>
    </div>
  );
}

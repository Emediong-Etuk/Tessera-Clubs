"use client";

import { useEffect } from "react";
import { buttonClass, cardClass } from "@/lib/ui";

export function ConfirmDialog({
  title,
  body,
  error,
  confirmLabel,
  busyLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  error?: string | null;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={cardClass("animate-fade-up w-full max-w-sm")}
      >
        <h2 id="confirm-dialog-title" className="mb-2 font-semibold">
          {title}
        </h2>
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {error && (
          <p className="mb-3 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className={buttonClass("secondary", "sm")}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className={buttonClass("danger", "sm")}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

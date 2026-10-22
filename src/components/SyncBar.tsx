"use client";

import { useEffect, useState } from "react";
import { useOnline, useOutboxCount } from "@/lib/offline/hooks";
import { syncNow, type SyncSummary } from "@/lib/offline/sync";

const INTERVAL_MS = 30_000;

// Runs the sync loop and shows its state: on app open, when the signal comes
// back, and every 30 s while items wait. Also registers the service worker.
export function SyncBar() {
  const online = useOnline();
  const waiting = useOutboxCount();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function report(s: SyncSummary) {
    if (s.signedOut) setMessage("Sign in to send saved items.");
    else if (s.failed) setMessage(`${s.failed} item(s) couldn't be sent. See field mode for details.`);
    else if (s.notes.length) setMessage(s.notes.join(" "));
    else setMessage(null);
  }

  async function syncByHand() {
    setBusy(true);
    report(await syncNow(true));
    setBusy(false);
  }

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          // Keep field mode's saved copy current while online.
          if (navigator.onLine) reg.active?.postMessage("refresh-shell");
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!online) return;
    const tick = () => void syncNow().then(report);
    tick();
    const timer = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [online]);

  if (online && waiting === 0 && !message) return null;
  return (
    <div
      role="status"
      className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-amber-100"
    >
      <span>
        {!online ? "Offline. New observations are saved on this phone. " : null}
        {waiting > 0 ? `${waiting} item${waiting === 1 ? "" : "s"} waiting to sync.` : null}
        {message ? ` ${message}` : null}
      </span>
      <span className="flex gap-3">
        <a href="/field" className="inline-flex min-h-12 items-center underline">Field mode</a>
        {online && waiting > 0 ? (
          <button type="button" className="min-h-12 font-medium underline" disabled={busy} onClick={() => void syncByHand()}>
            {busy ? "Syncing…" : "Sync now"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

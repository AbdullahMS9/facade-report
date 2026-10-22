"use client";

import { useEffect, useState } from "react";
import { offlineDb, requestPersistentStorage, type ProjectSnapshot } from "@/lib/offline/db";

// Saves what offline capture needs for this project on the phone, each time
// the project is opened with a signal.
export function OfflineSnapshot({ snapshot }: { snapshot: Omit<ProjectSnapshot, "savedAt"> }) {
  const [saved, setSaved] = useState(false);
  const key = JSON.stringify(snapshot);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await offlineDb().projects.put({ ...(JSON.parse(key) as Omit<ProjectSnapshot, "savedAt">), savedAt: Date.now() });
        await requestPersistentStorage();
        if (!cancelled) setSaved(true);
      } catch {
        // Private browsing or storage blocked: offline capture won't be available.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return saved ? (
    <p className="text-xs text-neutral-600 dark:text-neutral-400">
      ✓ Saved on this phone for offline capture. <a href={`/field?project=${snapshot.id}`} className="underline">Open field mode</a>
    </p>
  ) : null;
}

"use client";

import { liveQuery } from "dexie";
import { useEffect, useState, useSyncExternalStore } from "react";
import { offlineDb } from "./db";

// Re-runs a Dexie query whenever the data it reads changes.
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: () => {} });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export function useOutboxCount(): number {
  return useLiveQuery(
    async () => (await offlineDb().observations.count()) + (await offlineDb().photos.count()),
    [],
    0,
  );
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

"use client";

import { useTransition } from "react";
import { signOut } from "@/app/auth-actions";
import { clearOfflineData, offlineDb } from "@/lib/offline/db";

// Warns about unsent items, then clears this phone's saved data and signs out.
export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-12 text-sm underline"
      onClick={async () => {
        let waiting = 0;
        try {
          waiting = (await offlineDb().observations.count()) + (await offlineDb().photos.count());
        } catch {
          // No local storage: nothing to lose.
        }
        if (
          waiting > 0 &&
          !window.confirm(`${waiting} item(s) haven't synced yet and will be lost if you sign out. Sign out anyway?`)
        ) {
          return;
        }
        try {
          await clearOfflineData();
        } catch {
          // Continue signing out.
        }
        start(() => signOut());
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

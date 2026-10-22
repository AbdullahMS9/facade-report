"use client";

import { syncObservation, syncPhotoRow } from "@/app/sync-actions";
import { createClient } from "@/lib/db/client";
import { photoPaths } from "@/lib/photos/upload";
import { offlineDb, type OutboxPhoto } from "./db";
import { planSync } from "./plan";

export interface SyncSummary {
  sent: number;
  failed: number;
  signedOut: boolean;
  offline: boolean;
  notes: string[];
}

let running: Promise<SyncSummary> | null = null;

// Sends whatever is due. Only one run at a time; callers share it.
export function syncNow(force = false): Promise<SyncSummary> {
  running ??= run(force).finally(() => {
    running = null;
  });
  return running;
}

async function run(force: boolean): Promise<SyncSummary> {
  const summary: SyncSummary = { sent: 0, failed: 0, signedOut: false, offline: false, notes: [] };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ...summary, offline: true };

  const db = offlineDb();
  const [observations, photos] = await Promise.all([db.observations.toArray(), db.photos.toArray()]);
  const meta = (x: { id: string; createdAt: number; attempts: number; lastAttemptAt: number | null; blocked: boolean }) => ({
    id: x.id,
    createdAt: x.createdAt,
    attempts: x.attempts,
    lastAttemptAt: x.lastAttemptAt,
    blocked: x.blocked,
  });
  const plan = planSync(
    observations.map((o) => ({ kind: "observation" as const, ...meta(o) })),
    photos.map((p) => ({ kind: "photo" as const, ...meta(p), observationId: p.observationId })),
    Date.now(),
    force,
  );

  for (const item of plan) {
    if (item.kind === "observation") {
      const o = observations.find((x) => x.id === item.id)!;
      const result = await call(() =>
        syncObservation({ id: o.id, projectId: o.projectId, firmId: o.firmId, values: o.values }),
      );
      if (result.ok) {
        await db.observations.delete(o.id);
        summary.sent++;
        if (result.note) summary.notes.push(`${o.summary}: ${result.note}`);
      } else {
        await markFailed((c) => db.observations.update(o.id, c), o.attempts, result);
        summary.failed++;
        if (result.signedOut) return { ...summary, signedOut: true };
      }
    } else {
      const p = photos.find((x) => x.id === item.id)!;
      // Its observation may have failed earlier in this run; it'll go next time.
      if (p.observationId && (await db.observations.get(p.observationId))) continue;
      const result = await sendPhoto(p);
      if (result.ok) {
        await db.photos.delete(p.id);
        summary.sent++;
      } else {
        await markFailed((c) => db.photos.update(p.id, c), p.attempts, result);
        summary.failed++;
        if (result.signedOut) return { ...summary, signedOut: true };
      }
    }
  }
  return summary;
}

type Result = { ok: true; note?: string } | { ok: false; error: string; retry: boolean; signedOut?: boolean };

// A server action call that fails on the network becomes a retryable result.
async function call(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch {
    return { ok: false, error: "No connection. Will try again.", retry: true };
  }
}

async function markFailed(
  update: (changes: { attempts: number; lastAttemptAt: number; lastError: string; blocked: boolean }) => Promise<number>,
  attempts: number,
  result: Extract<Result, { ok: false }>,
) {
  await update({
    attempts: attempts + 1,
    lastAttemptAt: Date.now(),
    lastError: result.error,
    blocked: !result.retry,
  });
}

// Upload both files (skipping any already sent), then save the row.
async function sendPhoto(p: OutboxPhoto): Promise<Result> {
  const db = offlineDb();
  const bucket = createClient().storage.from("photos");
  const paths = photoPaths(p.firmId, p.projectId, { id: p.id, originalExt: p.originalExt });

  const upload = async (path: string, body: Blob, type: string): Promise<Result | null> => {
    try {
      const { error } = await bucket.upload(path, body, { contentType: type, upsert: false });
      // Already there from an earlier, interrupted run: fine.
      if (!error || /already exists|duplicate/i.test(error.message)) return null;
      return { ok: false, error: "Photo upload failed. Will try again.", retry: true };
    } catch {
      return { ok: false, error: "No connection. Will try again.", retry: true };
    }
  };

  if (!p.uploadedOriginal) {
    const failed = await upload(paths.original, p.original, p.originalType);
    if (failed) return failed;
    await db.photos.update(p.id, { uploadedOriginal: true });
  }
  if (!p.uploadedDisplay) {
    const failed = await upload(paths.display, p.display, "image/jpeg");
    if (failed) return failed;
    await db.photos.update(p.id, { uploadedDisplay: true });
  }
  return call(() =>
    syncPhotoRow({
      projectId: p.projectId,
      firmId: p.firmId,
      photo: {
        id: p.id,
        kind: p.kind,
        observation_id: p.observationId,
        original_ext: p.originalExt as "jpg",
        original_type: p.originalType as "image/jpeg",
        width: p.width,
        height: p.height,
        taken_at: p.takenAt,
        taken_at_source: p.takenAtSource,
        caption: "",
      },
    }),
  );
}

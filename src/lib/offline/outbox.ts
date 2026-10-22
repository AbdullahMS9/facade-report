"use client";

import type { PreparedPhoto } from "@/lib/photos/prepare";
import { offlineDb, type ObservationDraft, type OutboxPhoto } from "./db";

const fresh = (firmId: string, projectId: string) => ({
  firmId,
  projectId,
  createdAt: Date.now(),
  attempts: 0,
  lastAttemptAt: null,
  lastError: null,
  blocked: false,
});

function photoRow(
  p: PreparedPhoto,
  ctx: { firmId: string; projectId: string; kind: OutboxPhoto["kind"]; observationId: string | null },
): OutboxPhoto {
  return {
    ...fresh(ctx.firmId, ctx.projectId),
    id: p.id,
    observationId: ctx.observationId,
    kind: ctx.kind,
    original: p.original,
    originalExt: p.originalExt,
    originalType: p.originalType,
    display: p.display,
    width: p.width,
    height: p.height,
    takenAt: p.takenAt,
    takenAtSource: p.takenAtSource,
    uploadedOriginal: false,
    uploadedDisplay: false,
  };
}

// Saves an observation and its photos on this phone, in one transaction.
// Returns the observation's id (created here, kept on the server).
export async function queueObservation(input: {
  firmId: string;
  projectId: string;
  values: ObservationDraft;
  photos: PreparedPhoto[];
}): Promise<string> {
  const db = offlineDb();
  const id = crypto.randomUUID();
  const summary = [input.values.classification?.toUpperCase(), input.values.element].filter(Boolean).join(" · ");
  await db.transaction("rw", db.observations, db.photos, async () => {
    await db.observations.add({ ...fresh(input.firmId, input.projectId), id, values: input.values, summary });
    await db.photos.bulkAdd(
      input.photos.map((p) => photoRow(p, { firmId: input.firmId, projectId: input.projectId, kind: "condition", observationId: id })),
    );
  });
  return id;
}

export async function queuePhotos(input: {
  firmId: string;
  projectId: string;
  kind: OutboxPhoto["kind"];
  observationId: string | null;
  photos: PreparedPhoto[];
}): Promise<void> {
  await offlineDb().photos.bulkAdd(input.photos.map((p) => photoRow(p, input)));
}

// Drops an item the server won't accept (and the photos waiting on it).
export async function discardObservation(id: string): Promise<void> {
  const db = offlineDb();
  await db.transaction("rw", db.observations, db.photos, async () => {
    await db.photos.where("observationId").equals(id).delete();
    await db.observations.delete(id);
  });
}

export async function discardPhoto(id: string): Promise<void> {
  await offlineDb().photos.delete(id);
}

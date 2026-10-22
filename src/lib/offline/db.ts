"use client";

import Dexie, { type EntityTable } from "dexie";

// IndexedDB on the phone (Dexie). Holds project snapshots for offline capture
// and an outbox of observations and photos waiting to sync.

export type ProjectSnapshot = {
  id: string;
  firmId: string;
  address: string;
  cycle: number;
  finalInspectionDate: string | null;
  elevations: { id: string; name: string; closeups: { id: string; location_note: string }[] }[];
  savedAt: number;
};

// Form values exactly as typed; the server validates them on sync.
export type ObservationDraft = Record<string, string>;

type Meta = {
  firmId: string;
  projectId: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  blocked: boolean; // won't succeed on retry; shown to the user to fix or discard
};

export type OutboxObservation = Meta & { id: string; values: ObservationDraft; summary: string };

export type OutboxPhoto = Meta & {
  id: string;
  observationId: string | null;
  kind: "condition" | "elevation" | "inspector" | "probe" | "typical";
  original: Blob;
  originalExt: string;
  originalType: string;
  display: Blob;
  width: number;
  height: number;
  takenAt: string | null;
  takenAtSource: "exif" | "file";
  uploadedOriginal: boolean;
  uploadedDisplay: boolean;
};

class OfflineDb extends Dexie {
  projects!: EntityTable<ProjectSnapshot, "id">;
  observations!: EntityTable<OutboxObservation, "id">;
  photos!: EntityTable<OutboxPhoto, "id">;

  constructor() {
    super("facade-report");
    this.version(1).stores({
      projects: "id, savedAt",
      observations: "id, projectId, createdAt",
      photos: "id, projectId, observationId, createdAt",
    });
  }
}

let instance: OfflineDb | null = null;

// Created on first use, in the browser only.
export function offlineDb(): OfflineDb {
  instance ??= new OfflineDb();
  return instance;
}

// Removes everything on this phone (sign-out).
export async function clearOfflineData(): Promise<void> {
  await offlineDb().delete();
  instance = null;
}

// Asks the browser not to evict our data when storage runs low.
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Not supported; data may be evicted under storage pressure.
  }
}

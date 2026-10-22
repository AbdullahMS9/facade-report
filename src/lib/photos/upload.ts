"use client";

import { createClient } from "@/lib/db/client";
import type { PreparedPhoto } from "./prepare";

// Storage layout: <firm>/<project>/<photo>/original.<ext> and display.jpg.
// The database checks the same layout (photos table constraints).
export function photoPaths(firmId: string, projectId: string, photo: Pick<PreparedPhoto, "id" | "originalExt">) {
  const dir = `${firmId}/${projectId}/${photo.id}`;
  return { original: `${dir}/original.${photo.originalExt}`, display: `${dir}/display.jpg` };
}

// Uploads both files as the signed-in user (storage rules check the firm).
export async function uploadPhotoFiles(firmId: string, projectId: string, photo: PreparedPhoto): Promise<void> {
  const supabase = createClient();
  const paths = photoPaths(firmId, projectId, photo);
  const bucket = supabase.storage.from("photos");
  const original = await bucket.upload(paths.original, photo.original, { contentType: photo.originalType, upsert: false });
  if (original.error) throw new Error("Upload failed. Check your connection and try again.");
  const display = await bucket.upload(paths.display, photo.display, { contentType: "image/jpeg", upsert: false });
  if (display.error) throw new Error("Upload failed. Check your connection and try again.");
}

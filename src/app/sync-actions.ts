"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { syncObservationCore, syncPhotoRowCore, type SyncResult } from "@/lib/offline/serverSync";
import type { RecordPhotoInput } from "@/lib/schemas/photo";

// Called by the browser's sync loop. Never redirects: a signed-out phone gets
// a result it can show, and keeps its queue.

const SIGNED_OUT: SyncResult = { ok: false, error: "Sign in to send saved items.", retry: true, signedOut: true };

export async function syncObservation(input: {
  id: string;
  projectId: string;
  firmId: string;
  values: Record<string, string>;
}): Promise<SyncResult> {
  const { supabase, user, membership } = await getSession();
  if (!user || !membership) return SIGNED_OUT;
  const result = await syncObservationCore(supabase, membership.firmId, input);
  if (result.ok) revalidatePath(`/projects/${input.projectId}`, "layout");
  return result;
}

export async function syncPhotoRow(input: { projectId: string; firmId: string; photo: RecordPhotoInput }): Promise<SyncResult> {
  const { supabase, user, membership } = await getSession();
  if (!user || !membership) return SIGNED_OUT;
  const result = await syncPhotoRowCore(supabase, membership.firmId, input);
  if (result.ok) revalidatePath(`/projects/${input.projectId}`, "layout");
  return result;
}

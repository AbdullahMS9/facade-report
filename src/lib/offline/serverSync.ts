import { z } from "zod";
import type { Db } from "@/lib/db/queries";
import { firstError } from "@/lib/schemas";
import { observationSchema } from "@/lib/schemas/observation";
import { recordPhotoSchema, type RecordPhotoInput } from "@/lib/schemas/photo";

// Server half of offline sync. Safe to call twice with the same item: a
// repeat returns ok without creating a duplicate. Takes the caller's
// Supabase client so RLS applies (and so tests can call it directly).

export type SyncResult =
  | { ok: true; note?: string }
  | { ok: false; error: string; retry: boolean; signedOut?: boolean };

const ids = z.object({ id: z.uuid(), projectId: z.uuid(), firmId: z.uuid() });

function permanent(error: string): SyncResult {
  return { ok: false, error, retry: false };
}
function temporary(error: string): SyncResult {
  return { ok: false, error, retry: true };
}

export async function syncObservationCore(
  db: Db,
  memberFirmId: string,
  input: { id: string; projectId: string; firmId: string; values: Record<string, unknown> },
): Promise<SyncResult> {
  const key = ids.safeParse(input);
  if (!key.success) return permanent("This saved item is damaged and can't be sent.");
  if (key.data.firmId !== memberFirmId) return permanent("Saved under a different firm account. Sign in as that user to send it.");
  const parsed = observationSchema.safeParse(
    Object.fromEntries(Object.keys(observationSchema.in.shape).map((k) => [k, input.values[k] ?? null])),
  );
  if (!parsed.success) return permanent(firstError(parsed.error));

  const row = { ...parsed.data, id: key.data.id, project_id: key.data.projectId, firm_id: key.data.firmId };
  let { error } = await db.from("observations").insert(row);

  // The elevation or drop was deleted while this waited: keep the observation.
  let note: string | undefined;
  if (error?.code === "23503" && (row.elevation_id || row.closeup_id)) {
    ({ error } = await db.from("observations").insert({ ...row, elevation_id: null, closeup_id: null }));
    if (!error) note = "Its elevation or drop was deleted, so it was saved without one.";
  }
  if (!error) return { ok: true, note };
  if (error.code === "23505") {
    // Same id already there. Ok only if it's ours, in this project (a retry).
    const { data } = await db.from("observations").select("project_id").eq("id", key.data.id).maybeSingle();
    return data?.project_id === key.data.projectId ? { ok: true } : permanent("This item conflicts with another record.");
  }
  if (error.code === "23503") return permanent("The project was deleted, so this can't be saved.");
  return temporary("Couldn't save right now. Will try again.");
}

export async function syncPhotoRowCore(
  db: Db,
  memberFirmId: string,
  input: { projectId: string; firmId: string; photo: RecordPhotoInput },
): Promise<SyncResult> {
  const key = z.object({ projectId: z.uuid(), firmId: z.uuid() }).safeParse(input);
  const parsed = recordPhotoSchema.safeParse(input.photo);
  if (!key.success || !parsed.success) return permanent("This saved photo is damaged and can't be sent.");
  if (key.data.firmId !== memberFirmId) return permanent("Saved under a different firm account. Sign in as that user to send it.");
  const p = parsed.data;
  const dir = `${key.data.firmId}/${key.data.projectId}/${p.id}`;

  const { error } = await db.from("photos").insert({
    id: p.id,
    firm_id: key.data.firmId,
    project_id: key.data.projectId,
    observation_id: p.observation_id,
    kind: p.kind,
    original_path: `${dir}/original.${p.original_ext}`,
    display_path: `${dir}/display.jpg`,
    original_type: p.original_type,
    width: p.width,
    height: p.height,
    taken_at: p.taken_at,
    taken_at_source: p.taken_at_source,
    caption: p.caption,
  });
  if (!error) return { ok: true };
  if (error.code === "23505") {
    const { data } = await db.from("photos").select("project_id").eq("id", p.id).maybeSingle();
    return data?.project_id === key.data.projectId ? { ok: true } : permanent("This photo conflicts with another record.");
  }
  if (error.code === "23503") return permanent("Its observation or project was deleted, so this photo can't be saved.");
  return temporary("Couldn't save the photo right now. Will try again.");
}

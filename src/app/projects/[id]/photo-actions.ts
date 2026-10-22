"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { friendlyDbError } from "@/lib/dbErrors";
import { firstError, type FormState } from "@/lib/schemas";
import { recordPhotoSchema, type RecordPhotoInput } from "@/lib/schemas/photo";

// Saves the row for a photo whose two files were just uploaded.
export async function recordPhoto(projectId: string, input: RecordPhotoInput): Promise<FormState> {
  const project = z.uuid().safeParse(projectId);
  if (!project.success) return { error: "Something went wrong. Reload the page and try again." };
  const parsed = recordPhotoSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const p = parsed.data;

  const { supabase, membership } = await requireMember();
  const dir = `${membership.firmId}/${project.data}/${p.id}`;
  const { error } = await supabase.from("photos").insert({
    id: p.id,
    firm_id: membership.firmId,
    project_id: project.data,
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
  if (error) return { error: friendlyDbError(error, "The photo uploaded but couldn't be saved. Please try again.") };
  revalidatePath(`/projects/${project.data}`, "layout");
  return { ok: true };
}

// QEWI only (RLS on the row and on the files).
export async function deletePhoto(projectId: string, photoId: string): Promise<void> {
  const ids = z.array(z.uuid()).safeParse([projectId, photoId]);
  if (!ids.success) return;
  const { supabase } = await requireMember();
  const { data: photo } = await supabase
    .from("photos")
    .select("original_path, display_path")
    .eq("id", photoId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!photo) return;
  const { error } = await supabase.storage.from("photos").remove([photo.original_path, photo.display_path]);
  if (error) return; // keep the row if the files couldn't be removed
  await supabase.from("photos").delete().eq("id", photoId);
  revalidatePath(`/projects/${projectId}`, "layout");
}

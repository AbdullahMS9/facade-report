"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";

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

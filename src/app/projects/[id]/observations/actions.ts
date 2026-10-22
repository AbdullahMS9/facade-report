"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { friendlyDbError } from "@/lib/dbErrors";
import { firstError, formFields, type FormState } from "@/lib/schemas";
import { observationSchema } from "@/lib/schemas/observation";

const BAD_REQUEST = { error: "Something went wrong. Reload the page and try again." };
// The schema transforms its output, so read the field names from its input side.
const fields = (fd: FormData) => formFields(observationSchema.in, fd);

export async function updateObservation(
  projectId: string,
  observationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ids = z.array(z.uuid()).safeParse([projectId, observationId]);
  if (!ids.success) return BAD_REQUEST;
  const parsed = observationSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase } = await requireMember();
  const { data, error } = await supabase
    .from("observations")
    .update(parsed.data)
    .eq("id", observationId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendlyDbError(error, "We couldn't save the observation. Please try again.") };
  if (!data?.length) return { error: "This observation wasn't found. It may have been deleted." };
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}

// QEWI only. Removes the photo files first, then the observation (rows cascade).
export async function deleteObservation(projectId: string, observationId: string): Promise<void> {
  const ids = z.array(z.uuid()).safeParse([projectId, observationId]);
  if (!ids.success) return;
  const { supabase, membership } = await requireMember();
  if (membership.role !== "qewi") return;
  const { data: photos } = await supabase
    .from("photos")
    .select("original_path, display_path")
    .eq("observation_id", observationId);
  const paths = (photos ?? []).flatMap((p) => [p.original_path, p.display_path]);
  if (paths.length) {
    const { error } = await supabase.storage.from("photos").remove(paths);
    if (error) return;
  }
  await supabase.from("observations").delete().eq("id", observationId).eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}`, "layout");
  redirect(`/projects/${projectId}/observations`);
}

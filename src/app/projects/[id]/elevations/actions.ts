"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { friendlyDbError } from "@/lib/dbErrors";
import { firstError, formFields, type FormState } from "@/lib/schemas";
import { closeupSchema, elevationSchema, probeSchema } from "@/lib/schemas/elevation";

const BAD_REQUEST = { error: "Something went wrong. Reload the page and try again." };

function ids(...values: string[]) {
  const parsed = z.array(z.uuid()).safeParse(values);
  return parsed.success ? parsed.data : null;
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
}

export async function createElevation(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const checked = ids(projectId);
  if (!checked) return BAD_REQUEST;
  const parsed = elevationSchema.safeParse(formFields(elevationSchema, formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase, membership } = await requireMember();
  const { count } = await supabase
    .from("elevations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const { data, error } = await supabase
    .from("elevations")
    .insert({ ...parsed.data, project_id: projectId, firm_id: membership.firmId, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error, "We couldn't add the elevation. Please try again.") };

  refresh(projectId);
  redirect(`/projects/${projectId}/elevations/${data.id}`);
}

export async function updateElevation(
  projectId: string,
  elevationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!ids(projectId, elevationId)) return BAD_REQUEST;
  const parsed = elevationSchema.safeParse(formFields(elevationSchema, formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase } = await requireMember();
  const { data, error } = await supabase
    .from("elevations")
    .update(parsed.data)
    .eq("id", elevationId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendlyDbError(error, "We couldn't save the elevation. Please try again.") };
  if (!data?.length) return { error: "This elevation wasn't found. It may have been deleted." };
  refresh(projectId);
  return { ok: true };
}

export async function deleteElevation(projectId: string, elevationId: string) {
  if (!ids(projectId, elevationId)) return;
  const { supabase } = await requireMember();
  // RLS allows this only for the firm's QEWI; drops and probes go with it.
  await supabase.from("elevations").delete().eq("id", elevationId).eq("project_id", projectId);
  refresh(projectId);
  redirect(`/projects/${projectId}`);
}

export async function addCloseup(
  projectId: string,
  elevationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!ids(projectId, elevationId)) return BAD_REQUEST;
  const parsed = closeupSchema.safeParse(formFields(closeupSchema, formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase, membership } = await requireMember();
  const { error } = await supabase
    .from("closeups")
    .insert({ ...parsed.data, elevation_id: elevationId, firm_id: membership.firmId });
  if (error) return { error: friendlyDbError(error, "We couldn't add the drop. Please try again.") };
  refresh(projectId);
  return { ok: true };
}

export async function deleteCloseup(projectId: string, closeupId: string) {
  if (!ids(projectId, closeupId)) return;
  const { supabase } = await requireMember();
  await supabase.from("closeups").delete().eq("id", closeupId);
  refresh(projectId);
}

export async function addProbe(
  projectId: string,
  closeupId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!ids(projectId, closeupId)) return BAD_REQUEST;
  const parsed = probeSchema.safeParse(formFields(probeSchema, formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase, membership } = await requireMember();
  const { error } = await supabase
    .from("probes")
    .insert({ ...parsed.data, closeup_id: closeupId, firm_id: membership.firmId });
  if (error) return { error: friendlyDbError(error, "We couldn't add the probe. Please try again.") };
  refresh(projectId);
  return { ok: true };
}

export async function deleteProbe(projectId: string, probeId: string) {
  if (!ids(projectId, probeId)) return;
  const { supabase } = await requireMember();
  await supabase.from("probes").delete().eq("id", probeId);
  refresh(projectId);
}

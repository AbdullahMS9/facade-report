"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { friendlyDbError } from "@/lib/dbErrors";
import { getBuildingHistory } from "@/lib/opendata/history";
import { firstError, formFields, type FormState } from "@/lib/schemas";
import { priorItemSchema } from "@/lib/schemas/priorItem";

const BAD_REQUEST = { error: "Something went wrong. Reload the page and try again." };

export async function refreshPriorFilings(projectId: string): Promise<void> {
  const id = z.uuid().safeParse(projectId);
  if (!id.success) return;
  const { supabase } = await requireMember();
  const { data } = await supabase
    .from("projects")
    .select("buildings(id, firm_id, bin, borough, block, lot)")
    .eq("id", id.data)
    .maybeSingle();
  if (data?.buildings) await getBuildingHistory(supabase, data.buildings, { force: true });
  revalidatePath(`/projects/${id.data}`);
}

export async function addPriorItem(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(projectId);
  if (!id.success) return BAD_REQUEST;
  const parsed = priorItemSchema.safeParse(formFields(priorItemSchema, formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase, membership } = await requireMember();
  const { error } = await supabase
    .from("prior_items")
    .insert({ ...parsed.data, project_id: id.data, firm_id: membership.firmId });
  if (error) return { error: friendlyDbError(error, "We couldn't add the item. Please try again.") };
  revalidatePath(`/projects/${id.data}`, "layout");
  return { ok: true };
}

export async function updatePriorItem(
  projectId: string,
  itemId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ids = z.array(z.uuid()).safeParse([projectId, itemId]);
  if (!ids.success) return BAD_REQUEST;
  const parsed = priorItemSchema.safeParse(formFields(priorItemSchema, formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase } = await requireMember();
  const { data, error } = await supabase
    .from("prior_items")
    .update(parsed.data)
    .eq("id", itemId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendlyDbError(error, "We couldn't save the item. Please try again.") };
  if (!data?.length) return { error: "This item wasn't found. It may have been deleted." };
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}

export async function deletePriorItem(projectId: string, itemId: string): Promise<void> {
  const ids = z.array(z.uuid()).safeParse([projectId, itemId]);
  if (!ids.success) return;
  const { supabase } = await requireMember();
  // RLS allows this only for the firm's QEWI.
  await supabase.from("prior_items").delete().eq("id", itemId).eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}`, "layout");
}

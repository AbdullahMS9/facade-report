"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { friendlyDbError } from "@/lib/dbErrors";
import { firstError, formFields, type FormState } from "@/lib/schemas";
import { projectDetailsSchema, statusSchema } from "@/lib/schemas/project";
import { loadChecks } from "./load";

export async function updateProjectDetails(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(projectId);
  if (!id.success) return { error: "Something went wrong. Reload the page and try again." };
  const parsed = projectDetailsSchema.safeParse(formFields(projectDetailsSchema, formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase } = await requireMember();
  const { data, error } = await supabase
    .from("projects")
    .update({ ...parsed.data, cycle: parsed.data.cycle! })
    .eq("id", id.data)
    .select("id");
  if (error) return { error: friendlyDbError(error, "We couldn't save the project. Please try again.") };
  if (!data?.length) return { error: "This project wasn't found. It may have been deleted." };

  revalidatePath(`/projects/${id.data}`, "layout");
  revalidatePath("/");
  return { ok: true };
}

export async function updateStatus(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(projectId);
  const status = statusSchema.safeParse(formData.get("status"));
  if (!id.success) return { error: "Something went wrong. Reload the page and try again." };
  if (!status.success) return { error: firstError(status.error) };

  const { supabase, membership } = await requireMember();
  if (membership.role !== "qewi") return { error: "Only a QEWI can change a project's status." };

  // Ready/filed only when the checker has no blockers (CLAUDE.md §3.7).
  // Moving back to draft is always allowed.
  if (status.data !== "draft") {
    const { blockers } = await loadChecks(id.data);
    if (blockers.length) {
      return {
        error: `Fix the ${blockers.length} checker blocker${blockers.length === 1 ? "" : "s"} first: ${blockers.map((b) => b.title).join(", ")}.`,
      };
    }
  }

  // The database also enforces who can change status (projects_status_change trigger).
  const { error } = await supabase.from("projects").update({ status: status.data }).eq("id", id.data);
  if (error) return { error: friendlyDbError(error, "We couldn't change the status. Please try again.") };

  revalidatePath(`/projects/${id.data}`, "layout");
  revalidatePath("/");
  return { ok: true };
}

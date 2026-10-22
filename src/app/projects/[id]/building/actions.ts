"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { friendlyDbError } from "@/lib/dbErrors";
import { firstError, type FormState } from "@/lib/schemas";
import { binBoroughWarning, buildingFromForm } from "@/lib/schemas/building";

export async function updateBuilding(
  buildingId: string,
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ids = z.tuple([z.uuid(), z.uuid()]).safeParse([buildingId, projectId]);
  if (!ids.success) return { error: "Something went wrong. Reload the page and try again." };
  const parsed = buildingFromForm(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase } = await requireMember();
  const { data, error } = await supabase.from("buildings").update(parsed.data).eq("id", ids.data[0]).select("id");
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Another building in your firm already has that BIN."
          : friendlyDbError(error, "We couldn't save the building. Please try again."),
    };
  }
  if (!data?.length) return { error: "This building wasn't found. It may have been deleted." };

  revalidatePath(`/projects/${ids.data[1]}`, "layout");
  const warning = binBoroughWarning(parsed.data.bin, parsed.data.borough);
  return { ok: true, warning: warning ? `Saved. ${warning}` : undefined };
}

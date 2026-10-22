"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { friendlyDbError } from "@/lib/dbErrors";
import { firstError, formFields, type FormState } from "@/lib/schemas";
import { buildingSchema } from "@/lib/schemas/building";
import { newProjectSchema } from "@/lib/schemas/project";

const newBuildingSchema = buildingSchema.pick({ address: true, borough: true, block: true, lot: true, bin: true });

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const project = newProjectSchema.safeParse(formFields(newProjectSchema, formData));
  if (!project.success) return { error: firstError(project.error) };

  const useExisting = formData.get("building_choice") === "existing";
  const { supabase } = await requireMember();

  let args;
  if (useExisting) {
    const buildingId = z.uuid({ error: "Choose a building from the list." }).safeParse(formData.get("building_id"));
    if (!buildingId.success) return { error: firstError(buildingId.error) };
    args = { p_building_id: buildingId.data };
  } else {
    const b = newBuildingSchema.safeParse(formFields(newBuildingSchema, formData));
    if (!b.success) return { error: firstError(b.error) };
    args = {
      p_address: b.data.address,
      p_borough: b.data.borough,
      p_block: b.data.block ?? undefined,
      p_lot: b.data.lot ?? undefined,
      p_bin: b.data.bin ?? undefined,
    };
  }

  const { data: projectId, error } = await supabase.rpc("create_project", {
    p_cycle: project.data.cycle!,
    p_report_type: project.data.report_type,
    ...args,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "A building with that BIN is already in your firm. Choose “Existing building” and pick it."
          : friendlyDbError(error, "We couldn't create the project. Please try again."),
    };
  }
  redirect(`/projects/${projectId}`);
}

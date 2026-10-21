"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { friendlyDbError } from "@/lib/dbErrors";
import { firmNameSchema, firstError, type FormState } from "@/lib/schemas";

export async function createFirm(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = firmNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_firm", { p_name: parsed.data });
  if (error) return { error: friendlyDbError(error) };
  redirect("/");
}

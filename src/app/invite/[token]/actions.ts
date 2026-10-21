"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { friendlyDbError } from "@/lib/dbErrors";
import { firstError, tokenSchema, type FormState } from "@/lib/schemas";

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = tokenSchema.safeParse(formData.get("token"));
  if (!token.success) return { error: firstError(token.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error) return { error: friendlyDbError(error) };
  redirect("/");
}

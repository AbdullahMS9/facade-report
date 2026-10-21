"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/admin";
import { friendlyDbError } from "@/lib/dbErrors";
import { publicEnv } from "@/lib/env";
import { emailSchema, firstError, roleSchema } from "@/lib/schemas";
import { z } from "zod";

export type InviteState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "sent"; email: string; link: string; emailSent: boolean };

const inviteSchema = z.object({ email: emailSchema, role: roleSchema });

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { status: "error", error: firstError(parsed.error) };
  const { email, role } = parsed.data;

  const { supabase, user, membership } = await requireMember();
  if (membership.role !== "qewi") return { status: "error", error: "Only a QEWI can invite people." };

  // Inserted as the signed-in user, so RLS decides whether this is allowed.
  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({ firm_id: membership.firmId, email, role, invited_by: user.id })
    .select("token")
    .single();
  if (error) {
    const message =
      error.code === "23505"
        ? "There is already an open invitation for that email."
        : friendlyDbError(error, "We couldn't create the invitation. Please try again.");
    return { status: "error", error: message };
  }

  const link = `${publicEnv().NEXT_PUBLIC_SITE_URL}/invite/${invitation.token}`;

  // The service role is used only to send the invite email. If the person
  // already has an account, Supabase won't send one; the QEWI shares the link.
  const { error: emailError } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { invite_token: invitation.token, firm_name: membership.firmName },
    redirectTo: link,
  });

  revalidatePath("/team");
  return { status: "sent", email, link, emailSent: !emailError };
}

export async function revokeInvitation(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireMember();
  // RLS allows this only for the firm's QEWI and only for open invitations.
  await supabase.from("invitations").delete().eq("id", id.data);
  revalidatePath("/team");
}

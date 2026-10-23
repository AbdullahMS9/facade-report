"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/db/server";
import { codeSchema, emailSchema, firstError, safeNextPath } from "@/lib/schemas";

export type LoginState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; error?: string };

export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { step: "email", error: firstError(parsed.error) };
  const email = parsed.data;

  // Where the email's sign-in link returns. Supabase only allows URLs on its
  // redirect allow-list, so the request's own origin is safe to use here.
  const origin = (await headers()).get("origin") ?? publicEnv().NEXT_PUBLIC_SITE_URL;
  const callback = new URL("/auth/callback", origin);
  const next = safeNextPath(formData.get("next"));
  if (next !== "/") callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: callback.toString() },
  });
  if (error) {
    const message =
      error.status === 429
        ? "Too many codes requested. Wait a minute and try again."
        : "We couldn't send a code to that email. Check it and try again.";
    return { step: "email", email, error: message };
  }
  return { step: "code", email };
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { step: "email", error: firstError(email.error) };
  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { step: "code", email: email.data, error: firstError(code.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error) {
    return { step: "code", email: email.data, error: "That code is wrong or has expired. Try again or send a new code." };
  }
  redirect(safeNextPath(formData.get("next")));
}

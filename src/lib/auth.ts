import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import type { Database } from "@/types/database";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export interface Membership {
  firmId: string;
  firmName: string;
  role: MemberRole;
}

// The signed-in user (verified with the auth server) and their firm, if any.
export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { supabase, user: null, membership: null };

  const { data: row } = await supabase
    .from("memberships")
    .select("role, firm_id, firms(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  const membership: Membership | null = row
    ? { firmId: row.firm_id, firmName: row.firms?.name ?? "", role: row.role }
    : null;
  return { supabase, user, membership };
}

// For pages that need a firm. Sends people to sign in or set up a firm.
export async function requireMember() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (!session.membership) redirect("/onboarding");
  return { ...session, user: session.user, membership: session.membership };
}

export async function requireUser() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  return { ...session, user: session.user };
}

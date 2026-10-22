import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
) as { API_URL: string; SERVICE_ROLE_KEY: string; MAILPIT_URL: string };

export const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function testEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@example.test`;
}

// Waits for the sign-in code emailed to `to` and returns it.
export async function signInCode(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const q = encodeURIComponent(`to:"${to}" subject:"Your Facade Report sign-in code"`);
    const res = (await (await fetch(`${status.MAILPIT_URL}/api/v1/search?query=${q}`)).json()) as { messages: { ID: string }[] };
    const id = res.messages[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${status.MAILPIT_URL}/api/v1/message/${id}`)).json()) as { Text: string };
      const code = /\b(\d{6})\b/.exec(msg.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No sign-in code arrived for ${to}`);
}

// Deletes the test user and their firm (cascades to all firm data).
export async function deleteUserAndFirm(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (!user) return;
  const { data: m } = await admin.from("memberships").select("firm_id").eq("user_id", user.id).maybeSingle();
  if (m) await admin.from("firms").delete().eq("id", m.firm_id);
  await admin.auth.admin.deleteUser(user.id);
}

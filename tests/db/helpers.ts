import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;

interface LocalStatus {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  MAILPIT_URL: string;
}

// Reads URL and keys from the running local stack, so no secrets live in files.
function localStatus(): LocalStatus {
  try {
    const out = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(out) as LocalStatus;
  } catch {
    throw new Error("Local Supabase is not running. Start it with `npm run db:start`.");
  }
}

const status = localStatus();
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: Db = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, noSession);

export function anonClient(): Db {
  return createClient<Database>(status.API_URL, status.ANON_KEY, noSession);
}

// Waits for the newest email to `to` in the local Mailpit inbox.
export async function latestEmail(to: string, subject: string): Promise<{ text: string; html: string }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
    const res = await fetch(`${status.MAILPIT_URL}/api/v1/search?query=${query}`);
    const body = (await res.json()) as { messages: { ID: string }[] };
    const id = body.messages[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${status.MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
        Text: string;
        HTML: string;
      };
      return { text: msg.Text, html: msg.HTML };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email "${subject}" arrived for ${to}`);
}

export async function trackUserByEmail(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (user) createdUserIds.push(user.id);
}

export interface TestUser {
  id: string;
  email: string;
  db: Db;
}

const createdUserIds: string[] = [];

export function testEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@example.test`;
}

// Creates a confirmed user and returns a client signed in as them.
export async function createUser(label: string, email = testEmail(label)): Promise<TestUser> {
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUserIds.push(data.user.id);

  const db = anonClient();
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, db };
}

export async function createFirm(user: TestUser, name: string): Promise<string> {
  const { data, error } = await user.db.rpc("create_firm", { p_name: name });
  if (error) throw error;
  return data;
}

export async function cleanup(firmIds: string[]): Promise<void> {
  if (firmIds.length) await admin.from("firms").delete().in("id", firmIds);
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
}

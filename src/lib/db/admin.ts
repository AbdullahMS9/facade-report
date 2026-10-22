import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/serverEnv";
import type { Database } from "@/types/database";

// Service-role client. BYPASSES Row Level Security. Use only for things RLS
// can't do (sending invite emails), never to read or write firm data.
export function createAdminClient() {
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

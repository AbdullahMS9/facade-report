import "server-only";
import { z } from "zod";

// Secrets. Lives apart from env.ts so it can never be bundled into browser
// code: importing this from a Client Component fails the build.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NYC_OPEN_DATA_APP_TOKEN: z.string().min(1).optional(),
  // Override for tests (Playwright points this at a local fake).
  NYC_OPEN_DATA_URL: z.url().optional(),
});

export function serverEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NYC_OPEN_DATA_APP_TOKEN: process.env.NYC_OPEN_DATA_APP_TOKEN || undefined,
    NYC_OPEN_DATA_URL: process.env.NYC_OPEN_DATA_URL || undefined,
  });
}

import { z } from "zod";

// Values safe to send to the browser. Next.js inlines NEXT_PUBLIC_* at build
// time, so each one must be referenced by its full name here.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NYC_OPEN_DATA_APP_TOKEN: z.string().min(1).optional(),
  // Override for tests (Playwright points this at a local fake).
  NYC_OPEN_DATA_URL: z.url().optional(),
});

// Secrets. Throws if called in the browser so a mistaken import fails loudly.
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must only be called on the server.");
  }
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NYC_OPEN_DATA_APP_TOKEN: process.env.NYC_OPEN_DATA_APP_TOKEN || undefined,
    NYC_OPEN_DATA_URL: process.env.NYC_OPEN_DATA_URL || undefined,
  });
}

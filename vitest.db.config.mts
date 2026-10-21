import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests that need the local Supabase stack (`npm run db:start`).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});

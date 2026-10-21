import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Fast unit tests (no database). Database tests: vitest.db.config.mts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/db/**", "**/node_modules/**"],
  },
});

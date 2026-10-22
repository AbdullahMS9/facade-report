import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// CLAUDE.md §8: RLS on every table. Fails if a new table forgets it.
// Reads the catalog with psql inside the local database container.
function sql(query: string): string[] {
  const out = execFileSync(
    "docker",
    ["exec", "supabase_db_facade-report", "psql", "-U", "postgres", "-At", "-c", query],
    { encoding: "utf8" },
  );
  return out.split("\n").filter(Boolean);
}

describe("row level security coverage", () => {
  it("is enabled on every table in the public schema", () => {
    const tables = sql("select tablename from pg_tables where schemaname = 'public'");
    expect(tables.length).toBeGreaterThan(10);
    const without = sql("select tablename from pg_tables where schemaname = 'public' and not rowsecurity");
    expect(without).toEqual([]);
  });

  it("gives signed-out visitors no table privileges", () => {
    const grants = sql(
      "select table_name || ':' || privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'",
    );
    expect(grants).toEqual([]);
  });

  it("keeps the photos bucket private", () => {
    expect(sql("select public from storage.buckets where id = 'photos'")).toEqual(["f"]);
  });
});

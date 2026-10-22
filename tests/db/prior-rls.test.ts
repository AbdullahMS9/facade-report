import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createFirm, createUser, testEmail, type TestUser } from "./helpers";

// CLAUDE.md §8: prior items and the Open Data cache stay inside the firm.

let qewiA: TestUser;
let staffA: TestUser;
let qewiB: TestUser;
let firmA: string;
let firmB: string;
const firmIds: string[] = [];
const a = { building: "", project: "", item: "" };
const b = { building: "", project: "", item: "", cache: "" };

async function seed(user: TestUser, firmId: string, address: string) {
  const { data: projectId, error } = await user.db.rpc("create_project", {
    p_cycle: 10,
    p_report_type: "initial",
    p_address: address,
    p_borough: "bronx",
    p_block: 2001,
    p_lot: 10,
  });
  if (error) throw error;
  const project = await user.db.from("projects").select("building_id").eq("id", projectId).single();
  const item = await user.db
    .from("prior_items")
    .insert({ firm_id: firmId, project_id: projectId, description: "Cracked lintel at floor 5" })
    .select("id")
    .single();
  if (item.error) throw item.error;
  return { project: projectId, building: project.data!.building_id, item: item.data.id };
}

beforeAll(async () => {
  qewiA = await createUser("pi-qewi-a");
  qewiB = await createUser("pi-qewi-b");
  firmA = await createFirm(qewiA, "Fictional Facade Engineers A");
  firmB = await createFirm(qewiB, "Imaginary Exterior Wall Group B");
  firmIds.push(firmA, firmB);

  const staffEmail = testEmail("pi-staff-a");
  const inv = await qewiA.db
    .from("invitations")
    .insert({ firm_id: firmA, email: staffEmail, invited_by: qewiA.id })
    .select("token")
    .single();
  staffA = await createUser("pi-staff-a", staffEmail);
  await staffA.db.rpc("accept_invitation", { p_token: inv.data!.token });

  Object.assign(a, await seed(qewiA, firmA, "10 Example Street"));
  Object.assign(b, await seed(qewiB, firmB, "20 Sample Avenue"));
  const cache = await qewiB.db
    .from("building_filings_cache")
    .insert({ firm_id: firmB, building_id: b.building, lookup_key: "bbl:bronx/2001/10", filings: [] })
    .select("id")
    .single();
  if (cache.error) throw cache.error;
  b.cache = cache.data.id;
});

afterAll(async () => {
  await cleanup(firmIds);
});

describe("prior_items", () => {
  it("firm A can't read, edit or delete firm B's items", async () => {
    const read = await qewiA.db.from("prior_items").select("id, firm_id");
    expect(read.data?.every((r) => r.firm_id === firmA)).toBe(true);
    const upd = await qewiA.db.from("prior_items").update({ repaired: true }).eq("id", b.item).select();
    expect(upd.data).toEqual([]);
    const del = await qewiA.db.from("prior_items").delete().eq("id", b.item).select();
    expect(del.data).toEqual([]);
  });

  it("firm A can't attach an item to firm B's project", async () => {
    const { error } = await qewiA.db
      .from("prior_items")
      .insert({ firm_id: firmA, project_id: b.project, description: "Intruder" });
    expect(error).not.toBeNull();
  });

  it("staff can add and mark items but not delete them", async () => {
    const add = await staffA.db
      .from("prior_items")
      .insert({ firm_id: firmA, project_id: a.project, description: "Loose coping stone" })
      .select("id")
      .single();
    expect(add.error).toBeNull();
    const mark = await staffA.db.from("prior_items").update({ repaired: false }).eq("id", add.data!.id).select("repaired");
    expect(mark.data?.[0]?.repaired).toBe(false);
    const del = await staffA.db.from("prior_items").delete().eq("id", add.data!.id).select();
    expect(del.data).toEqual([]);
  });
});

describe("building_filings_cache", () => {
  it("firm A can't read or overwrite firm B's cache", async () => {
    const read = await qewiA.db.from("building_filings_cache").select("id").eq("id", b.cache);
    expect(read.data).toEqual([]);
    const upd = await qewiA.db.from("building_filings_cache").update({ last_error: "x" }).eq("id", b.cache).select();
    expect(upd.data).toEqual([]);
  });

  it("firm A can't cache data against firm B's building", async () => {
    const { error } = await qewiA.db
      .from("building_filings_cache")
      .insert({ firm_id: firmA, building_id: b.building, lookup_key: "bin:2000001" });
    expect(error).not.toBeNull();
  });

  it("staff can upsert their firm's cache", async () => {
    const { error } = await staffA.db
      .from("building_filings_cache")
      .upsert(
        { firm_id: firmA, building_id: a.building, lookup_key: "bbl:bronx/2001/10", filings: [], fetched_at: new Date().toISOString() },
        { onConflict: "building_id" },
      );
    expect(error).toBeNull();
    const again = await staffA.db
      .from("building_filings_cache")
      .upsert({ firm_id: firmA, building_id: a.building, lookup_key: "bbl:bronx/2001/10", last_error: "timeout" }, { onConflict: "building_id" })
      .select("last_error");
    expect(again.data?.[0]?.last_error).toBe("timeout");
  });

  it("rejects a non-list filings value", async () => {
    const { error } = await admin
      .from("building_filings_cache")
      .update({ filings: { not: "a list" } })
      .eq("id", b.cache);
    expect(error).not.toBeNull();
  });
});

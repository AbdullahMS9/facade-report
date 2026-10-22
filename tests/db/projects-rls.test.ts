import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createFirm, createUser, testEmail, type TestUser } from "./helpers";

// CLAUDE.md §8: firm A can't read or write firm B's buildings, projects,
// elevations, close-ups or probes, and can't link its rows to B's.

const TABLES = ["buildings", "projects", "elevations", "closeups", "probes"] as const;
type Table = (typeof TABLES)[number];

let qewiA: TestUser;
let staffA: TestUser;
let qewiB: TestUser;
let firmA: string;
let firmB: string;
const firmIds: string[] = [];
const idsB = {} as Record<Table, string>;
const idsA = {} as Record<Table, string>;

async function seedFirm(user: TestUser, firmId: string, address: string): Promise<Record<Table, string>> {
  const b = await user.db
    .from("buildings")
    .insert({ firm_id: firmId, address, borough: "manhattan", block: 1234, lot: 5 })
    .select("id")
    .single();
  if (b.error) throw b.error;
  const p = await user.db
    .from("projects")
    .insert({ firm_id: firmId, building_id: b.data.id })
    .select("id")
    .single();
  if (p.error) throw p.error;
  const e = await user.db
    .from("elevations")
    .insert({ firm_id: firmId, project_id: p.data.id, name: "North", faces_street: true, frontage_ft: 75 })
    .select("id")
    .single();
  if (e.error) throw e.error;
  const c = await user.db
    .from("closeups")
    .insert({ firm_id: firmId, elevation_id: e.data.id, location_note: "Drop 1", inspected_on: "2026-05-01", method: "scaffold" })
    .select("id")
    .single();
  if (c.error) throw c.error;
  const pr = await user.db
    .from("probes")
    .insert({ firm_id: firmId, closeup_id: c.data.id, location_note: "Floor 3", probed_on: "2026-05-01" })
    .select("id")
    .single();
  if (pr.error) throw pr.error;
  return { buildings: b.data.id, projects: p.data.id, elevations: e.data.id, closeups: c.data.id, probes: pr.data.id };
}

beforeAll(async () => {
  qewiA = await createUser("p-qewi-a");
  qewiB = await createUser("p-qewi-b");
  firmA = await createFirm(qewiA, "Fictional Facade Engineers A");
  firmB = await createFirm(qewiB, "Imaginary Exterior Wall Group B");
  firmIds.push(firmA, firmB);

  const staffEmail = testEmail("p-staff-a");
  const inv = await qewiA.db
    .from("invitations")
    .insert({ firm_id: firmA, email: staffEmail, invited_by: qewiA.id })
    .select("token")
    .single();
  if (inv.error) throw inv.error;
  staffA = await createUser("p-staff-a", staffEmail);
  const accepted = await staffA.db.rpc("accept_invitation", { p_token: inv.data.token });
  if (accepted.error) throw accepted.error;

  Object.assign(idsA, await seedFirm(qewiA, firmA, "100 Example Street"));
  Object.assign(idsB, await seedFirm(qewiB, firmB, "200 Sample Avenue"));
});

afterAll(async () => {
  await cleanup(firmIds);
});

describe("firm A reading firm B", () => {
  it.each(TABLES)("%s: sees only its own rows", async (table) => {
    const { data, error } = await qewiA.db.from(table).select("id, firm_id");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((r) => r.firm_id === firmA)).toBe(true);
    const direct = await qewiA.db.from(table).select("id").eq("id", idsB[table]);
    expect(direct.data).toEqual([]);
  });
});

describe("firm A writing to firm B", () => {
  it.each(TABLES)("%s: can't edit or delete B's row", async (table) => {
    const upd = await qewiA.db.from(table).update({ updated_at: new Date().toISOString() }).eq("id", idsB[table]).select();
    expect(upd.data).toEqual([]);
    const del = await qewiA.db.from(table).delete().eq("id", idsB[table]).select();
    expect(del.data).toEqual([]);
    const still = await admin.from(table).select("id").eq("id", idsB[table]);
    expect(still.data?.length).toBe(1);
  });

  it("can't add rows with firm B's firm_id", async () => {
    const b = await qewiA.db.from("buildings").insert({ firm_id: firmB, address: "1 Intruder Way", borough: "bronx" });
    expect(b.error).not.toBeNull();
    const p = await qewiA.db.from("projects").insert({ firm_id: firmB, building_id: idsB.buildings });
    expect(p.error).not.toBeNull();
  });

  it("can't link its own rows to B's parents", async () => {
    const project = await qewiA.db.from("projects").insert({ firm_id: firmA, building_id: idsB.buildings });
    expect(project.error).not.toBeNull();
    const elevation = await qewiA.db
      .from("elevations")
      .insert({ firm_id: firmA, project_id: idsB.projects, name: "East", faces_street: false });
    expect(elevation.error).not.toBeNull();
    const closeup = await qewiA.db
      .from("closeups")
      .insert({ firm_id: firmA, elevation_id: idsB.elevations, location_note: "x", inspected_on: "2026-05-01", method: "rope" });
    expect(closeup.error).not.toBeNull();
    const probe = await qewiA.db
      .from("probes")
      .insert({ firm_id: firmA, closeup_id: idsB.closeups, location_note: "x", probed_on: "2026-05-01" });
    expect(probe.error).not.toBeNull();
  });

  it("can't move its project onto B's building", async () => {
    const { error } = await qewiA.db.from("projects").update({ building_id: idsB.buildings }).eq("id", idsA.projects);
    expect(error).not.toBeNull();
  });

  it("can't assign firm B's inspector as QEWI", async () => {
    const insp = await qewiB.db
      .from("inspectors")
      .insert({ firm_id: firmB, name: "Pat Example", license_type: "PE", license_number: "100001" })
      .select("id")
      .single();
    const { error } = await qewiA.db.from("projects").update({ qewi_id: insp.data!.id }).eq("id", idsA.projects);
    expect(error).not.toBeNull();
  });
});

describe("staff permissions", () => {
  it("can add and edit buildings, projects and elevations", async () => {
    const ids = await seedFirm(staffA, firmA, "300 Placeholder Place");
    const upd = await staffA.db.from("elevations").update({ frontage_ft: 130 }).eq("id", ids.elevations).select();
    expect(upd.data?.length).toBe(1);
  });

  it.each(TABLES)("%s: can't delete", async (table) => {
    const del = await staffA.db.from(table).delete().eq("id", idsA[table]).select();
    expect(del.data).toEqual([]);
  });

  it("can't change a project's status", async () => {
    const { error } = await staffA.db.from("projects").update({ status: "ready" }).eq("id", idsA.projects);
    expect(error?.message).toMatch(/Only a QEWI/);
    const insert = await staffA.db.from("projects").insert({ firm_id: firmA, building_id: idsA.buildings, status: "filed" });
    expect(insert.error?.message).toMatch(/Only a QEWI/);
  });

  it("can still edit other project fields", async () => {
    const { data, error } = await staffA.db
      .from("projects")
      .update({ final_visual_date: "2026-06-01" })
      .eq("id", idsA.projects)
      .select("final_visual_date");
    expect(error).toBeNull();
    expect(data?.[0]?.final_visual_date).toBe("2026-06-01");
  });
});

describe("QEWI permissions", () => {
  it("can change status", async () => {
    const { error } = await qewiA.db.from("projects").update({ status: "ready" }).eq("id", idsA.projects);
    expect(error).toBeNull();
  });

  it("deleting an elevation removes its close-ups and probes", async () => {
    const ids = await seedFirm(qewiA, firmA, "400 Fictional Boulevard");
    const del = await qewiA.db.from("elevations").delete().eq("id", ids.elevations).select();
    expect(del.data?.length).toBe(1);
    const probes = await admin.from("probes").select("id").eq("id", ids.probes);
    expect(probes.data).toEqual([]);
  });
});

describe("data checks", () => {
  it("rejects a malformed BIN and a duplicate BIN in the same firm", async () => {
    const bad = await qewiA.db.from("buildings").insert({ firm_id: firmA, address: "1 Test St", borough: "queens", bin: "912345" });
    expect(bad.error).not.toBeNull();
    const first = await qewiA.db.from("buildings").insert({ firm_id: firmA, address: "2 Test St", borough: "queens", bin: "4000001" });
    expect(first.error).toBeNull();
    const dup = await qewiA.db.from("buildings").insert({ firm_id: firmA, address: "3 Test St", borough: "queens", bin: "4000001" });
    expect(dup.error).not.toBeNull();
    // The same BIN is fine in another firm.
    const other = await qewiB.db.from("buildings").insert({ firm_id: firmB, address: "2 Test St", borough: "queens", bin: "4000001" });
    expect(other.error).toBeNull();
  });

  it("rejects an exam end date before the start date", async () => {
    const { error } = await qewiA.db
      .from("projects")
      .update({ exam_start: "2026-05-10", exam_end: "2026-05-01" })
      .eq("id", idsA.projects);
    expect(error).not.toBeNull();
  });
});

describe("create_project()", () => {
  it("creates a building and project together", async () => {
    const { data: projectId, error } = await staffA.db.rpc("create_project", {
      p_cycle: 10,
      p_report_type: "initial",
      p_address: "500 Imaginary Road",
      p_borough: "brooklyn",
      p_block: 2345,
    });
    expect(error).toBeNull();
    const row = await staffA.db.from("projects").select("cycle, buildings(address, firm_id)").eq("id", projectId!).single();
    expect(row.data).toMatchObject({ cycle: 10, buildings: { address: "500 Imaginary Road", firm_id: firmA } });
  });

  it("reuses an existing building", async () => {
    const { data: projectId, error } = await qewiA.db.rpc("create_project", {
      p_cycle: 11,
      p_report_type: "initial",
      p_building_id: idsA.buildings,
    });
    expect(error).toBeNull();
    const row = await qewiA.db.from("projects").select("building_id").eq("id", projectId!).single();
    expect(row.data?.building_id).toBe(idsA.buildings);
  });

  it("won't use another firm's building", async () => {
    const { error } = await qewiA.db.rpc("create_project", {
      p_cycle: 10,
      p_report_type: "initial",
      p_building_id: idsB.buildings,
    });
    expect(error).not.toBeNull();
  });

  it("leaves nothing behind when the project can't be created", async () => {
    const before = await qewiA.db.from("buildings").select("id");
    const { error } = await qewiA.db.rpc("create_project", {
      p_cycle: 500, // out of range: project insert fails after the building insert
      p_report_type: "initial",
      p_address: "600 Rollback Lane",
      p_borough: "queens",
    });
    expect(error).not.toBeNull();
    const after = await qewiA.db.from("buildings").select("id");
    expect(after.data?.length).toBe(before.data?.length);
  });
});

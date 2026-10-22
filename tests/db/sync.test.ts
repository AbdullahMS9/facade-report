import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { syncObservationCore, syncPhotoRowCore } from "@/lib/offline/serverSync";
import { admin, cleanup, createFirm, createUser, type TestUser } from "./helpers";

// Offline sync must be safe to repeat and must never cross firms.

let a: TestUser;
let b: TestUser;
let firmA: string;
let firmB: string;
let projectA: string;
let projectB: string;
const firmIds: string[] = [];

const values = { element: "Parapet", condition: "Loose coping", classification: "unsafe", floor: "Roof" };

beforeAll(async () => {
  a = await createUser("sync-a");
  b = await createUser("sync-b");
  firmA = await createFirm(a, "Fictional Facade Engineers A");
  firmB = await createFirm(b, "Imaginary Exterior Wall Group B");
  firmIds.push(firmA, firmB);
  const pa = await a.db.rpc("create_project", { p_cycle: 10, p_report_type: "initial", p_address: "1 Example St", p_borough: "manhattan" });
  const pb = await b.db.rpc("create_project", { p_cycle: 10, p_report_type: "initial", p_address: "2 Sample Ave", p_borough: "bronx" });
  projectA = pa.data!;
  projectB = pb.data!;
});

afterAll(async () => {
  await cleanup(firmIds);
});

describe("syncObservationCore", () => {
  it("creates once and treats a repeat as done", async () => {
    const id = randomUUID();
    const input = { id, projectId: projectA, firmId: firmA, values };
    expect(await syncObservationCore(a.db, firmA, input)).toEqual({ ok: true });
    expect(await syncObservationCore(a.db, firmA, input)).toEqual({ ok: true });
    const rows = await admin.from("observations").select("id").eq("id", id);
    expect(rows.data).toHaveLength(1);
  });

  it("refuses items saved under another firm", async () => {
    const r = await syncObservationCore(a.db, firmA, { id: randomUUID(), projectId: projectB, firmId: firmB, values });
    expect(r).toMatchObject({ ok: false, retry: false });
  });

  it("can't claim another firm's existing id", async () => {
    const id = randomUUID();
    await syncObservationCore(b.db, firmB, { id, projectId: projectB, firmId: firmB, values });
    const r = await syncObservationCore(a.db, firmA, { id, projectId: projectA, firmId: firmA, values });
    expect(r).toMatchObject({ ok: false, retry: false });
  });

  it("can't write into another firm's project", async () => {
    const r = await syncObservationCore(a.db, firmA, { id: randomUUID(), projectId: projectB, firmId: firmA, values });
    expect(r.ok).toBe(false);
    const rows = await admin.from("observations").select("id").eq("project_id", projectB).eq("firm_id", firmA);
    expect(rows.data).toEqual([]);
  });

  it("keeps an observation whose elevation was deleted while it waited", async () => {
    const elevation = await a.db
      .from("elevations")
      .insert({ firm_id: firmA, project_id: projectA, name: "East", faces_street: false })
      .select("id")
      .single();
    await a.db.from("elevations").delete().eq("id", elevation.data!.id);
    const r = await syncObservationCore(a.db, firmA, {
      id: randomUUID(),
      projectId: projectA,
      firmId: firmA,
      values: { ...values, elevation_id: elevation.data!.id },
    });
    expect(r).toMatchObject({ ok: true, note: expect.stringContaining("without one") });
  });

  it("rejects invalid saved values without retrying", async () => {
    const r = await syncObservationCore(a.db, firmA, {
      id: randomUUID(),
      projectId: projectA,
      firmId: firmA,
      values: { ...values, classification: "fine" },
    });
    expect(r).toMatchObject({ ok: false, retry: false });
  });
});

describe("syncPhotoRowCore", () => {
  it("records once and treats a repeat as done", async () => {
    const photo = {
      id: randomUUID(),
      kind: "typical" as const,
      observation_id: null,
      original_ext: "jpg" as const,
      original_type: "image/jpeg" as const,
      width: 1600,
      height: 1200,
      taken_at: "2026-09-21T14:30:00.000Z",
      taken_at_source: "exif" as const,
      caption: "",
    };
    const input = { projectId: projectA, firmId: firmA, photo };
    expect(await syncPhotoRowCore(a.db, firmA, input)).toEqual({ ok: true });
    expect(await syncPhotoRowCore(a.db, firmA, input)).toEqual({ ok: true });
    const rows = await admin.from("photos").select("original_path").eq("id", photo.id);
    expect(rows.data).toEqual([{ original_path: `${firmA}/${projectA}/${photo.id}/original.jpg` }]);
  });
});

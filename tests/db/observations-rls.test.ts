import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createFirm, createUser, testEmail, type TestUser } from "./helpers";

// CLAUDE.md §8: observations, photo rows and photo files stay inside the firm.

let qewiA: TestUser;
let staffA: TestUser;
let qewiB: TestUser;
let firmA: string;
let firmB: string;
const firmIds: string[] = [];
const A = { project: "", elevation: "", closeup: "", observation: "", photo: "" };
const B = { project: "", elevation: "", observation: "", photo: "", path: "" };

// A tiny fake JPEG (header bytes only); storage doesn't decode it.
const FAKE_JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

async function seed(user: TestUser, firmId: string, address: string) {
  const { data: project, error } = await user.db.rpc("create_project", {
    p_cycle: 10,
    p_report_type: "initial",
    p_address: address,
    p_borough: "queens",
  });
  if (error) throw error;
  const elevation = await user.db
    .from("elevations")
    .insert({ firm_id: firmId, project_id: project, name: "North", faces_street: true, frontage_ft: 50 })
    .select("id")
    .single();
  const closeup = await user.db
    .from("closeups")
    .insert({ firm_id: firmId, elevation_id: elevation.data!.id, location_note: "Drop 1", inspected_on: "2026-05-01", method: "rope" })
    .select("id")
    .single();
  const observation = await user.db
    .from("observations")
    .insert({
      firm_id: firmId,
      project_id: project,
      elevation_id: elevation.data!.id,
      closeup_id: closeup.data!.id,
      element: "Brick masonry",
      condition: "Cracked brick at pier",
      classification: "swarmp",
    })
    .select("id")
    .single();
  if (observation.error) throw observation.error;

  const photoId = randomUUID();
  const dir = `${firmId}/${project}/${photoId}`;
  for (const file of ["original.jpg", "display.jpg"]) {
    const up = await user.db.storage.from("photos").upload(`${dir}/${file}`, FAKE_JPEG, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
  }
  const photo = await user.db
    .from("photos")
    .insert({
      id: photoId,
      firm_id: firmId,
      project_id: project,
      observation_id: observation.data.id,
      kind: "condition",
      original_path: `${dir}/original.jpg`,
      display_path: `${dir}/display.jpg`,
      original_type: "image/jpeg",
      width: 1600,
      height: 1200,
    })
    .select("id")
    .single();
  if (photo.error) throw photo.error;
  return {
    project: project as string,
    elevation: elevation.data!.id,
    closeup: closeup.data!.id,
    observation: observation.data.id,
    photo: photo.data.id,
    path: `${dir}/display.jpg`,
  };
}

beforeAll(async () => {
  qewiA = await createUser("ob-qewi-a");
  qewiB = await createUser("ob-qewi-b");
  firmA = await createFirm(qewiA, "Fictional Facade Engineers A");
  firmB = await createFirm(qewiB, "Imaginary Exterior Wall Group B");
  firmIds.push(firmA, firmB);

  const staffEmail = testEmail("ob-staff-a");
  const inv = await qewiA.db
    .from("invitations")
    .insert({ firm_id: firmA, email: staffEmail, invited_by: qewiA.id })
    .select("token")
    .single();
  staffA = await createUser("ob-staff-a", staffEmail);
  await staffA.db.rpc("accept_invitation", { p_token: inv.data!.token });

  Object.assign(A, await seed(qewiA, firmA, "30 Example Street"));
  Object.assign(B, await seed(qewiB, firmB, "40 Sample Avenue"));
});

afterAll(async () => {
  // Remove storage files, then the firms (rows cascade).
  for (const firm of firmIds) {
    const { data: projects } = await admin.storage.from("photos").list(firm);
    for (const p of projects ?? []) {
      const { data: photos } = await admin.storage.from("photos").list(`${firm}/${p.name}`);
      for (const ph of photos ?? []) {
        const { data: files } = await admin.storage.from("photos").list(`${firm}/${p.name}/${ph.name}`);
        await admin.storage.from("photos").remove((files ?? []).map((f) => `${firm}/${p.name}/${ph.name}/${f.name}`));
      }
    }
  }
  await cleanup(firmIds);
});

describe("observations and photo rows", () => {
  it.each(["observations", "photos"] as const)("%s: firm A sees only its own rows", async (table) => {
    const { data } = await qewiA.db.from(table).select("id, firm_id");
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((r) => r.firm_id === firmA)).toBe(true);
  });

  it("firm A can't edit or delete firm B's observation or photo", async () => {
    const upd = await qewiA.db.from("observations").update({ classification: "safe" }).eq("id", B.observation).select();
    expect(upd.data).toEqual([]);
    const del = await qewiA.db.from("photos").delete().eq("id", B.photo).select();
    expect(del.data).toEqual([]);
  });

  it("can't link an observation to another project's elevation", async () => {
    const { data: otherProject } = await qewiA.db.rpc("create_project", {
      p_cycle: 10,
      p_report_type: "initial",
      p_address: "31 Example Street",
      p_borough: "queens",
    });
    const { error } = await qewiA.db.from("observations").insert({
      firm_id: firmA,
      project_id: otherProject!,
      elevation_id: A.elevation, // belongs to A.project, not otherProject
      element: "Parapet",
      condition: "Loose coping",
      classification: "unsafe",
    });
    expect(error).not.toBeNull();
  });

  it("can't record a photo whose path points at another firm", async () => {
    const id = randomUUID();
    const { error } = await qewiA.db.from("photos").insert({
      id,
      firm_id: firmA,
      project_id: A.project,
      kind: "typical",
      original_path: `${firmB}/${A.project}/${id}/original.jpg`,
      display_path: `${firmB}/${A.project}/${id}/display.jpg`,
      original_type: "image/jpeg",
      width: 1000,
      height: 800,
    });
    expect(error).not.toBeNull();
  });

  it("requires an observation for condition photos", async () => {
    const id = randomUUID();
    const dir = `${firmA}/${A.project}/${id}`;
    const { error } = await qewiA.db.from("photos").insert({
      id,
      firm_id: firmA,
      project_id: A.project,
      kind: "condition",
      original_path: `${dir}/original.jpg`,
      display_path: `${dir}/display.jpg`,
      original_type: "image/jpeg",
      width: 1000,
      height: 800,
    });
    expect(error).not.toBeNull();
  });

  it("staff can add observations but not delete them", async () => {
    const add = await staffA.db
      .from("observations")
      .insert({ firm_id: firmA, project_id: A.project, element: "Lintel", condition: "Rust staining", classification: "safe" })
      .select("id")
      .single();
    expect(add.error).toBeNull();
    const del = await staffA.db.from("observations").delete().eq("id", add.data!.id).select();
    expect(del.data).toEqual([]);
  });
});

describe("photo files in storage", () => {
  it("firm A can't download or sign firm B's files", async () => {
    const dl = await qewiA.db.storage.from("photos").download(B.path);
    expect(dl.error).not.toBeNull();
    const signed = await qewiA.db.storage.from("photos").createSignedUrl(B.path, 60);
    expect(signed.error).not.toBeNull();
  });

  it("firm A can download and sign its own files", async () => {
    const own = (await admin.from("photos").select("display_path").eq("id", A.photo).single()).data!.display_path;
    const dl = await qewiA.db.storage.from("photos").download(own);
    expect(dl.error).toBeNull();
    const signed = await staffA.db.storage.from("photos").createSignedUrl(own, 60);
    expect(signed.data?.signedUrl).toContain("token=");
  });

  it("firm A can't upload into firm B's folder or outside any firm folder", async () => {
    const intoB = await qewiA.db.storage.from("photos").upload(`${firmB}/${B.project}/${randomUUID()}/original.jpg`, FAKE_JPEG);
    expect(intoB.error).not.toBeNull();
    const loose = await qewiA.db.storage.from("photos").upload(`not-a-firm/${randomUUID()}.jpg`, FAKE_JPEG);
    expect(loose.error).not.toBeNull();
  });

  it("files can't be overwritten", async () => {
    const own = (await admin.from("photos").select("original_path").eq("id", A.photo).single()).data!.original_path;
    const again = await qewiA.db.storage.from("photos").upload(own, FAKE_JPEG, { upsert: true });
    expect(again.error).not.toBeNull();
  });

  it("staff can't delete files; firm B's QEWI can't delete A's", async () => {
    const own = (await admin.from("photos").select("display_path").eq("id", A.photo).single()).data!.display_path;
    await staffA.db.storage.from("photos").remove([own]);
    await qewiB.db.storage.from("photos").remove([own]);
    const still = await admin.storage.from("photos").download(own);
    expect(still.error).toBeNull();
  });

  it("signed-out visitors get nothing", async () => {
    const { anonClient } = await import("./helpers");
    const dl = await anonClient().storage.from("photos").download(B.path);
    expect(dl.error).not.toBeNull();
  });
});

describe("deleting an elevation keeps its observations", () => {
  it("clears the elevation and drop links", async () => {
    const del = await qewiA.db.from("elevations").delete().eq("id", A.elevation).select();
    expect(del.error).toBeNull();
    const obs = await qewiA.db.from("observations").select("elevation_id, closeup_id").eq("id", A.observation).single();
    expect(obs.data).toEqual({ elevation_id: null, closeup_id: null });
  });
});

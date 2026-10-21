import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  cleanup,
  createFirm,
  createUser,
  testEmail,
  type TestUser,
} from "./helpers";

// CLAUDE.md §8: a user from firm A must not read or write firm B's rows.

let qewiA: TestUser;
let qewiB: TestUser;
let staffA: TestUser;
let firmA: string;
let firmB: string;
let inspectorB: string;
let invitationB: string;
const firmIds: string[] = [];

beforeAll(async () => {
  qewiA = await createUser("qewi-a");
  qewiB = await createUser("qewi-b");
  firmA = await createFirm(qewiA, "Fictional Facade Engineers A");
  firmB = await createFirm(qewiB, "Imaginary Exterior Wall Group B");
  firmIds.push(firmA, firmB);

  const insp = await qewiB.db
    .from("inspectors")
    .insert({ firm_id: firmB, name: "Pat Example", license_type: "PE", license_number: "000001" })
    .select("id")
    .single();
  if (insp.error) throw insp.error;
  inspectorB = insp.data.id;

  const inv = await qewiB.db
    .from("invitations")
    .insert({ firm_id: firmB, email: testEmail("invitee-b"), invited_by: qewiB.id })
    .select("id")
    .single();
  if (inv.error) throw inv.error;
  invitationB = inv.data.id;

  // Firm A also gets an inspector and a staff member who joins by invitation.
  const inspA = await qewiA.db
    .from("inspectors")
    .insert({ firm_id: firmA, name: "Sam Sample", license_type: "RA", license_number: "000002" })
    .select("id")
    .single();
  if (inspA.error) throw inspA.error;

  const staffEmail = testEmail("staff-a");
  const invA = await qewiA.db
    .from("invitations")
    .insert({ firm_id: firmA, email: staffEmail, invited_by: qewiA.id })
    .select("token")
    .single();
  if (invA.error) throw invA.error;
  staffA = await createUser("staff-a", staffEmail);
  const accepted = await staffA.db.rpc("accept_invitation", { p_token: invA.data.token });
  if (accepted.error) throw accepted.error;
});

afterAll(async () => {
  await cleanup(firmIds);
});

describe("reading another firm's rows", () => {
  it("firms: sees only its own firm", async () => {
    const { data, error } = await qewiA.db.from("firms").select("id");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([firmA]);
  });

  it("memberships: sees only its own firm's members", async () => {
    const { data } = await qewiA.db.from("memberships").select("firm_id");
    expect(data?.length).toBe(2); // qewiA + staffA
    expect(data?.every((r) => r.firm_id === firmA)).toBe(true);
  });

  it("inspectors: sees only its own firm's inspectors", async () => {
    const { data } = await qewiA.db.from("inspectors").select("firm_id");
    expect(data?.length).toBe(1);
    expect(data?.every((r) => r.firm_id === firmA)).toBe(true);
  });

  it("invitations: sees only its own firm's invitations", async () => {
    const { data } = await qewiA.db.from("invitations").select("firm_id");
    expect(data?.every((r) => r.firm_id === firmA)).toBe(true);
    const direct = await qewiA.db.from("invitations").select("id").eq("id", invitationB);
    expect(direct.data).toEqual([]);
  });

  it("firm_members(): lists only its own firm", async () => {
    const { data, error } = await qewiA.db.rpc("firm_members");
    expect(error).toBeNull();
    expect(data?.map((m) => m.email).sort()).toEqual([qewiA.email, staffA.email].sort());
  });
});

describe("writing to another firm", () => {
  it("cannot add an inspector to firm B", async () => {
    const { error } = await qewiA.db
      .from("inspectors")
      .insert({ firm_id: firmB, name: "Intruder", license_type: "PE", license_number: "999999" });
    expect(error).not.toBeNull();
  });

  it("cannot invite people to firm B", async () => {
    const { error } = await qewiA.db
      .from("invitations")
      .insert({ firm_id: firmB, email: testEmail("x"), invited_by: qewiA.id });
    expect(error).not.toBeNull();
  });

  it("cannot rename firm B", async () => {
    const { data } = await qewiA.db.from("firms").update({ name: "Hacked" }).eq("id", firmB).select();
    expect(data).toEqual([]);
    const check = await admin.from("firms").select("name").eq("id", firmB).single();
    expect(check.data?.name).toBe("Imaginary Exterior Wall Group B");
  });

  it("cannot edit or delete firm B's inspector", async () => {
    const upd = await qewiA.db.from("inspectors").update({ name: "Hacked" }).eq("id", inspectorB).select();
    expect(upd.data).toEqual([]);
    const del = await qewiA.db.from("inspectors").delete().eq("id", inspectorB).select();
    expect(del.data).toEqual([]);
    const check = await admin.from("inspectors").select("name").eq("id", inspectorB).single();
    expect(check.data?.name).toBe("Pat Example");
  });

  it("cannot move its own inspector into firm B", async () => {
    const { error } = await qewiA.db
      .from("inspectors")
      .update({ firm_id: firmB })
      .eq("firm_id", firmA)
      .select();
    expect(error).not.toBeNull();
  });

  it("cannot revoke firm B's invitation", async () => {
    const { data } = await qewiA.db.from("invitations").delete().eq("id", invitationB).select();
    expect(data).toEqual([]);
    const check = await admin.from("invitations").select("id").eq("id", invitationB);
    expect(check.data?.length).toBe(1);
  });

  it("cannot insert firms or memberships directly", async () => {
    const firm = await qewiA.db.from("firms").insert({ name: "Side firm" });
    expect(firm.error).not.toBeNull();
    const member = await qewiA.db.from("memberships").insert({ firm_id: firmB, user_id: qewiA.id, role: "qewi" });
    expect(member.error).not.toBeNull();
  });
});

describe("staff permissions", () => {
  it("can read the firm and its inspectors", async () => {
    const firms = await staffA.db.from("firms").select("id");
    expect(firms.data?.map((r) => r.id)).toEqual([firmA]);
    const insp = await staffA.db.from("inspectors").select("id");
    expect(insp.data?.length).toBe(1);
  });

  it("cannot see invitations, invite, or rename the firm", async () => {
    const inv = await staffA.db.from("invitations").select("id");
    expect(inv.data).toEqual([]);
    const ins = await staffA.db
      .from("invitations")
      .insert({ firm_id: firmA, email: testEmail("y"), invited_by: staffA.id });
    expect(ins.error).not.toBeNull();
    const upd = await staffA.db.from("firms").update({ name: "Renamed" }).eq("id", firmA).select();
    expect(upd.data).toEqual([]);
  });
});

describe("invitations and one firm per user", () => {
  it("rejects an invitation sent to a different email", async () => {
    const inv = await qewiB.db
      .from("invitations")
      .insert({ firm_id: firmB, email: testEmail("someone-else"), invited_by: qewiB.id })
      .select("token")
      .single();
    const stranger = await createUser("stranger");
    const { error } = await stranger.db.rpc("accept_invitation", { p_token: inv.data!.token });
    expect(error?.message).toMatch(/different email/);
    const firms = await stranger.db.from("firms").select("id");
    expect(firms.data).toEqual([]);
  });

  it("rejects an invitation that was already used", async () => {
    const email = testEmail("twice");
    const inv = await qewiA.db
      .from("invitations")
      .insert({ firm_id: firmA, email, invited_by: qewiA.id })
      .select("token")
      .single();
    const user = await createUser("twice", email);
    expect((await user.db.rpc("accept_invitation", { p_token: inv.data!.token })).error).toBeNull();
    const again = await user.db.rpc("accept_invitation", { p_token: inv.data!.token });
    expect(again.error?.message).toMatch(/already been used/);
  });

  it("does not let a firm member create or join a second firm", async () => {
    const second = await qewiA.db.rpc("create_firm", { p_name: "Second firm" });
    expect(second.error?.message).toMatch(/already belong/);

    const inv = await qewiB.db
      .from("invitations")
      .insert({ firm_id: firmB, email: qewiA.email, invited_by: qewiB.id })
      .select("token")
      .single();
    const join = await qewiA.db.rpc("accept_invitation", { p_token: inv.data!.token });
    expect(join.error?.message).toMatch(/already belong/);
  });
});

describe("signed-out visitors", () => {
  it("cannot read any table", async () => {
    const anon = anonClient();
    for (const table of ["firms", "memberships", "inspectors", "invitations"] as const) {
      const { data } = await anon.from(table).select("id");
      expect(data ?? []).toEqual([]);
    }
  });

  it("can preview an invitation only with its token", async () => {
    const tokenRow = await admin.from("invitations").select("token").eq("id", invitationB).single();
    const anon = anonClient();
    const { data, error } = await anon.rpc("invitation_preview", { p_token: tokenRow.data!.token });
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ firm_name: "Imaginary Exterior Wall Group B", status: "open" });

    const wrong = await anon.rpc("invitation_preview", { p_token: "00000000-0000-0000-0000-000000000000" });
    expect(wrong.data).toEqual([]);
  });

  it("cannot call create_firm", async () => {
    const { error } = await anonClient().rpc("create_firm", { p_name: "Anon firm" });
    expect(error).not.toBeNull();
  });
});

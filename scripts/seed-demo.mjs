// Seeds one fictional demo project (CLAUDE.md §10 step 10, §8: clearly fictional).
//
//   node --env-file=.env.local --env-file=.env.seed.local scripts/seed-demo.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_EMAIL (the
// address that will sign in to the demo; keep it in .env.seed.local, never in
// the repo). Safe to rerun: it replaces the demo firm each time. It refuses to
// touch an account that belongs to any other firm.
//
// The demo deliberately leaves two checker blockers (an UNSAFE observation
// without a photo, and an undecided prior-cycle item) to show the checker.

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DEMO_FIRM = "Demo Facade Engineering (fictional)";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
if (!url || !serviceKey || !email) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_EMAIL.");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const must = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};

// Dates relative to today in New York.
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
function day(offset) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1. The demo user (created confirmed; signs in with an emailed code).
// ---------------------------------------------------------------------------

async function findUser(address) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === address);
    if (user || data.users.length < 200) return user ?? null;
  }
  return null;
}

let user = await findUser(email);
if (!user) {
  user = must(await db.auth.admin.createUser({ email, email_confirm: true }), "create user").user;
  console.log(`Created user ${email}`);
}

// ---------------------------------------------------------------------------
// 2. Remove the previous demo firm (never any other firm).
// ---------------------------------------------------------------------------

const membership = must(
  await db.from("memberships").select("firm_id, firms(name)").eq("user_id", user.id).maybeSingle(),
  "read membership",
);
if (membership && membership.firms?.name !== DEMO_FIRM) {
  console.error(`${email} already belongs to "${membership.firms?.name}". Use another DEMO_EMAIL.`);
  process.exit(1);
}
if (membership) {
  const firmId = membership.firm_id;
  const bucket = db.storage.from("photos");
  for (const project of must(await bucket.list(firmId), "list files")) {
    for (const photo of must(await bucket.list(`${firmId}/${project.name}`), "list files")) {
      const files = must(await bucket.list(`${firmId}/${project.name}/${photo.name}`), "list files");
      if (files.length) must(await bucket.remove(files.map((f) => `${firmId}/${project.name}/${photo.name}/${f.name}`)), "remove files");
    }
  }
  must(await db.from("projects").delete().eq("firm_id", firmId), "delete projects");
  must(await db.from("firms").delete().eq("id", firmId), "delete firm");
  console.log("Removed the previous demo firm");
}

// ---------------------------------------------------------------------------
// 3. Firm, inspector, building, project.
// ---------------------------------------------------------------------------

const firm = must(await db.from("firms").insert({ name: DEMO_FIRM }).select("id").single(), "firm");
must(await db.from("memberships").insert({ firm_id: firm.id, user_id: user.id, role: "qewi" }), "membership");
const inspector = must(
  await db
    .from("inspectors")
    .insert({ firm_id: firm.id, user_id: user.id, name: "Alex Sample (fictional)", license_type: "PE", license_number: "000001" })
    .select("id")
    .single(),
  "inspector",
);

// No real address: there is no Demo Street in NYC, and BIN 1999990 matches no
// DOB filing, so the Open Data lookup finds nothing real.
const building = must(
  await db
    .from("buildings")
    .insert({
      firm_id: firm.id,
      address: "123 Demo Street",
      borough: "manhattan",
      block: 9994, // ends in 4 → Cycle 10 window Feb 21, 2025 – Feb 21, 2027
      lot: 1,
      bin: "1999990",
      cross_street: "Sample Avenue",
      is_landmark: false,
      stories: 12,
      height_ft: 128,
      year_built: 1927,
      use: "Residential (fictional)",
      materials: ["Brick", "Cast stone", "Steel lintels"],
      materials_notes: "Original 1927 brick and cast stone; cast stone sills replaced 2004 (fictional).",
      is_cavity_wall: true,
      owner_name: "Demo Owner LLC (fictional)",
      owner_address: "1 Sample Plaza\nNew York, NY",
      owner_phone: "000-000-0000",
      owner_principal_name: "Jamie Example (fictional)",
      owner_principal_title: "Managing Member",
    })
    .select("id")
    .single(),
  "building",
);

const project = must(
  await db
    .from("projects")
    .insert({
      firm_id: firm.id,
      building_id: building.id,
      cycle: 10,
      report_type: "initial",
      qewi_id: inspector.id,
      exam_start: day(-40),
      exam_end: day(-10),
      closeup_complete_date: day(-20),
      final_visual_date: day(-10),
      unsafe_notified_on: day(-19),
      public_protection_note: "Sidewalk shed installed along Demo Street (fictional).",
    })
    .select("id")
    .single(),
  "project",
);

// ---------------------------------------------------------------------------
// 4. Elevations, drops, probes.
// ---------------------------------------------------------------------------

async function elevation(name, facesStreet, frontageFt, order, setbacks = null) {
  return must(
    await db
      .from("elevations")
      .insert({ firm_id: firm.id, project_id: project.id, name, faces_street: facesStreet, frontage_ft: frontageFt, sort_order: order, setbacks_note: setbacks })
      .select("id")
      .single(),
    "elevation",
  ).id;
}
async function drop(elevationId, note, offset, method) {
  return must(
    await db
      .from("closeups")
      .insert({ firm_id: firm.id, elevation_id: elevationId, location_note: note, inspected_on: day(offset), method })
      .select("id")
      .single(),
    "drop",
  ).id;
}
async function probe(closeupId, note, offset) {
  must(
    await db.from("probes").insert({
      firm_id: firm.id,
      closeup_id: closeupId,
      location_note: note,
      probed_on: day(offset),
      tie_type: "Corrugated metal",
      tie_spacing: "16 in horizontal, 24 in vertical",
      tie_condition: "Light surface rust; sound",
    }),
    "probe",
  );
}

const north = await elevation("North (Demo Street)", true, 110, 0, "Setback at 10th floor");
const east = await elevation("East (Sample Avenue)", true, 55, 1);
const south = await elevation("South (rear yard)", false, 80, 2);
const n1 = await drop(north, "Bay 1, west of entrance", -30, "scaffold");
const n2 = await drop(north, "Bay 4, east corner", -28, "scaffold");
const e1 = await drop(east, "Center bay", -25, "swing_stage");
await drop(south, "Rear center", -22, "rope");
await probe(n1, "Floor 4, left pier", -30);
await probe(n2, "Floor 7, right pier", -28);
await probe(e1, "Floor 5, center", -25);

// ---------------------------------------------------------------------------
// 5. Observations and photos.
// ---------------------------------------------------------------------------

const photoFile = (name) => readFile(new URL(`./demo-photos/${name}.jpg`, import.meta.url));

async function addPhoto(kind, file, offset, observationId = null) {
  const id = randomUUID();
  const dir = `${firm.id}/${project.id}/${id}`;
  const body = await photoFile(file);
  for (const name of ["original.jpg", "display.jpg"]) {
    must(await db.storage.from("photos").upload(`${dir}/${name}`, body, { contentType: "image/jpeg" }), "upload");
  }
  must(
    await db.from("photos").insert({
      id,
      firm_id: firm.id,
      project_id: project.id,
      observation_id: observationId,
      kind,
      original_path: `${dir}/original.jpg`,
      display_path: `${dir}/display.jpg`,
      original_type: "image/jpeg",
      width: 1600,
      height: 1200,
      taken_at: `${day(offset)}T14:30:00.000Z`,
      taken_at_source: "exif",
    }),
    "photo",
  );
}

async function observation(o, photo = null) {
  const row = must(
    await db
      .from("observations")
      .insert({ firm_id: firm.id, project_id: project.id, ...o })
      .select("id")
      .single(),
    "observation",
  );
  if (photo) await addPhoto("condition", photo, -28, row.id);
}

await observation(
  {
    elevation_id: north,
    closeup_id: n2,
    floor: "Roof",
    element: "Coping",
    condition: "Loose coping stones at the parapet along Demo Street.",
    classification: "unsafe",
    cause: "Failed mortar joints and corroded anchors.",
    recommended_repair: "Remove, re-anchor and reset coping stones.",
    repair_by_date: day(-10 + 180),
  },
  "parapet-coping",
);
await observation({
  // No photo on purpose: a checker blocker for the demo.
  elevation_id: north,
  closeup_id: n1,
  floor: "8",
  element: "Window air conditioner",
  condition: "Unsecured window air conditioner bracket.",
  classification: "unsafe",
  cause: "Missing bracket fasteners.",
  recommended_repair: "Secure or remove the unit.",
  repair_by_date: day(-10 + 90),
});
await observation(
  {
    elevation_id: north,
    closeup_id: n1,
    floor: "3",
    element: "Brick masonry",
    condition: "Step cracking at the pier below the 4th floor window.",
    classification: "swarmp",
    cause: "Water infiltration and freeze-thaw.",
    recommended_repair: "Replace cracked brick and repoint.",
    repair_by_date: day(-10 + 730),
  },
  "brick-cracking",
);
await observation(
  {
    elevation_id: east,
    closeup_id: e1,
    floor: "5",
    element: "Lintel",
    condition: "Rust jacking at the steel lintel above the 5th floor window.",
    classification: "swarmp",
    cause: "Corrosion of the steel lintel.",
    recommended_repair: "Expose, treat or replace the lintel and flash.",
    repair_by_date: day(-10 + 545),
  },
  "lintel-rust",
);
await observation({
  elevation_id: east,
  floor: "2–12",
  element: "Sealant joint",
  condition: "Sealant at window perimeters in fair condition.",
  classification: "safe",
});
await observation({
  elevation_id: south,
  floor: "1–12",
  element: "Fire escape",
  condition: "Fire escape anchored; light surface rust.",
  classification: "safe",
});

await addPhoto("elevation", "elevation-north", -30);
await addPhoto("inspector", "inspector-drop", -30);
await addPhoto("probe", "probe-opening", -30);

// ---------------------------------------------------------------------------
// 6. Prior-cycle items.
// ---------------------------------------------------------------------------

must(
  await db.from("prior_items").insert([
    { firm_id: firm.id, project_id: project.id, description: "Cracked cast stone sill, 6th floor (fictional, Cycle 9).", location_note: "North elevation", repaired: true },
    // Left undecided on purpose: a checker blocker for the demo.
    { firm_id: firm.id, project_id: project.id, description: "Displaced brick at rear parapet (fictional, Cycle 9).", location_note: "South elevation", repaired: null },
  ]),
  "prior items",
);

console.log(`Demo ready: "${DEMO_FIRM}", project 123 Demo Street (${project.id}).`);
console.log(`Sign in as ${email} with an emailed code.`);

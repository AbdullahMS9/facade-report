import { describe, expect, it } from "vitest";
import { runChecks, summarizeChecks, type CheckerInput, type CheckId } from "./checker";

// A fictional project that passes every check. Tests change one thing at a time.
function complete(): CheckerInput {
  return {
    today: "2026-10-22",
    cycle: 10,
    building: {
      address: "123 Example Street",
      block: 1234, // window Feb 21, 2025 – Feb 21, 2027
      lot: 5,
      bin: "1000123",
      materials: ["Brick"],
      isCavityWall: false,
      ownerName: "Example Holdings LLC",
      ownerAddress: "1 Sample Plaza, New York, NY",
    },
    project: {
      qewiChosen: true,
      examStart: "2026-09-01",
      examEnd: "2026-10-01",
      finalInspectionDate: "2026-10-01", // +60 days → Nov 30, 2026
      closeupCompleteDate: "2026-09-25",
      unsafeNotifiedOn: null,
      publicProtectionNote: null,
      probeWaiver: null,
    },
    elevations: [
      { id: "e1", name: "North", facesStreet: true, frontageFt: 75, closeups: [{ id: "c1", probeCount: 0 }, { id: "c2", probeCount: 0 }] },
      { id: "e2", name: "South", facesStreet: false, frontageFt: 75, closeups: [] },
    ],
    observations: [
      {
        id: "o1",
        label: "Parapet, floor Roof",
        classification: "swarmp",
        recommendedRepair: "Reset coping stones",
        repairByDate: "2028-10-01",
        cause: "Failed mortar joints",
        photoCount: 1,
      },
    ],
    photos: [
      { id: "p1", kind: "condition", width: 1600, height: 1200, takenAt: "2026-09-21T14:30:00Z", takenAtSource: "exif" },
      { id: "p2", kind: "inspector", width: 1600, height: 1200, takenAt: "2026-09-21T15:00:00Z", takenAtSource: "exif" },
      { id: "p3", kind: "elevation", width: 1600, height: 1200, takenAt: "2026-09-21T15:10:00Z", takenAtSource: "exif" },
    ],
    priorItems: [],
  };
}

function check(input: CheckerInput, id: CheckId) {
  const r = runChecks(input).find((c) => c.id === id);
  if (!r) throw new Error(`no check ${id}`);
  return r;
}

describe("runChecks on a complete project", () => {
  it("passes everything", () => {
    const failing = runChecks(complete()).filter((r) => !r.passed);
    expect(failing).toEqual([]);
  });

  it("returns every check with the §3.7 shape", () => {
    const results = runChecks(complete());
    expect(results).toHaveLength(18);
    for (const r of results) {
      expect(r).toMatchObject({ id: expect.any(String), passed: expect.any(Boolean), message: expect.any(String) });
      expect(["blocker", "warning"]).toContain(r.severity);
    }
  });
});

describe("blockers", () => {
  it("building identifiers", () => {
    const i = complete();
    i.building.bin = null;
    i.building.lot = null;
    expect(check(i, "building_identifiers")).toMatchObject({ passed: false, severity: "blocker", message: "Missing: lot, BIN." });
  });

  it("wall materials", () => {
    const i = complete();
    i.building.materials = [];
    expect(check(i, "wall_materials").passed).toBe(false);
  });

  it("close-ups: 60 ft exactly needs 2", () => {
    const i = complete();
    i.elevations[0]!.frontageFt = 60;
    i.elevations[0]!.closeups = [{ id: "c1", probeCount: 0 }];
    const r = check(i, "closeups_required");
    expect(r.passed).toBe(false);
    expect(r.related).toEqual([{ kind: "elevation", id: "e1", label: "North: 1 of 2 drops" }]);
    i.elevations[0]!.frontageFt = 59.9;
    expect(check(i, "closeups_required").passed).toBe(true);
  });

  it("close-ups: missing frontage, no elevations, no drops at all", () => {
    const i = complete();
    i.elevations[0]!.frontageFt = 0;
    expect(check(i, "closeups_required").message).toMatch(/frontage missing/);
    i.elevations = [];
    expect(check(i, "closeups_required").message).toBe("No elevations added.");
    i.elevations = [{ id: "e2", name: "Rear", facesStreet: false, frontageFt: 40, closeups: [] }];
    expect(check(i, "closeups_required").message).toBe("No close-up inspections recorded.");
  });

  it("probes: unknown cavity wall blocks; not cavity passes", () => {
    const i = complete();
    i.building.isCavityWall = null;
    expect(check(i, "probes").passed).toBe(false);
    i.building.isCavityWall = false;
    expect(check(i, "probes").passed).toBe(true);
  });

  it("probes: cavity wall needs a probe per required drop, unless waived", () => {
    const i = complete();
    i.building.isCavityWall = true;
    i.elevations[0]!.closeups = [{ id: "c1", probeCount: 1 }, { id: "c2", probeCount: 0 }];
    expect(check(i, "probes")).toMatchObject({ passed: false, related: [{ id: "e1" }] });
    i.elevations[0]!.closeups[1]!.probeCount = 2;
    expect(check(i, "probes").passed).toBe(true);
    i.elevations[0]!.closeups[1]!.probeCount = 0;
    i.project.probeWaiver = "tie_repair";
    expect(check(i, "probes").passed).toBe(true);
  });

  it("probes: not required before cycle 9", () => {
    const i = complete();
    i.building.isCavityWall = true;
    i.cycle = 8;
    i.building.block = 1234;
    expect(check(i, "probes").message).toMatch(/aren't required in cycle 8/);
  });

  it("condition photos", () => {
    const i = complete();
    i.observations[0]!.photoCount = 0;
    expect(check(i, "condition_photos")).toMatchObject({ passed: false, related: [{ kind: "observation", id: "o1" }] });
    i.observations[0]!.classification = "safe";
    expect(check(i, "condition_photos").passed).toBe(true);
  });

  it("typical photos: only for a SAFE building; 2 fails, 3 passes", () => {
    const i = complete();
    i.observations = [];
    const typical = (id: string) => ({ id, kind: "typical" as const, width: 1200, height: 900, takenAt: "2026-09-21T15:00:00Z", takenAtSource: "exif" as const });
    i.photos.push(typical("t1"), typical("t2"));
    expect(check(i, "typical_photos").passed).toBe(false);
    i.photos.push(typical("t3"));
    expect(check(i, "typical_photos").passed).toBe(true);
  });

  it("typical photos: an unrepaired prior item makes the building UNSAFE, not SAFE", () => {
    const i = complete();
    i.observations = [];
    i.priorItems = [{ id: "pi1", description: "Cracked lintel", repaired: false }];
    expect(check(i, "typical_photos").message).toMatch(/isn't SAFE/);
  });

  it("photo size and dates", () => {
    const i = complete();
    i.photos.push({ id: "small", kind: "typical", width: 799, height: 600, takenAt: "2026-09-21T15:00:00Z", takenAtSource: "exif" });
    i.photos.push({ id: "nodate", kind: "typical", width: 1200, height: 900, takenAt: null, takenAtSource: null });
    i.photos.push({ id: "portrait", kind: "typical", width: 600, height: 800, takenAt: "2026-09-21T15:00:00Z", takenAtSource: "exif" });
    const r = check(i, "photo_quality");
    expect(r.passed).toBe(false);
    expect(r.related.map((x) => x.id)).toEqual(["small", "nodate"]);
  });

  it("inspector photo must be dated", () => {
    const i = complete();
    i.photos = i.photos.map((p) => (p.kind === "inspector" ? { ...p, takenAt: null } : p));
    expect(check(i, "inspector_photo").passed).toBe(false);
  });

  it("prior items must all be decided", () => {
    const i = complete();
    i.priorItems = [
      { id: "a", description: "Loose coping", repaired: true },
      { id: "b", description: "Cracked lintel", repaired: null },
    ];
    expect(check(i, "prior_items")).toMatchObject({ passed: false, related: [{ id: "b" }] });
  });

  it("repairs: missing text, missing date, and dates on the limits", () => {
    const i = complete();
    i.observations[0]!.recommendedRepair = " ";
    expect(check(i, "repairs").related[0]!.label).toMatch(/no recommended repair/);
    i.observations[0]!.recommendedRepair = "Reset coping";
    i.observations[0]!.repairByDate = "2027-10-01"; // exactly 1 year: OK for SWARMP
    expect(check(i, "repairs").passed).toBe(true);
    i.observations[0]!.repairByDate = "2027-09-30";
    expect(check(i, "repairs").passed).toBe(false);
    i.observations[0]!.classification = "unsafe";
    i.observations[0]!.repairByDate = "2027-10-01"; // exactly 1 year: OK for UNSAFE
    expect(check(i, "repairs").passed).toBe(true);
    i.observations[0]!.repairByDate = "2027-10-02";
    expect(check(i, "repairs").passed).toBe(false);
  });

  it("UNSAFE needs notice and public protection, including carried-forward items", () => {
    const i = complete();
    i.priorItems = [{ id: "pi", description: "Cracked lintel", repaired: false }];
    const r = check(i, "unsafe_notice");
    expect(r.passed).toBe(false);
    expect(r.message).toMatch(/notified and the public protection/);
    i.project.unsafeNotifiedOn = "2026-10-02";
    i.project.publicProtectionNote = "Sidewalk shed installed Oct 3";
    expect(check(i, "unsafe_notice")).toMatchObject({ passed: true, message: expect.stringContaining("Oct 2, 2026") });
  });

  it("filing deadline: needs block and dates", () => {
    const i = complete();
    i.project.finalInspectionDate = null;
    expect(check(i, "filing_deadline").message).toMatch(/QEWI final inspection/);
    i.building.block = null;
    expect(check(i, "filing_deadline").message).toMatch(/block number/);
  });

  it("filing deadline: passing shows the date and days left; day of deadline still OK", () => {
    const i = complete();
    expect(check(i, "filing_deadline").message).toBe("File by Nov 30, 2026 (39 days left).");
    i.today = "2026-11-30";
    expect(check(i, "filing_deadline").message).toBe("File by Nov 30, 2026 (0 days left).");
    i.today = "2026-12-01";
    expect(check(i, "filing_deadline").message).toMatch(/passed on Nov 30, 2026/);
  });

  it("filing deadline: window not open yet, or deadline before it opens", () => {
    const i = complete();
    i.building.block = 1231; // window opens Feb 21, 2027
    i.project.finalInspectionDate = "2027-01-15"; // +60 = Mar 16, 2027
    i.project.closeupCompleteDate = "2027-01-10";
    i.today = "2027-01-20";
    expect(check(i, "filing_deadline").message).toBe("The filing window opens Feb 21, 2027.");
    i.project.finalInspectionDate = "2026-10-01";
    expect(check(i, "filing_deadline").message).toMatch(/before the filing window opens/);
  });
});

describe("warnings", () => {
  it("are warnings and flag what's missing", () => {
    const i = complete();
    i.project.qewiChosen = false;
    i.building.ownerAddress = null;
    i.project.examEnd = null;
    i.observations[0]!.cause = null;
    i.photos = i.photos.filter((p) => p.kind !== "elevation");
    i.photos[0]!.takenAtSource = "file";
    const { blockers, warnings } = summarizeChecks(runChecks(i));
    expect(blockers).toEqual([]);
    expect(warnings.map((w) => w.id).sort()).toEqual(
      ["causes", "elevation_photos", "exam_dates", "owner_info", "photo_dates", "qewi_chosen"].sort(),
    );
  });
});

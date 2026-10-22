import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { buildReport, SECTION_TITLES } from "./build";
import type { ReportData } from "./types";
import { docxText, unzip } from "./unzip";

// Smallest valid JPEG (1 × 1), standing in for fictional photos.
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
);

function fixture(): ReportData {
  return {
    generatedOn: "2026-10-22",
    blockers: 0,
    firmName: "Fictional Facade Engineers",
    building: {
      address: "123 Example Street",
      borough: "Manhattan",
      block: 1234,
      lot: 5,
      bin: "1000123",
      crossStreet: "Sample Avenue",
      isLandmark: false,
      stories: 12,
      heightFt: 130,
      yearBuilt: 1928,
      coNumber: null,
      use: "Residential",
      materials: ["Brick", "Cast stone"],
      materialsNotes: "Original 1928 brick",
      isCavityWall: true,
      ownerName: "Example Holdings LLC",
      ownerAddress: "1 Sample Plaza\nNew York, NY",
      ownerPhone: null,
      ownerPrincipalName: null,
      ownerPrincipalTitle: null,
    },
    project: {
      cycle: 10,
      reportType: "Initial",
      examStart: "2026-09-01",
      examEnd: "2026-10-01",
      closeupCompleteDate: "2026-09-25",
      finalInspectionDate: "2026-10-01",
      unsafeNotifiedOn: "2026-09-22",
      publicProtectionNote: "Sidewalk shed installed Sep 23",
      probeWaiver: null,
      probeWaiverNote: null,
    },
    qewi: { name: "Pat Example", licenseType: "PE", licenseNumber: "000123" },
    status: "unsafe",
    elevations: [
      {
        id: "north",
        name: "North",
        facesStreet: true,
        frontageFt: 75,
        setbacksNote: "Setback at 10th floor",
        closeups: [
          {
            id: "c1",
            locationNote: "Bay 1",
            inspectedOn: "2026-09-21",
            method: "Scaffold",
            probes: [{ locationNote: "Floor 4 pier", probedOn: "2026-09-21", tieType: "Corrugated", tieSpacing: "16 in", tieCondition: "Light rust" }],
          },
        ],
      },
    ],
    observations: [
      { id: "o1", elevationId: "north", elevationName: "North", floor: "Roof", element: "Parapet", condition: "Loose coping stones", classification: "unsafe", cause: "Failed anchors", recommendedRepair: "Reset and anchor coping", repairByDate: "2027-06-01" },
      { id: "o2", elevationId: "north", elevationName: "North", floor: "3", element: "Brick masonry", condition: "Step cracking", classification: "swarmp", cause: null, recommendedRepair: "Repoint", repairByDate: "2028-10-01" },
    ],
    photos: [
      { id: "p1", kind: "condition", observationId: "o1", takenAtText: "Sep 21, 2026, 10:30 AM", width: 2000, height: 1500, data: JPEG, createdAt: "2026-09-21T14:30:00Z" },
      { id: "p2", kind: "condition", observationId: "o1", takenAtText: "Sep 21, 2026, 10:31 AM", width: 2000, height: 1500, data: JPEG, createdAt: "2026-09-21T14:31:00Z" },
      { id: "p3", kind: "inspector", observationId: null, takenAtText: "Sep 21, 2026, 9:00 AM", width: 1500, height: 2000, data: JPEG, createdAt: "2026-09-21T13:00:00Z" },
      { id: "p4", kind: "typical", observationId: null, takenAtText: null, width: 2000, height: 1500, data: null, createdAt: "2026-09-21T15:00:00Z" },
    ],
    priorFilings: [
      { tr6No: "TR6-000001-9A-I1", cycle: 9, filingType: "Initial", filingStatus: "SWARMP", currentStatus: "SWARMP", priorStatus: null, filingDate: "2021-03-15", fieldInspectionDate: null, qewiName: "SAM SAMPLE", qewiLicense: "RA - 000999", comments: null },
    ],
    priorFilingsFetchedAt: "Oct 21, 2026, 10:13 PM",
    priorItems: [{ description: "Cracked lintel at floor 5", locationNote: "North", repaired: false }],
  };
}

async function render(data: ReportData) {
  const files = unzip(await Packer.toBuffer(buildReport(data)));
  const body = docxText(files.get("word/document.xml")!.toString("utf8"));
  const header = [...files.keys()]
    .filter((k) => /^word\/header\d*\.xml$/.test(k))
    .map((k) => docxText(files.get(k)!.toString("utf8")))
    .join(" ");
  const media = [...files.keys()].filter((k) => k.startsWith("word/media/") && !k.endsWith("/"));
  return { body, header, media };
}

describe("buildReport", () => {
  it("has every §3.5 section, in order", async () => {
    const { body } = await render(fixture());
    const positions = SECTION_TITLES.map((title, i) => body.indexOf(`${i + 1}. ${title}`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("fills in what the app knows", async () => {
    const { body } = await render(fixture());
    for (const text of [
      "Building classification: UNSAFE",
      "Observations: 1 UNSAFE, 1 SWARMP, 0 SAFE. Conditions from the previous report not repaired, reported as UNSAFE: 1.",
      "123 Example Street",
      "1000123",
      "Example Holdings LLC",
      "Brick, Cast stone",
      "Corrugated",
      "Sep 25, 2026",
      "Loose coping stones",
      "Failed anchors",
      "Reset and anchor coping",
      "Jun 1, 2027",
      "DOB and owner notified of UNSAFE conditions: Sep 22, 2026.",
      "Public protection: Sidewalk shed installed Sep 23",
      "SAM SAMPLE, RA - 000999",
      "No – reported as UNSAFE",
      "Pat Example, PE 000123",
    ]) {
      expect(body, text).toContain(text);
    }
  });

  it("keeps line breaks from typed addresses", async () => {
    const { body } = await render(fixture());
    expect(body).toContain("1 Sample Plaza New York, NY");
  });

  it("leaves highlighted placeholders where the QEWI must write", async () => {
    const { body } = await render(fixture());
    expect(body).toContain("[QEWI to complete: distress, settlement, repairs or revisions");
    expect(body).toContain("[QEWI to complete: work permits required");
    expect(body).toContain("[QEWI to complete: cause]"); // o2 has no cause
  });

  it("numbers photos and cross-references them", async () => {
    const { body } = await render(fixture());
    // Inspector photo first (Photo 1), then the two condition photos.
    expect(body).toContain("See Photo 1 in Section 17.");
    expect(body).toContain("Photos 2, 3");
    expect(body).toContain("Photo 2. UNSAFE – Parapet, floor Roof, North elevation. Taken Sep 21, 2026, 10:30 AM.");
    expect(body).toContain("Photo 4. Typical condition. Date not recorded.");
    expect(body).toContain("[Image could not be loaded]");
  });

  it("embeds the photos that loaded", async () => {
    const { media } = await render(fixture());
    expect(media.length).toBeGreaterThanOrEqual(1); // identical images may be stored once
  });

  it("marks the report DRAFT while the checker has blockers", async () => {
    expect((await render({ ...fixture(), blockers: 3 })).header).toContain("DRAFT – 3 checker blockers. Not for filing.");
    const clean = await render(fixture());
    expect(clean.header).not.toContain("DRAFT");
    expect(clean.header).toContain("FISP Cycle 10 · 123 Example Street");
  });

  it("handles an empty project", async () => {
    const empty = { ...fixture(), status: "safe" as const, elevations: [], observations: [], photos: [], priorFilings: [], priorItems: [], qewi: null };
    const { body } = await render(empty);
    expect(body).toContain("No UNSAFE or SWARMP conditions were found.");
    expect(body).toContain("[QEWI to complete: QEWI name and license number]");
    expect(body).not.toContain("DOB and owner notified");
  });
});

describe("page setup", () => {
  it("uses US Letter with 1-inch margins", async () => {
    const files = unzip(await Packer.toBuffer(buildReport(fixture())));
    const xml = files.get("word/document.xml")!.toString("utf8");
    expect(xml).toMatch(/<w:pgSz w:w="12240" w:h="15840"/);
    expect(xml).toMatch(/<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/);
  });
});

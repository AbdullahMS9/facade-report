import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HeightRule,
  ImageRun,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatUsDate } from "@/lib/rules";
import { fitBox, numberPhotos, photoRefs } from "./photos";
import type { ReportData } from "./types";

// Builds the critical examination report (CLAUDE.md §3.5) as an editable
// Word document. Pure: everything comes in through ReportData. Where we have
// no data, a highlighted "[QEWI to complete: …]" placeholder is left.

export const SECTION_TITLES = [
  "Executive overview",
  "Building identification",
  "Owner",
  "Building description",
  "Distress, settlement and repairs since the previous report",
  "Examination procedures and extent of close-up and probe examinations",
  "Riggers, contractors and consultants",
  "Located diagram",
  "Examination dates",
  "Photographs of close-up inspections",
  "Conditions observed",
  "Causes of UNSAFE and SWARMP conditions",
  "Maintenance status and plan",
  "Comparison with the prior cycle",
  "Recommended repairs",
  "Required work permits",
  "Photographs",
  "QEWI seal and signature",
] as const;

const CLASS = { safe: "SAFE", swarmp: "SWARMP", unsafe: "UNSAFE" } as const;

// US Letter with 1-inch margins (twips: 1440 per inch).
const PAGE = { width: 12240, height: 15840, margin: 1440 };
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin; // 9360

// Column widths from relative weights, summing to the content width.
function columns(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.floor((CONTENT_WIDTH * w) / total));
}
const PLACEHOLDER_PREFIX = "[QEWI to complete: ";

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const date = (d: string | null) => (d ? formatUsDate(d) : "—");
const yesNo = (v: boolean | null) => (v === null ? "Not recorded" : v ? "Yes" : "No");
const orDash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : String(v));

function para(text: string, opts: { bold?: boolean } = {}): Paragraph {
  // Keep line breaks typed into the app (e.g. mailing addresses).
  const lines = text.split("\n");
  return new Paragraph({
    spacing: { after: 120 },
    children: lines.map((line, i) => new TextRun({ text: line, bold: opts.bold, break: i > 0 ? 1 : undefined })),
  });
}

function todo(what: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: `${PLACEHOLDER_PREFIX}${what}]`, italics: true, highlight: "yellow" })],
  });
}

function heading(index: number): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun(`${index + 1}. ${SECTION_TITLES[index]}`)],
  });
}

function cell(text: string, opts: { header?: boolean } = {}): TableCell {
  return new TableCell({
    shading: opts.header ? { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: text.split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, bold: opts.header })] })),
  });
}

function table(headers: string[], rows: string[][], weights: number[] = headers.map(() => 1)): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: columns(weights),
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, { header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
    ],
  });
}

function facts(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: columns([2, 3]),
    rows: rows.map(
      ([label, value]) =>
        new TableRow({ children: [cell(label, { header: true }), cell(value)] }),
    ),
  });
}

const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function buildReport(data: ReportData): Document {
  const { building: b, project: p } = data;
  const photos = numberPhotos(data);
  const conditionNo = new Map(data.observations.map((o, i) => [o.id, i + 1]));
  const serious = data.observations.filter((o) => o.classification !== "safe");
  const count = (c: keyof typeof CLASS) => data.observations.filter((o) => o.classification === c).length;
  const carried = data.priorItems.filter((i) => i.repaired === false).length;
  const drops = data.elevations.flatMap((e) => e.closeups.map((c, i) => ({ elevation: e.name, n: i + 1, ...c })));
  const probes = drops.flatMap((d) => d.probes.map((pr) => ({ drop: `${d.elevation}, drop ${d.n}`, ...pr })));
  const location = (o: (typeof data.observations)[number]) =>
    [o.elevationName && `${o.elevationName} elevation`, o.floor && `floor ${o.floor}`].filter(Boolean).join(", ") || "—";

  const body: (Paragraph | Table)[] = [];
  const add = (...items: (Paragraph | Table)[]) => body.push(...items);

  // Title block
  add(
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Critical Examination Report")] }),
    para(`${b.address}, ${b.borough}`, { bold: true }),
    para(`FISP (Local Law 11) Cycle ${p.cycle} · ${p.reportType} report`),
    para(`Prepared by ${data.firmName} · ${date(data.generatedOn)}`),
  );

  // 1. Executive overview
  add(heading(0));
  add(para(`Building classification: ${CLASS[data.status]}`, { bold: true }));
  add(
    para(
      `Observations: ${count("unsafe")} UNSAFE, ${count("swarmp")} SWARMP, ${count("safe")} SAFE.` +
        (carried ? ` Conditions from the previous report not repaired, reported as UNSAFE: ${carried}.` : ""),
    ),
  );
  add(
    para(
      `Scope: critical examination of the exterior walls and appurtenances of ${b.address}, ${b.borough}. ` +
        `${data.elevations.length} elevation(s), ${data.elevations.filter((e) => e.facesStreet).length} facing a street; ` +
        `${drops.length} close-up inspection drop(s); ${probes.length} probe(s).`,
    ),
  );
  add(todo("summary of findings, conclusions and recommendations"));

  // 2. Identification
  add(heading(1));
  add(
    facts([
      ["Address", b.address],
      ["Borough", b.borough],
      ["Block", orDash(b.block)],
      ["Lot", orDash(b.lot)],
      ["BIN", orDash(b.bin)],
      ["Landmark", yesNo(b.isLandmark)],
      ["Nearest cross street", orDash(b.crossStreet)],
    ]),
  );

  // 3. Owner
  add(heading(2));
  add(
    facts([
      ["Owner", orDash(b.ownerName)],
      ["Mailing address", orDash(b.ownerAddress)],
      ["Phone", orDash(b.ownerPhone)],
      ["Principal (if the owner is an entity)", orDash(b.ownerPrincipalName)],
      ["Principal's title", orDash(b.ownerPrincipalTitle)],
    ]),
  );

  // 4. Description
  add(heading(3));
  add(
    facts([
      ["Stories", orDash(b.stories)],
      ["Height (ft)", orDash(b.heightFt)],
      ["Year built", orDash(b.yearBuilt)],
      ["Certificate of Occupancy", orDash(b.coNumber)],
      ["Use", orDash(b.use)],
      ["Exterior wall materials", b.materials.length ? b.materials.join(", ") : "—"],
      ["Materials and age", orDash(b.materialsNotes)],
      ["Cavity wall construction", yesNo(b.isCavityWall)],
    ]),
  );
  add(gap(), todo("plan dimensions"));

  // 5. Distress since previous report
  add(heading(4));
  add(todo("distress, settlement, repairs or revisions to the exterior walls since the previous report"));

  // 6. Procedures and extent
  add(heading(5));
  add(todo("procedures used in making the critical examination"));
  add(para("Close-up inspections (drops):", { bold: true }));
  add(
    drops.length
      ? table(
          ["Elevation", "Drop", "Location", "Date", "Method"],
          drops.map((d) => [d.elevation, String(d.n), d.locationNote, date(d.inspectedOn), d.method]),
        )
      : todo("close-up inspection locations and dates"),
  );
  add(gap());
  if (probes.length) {
    add(para("Cavity wall probes:", { bold: true }));
    add(
      table(
        ["Drop", "Location", "Date", "Tie type", "Spacing", "Condition"],
        probes.map((pr) => [pr.drop, pr.locationNote, date(pr.probedOn), orDash(pr.tieType), orDash(pr.tieSpacing), orDash(pr.tieCondition)]),
      ),
    );
  }
  if (p.probeWaiver) add(para(`Probe waiver: ${p.probeWaiver}.${p.probeWaiverNote ? ` ${p.probeWaiverNote}` : ""}`));

  // 7. Riggers etc.
  add(heading(6));
  add(todo("names, addresses, telephone numbers and license numbers of riggers, contractors and consultants"));

  // 8. Located diagram
  add(heading(7));
  add(todo("located diagram with north arrow, elevation lengths, setbacks, and inspection locations and dates"));
  add(
    data.elevations.length
      ? table(
          ["Elevation", "Faces street", "Frontage (ft)", "Setbacks", "Drops"],
          data.elevations.map((e) => [
            e.name,
            e.facesStreet ? "Yes" : "No",
            e.frontageFt > 0 ? String(e.frontageFt) : "—",
            orDash(e.setbacksNote),
            e.closeups.length ? e.closeups.map((c, i) => `${i + 1}: ${c.locationNote} (${date(c.inspectedOn)})`).join("\n") : "None",
          ]),
        )
      : todo("elevations"),
  );

  // 9. Dates
  add(heading(8));
  add(
    facts([
      ["Examination started", date(p.examStart)],
      ["Examination completed", date(p.examEnd)],
      ["Close-up inspections completed", date(p.closeupCompleteDate)],
      ["QEWI final inspection", date(p.finalInspectionDate)],
    ]),
  );

  // 10. Inspector photos
  add(heading(9));
  const inspector = photos.filter((ph) => ph.kind === "inspector").map((ph) => ph.number);
  add(
    inspector.length
      ? para(`See ${inspector.length === 1 ? "Photo" : "Photos"} ${inspector.join(", ")} in Section 17.`)
      : todo("dated photo of the QEWI or staff performing a close-up inspection"),
  );

  // 11. Conditions
  add(heading(10));
  add(
    data.observations.length
      ? table(
          ["#", "Location", "Element", "Condition", "Classification", "Photos"],
          data.observations.map((o, i) => [
            String(i + 1),
            location(o),
            o.element,
            o.condition,
            CLASS[o.classification],
            photoRefs(photos, o.id),
          ]),
          [0.5, 2, 1.6, 3.2, 1.5, 1.3],
        )
      : todo("conditions observed"),
  );
  add(gap());
  const elements = [...new Set(data.observations.map((o) => o.element))];
  if (elements.length) add(para(`Elements and appurtenances with recorded conditions: ${elements.join(", ")}.`));
  add(todo("full list of appurtenances, and confirmation that guards and railings were checked for secure attachment"));

  // 12. Causes
  add(heading(11));
  add(
    serious.length
      ? table(
          ["#", "Element", "Classification", "Cause"],
          serious.map((o) => [
            String(conditionNo.get(o.id)),
            o.element,
            CLASS[o.classification],
            o.cause?.trim() ? o.cause : `${PLACEHOLDER_PREFIX}cause]`,
          ]),
          [0.5, 1.8, 1.5, 4],
        )
      : para("No UNSAFE or SWARMP conditions were found."),
  );

  // 13. Maintenance
  add(heading(12));
  add(todo("status of maintenance work to date and the maintenance plan"));

  // 14. Prior cycle
  add(heading(13));
  add(para("Previous facade filings on record with DOB:", { bold: true }));
  add(
    data.priorFilings.length
      ? table(
          ["Cycle", "Type", "Status", "Filed", "QEWI"],
          data.priorFilings.map((f) => [
            String(f.cycle),
            f.filingType,
            orDash(f.filingStatus),
            date(f.filingDate),
            [f.qewiName, f.qewiLicense].filter(Boolean).join(", ") || "—",
          ]),
        )
      : todo("previous filings (none found in NYC Open Data)"),
  );
  if (data.priorFilingsFetchedAt) {
    add(para(`Source: NYC Open Data, "DOB NOW: Safety – Facades Compliance Filings", retrieved ${data.priorFilingsFetchedAt}.`));
  }
  add(para("Conditions from the previous report requiring repair:", { bold: true }));
  add(
    data.priorItems.length
      ? table(
          ["Condition", "Location", "Repaired"],
          data.priorItems.map((i) => [
            i.description,
            orDash(i.locationNote),
            i.repaired === null ? "Not decided" : i.repaired ? "Yes" : "No – reported as UNSAFE",
          ]),
        )
      : para("None listed."),
  );
  add(todo("permit and job numbers for repairs, open ECB violations and their status"));

  // 15. Repairs
  add(heading(14));
  add(
    serious.length
      ? table(
          ["#", "Element", "Classification", "Recommended repair", "Complete by"],
          serious.map((o) => [
            String(conditionNo.get(o.id)),
            o.element,
            CLASS[o.classification],
            o.recommendedRepair?.trim() ? o.recommendedRepair : `${PLACEHOLDER_PREFIX}recommended repair]`,
            date(o.repairByDate),
          ]),
          [0.5, 1.6, 1.5, 3.4, 1.5],
        )
      : para("No repairs are required."),
  );
  if (data.status === "unsafe") {
    add(para(`DOB and owner notified of UNSAFE conditions: ${date(p.unsafeNotifiedOn)}.`));
    add(p.publicProtectionNote ? para(`Public protection: ${p.publicProtectionNote}`) : todo("public protection installed"));
  }

  // 16. Permits
  add(heading(15));
  add(todo("work permits required, or why none are needed"));

  // 17. Photographs
  add(heading(16));
  if (photos.length === 0) add(todo("photographs"));
  photos.forEach((ph, i) => {
    const size = fitBox(ph.width, ph.height, 480, 330);
    add(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: i % 2 === 0, // two photos per page
        keepNext: true,
        children: ph.data
          ? [
              new ImageRun({
                type: "jpg",
                data: ph.data,
                transformation: size,
                altText: { name: `Photo ${ph.number}`, description: ph.caption, title: `Photo ${ph.number}` },
              }),
            ]
          : [new TextRun({ text: "[Image could not be loaded]", italics: true, highlight: "yellow" })],
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: ph.caption, size: 20 })] }),
    );
  });

  // 18. Seal and signature
  add(heading(17));
  add(
    data.qewi
      ? para(`${data.qewi.name}, ${data.qewi.licenseType} ${data.qewi.licenseNumber}`)
      : todo("QEWI name and license number"),
  );
  add(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: columns([1, 1]),
      rows: [
        new TableRow({ children: [cell("Seal", { header: true }), cell("Signature and date", { header: true })] }),
        new TableRow({ height: { value: 2400, rule: HeightRule.ATLEAST }, children: [cell(""), cell("")] }),
      ],
    }),
  );

  const headerText =
    data.blockers > 0
      ? `DRAFT – ${data.blockers} checker blocker${data.blockers === 1 ? "" : "s"}. Not for filing.`
      : `FISP Cycle ${p.cycle} · ${b.address}`;

  return new Document({
    creator: data.firmName,
    title: `Critical Examination Report – ${b.address}`,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: headerText, bold: data.blockers > 0, color: data.blockers > 0 ? "B91C1C" : "555555", size: 18 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 18 })],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });
}

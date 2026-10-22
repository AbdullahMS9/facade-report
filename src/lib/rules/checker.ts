import { buildingStatus } from "./priorItems";
import { probesApply } from "./elevationProgress";
import { requiredCloseups } from "./closeups";
import { FISP_RULES } from "./config";
import { formatUsDate } from "./dates";
import { filingSummary } from "./filingSummary";
import { checkRepairDate } from "./repairDate";
import type { Classification, IsoDate } from "./types";

// Pre-filing checks (CLAUDE.md §3.7), plus a few warnings for report contents
// (§3.5). Pure: everything it needs comes in through CheckerInput.

export interface CheckerInput {
  today: IsoDate;
  cycle: number;
  building: {
    address: string;
    block: number | null;
    lot: number | null;
    bin: string | null;
    materials: string[];
    isCavityWall: boolean | null;
    ownerName: string | null;
    ownerAddress: string | null;
  };
  project: {
    qewiChosen: boolean;
    examStart: IsoDate | null;
    examEnd: IsoDate | null;
    finalInspectionDate: IsoDate | null;
    closeupCompleteDate: IsoDate | null;
    unsafeNotifiedOn: IsoDate | null;
    publicProtectionNote: string | null;
    probeWaiver: string | null;
  };
  elevations: {
    id: string;
    name: string;
    facesStreet: boolean;
    frontageFt: number;
    closeups: { id: string; probeCount: number }[];
  }[];
  observations: {
    id: string;
    label: string; // e.g. "Parapet, floor Roof"
    classification: Classification;
    recommendedRepair: string | null;
    repairByDate: IsoDate | null;
    cause: string | null;
    photoCount: number;
  }[];
  photos: {
    id: string;
    kind: "condition" | "elevation" | "inspector" | "probe" | "typical";
    width: number;
    height: number;
    takenAt: string | null;
    takenAtSource: "exif" | "file" | null;
  }[];
  priorItems: { id: string; description: string; repaired: boolean | null }[];
}

export type CheckId =
  | "building_identifiers"
  | "wall_materials"
  | "closeups_required"
  | "probes"
  | "condition_photos"
  | "typical_photos"
  | "photo_quality"
  | "inspector_photo"
  | "prior_items"
  | "repairs"
  | "unsafe_notice"
  | "filing_deadline"
  | "photo_dates"
  | "qewi_chosen"
  | "owner_info"
  | "exam_dates"
  | "causes"
  | "elevation_photos";

export type RelatedKind = "observation" | "elevation" | "photo" | "prior_item";

export interface CheckResult {
  id: CheckId;
  title: string;
  passed: boolean;
  severity: "blocker" | "warning";
  message: string; // what's wrong (or, when passed, what's fine)
  fix: string; // how to fix it; empty when passed
  related: { kind: RelatedKind; id: string; label: string }[];
}

type Draft = Omit<CheckResult, "id" | "title" | "severity" | "related"> & { related?: CheckResult["related"] };

const pass = (message: string): Draft => ({ passed: true, message, fix: "" });
const fail = (message: string, fix: string, related: CheckResult["related"] = []): Draft => ({
  passed: false,
  message,
  fix,
  related,
});
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MIN = { width: 800, height: 600 };

function meetsMinimum(w: number, h: number) {
  return Math.max(w, h) >= MIN.width && Math.min(w, h) >= MIN.height;
}

export function runChecks(input: CheckerInput, rules = FISP_RULES): CheckResult[] {
  const { building: b, project: p } = input;
  const out: CheckResult[] = [];
  const add = (id: CheckId, title: string, severity: CheckResult["severity"], d: Draft) =>
    out.push({ id, title, severity, related: [], ...d });

  const status = buildingStatus(
    input.observations.map((o) => o.classification),
    input.priorItems,
  );
  const anyUnsafe = status === "unsafe";

  // §3.7: building identifiers complete (§3.5 item 2).
  {
    const missing = [
      !b.address.trim() && "address",
      b.block === null && "block",
      b.lot === null && "lot",
      !b.bin && "BIN",
    ].filter(Boolean) as string[];
    add(
      "building_identifiers",
      "Building identifiers",
      "blocker",
      missing.length
        ? fail(`Missing: ${missing.join(", ")}.`, "Add them on the building page.")
        : pass("Address, block, lot and BIN are filled in."),
    );
  }

  // §3.7: exterior wall materials listed (§3.5 item 4).
  add(
    "wall_materials",
    "Exterior wall materials",
    "blocker",
    b.materials.length
      ? pass(`Listed: ${b.materials.join(", ")}.`)
      : fail("No exterior wall materials listed.", "List them on the building page."),
  );

  // §3.7 / §3.2: every street elevation has its required close-ups; at least
  // one close-up per building. §103-04(c)(2)(iv).
  {
    const problems: CheckResult["related"] = [];
    const lines: string[] = [];
    for (const e of input.elevations.filter((e) => e.facesStreet)) {
      if (e.frontageFt <= 0) {
        lines.push(`${e.name}: frontage missing`);
        problems.push({ kind: "elevation", id: e.id, label: `${e.name}: enter frontage` });
        continue;
      }
      const required = requiredCloseups(e.frontageFt, rules);
      if (e.closeups.length < required) {
        lines.push(`${e.name}: ${e.closeups.length} of ${required}`);
        problems.push({ kind: "elevation", id: e.id, label: `${e.name}: ${e.closeups.length} of ${required} drops` });
      }
    }
    const total = input.elevations.reduce((n, e) => n + e.closeups.length, 0);
    if (input.elevations.length === 0) {
      add("closeups_required", "Close-up inspections", "blocker", fail("No elevations added.", "Add each elevation, starting with the street elevations, and record the drops."));
    } else if (problems.length) {
      add(
        "closeups_required",
        "Close-up inspections",
        "blocker",
        fail(`Not enough drops: ${lines.join("; ")}.`, "Record the missing drops on each elevation (one per 60 ft of street frontage, plus one).", problems),
      );
    } else if (total < rules.closeups.minimumPerBuilding) {
      add("closeups_required", "Close-up inspections", "blocker", fail("No close-up inspections recorded.", "Record at least one drop."));
    } else {
      add("closeups_required", "Close-up inspections", "blocker", pass(`${plural(total, "drop")} recorded; street elevations meet their minimum.`));
    }
  }

  // §3.7 / §3.3: probes where they apply; at least one per required close-up
  // interval. §103-04(c)(2)(v).
  {
    let d: Draft;
    if (b.isCavityWall === null) {
      d = fail("We don't know if this is a cavity wall building.", "Answer \"Cavity wall?\" on the building page.");
    } else if (!probesApply(b.isCavityWall, input.cycle, rules)) {
      d = pass(b.isCavityWall ? `Probes aren't required in cycle ${input.cycle}.` : "Not a cavity wall building: no probes needed.");
    } else if (p.probeWaiver) {
      d = pass("A probe waiver is recorded. Keep the proof with the report.");
    } else {
      const related: CheckResult["related"] = [];
      const lines: string[] = [];
      const street = input.elevations.filter((e) => e.facesStreet && e.frontageFt > 0);
      for (const e of street) {
        const required = requiredCloseups(e.frontageFt, rules);
        const probed = e.closeups.filter((c) => c.probeCount > 0).length;
        if (probed < required) {
          lines.push(`${e.name}: ${probed} of ${required}`);
          related.push({ kind: "elevation", id: e.id, label: `${e.name}: probes at ${probed} of ${required} drops` });
        }
      }
      const totalProbes = input.elevations.reduce((n, e) => n + e.closeups.reduce((m, c) => m + c.probeCount, 0), 0);
      if (street.length === 0 && totalProbes === 0) {
        d = fail("Cavity wall building with no probes recorded.", "Record at least one probe on a drop.");
      } else if (related.length) {
        d = fail(
          `Each required drop needs a probe: ${lines.join("; ")}.`,
          "Add probes on the drops, or record a probe waiver on the project details page if one applies.",
          related,
        );
      } else {
        d = pass(`${plural(totalProbes, "probe")} recorded.`);
      }
    }
    add("probes", "Cavity wall probes", "blocker", d);
  }

  // §3.7 / §3.6: every SWARMP/UNSAFE condition photographed; the photo's
  // status label comes from the observation it's attached to.
  {
    const missing = input.observations.filter((o) => o.classification !== "safe" && o.photoCount === 0);
    add(
      "condition_photos",
      "Photos of SWARMP and UNSAFE conditions",
      "blocker",
      missing.length
        ? fail(
            `${plural(missing.length, "SWARMP/UNSAFE observation")} without a photo.`,
            "Add at least one photo to each.",
            missing.map((o) => ({ kind: "observation" as const, id: o.id, label: o.label })),
          )
        : pass("Every SWARMP and UNSAFE observation has a photo."),
    );
  }

  // §3.7 / §3.6: a SAFE building still needs three typical-condition photos.
  {
    const typical = input.photos.filter((ph) => ph.kind === "typical").length;
    add(
      "typical_photos",
      "Typical-condition photos (SAFE building)",
      "blocker",
      status !== "safe"
        ? pass("Not needed: the building isn't SAFE.")
        : typical >= 3
          ? pass(`${plural(typical, "typical-condition photo")}.`)
          : fail(`A SAFE building needs at least 3 typical-condition photos; ${typical} added.`, "Add them on the project photos page."),
    );
  }

  // §3.7 / §3.6: all photos at least 800 × 600 and dated.
  {
    const bad = input.photos.filter((ph) => !meetsMinimum(ph.width, ph.height) || !ph.takenAt);
    add(
      "photo_quality",
      "Photo size and dates",
      "blocker",
      bad.length
        ? fail(
            `${plural(bad.length, "photo")} under 800 × 600 or without a date.`,
            "Replace them with larger, dated photos.",
            bad.map((ph) => ({
              kind: "photo" as const,
              id: ph.id,
              label: !ph.takenAt ? "No date" : `${ph.width} × ${ph.height}`,
            })),
          )
        : pass(input.photos.length ? "All photos are at least 800 × 600 and dated." : "No photos yet."),
    );
  }

  // §3.7 / §3.6: dated photo of the QEWI or staff doing a close-up.
  {
    const dated = input.photos.filter((ph) => ph.kind === "inspector" && ph.takenAt).length;
    add(
      "inspector_photo",
      "Inspector-at-work photo",
      "blocker",
      dated
        ? pass(`${plural(dated, "dated inspector photo")}.`)
        : fail("No dated photo of the QEWI or staff doing a close-up inspection.", "Add one under Inspector at work on the project photos page."),
    );
  }

  // §3.7 / §2: every prior-cycle item marked repaired or carried forward.
  {
    const open = input.priorItems.filter((i) => i.repaired === null);
    add(
      "prior_items",
      "Prior-cycle items",
      "blocker",
      open.length
        ? fail(
            `${plural(open.length, "prior-cycle item")} not marked repaired or not repaired.`,
            "Mark each one. Items not repaired are reported as UNSAFE.",
            open.map((i) => ({ kind: "prior_item" as const, id: i.id, label: i.description })),
          )
        : pass(input.priorItems.length ? "All prior-cycle items are decided." : "No prior-cycle items listed."),
    );
  }

  // §3.7 / §3.5 item 15: recommended repair with a date inside the limits.
  {
    const related: CheckResult["related"] = [];
    for (const o of input.observations.filter((o) => o.classification !== "safe")) {
      if (!o.recommendedRepair?.trim()) {
        related.push({ kind: "observation", id: o.id, label: `${o.label}: no recommended repair` });
        continue;
      }
      const r = checkRepairDate(
        { classification: o.classification, repairBy: o.repairByDate, finalInspectionDate: p.finalInspectionDate },
        rules,
      );
      if (!r.ok) related.push({ kind: "observation", id: o.id, label: `${o.label}: ${r.message}` });
    }
    add(
      "repairs",
      "Recommended repairs and dates",
      "blocker",
      related.length
        ? fail(
            `${plural(related.length, "SWARMP/UNSAFE observation")} missing a repair or with a date outside the limits.`,
            "UNSAFE: repair within 1 year of the final inspection. SWARMP: at least 1 year and within 5 years.",
            related,
          )
        : pass("Every SWARMP and UNSAFE observation has a repair and a date within the limits."),
    );
  }

  // §3.7 / §2: UNSAFE needs notice to DOB and the owner, and public protection.
  {
    const missing = [
      !p.unsafeNotifiedOn && "the date DOB and the owner were notified",
      !p.publicProtectionNote?.trim() && "the public protection",
    ].filter(Boolean) as string[];
    add(
      "unsafe_notice",
      "UNSAFE notice and public protection",
      "blocker",
      !anyUnsafe
        ? pass("Not needed: no UNSAFE conditions.")
        : missing.length
          ? fail(`UNSAFE conditions found. Record ${missing.join(" and ")}.`, "Add them on the project details page.")
          : pass(`DOB and owner notified ${formatUsDate(p.unsafeNotifiedOn!)}; public protection recorded.`),
    );
  }

  // §3.7 / §3.4: inside the filing window and before the deadline.
  {
    let d: Draft;
    if (b.block === null) {
      d = fail("The filing window depends on the block number.", "Add the block on the building page.");
    } else if (!p.finalInspectionDate || !p.closeupCompleteDate) {
      const missing = [!p.closeupCompleteDate && "close-up completion", !p.finalInspectionDate && "QEWI final inspection"].filter(Boolean);
      d = fail(`Missing the ${missing.join(" and ")} date.`, "Add it on the project details page; the deadline depends on it.");
    } else {
      const s = filingSummary(
        {
          block: b.block,
          cycle: input.cycle,
          finalInspectionDate: p.finalInspectionDate,
          closeupCompleteDate: p.closeupCompleteDate,
          today: input.today,
        },
        rules,
      );
      if (s.kind !== "ok") {
        d = fail("The filing window depends on the block number.", "Add the block on the building page.");
      } else if (s.deadlineBeforeWindow) {
        d = fail(
          `The deadline (${formatUsDate(s.deadline.deadline)}) is before the filing window opens (${formatUsDate(s.window.start)}).`,
          "Check the inspection dates. A new final inspection may be needed.",
        );
      } else if (s.daysLeft < 0) {
        d = fail(`The deadline passed on ${formatUsDate(s.deadline.deadline)}.`, "Check the dates. A new examination may be needed.");
      } else if (s.windowStatus === "not_open") {
        d = fail(`The filing window opens ${formatUsDate(s.window.start)}.`, "File on or after that date.");
      } else if (s.windowStatus === "closed") {
        d = fail(`The filing window closed ${formatUsDate(s.window.end)}.`, "The report is late. Check penalties with DOB.");
      } else {
        d = pass(`File by ${formatUsDate(s.deadline.deadline)} (${plural(s.daysLeft, "day")} left).`);
      }
    }
    add("filing_deadline", "Filing window and deadline", "blocker", d);
  }

  // ----- Warnings (report contents) -----

  // §3.6: dates should come from the camera.
  {
    const fromFile = input.photos.filter((ph) => ph.takenAt && ph.takenAtSource === "file");
    add(
      "photo_dates",
      "Photo dates from the camera",
      "warning",
      fromFile.length
        ? fail(
            `${plural(fromFile.length, "photo")} dated from the file, not the camera.`,
            "Check that these dates are right.",
            fromFile.map((ph) => ({ kind: "photo" as const, id: ph.id, label: "Date from file" })),
          )
        : pass("Photo dates come from the camera."),
    );
  }

  // §3.5 item 18: the QEWI who seals the report.
  add(
    "qewi_chosen",
    "QEWI",
    "warning",
    p.qewiChosen ? pass("QEWI chosen.") : fail("No QEWI chosen for this report.", "Choose one on the project details page."),
  );

  // §3.5 item 3: owner.
  {
    const missing = [!b.ownerName?.trim() && "name", !b.ownerAddress?.trim() && "mailing address"].filter(Boolean);
    add(
      "owner_info",
      "Owner",
      "warning",
      missing.length ? fail(`Owner ${missing.join(" and ")} missing.`, "Add them on the building page.") : pass("Owner name and address filled in."),
    );
  }

  // §3.5 item 9: start and completion dates of the examination.
  {
    const missing = [!p.examStart && "start", !p.examEnd && "end"].filter(Boolean);
    add(
      "exam_dates",
      "Examination dates",
      "warning",
      missing.length ? fail(`Exam ${missing.join(" and ")} date missing.`, "Add them on the project details page.") : pass("Exam dates filled in."),
    );
  }

  // §3.5 item 12: causes of UNSAFE and SWARMP conditions.
  {
    const missing = input.observations.filter((o) => o.classification !== "safe" && !o.cause?.trim());
    add(
      "causes",
      "Causes of SWARMP and UNSAFE conditions",
      "warning",
      missing.length
        ? fail(
            `${plural(missing.length, "SWARMP/UNSAFE observation")} without a cause.`,
            "Add the cause to each.",
            missing.map((o) => ({ kind: "observation" as const, id: o.id, label: o.label })),
          )
        : pass("Causes given for every SWARMP and UNSAFE observation."),
    );
  }

  // §3.6: elevation photos (house number, full view of each street elevation).
  {
    const n = input.photos.filter((ph) => ph.kind === "elevation").length;
    add(
      "elevation_photos",
      "Elevation photos",
      "warning",
      n
        ? pass(`${plural(n, "elevation photo")}. Include the house number and a full view of each street elevation.`)
        : fail("No elevation photos.", "Add the house number and a full view of each street elevation on the project photos page."),
    );
  }

  return out;
}

export function summarizeChecks(results: CheckResult[]) {
  const failing = results.filter((r) => !r.passed);
  return {
    blockers: failing.filter((r) => r.severity === "blocker"),
    warnings: failing.filter((r) => r.severity === "warning"),
    passed: results.filter((r) => r.passed),
  };
}

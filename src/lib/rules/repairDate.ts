import { FISP_RULES } from "./config";
import { addYears, compareDates } from "./dates";
import type { Classification, IsoDate } from "./types";

export type RepairDateResult =
  | { ok: true }
  | {
      ok: false;
      issue: "missing" | "no_final_inspection" | "unsafe_too_late" | "swarmp_too_soon" | "swarmp_too_late";
      message: string;
      // Allowed range when known, for the UI.
      earliest?: IsoDate;
      latest?: IsoDate;
    };

// Does the recommended repair date fit the classification's time limit?
// SAFE conditions need no repair date. Both ends of each range are allowed.
export function checkRepairDate(
  input: { classification: Classification; repairBy: IsoDate | null; finalInspectionDate: IsoDate | null },
  rules = FISP_RULES,
): RepairDateResult {
  const { classification, repairBy, finalInspectionDate } = input;
  if (classification === "safe") return { ok: true };

  const label = classification === "unsafe" ? "UNSAFE" : "SWARMP";
  if (!repairBy) {
    return { ok: false, issue: "missing", message: `${label} conditions need a recommended repair date.` };
  }
  if (!finalInspectionDate) {
    return {
      ok: false,
      issue: "no_final_inspection",
      message: "Add the QEWI final inspection date to check this repair date.",
    };
  }

  const { unsafeMaxYears, swarmpMinYears, swarmpMaxYears } = rules.repairLimits;
  if (classification === "unsafe") {
    const latest = addYears(finalInspectionDate, unsafeMaxYears);
    if (compareDates(repairBy, latest) > 0) {
      return {
        ok: false,
        issue: "unsafe_too_late",
        message: `UNSAFE repairs must be done within ${unsafeMaxYears} year of the final inspection (by ${latest}).`,
        latest,
      };
    }
    return { ok: true };
  }

  const earliest = addYears(finalInspectionDate, swarmpMinYears);
  const latest = addYears(finalInspectionDate, swarmpMaxYears);
  if (compareDates(repairBy, earliest) < 0) {
    return {
      ok: false,
      issue: "swarmp_too_soon",
      message: `A SWARMP repair date must be at least ${swarmpMinYears} year after the final inspection (${earliest} or later). If it needs repair sooner, consider UNSAFE.`,
      earliest,
      latest,
    };
  }
  if (compareDates(repairBy, latest) > 0) {
    return {
      ok: false,
      issue: "swarmp_too_late",
      message: `SWARMP repairs must be done within ${swarmpMaxYears} years of the final inspection (by ${latest}).`,
      earliest,
      latest,
    };
  }
  return { ok: true };
}

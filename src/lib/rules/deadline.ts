import { FISP_RULES } from "./config";
import { addDays, addYears, compareDates } from "./dates";
import type { FilingWindow } from "./filingWindow";
import type { IsoDate } from "./types";

export type DeadlineLimit =
  | "final_inspection_60_days"
  | "closeup_1_year"
  | "filing_window_end";

export interface DeadlineInput {
  window: FilingWindow;
  // QEWI's final visual walk-around (§103-04(c)(2)(viii)). Null if not done yet.
  finalInspectionDate: IsoDate | null;
  // Date the close-up inspection was completed. Null if not done yet.
  closeupCompleteDate: IsoDate | null;
}

export interface FilingDeadline {
  deadline: IsoDate;
  // The limit that sets the deadline (so the UI can explain it).
  bindingLimit: DeadlineLimit;
  // Every limit that applies, earliest first.
  limits: { limit: DeadlineLimit; date: IsoDate }[];
}

// Deadline = earliest of: final inspection + 60 days (§103-04(c)(4)(viii)),
// close-up completion + 1 year (§103-04(c)(4)(ix)), and the end of the
// filing window (§103-04(c)(4)(iii), (v)). Day 60 itself counts as on time.
export function computeFilingDeadline(input: DeadlineInput, rules = FISP_RULES): FilingDeadline {
  const { daysAfterFinalInspection, yearsAfterCloseup } = rules.filingLimits;
  const limits: FilingDeadline["limits"] = [
    { limit: "filing_window_end", date: input.window.end },
  ];
  if (input.finalInspectionDate) {
    limits.push({
      limit: "final_inspection_60_days",
      date: addDays(input.finalInspectionDate, daysAfterFinalInspection),
    });
  }
  if (input.closeupCompleteDate) {
    limits.push({
      limit: "closeup_1_year",
      date: addYears(input.closeupCompleteDate, yearsAfterCloseup),
    });
  }
  // Stable sort: on a tie the window end (pushed first) is named as binding.
  limits.sort((a, b) => compareDates(a.date, b.date));
  const binding = limits[0]!;
  return { deadline: binding.date, bindingLimit: binding.limit, limits };
}

// §103-04(c)(4)(x): a rejected report must be refiled within 45 days.
export function refileDeadline(rejectedOn: IsoDate, rules = FISP_RULES): IsoDate {
  return addDays(rejectedOn, rules.filingLimits.refileDaysAfterRejection);
}

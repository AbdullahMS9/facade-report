import { FISP_RULES } from "./config";
import { compareDates, daysBetween } from "./dates";
import { computeFilingDeadline, type DeadlineLimit, type FilingDeadline } from "./deadline";
import { filingWindowStatus, getFilingWindow, type FilingWindow, type FilingWindowStatus } from "./filingWindow";
import type { IsoDate } from "./types";

export interface FilingSummaryInput {
  block: number | null;
  cycle: number;
  finalInspectionDate: IsoDate | null;
  closeupCompleteDate: IsoDate | null;
  today: IsoDate;
}

export type FilingSummary =
  | { kind: "missing_block" }
  | {
      kind: "ok";
      window: FilingWindow;
      windowStatus: FilingWindowStatus; // as of today
      deadline: FilingDeadline;
      daysLeft: number; // negative once the deadline has passed
      // The deadline falls before the window opens, so no filing date meets
      // every limit in §3.4 (e.g. the final inspection was done too early).
      deadlineBeforeWindow: boolean;
    };

// Filing window, deadline and days left for one project (CLAUDE.md §3.1, §3.4).
// Needs the block number; returns "missing_block" without it.
export function filingSummary(input: FilingSummaryInput, rules = FISP_RULES): FilingSummary {
  if (input.block === null) return { kind: "missing_block" };
  const window = getFilingWindow(input.block, input.cycle, rules);
  const deadline = computeFilingDeadline(
    {
      window,
      finalInspectionDate: input.finalInspectionDate,
      closeupCompleteDate: input.closeupCompleteDate,
    },
    rules,
  );
  return {
    kind: "ok",
    window,
    windowStatus: filingWindowStatus(input.today, window, rules),
    deadline,
    daysLeft: daysBetween(input.today, deadline.deadline),
    deadlineBeforeWindow: compareDates(deadline.deadline, window.start) < 0,
  };
}

// Plain-English reason for the deadline, for the UI.
export const DEADLINE_LIMIT_LABEL: Record<DeadlineLimit, string> = {
  final_inspection_60_days: "60 days after the final inspection",
  closeup_1_year: "1 year after the close-up inspection was completed",
  filing_window_end: "end of the filing window",
};

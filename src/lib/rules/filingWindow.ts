import { FISP_RULES, type BlockDigit } from "./config";
import { addYears, compareDates, formatIsoDate } from "./dates";
import type { IsoDate } from "./types";

export interface FilingWindow {
  cycle: number;
  blockDigit: BlockDigit;
  start: IsoDate;
  end: IsoDate;
}

export type FilingWindowStatus = "not_open" | "open" | "closed";

// Tax block number as entered (e.g. 1234 or "01234").
export function blockLastDigit(block: number | string): BlockDigit {
  const text = String(block).trim();
  if (!/^\d+$/.test(text) || Number(text) < 1) {
    throw new RangeError(`Block must be a positive whole number: "${block}"`);
  }
  return Number(text.at(-1)) as BlockDigit;
}

// Year the given cycle starts (Cycle 10 → 2025, Cycle 11 → 2030).
export function cycleStartYear(cycle: number, rules = FISP_RULES): number {
  if (!Number.isInteger(cycle) || cycle < 1) {
    throw new RangeError(`Cycle must be a whole number of 1 or more: ${cycle}`);
  }
  const { referenceCycle, referenceStartYear, lengthYears } = rules.cycle;
  return referenceStartYear + (cycle - referenceCycle) * lengthYears;
}

// §103-04(c)(4)(v): two-year window set by the block's last digit.
export function getFilingWindow(
  block: number | string,
  cycle: number,
  rules = FISP_RULES,
): FilingWindow {
  const blockDigit = blockLastDigit(block);
  const { opensMonth, opensDay, lengthYears, offsetYearsByBlockDigit } = rules.filingWindow;
  const startYear = cycleStartYear(cycle, rules) + offsetYearsByBlockDigit[blockDigit];
  const start = formatIsoDate({ year: startYear, month: opensMonth, day: opensDay });
  return { cycle, blockDigit, start, end: addYears(start, lengthYears) };
}

export function filingWindowStatus(
  date: IsoDate,
  window: FilingWindow,
  rules = FISP_RULES,
): FilingWindowStatus {
  if (compareDates(date, window.start) < 0) return "not_open";
  const vsEnd = compareDates(date, window.end);
  if (vsEnd < 0 || (vsEnd === 0 && rules.filingWindow.endIsInclusive)) return "open";
  return "closed";
}

export function isInFilingWindow(date: IsoDate, window: FilingWindow, rules = FISP_RULES): boolean {
  return filingWindowStatus(date, window, rules) === "open";
}

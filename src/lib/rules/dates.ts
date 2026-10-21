import type { IsoDate } from "./types";

// Calendar-date helpers. Dates are "YYYY-MM-DD" strings so deadlines never
// shift by a day because of time zones.

interface DateParts {
  year: number;
  month: number; // 1–12
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function daysInMonth(year: number, month: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month, 0); // day 0 = last day of previous month
  return d.getUTCDate();
}

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseIsoDate(value: IsoDate): DateParts {
  if (!isIsoDate(value)) {
    throw new RangeError(`Not a valid date (expected YYYY-MM-DD): "${value}"`);
  }
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

export function formatIsoDate({ year, month, day }: DateParts): IsoDate {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function toUtcMs(value: IsoDate): number {
  const { year, month, day } = parseIsoDate(value);
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms);
  return formatIsoDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(value) + days * MS_PER_DAY);
}

// Feb 29 + 1 year → Feb 28 (ASSUMPTION, unconfirmed; see CLAUDE.md §11).
export function addYears(value: IsoDate, years: number): IsoDate {
  const { year, month, day } = parseIsoDate(value);
  const newYear = year + years;
  return formatIsoDate({
    year: newYear,
    month,
    day: Math.min(day, daysInMonth(newYear, month)),
  });
}

// Whole days from `from` to `to` (negative if `to` is earlier).
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return Math.sign(toUtcMs(a) - toUtcMs(b));
}

export function earliestDate(dates: readonly IsoDate[]): IsoDate {
  const [first, ...rest] = dates;
  if (first === undefined) throw new RangeError("earliestDate needs at least one date");
  return rest.reduce((min, d) => (compareDates(d, min) < 0 ? d : min), first);
}

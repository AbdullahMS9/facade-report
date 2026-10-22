import { z } from "zod";
import { isIsoDate, type IsoDate } from "@/lib/rules";
import { BOROUGH_LABEL, type Borough } from "@/lib/schemas/building";

// Client for "DOB NOW: Safety – Facades Compliance Filings" (CLAUDE.md §7).
// Pure: fetch is passed in, so it can be tested without the network.

export const OPEN_DATA_DEFAULT_URL = "https://data.cityofnewyork.us/resource/xubg-57si.json";

export type FilingLookup =
  | { kind: "bin"; bin: string }
  | { kind: "bbl"; borough: Borough; block: number; lot: number };

// BIN when it's a real one; else borough/block/lot; else nothing to look up.
// Placeholder BINs like 1000000 are shared by many buildings (CLAUDE.md §7).
export function lookupFor(building: {
  bin: string | null;
  borough: Borough;
  block: number | null;
  lot: number | null;
}): FilingLookup | null {
  if (building.bin && /^[1-5]\d{6}$/.test(building.bin) && !/^[1-5]000000$/.test(building.bin)) {
    return { kind: "bin", bin: building.bin };
  }
  if (building.block !== null && building.lot !== null) {
    return { kind: "bbl", borough: building.borough, block: building.block, lot: building.lot };
  }
  return null;
}

// Stable text key, stored with the cache so a changed BIN or lot refetches.
export function lookupKey(lookup: FilingLookup): string {
  return lookup.kind === "bin" ? `bin:${lookup.bin}` : `bbl:${lookup.borough}/${lookup.block}/${lookup.lot}`;
}

const FIELDS = [
  "tr6_no",
  "cycle",
  "filing_type",
  "filing_status",
  "current_status",
  "prior_status",
  "filing_date",
  "field_inspection_completed_date",
  "qewi_name",
  "qewi_nys_lic_no",
  "comments",
] as const;

export function buildQueryUrl(baseUrl: string, lookup: FilingLookup, limit = 200): URL {
  const url = new URL(baseUrl);
  url.searchParams.set("$select", FIELDS.join(","));
  url.searchParams.set("$limit", String(limit));
  if (lookup.kind === "bin") {
    url.searchParams.set("bin", lookup.bin);
  } else {
    // Dataset stores these as text, without leading zeros.
    url.searchParams.set("borough", BOROUGH_LABEL[lookup.borough]);
    url.searchParams.set("block", String(lookup.block));
    url.searchParams.set("lot", String(lookup.lot));
  }
  return url;
}

export interface PriorFiling {
  tr6No: string | null;
  cycle: number;
  filingType: string;
  filingStatus: string | null;
  currentStatus: string | null;
  priorStatus: string | null;
  filingDate: IsoDate | null;
  fieldInspectionDate: IsoDate | null;
  qewiName: string | null;
  qewiLicense: string | null;
  comments: string | null;
}

const text = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.replace(/\s+/g, " ").trim();
    return t ? t : null;
  });

// "2018-04-09T00:00:00.000" → "2018-04-09"
const date = z
  .string()
  .optional()
  .transform((v) => {
    const d = v?.slice(0, 10);
    return d && isIsoDate(d) ? d : null;
  });

const rowSchema = z
  .object({
    tr6_no: text,
    cycle: z.string().regex(/^\d{1,2}$/),
    filing_type: z.string().min(1),
    filing_status: text,
    current_status: text,
    prior_status: text,
    filing_date: date,
    field_inspection_completed_date: date,
    qewi_name: text,
    qewi_nys_lic_no: text,
    comments: text,
  })
  .transform(
    (r): PriorFiling => ({
      tr6No: r.tr6_no,
      cycle: Number(r.cycle),
      filingType: r.filing_type,
      filingStatus: r.filing_status,
      currentStatus: r.current_status,
      priorStatus: r.prior_status,
      filingDate: r.filing_date,
      fieldInspectionDate: r.field_inspection_completed_date,
      qewiName: r.qewi_name,
      qewiLicense: r.qewi_nys_lic_no,
      comments: r.comments,
    }),
  );

// Rows that don't parse (missing cycle, etc.) are skipped, not fatal.
export function parseRows(data: unknown): PriorFiling[] {
  if (!Array.isArray(data)) throw new OpenDataError("NYC Open Data sent an unexpected response.");
  return sortFilings(
    data.flatMap((row) => {
      const parsed = rowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    }),
  );
}

// Newest cycle first; within a cycle, newest filing first (undated last).
export function sortFilings(filings: PriorFiling[]): PriorFiling[] {
  return [...filings].sort(
    (a, b) => b.cycle - a.cycle || (b.filingDate ?? "").localeCompare(a.filingDate ?? ""),
  );
}

export class OpenDataError extends Error {}

export async function fetchPriorFilings(
  lookup: FilingLookup,
  options: { baseUrl?: string; appToken?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<PriorFiling[]> {
  const { baseUrl = OPEN_DATA_DEFAULT_URL, appToken, timeoutMs = 8000, fetchImpl = fetch } = options;
  let res: Response;
  try {
    res = await fetchImpl(buildQueryUrl(baseUrl, lookup), {
      headers: appToken ? { "X-App-Token": appToken } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new OpenDataError("Couldn't reach NYC Open Data. Try again later.");
  }
  if (!res.ok) {
    throw new OpenDataError(
      res.status === 429
        ? "NYC Open Data is limiting requests right now. Try again in a few minutes."
        : `NYC Open Data returned an error (${res.status}). Try again later.`,
    );
  }
  return parseRows(await res.json().catch(() => null));
}

export interface PriorCycleSummary {
  cycle: number;
  // Status on the most recent dated filing for that cycle, as DOB records it.
  status: string;
  filingDate: IsoDate | null;
}

// The last cycle before `currentCycle` that has any filing on record.
export function latestPriorCycle(filings: PriorFiling[], currentCycle: number): PriorCycleSummary | null {
  const earlier = sortFilings(filings).filter((f) => f.cycle < currentCycle);
  const first = earlier[0];
  if (!first) return null;
  const sameCycle = earlier.filter((f) => f.cycle === first.cycle);
  const latest = sameCycle.find((f) => f.filingDate) ?? first;
  return {
    cycle: first.cycle,
    status: latest.currentStatus ?? latest.filingStatus ?? "Unknown",
    filingDate: latest.filingDate,
  };
}

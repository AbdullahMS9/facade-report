import { describe, expect, it, vi } from "vitest";
import {
  buildQueryUrl,
  fetchPriorFilings,
  latestPriorCycle,
  lookupFor,
  lookupKey,
  needsRefresh,
  OpenDataError,
  parseCachedFilings,
  parseRows,
} from "./facades";

// Fictional rows shaped like the real dataset (CLAUDE.md §7).
const ROWS = [
  {
    tr6_no: "TR6-000001-8A-I1",
    cycle: "8",
    filing_type: "Initial",
    filing_status: "SWARMP",
    current_status: "SWARMP",
    prior_status: "SAFE",
    filing_date: "2018-04-09T00:00:00.000",
    field_inspection_completed_date: "2018-03-22T00:00:00.000",
    qewi_name: "PAT  EXAMPLE",
    qewi_nys_lic_no: "PE - 000123",
  },
  { tr6_no: "TR6-000001-9A-N1", cycle: "9", filing_type: "Auto-Generated", filing_status: "No Report Filed", current_status: "SAFE" },
  {
    tr6_no: "TR6-000001-9A-I1",
    cycle: "9",
    filing_type: "Initial",
    filing_status: "SAFE",
    current_status: "SAFE",
    prior_status: "SWARMP",
    filing_date: "2023-02-01T00:00:00.000",
  },
  {
    tr6_no: "TR6-000001-10A-I1",
    cycle: "10",
    filing_type: "Initial",
    filing_status: "UNSAFE",
    filing_date: "2026-01-05T00:00:00.000",
  },
];

describe("lookupFor / lookupKey", () => {
  const base = { borough: "manhattan" as const, block: 894, lot: 52 };

  it("prefers a real BIN", () => {
    const l = lookupFor({ ...base, bin: "1012345" });
    expect(l).toEqual({ kind: "bin", bin: "1012345" });
    expect(lookupKey(l!)).toBe("bin:1012345");
  });

  it("falls back to borough/block/lot for a placeholder or missing BIN", () => {
    expect(lookupFor({ ...base, bin: "1000000" })).toEqual({ kind: "bbl", borough: "manhattan", block: 894, lot: 52 });
    expect(lookupKey(lookupFor({ ...base, bin: null })!)).toBe("bbl:manhattan/894/52");
  });

  it("returns null with nothing to look up", () => {
    expect(lookupFor({ borough: "queens", bin: null, block: 12, lot: null })).toBeNull();
  });
});

describe("buildQueryUrl", () => {
  it("queries by BIN", () => {
    const url = buildQueryUrl("https://example.test/x.json", { kind: "bin", bin: "1012345" });
    expect(url.searchParams.get("bin")).toBe("1012345");
    expect(url.searchParams.get("$select")).toContain("filing_status");
    expect(url.searchParams.get("$select")).not.toContain("owner");
  });

  it("queries by borough name and unpadded block/lot", () => {
    const url = buildQueryUrl("https://example.test/x.json", { kind: "bbl", borough: "staten_island", block: 7, lot: 101 });
    expect(url.searchParams.get("borough")).toBe("Staten Island");
    expect(url.searchParams.get("block")).toBe("7");
    expect(url.searchParams.get("lot")).toBe("101");
  });
});

describe("parseRows", () => {
  it("parses, cleans and sorts newest cycle first", () => {
    const filings = parseRows(ROWS);
    expect(filings.map((f) => `${f.cycle}:${f.filingType}`)).toEqual([
      "10:Initial",
      "9:Initial",
      "9:Auto-Generated",
      "8:Initial",
    ]);
    expect(filings[3]).toMatchObject({
      filingDate: "2018-04-09",
      fieldInspectionDate: "2018-03-22",
      qewiName: "PAT EXAMPLE",
      qewiLicense: "PE - 000123",
      comments: null,
    });
  });

  it("skips rows it can't read", () => {
    expect(parseRows([{ filing_type: "Initial" }, { cycle: "x", filing_type: "Initial" }, ROWS[0]])).toHaveLength(1);
  });

  it("rejects a non-list response", () => {
    expect(() => parseRows({ error: true })).toThrow(OpenDataError);
  });
});

describe("latestPriorCycle", () => {
  it("uses the latest dated filing of the most recent earlier cycle", () => {
    expect(latestPriorCycle(parseRows(ROWS), 10)).toEqual({ cycle: 9, status: "SAFE", filingDate: "2023-02-01" });
    expect(latestPriorCycle(parseRows(ROWS), 9)).toEqual({ cycle: 8, status: "SWARMP", filingDate: "2018-04-09" });
  });

  it("is null with no earlier filings", () => {
    expect(latestPriorCycle(parseRows(ROWS), 8)).toBeNull();
  });
});

describe("fetchPriorFilings", () => {
  const lookup = { kind: "bin" as const, bin: "1012345" };

  it("sends the app token and parses the response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(ROWS), { status: 200 }));
    const filings = await fetchPriorFilings(lookup, { fetchImpl, appToken: "token-123", baseUrl: "https://example.test/x.json" });
    expect(filings).toHaveLength(4);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toContain("bin=1012345");
    expect(init.headers).toEqual({ "X-App-Token": "token-123" });
  });

  it("explains rate limits and server errors", async () => {
    const limited = vi.fn(async () => new Response("", { status: 429 }));
    await expect(fetchPriorFilings(lookup, { fetchImpl: limited })).rejects.toThrow(/limiting requests/);
    const broken = vi.fn(async () => new Response("", { status: 500 }));
    await expect(fetchPriorFilings(lookup, { fetchImpl: broken })).rejects.toThrow(/error \(500\)/);
  });

  it("explains network failures and timeouts", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchPriorFilings(lookup, { fetchImpl: offline })).rejects.toThrow(/Couldn't reach NYC Open Data/);

    const slow = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    await expect(fetchPriorFilings(lookup, { fetchImpl: slow as unknown as typeof fetch, timeoutMs: 20 })).rejects.toThrow(
      /Couldn't reach/,
    );
  });
});

describe("needsRefresh", () => {
  const now = new Date("2026-10-21T15:00:00Z");
  const fresh = { lookupKey: "bin:1012345", fetchedAt: "2026-10-21T10:00:00Z", lastAttemptAt: "2026-10-21T10:00:00Z", lastError: null };

  it("refreshes with no cache, a changed lookup, or when forced", () => {
    expect(needsRefresh(null, "bin:1012345", now)).toBe(true);
    expect(needsRefresh(fresh, "bin:1099999", now)).toBe(true);
    expect(needsRefresh(fresh, "bin:1012345", now, true)).toBe(true);
  });

  it("keeps data younger than 24 hours", () => {
    expect(needsRefresh(fresh, "bin:1012345", now)).toBe(false);
    expect(needsRefresh({ ...fresh, fetchedAt: "2026-10-20T14:59:00Z" }, "bin:1012345", now)).toBe(true);
  });

  it("waits 5 minutes after a failed attempt", () => {
    const failed = { ...fresh, fetchedAt: null, lastAttemptAt: "2026-10-21T14:58:00Z", lastError: "timeout" };
    expect(needsRefresh(failed, "bin:1012345", now)).toBe(false);
    expect(needsRefresh({ ...failed, lastAttemptAt: "2026-10-21T14:50:00Z" }, "bin:1012345", now)).toBe(true);
  });
});

describe("parseCachedFilings", () => {
  it("round-trips parsed filings and drops bad data", () => {
    const filings = parseRows(ROWS);
    expect(parseCachedFilings(JSON.parse(JSON.stringify(filings)))).toEqual(filings);
    expect(parseCachedFilings([{ cycle: "9" }])).toEqual([]);
    expect(parseCachedFilings(null)).toEqual([]);
  });
});

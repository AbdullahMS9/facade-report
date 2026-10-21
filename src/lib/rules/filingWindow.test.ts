import { describe, expect, it } from "vitest";
import { FISP_RULES } from "./config";
import {
  blockLastDigit,
  cycleStartYear,
  filingWindowStatus,
  getFilingWindow,
  isInFilingWindow,
} from "./filingWindow";

describe("blockLastDigit", () => {
  it("reads numbers and strings, including leading zeros", () => {
    expect(blockLastDigit(1234)).toBe(4);
    expect(blockLastDigit("00120")).toBe(0);
    expect(blockLastDigit(" 7 ")).toBe(7);
  });

  it.each([0, -5, 12.5, "12a", "", "1-2", Number.NaN])("rejects %s", (block) => {
    expect(() => blockLastDigit(block)).toThrow(RangeError);
  });
});

describe("cycleStartYear", () => {
  it("anchors Cycle 10 to 2025 and steps by five years", () => {
    expect(cycleStartYear(9)).toBe(2020);
    expect(cycleStartYear(10)).toBe(2025);
    expect(cycleStartYear(11)).toBe(2030);
  });

  it.each([0, -1, 10.5, Number.NaN])("rejects cycle %s", (cycle) => {
    expect(() => cycleStartYear(cycle)).toThrow(RangeError);
  });
});

describe("getFilingWindow (Cycle 10)", () => {
  it.each([
    [4, "2025-02-21", "2027-02-21"],
    [5, "2025-02-21", "2027-02-21"],
    [6, "2025-02-21", "2027-02-21"],
    [9, "2025-02-21", "2027-02-21"],
    [0, "2026-02-21", "2028-02-21"],
    [7, "2026-02-21", "2028-02-21"],
    [8, "2026-02-21", "2028-02-21"],
    [1, "2027-02-21", "2029-02-21"],
    [2, "2027-02-21", "2029-02-21"],
    [3, "2027-02-21", "2029-02-21"],
  ])("block ending %i → %s to %s", (digit, start, end) => {
    const block = 100 + digit; // 104, 105, ...
    expect(getFilingWindow(block, 10)).toEqual({ cycle: 10, blockDigit: digit, start, end });
  });
});

describe("getFilingWindow (other cycles)", () => {
  it("shifts by five years per cycle", () => {
    expect(getFilingWindow(14, 11)).toMatchObject({ start: "2030-02-21", end: "2032-02-21" });
    expect(getFilingWindow(10, 11)).toMatchObject({ start: "2031-02-21", end: "2033-02-21" });
    expect(getFilingWindow(13, 9)).toMatchObject({ start: "2022-02-21", end: "2024-02-21" });
  });
});

describe("filingWindowStatus", () => {
  const window = getFilingWindow(105, 10); // 2025-02-21 to 2027-02-21

  it("handles the opening edge", () => {
    expect(filingWindowStatus("2025-02-20", window)).toBe("not_open");
    expect(filingWindowStatus("2025-02-21", window)).toBe("open");
  });

  it("treats the closing Feb 21 as on time (configurable)", () => {
    expect(filingWindowStatus("2027-02-20", window)).toBe("open");
    expect(filingWindowStatus("2027-02-21", window)).toBe("open");
    expect(filingWindowStatus("2027-02-22", window)).toBe("closed");
  });

  it("can treat the closing day as late", () => {
    const strict = { ...FISP_RULES, filingWindow: { ...FISP_RULES.filingWindow, endIsInclusive: false } };
    expect(filingWindowStatus("2027-02-21", window, strict)).toBe("closed");
  });

  it("isInFilingWindow matches status", () => {
    expect(isInFilingWindow("2026-06-01", window)).toBe(true);
    expect(isInFilingWindow("2028-01-01", window)).toBe(false);
  });
});

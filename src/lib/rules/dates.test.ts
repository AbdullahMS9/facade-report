import { describe, expect, it } from "vitest";
import {
  addDays,
  addYears,
  compareDates,
  daysBetween,
  earliestDate,
  isIsoDate,
  parseIsoDate,
} from "./dates";

describe("isIsoDate / parseIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isIsoDate("2025-02-21")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true); // leap year
    expect(parseIsoDate("2025-02-21")).toEqual({ year: 2025, month: 2, day: 21 });
  });

  it.each(["2027-02-29", "2025-13-01", "2025-00-10", "2025-04-31", "2025-2-21", "02/21/2025", ""])(
    "rejects %s",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
      expect(() => parseIsoDate(value)).toThrow(RangeError);
    },
  );
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is not affected by daylight saving changes", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
  });
});

describe("addYears", () => {
  it("keeps month and day", () => {
    expect(addYears("2025-02-21", 2)).toBe("2027-02-21");
  });

  it("moves Feb 29 to Feb 28 in a non-leap year", () => {
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
    expect(addYears("2028-02-29", 4)).toBe("2032-02-29");
  });
});

describe("compareDates / daysBetween / earliestDate", () => {
  it("compares and measures", () => {
    expect(compareDates("2025-01-01", "2025-01-02")).toBe(-1);
    expect(compareDates("2025-01-02", "2025-01-02")).toBe(0);
    expect(compareDates("2026-01-01", "2025-12-31")).toBe(1);
    expect(daysBetween("2025-01-01", "2025-03-02")).toBe(60);
    expect(daysBetween("2025-03-02", "2025-01-01")).toBe(-60);
  });

  it("finds the earliest date", () => {
    expect(earliestDate(["2026-05-01", "2025-12-31", "2027-01-01"])).toBe("2025-12-31");
    expect(() => earliestDate([])).toThrow(RangeError);
  });
});

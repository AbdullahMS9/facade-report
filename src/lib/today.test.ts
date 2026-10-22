import { describe, expect, it } from "vitest";
import { formatDate, todayInNewYork } from "./today";

describe("todayInNewYork", () => {
  it("uses New York's date, not UTC", () => {
    // 03:30 UTC on Mar 2 is still Mar 1 in New York.
    expect(todayInNewYork(new Date("2026-03-02T03:30:00Z"))).toBe("2026-03-01");
    expect(todayInNewYork(new Date("2026-03-02T15:00:00Z"))).toBe("2026-03-02");
  });
});

describe("formatDate", () => {
  it("formats without shifting the day", () => {
    expect(formatDate("2027-02-21")).toBe("Feb 21, 2027");
  });
});

import { describe, expect, it } from "vitest";
import { computeFilingDeadline, refileDeadline } from "./deadline";
import { getFilingWindow } from "./filingWindow";

const window = getFilingWindow(105, 10); // 2025-02-21 to 2027-02-21

describe("computeFilingDeadline", () => {
  it("uses the window end when no inspection dates are set", () => {
    expect(
      computeFilingDeadline({ window, finalInspectionDate: null, closeupCompleteDate: null }),
    ).toEqual({
      deadline: "2027-02-21",
      bindingLimit: "filing_window_end",
      limits: [{ limit: "filing_window_end", date: "2027-02-21" }],
    });
  });

  it("is 60 days after the final inspection when that is earliest", () => {
    const result = computeFilingDeadline({
      window,
      finalInspectionDate: "2026-03-01",
      closeupCompleteDate: "2026-01-15",
    });
    expect(result.deadline).toBe("2026-04-30");
    expect(result.bindingLimit).toBe("final_inspection_60_days");
    expect(result.limits.map((l) => l.limit)).toEqual([
      "final_inspection_60_days",
      "closeup_1_year",
      "filing_window_end",
    ]);
  });

  it("is 1 year after close-up when that is earliest", () => {
    const result = computeFilingDeadline({
      window,
      finalInspectionDate: "2026-04-01",
      closeupCompleteDate: "2025-05-01",
    });
    expect(result).toMatchObject({ deadline: "2026-05-01", bindingLimit: "closeup_1_year" });
  });

  it("is the window end when that is earliest", () => {
    const result = computeFilingDeadline({
      window,
      finalInspectionDate: "2027-01-10", // +60 = 2027-03-11
      closeupCompleteDate: "2026-11-01", // +1y = 2027-11-01
    });
    expect(result).toMatchObject({ deadline: "2027-02-21", bindingLimit: "filing_window_end" });
  });

  it("handles a close-up finished on Feb 29", () => {
    const leapWindow = getFilingWindow(110, 10); // 2026-02-21 to 2028-02-21
    const result = computeFilingDeadline({
      window: { ...leapWindow, end: "2030-02-21" },
      finalInspectionDate: null,
      closeupCompleteDate: "2028-02-29",
    });
    expect(result).toMatchObject({ deadline: "2029-02-28", bindingLimit: "closeup_1_year" });
  });

  it("names the window end as binding on a tie", () => {
    const result = computeFilingDeadline({
      window,
      finalInspectionDate: "2026-12-23", // +60 = 2027-02-21
      closeupCompleteDate: null,
    });
    expect(result).toMatchObject({ deadline: "2027-02-21", bindingLimit: "filing_window_end" });
  });
});

describe("refileDeadline", () => {
  it("is 45 days after rejection", () => {
    expect(refileDeadline("2026-03-01")).toBe("2026-04-15");
    expect(refileDeadline("2026-12-20")).toBe("2027-02-03");
  });
});

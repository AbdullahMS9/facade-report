import { describe, expect, it } from "vitest";
import { filingSummary } from "./filingSummary";

describe("filingSummary", () => {
  it("needs a block number", () => {
    expect(
      filingSummary({ block: null, cycle: 10, finalInspectionDate: null, closeupCompleteDate: null, today: "2026-01-01" }),
    ).toEqual({ kind: "missing_block" });
  });

  it("combines window, deadline and days left", () => {
    const s = filingSummary({
      block: 1234, // ends in 4 → 2025-02-21 to 2027-02-21
      cycle: 10,
      finalInspectionDate: "2026-03-01",
      closeupCompleteDate: null,
      today: "2026-04-20",
    });
    expect(s).toMatchObject({
      kind: "ok",
      window: { start: "2025-02-21", end: "2027-02-21" },
      windowStatus: "open",
      deadline: { deadline: "2026-04-30", bindingLimit: "final_inspection_60_days" },
      daysLeft: 10,
    });
  });

  it("reports a window that hasn't opened and a passed deadline", () => {
    const notOpen = filingSummary({ block: 101, cycle: 10, finalInspectionDate: null, closeupCompleteDate: null, today: "2026-06-01" });
    expect(notOpen).toMatchObject({ windowStatus: "not_open", daysLeft: 996 });

    const late = filingSummary({ block: 1234, cycle: 10, finalInspectionDate: "2026-01-01", closeupCompleteDate: null, today: "2026-03-10" });
    expect(late).toMatchObject({ deadline: { deadline: "2026-03-02" }, daysLeft: -8 });
  });
});

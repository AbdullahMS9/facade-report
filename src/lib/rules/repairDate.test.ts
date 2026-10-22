import { describe, expect, it } from "vitest";
import { checkRepairDate } from "./repairDate";

const base = { finalInspectionDate: "2026-10-01" };

describe("checkRepairDate", () => {
  it("needs nothing for SAFE", () => {
    expect(checkRepairDate({ ...base, classification: "safe", repairBy: null })).toEqual({ ok: true });
  });

  it("requires a date for SWARMP and UNSAFE", () => {
    expect(checkRepairDate({ ...base, classification: "unsafe", repairBy: null })).toMatchObject({ issue: "missing" });
    expect(checkRepairDate({ ...base, classification: "swarmp", repairBy: null })).toMatchObject({ issue: "missing" });
  });

  it("can't check without the final inspection date", () => {
    expect(checkRepairDate({ classification: "unsafe", repairBy: "2027-01-01", finalInspectionDate: null })).toMatchObject({
      issue: "no_final_inspection",
    });
  });

  it("UNSAFE: up to and including 1 year", () => {
    expect(checkRepairDate({ ...base, classification: "unsafe", repairBy: "2027-10-01" })).toEqual({ ok: true });
    expect(checkRepairDate({ ...base, classification: "unsafe", repairBy: "2027-10-02" })).toMatchObject({
      issue: "unsafe_too_late",
      latest: "2027-10-01",
    });
  });

  it("SWARMP: between 1 and 5 years, ends included", () => {
    expect(checkRepairDate({ ...base, classification: "swarmp", repairBy: "2027-09-30" })).toMatchObject({
      issue: "swarmp_too_soon",
      earliest: "2027-10-01",
    });
    expect(checkRepairDate({ ...base, classification: "swarmp", repairBy: "2027-10-01" })).toEqual({ ok: true });
    expect(checkRepairDate({ ...base, classification: "swarmp", repairBy: "2031-10-01" })).toEqual({ ok: true });
    expect(checkRepairDate({ ...base, classification: "swarmp", repairBy: "2031-10-02" })).toMatchObject({
      issue: "swarmp_too_late",
    });
  });

  it("handles a Feb 29 final inspection", () => {
    expect(
      checkRepairDate({ classification: "unsafe", repairBy: "2029-02-28", finalInspectionDate: "2028-02-29" }),
    ).toEqual({ ok: true });
    expect(
      checkRepairDate({ classification: "unsafe", repairBy: "2029-03-01", finalInspectionDate: "2028-02-29" }),
    ).toMatchObject({ issue: "unsafe_too_late" });
  });
});

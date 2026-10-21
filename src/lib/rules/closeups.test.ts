import { describe, expect, it } from "vitest";
import { closeupRequirements, requiredCloseups } from "./closeups";

describe("requiredCloseups", () => {
  it.each([
    [0, 0],
    [1, 1],
    [59.9, 1],
    [60, 2],
    [119.9, 2],
    [120, 3],
    [179.99, 3],
    [180, 4],
    [400, 7],
  ])("%s ft → %i", (frontage, expected) => {
    expect(requiredCloseups(frontage)).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (frontage) => {
    expect(() => requiredCloseups(frontage)).toThrow(RangeError);
  });
});

describe("closeupRequirements", () => {
  it("counts street elevations and ignores non-street ones", () => {
    const result = closeupRequirements([
      { facesStreet: true, frontageFt: 100 }, // 2
      { facesStreet: true, frontageFt: 125 }, // 3
      { facesStreet: false, frontageFt: 300 }, // sample, 0 fixed
    ]);
    expect(result).toEqual({ byElevation: [2, 3, 0], buildingMinimum: 5 });
  });

  it("requires at least one close-up for a building with no street frontage", () => {
    const result = closeupRequirements([
      { facesStreet: false, frontageFt: 80 },
      { facesStreet: false, frontageFt: 80 },
    ]);
    expect(result).toEqual({ byElevation: [0, 0], buildingMinimum: 1 });
  });

  it("still requires one when there are no elevations yet", () => {
    expect(closeupRequirements([])).toEqual({ byElevation: [], buildingMinimum: 1 });
  });

  it("reports 0 for a street elevation with no frontage entered", () => {
    expect(closeupRequirements([{ facesStreet: true, frontageFt: 0 }]).byElevation).toEqual([0]);
  });
});

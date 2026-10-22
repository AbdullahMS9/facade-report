import { describe, expect, it } from "vitest";
import { elevationProgress, probesApply } from "./elevationProgress";

describe("elevationProgress", () => {
  it("counts drops against the street-elevation minimum", () => {
    expect(elevationProgress({ facesStreet: true, frontageFt: 120, closeupCount: 1 })).toEqual({
      required: 3,
      recorded: 1,
      short: 2,
    });
    expect(elevationProgress({ facesStreet: true, frontageFt: 59, closeupCount: 2 })).toEqual({
      required: 1,
      recorded: 2,
      short: 0,
    });
  });

  it("has no fixed minimum for non-street elevations", () => {
    expect(elevationProgress({ facesStreet: false, frontageFt: 200, closeupCount: 0 })).toEqual({
      required: null,
      recorded: 0,
      short: 0,
    });
  });

  it("reports 0 required for a street elevation with no frontage entered", () => {
    expect(elevationProgress({ facesStreet: true, frontageFt: 0, closeupCount: 0 }).required).toBe(0);
  });
});

describe("probesApply", () => {
  it("applies only to known cavity walls in probe cycles", () => {
    expect(probesApply(true, 10)).toBe(true);
    expect(probesApply(true, 8)).toBe(false);
    expect(probesApply(false, 10)).toBe(false);
    expect(probesApply(null, 10)).toBe(false);
  });
});

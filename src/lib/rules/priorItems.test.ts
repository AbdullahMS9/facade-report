import { describe, expect, it } from "vitest";
import { buildingStatus, carriedForwardClassifications, resolvePriorItem } from "./priorItems";

describe("resolvePriorItem", () => {
  it("drops repaired items", () => {
    expect(resolvePriorItem({ repaired: true })).toEqual({ status: "repaired" });
  });

  it("carries unrepaired items forward as unsafe", () => {
    expect(resolvePriorItem({ repaired: false })).toEqual({
      status: "carried_forward",
      classification: "unsafe",
    });
  });

  it("flags items not yet decided", () => {
    expect(resolvePriorItem({ repaired: null })).toEqual({ status: "unresolved" });
  });
});

describe("carriedForwardClassifications", () => {
  it("returns one unsafe per unrepaired item", () => {
    expect(
      carriedForwardClassifications([{ repaired: true }, { repaired: false }, { repaired: null }, { repaired: false }]),
    ).toEqual(["unsafe", "unsafe"]);
  });
});

describe("buildingStatus", () => {
  it("makes a SWARMP-only building unsafe when a prior SWARMP is not repaired", () => {
    expect(buildingStatus(["swarmp", "safe"], [{ repaired: false }])).toBe("unsafe");
  });

  it("makes an otherwise safe building unsafe (administrative unsafe)", () => {
    expect(buildingStatus([], [{ repaired: false }])).toBe("unsafe");
  });

  it("is unchanged when all prior items were repaired", () => {
    expect(buildingStatus(["swarmp"], [{ repaired: true }])).toBe("swarmp");
    expect(buildingStatus([], [{ repaired: true }])).toBe("safe");
  });

  it("ignores unresolved items (the checker blocks those)", () => {
    expect(buildingStatus(["safe"], [{ repaired: null }])).toBe("safe");
  });
});

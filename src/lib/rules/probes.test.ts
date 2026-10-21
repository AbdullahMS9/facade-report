import { describe, expect, it } from "vitest";
import { FISP_RULES } from "./config";
import { probesRequiredInCycle } from "./probes";

describe("probesRequiredInCycle", () => {
  it("is not required before Cycle 9", () => {
    expect(probesRequiredInCycle(8)).toBe(false);
  });

  it("is required in Cycle 9 and later odd cycles", () => {
    expect(probesRequiredInCycle(9)).toBe(true);
    expect(probesRequiredInCycle(11)).toBe(true);
  });

  it("follows the even-cycle flag (default true, unconfirmed)", () => {
    expect(probesRequiredInCycle(10)).toBe(true);
    const oddOnly = { ...FISP_RULES, probes: { ...FISP_RULES.probes, requiredInEvenCycles: false } };
    expect(probesRequiredInCycle(10, oddOnly)).toBe(false);
    expect(probesRequiredInCycle(11, oddOnly)).toBe(true);
  });

  it("rejects invalid cycles", () => {
    expect(() => probesRequiredInCycle(0)).toThrow(RangeError);
  });
});

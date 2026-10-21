import { describe, expect, it } from "vitest";
import { rollUpStatus } from "./classification";

describe("rollUpStatus", () => {
  it("is safe with no conditions", () => {
    expect(rollUpStatus([])).toBe("safe");
  });

  it("is safe when every condition is safe", () => {
    expect(rollUpStatus(["safe", "safe"])).toBe("safe");
  });

  it("is SWARMP when any SWARMP and no unsafe", () => {
    expect(rollUpStatus(["safe", "swarmp", "safe"])).toBe("swarmp");
  });

  it("is unsafe when any condition is unsafe", () => {
    expect(rollUpStatus(["swarmp", "unsafe", "safe"])).toBe("unsafe");
    expect(rollUpStatus(["unsafe"])).toBe("unsafe");
  });
});

import { describe, expect, it } from "vitest";
import { binBoroughWarning, buildingSchema } from "./building";
import { closeupSchema, elevationSchema } from "./elevation";
import { inspectorSchema } from "./inspector";
import { newProjectSchema, projectDetailsSchema } from "./project";

const baseBuilding = { address: "100 Example Street", borough: "manhattan" };

describe("buildingSchema", () => {
  it("turns blanks into null and parses numbers", () => {
    const r = buildingSchema.parse({ ...baseBuilding, block: "01234", lot: "", bin: "", stories: "12", height_ft: "130.5" });
    expect(r).toMatchObject({ block: 1234, lot: null, bin: null, stories: 12, height_ft: 130.5, is_landmark: null });
  });

  it("splits materials on commas and new lines", () => {
    const r = buildingSchema.parse({ ...baseBuilding, materials: "Brick, terra cotta\nCast stone, brick, " });
    expect(r.materials).toEqual(["Brick", "terra cotta", "Cast stone", "brick"]);
  });

  it("reads yes/no questions", () => {
    expect(buildingSchema.parse({ ...baseBuilding, is_cavity_wall: "yes", is_landmark: "no" })).toMatchObject({
      is_cavity_wall: true,
      is_landmark: false,
    });
  });

  it.each([
    [{ address: "" }, /Enter the address/],
    [{ borough: "jersey" }, /Choose a borough/],
    [{ block: "123456" }, /Block must be between 1 and 99999/],
    [{ block: "12a" }, /Block must be a whole number/],
    [{ lot: "0" }, /Lot must be between 1 and 9999/],
    [{ bin: "912345" }, /BIN must be 7 digits/],
    [{ bin: "6123456" }, /BIN must be 7 digits/],
    [{ height_ft: "tall" }, /Height must be a number/],
  ])("rejects %o", (override, message) => {
    const r = buildingSchema.safeParse({ ...baseBuilding, ...override });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(message);
  });
});

describe("binBoroughWarning", () => {
  it("warns when the BIN's first digit doesn't match the borough", () => {
    expect(binBoroughWarning("3012345", "manhattan")).toMatch(/Manhattan BINs start with 1/);
  });
  it("is quiet when they match or BIN is blank", () => {
    expect(binBoroughWarning("1012345", "manhattan")).toBeNull();
    expect(binBoroughWarning(null, "queens")).toBeNull();
  });
});

describe("project schemas", () => {
  it("requires a cycle and report type", () => {
    expect(newProjectSchema.parse({ cycle: "10", report_type: "initial" })).toEqual({ cycle: 10, report_type: "initial" });
    expect(newProjectSchema.safeParse({ cycle: "", report_type: "initial" }).success).toBe(false);
  });

  it("rejects an exam end before the start", () => {
    const r = projectDetailsSchema.safeParse({ cycle: "10", report_type: "initial", exam_start: "2026-05-10", exam_end: "2026-05-01" });
    expect(r.error?.issues[0]).toMatchObject({ path: ["exam_end"] });
  });

  it("accepts blank dates and no QEWI", () => {
    const r = projectDetailsSchema.parse({ cycle: "10", report_type: "amended", qewi_id: "", exam_start: "" });
    expect(r).toMatchObject({ qewi_id: null, exam_start: null, final_visual_date: null });
  });

  it("rejects an impossible date", () => {
    expect(projectDetailsSchema.safeParse({ cycle: "10", report_type: "initial", final_visual_date: "2026-02-30" }).success).toBe(false);
  });
});

describe("elevation, close-up and inspector schemas", () => {
  it("parses an elevation with blank frontage as 0", () => {
    expect(elevationSchema.parse({ name: "North", faces_street: "yes", frontage_ft: "" })).toMatchObject({
      faces_street: true,
      frontage_ft: 0,
      setbacks_note: null,
    });
  });

  it("requires the faces-street answer", () => {
    expect(elevationSchema.safeParse({ name: "North" }).success).toBe(false);
  });

  it("requires a close-up date and method", () => {
    expect(closeupSchema.safeParse({ location_note: "Drop 1", inspected_on: "", method: "scaffold" }).success).toBe(false);
    expect(closeupSchema.safeParse({ location_note: "Drop 1", inspected_on: "2026-05-01", method: "crane" }).success).toBe(false);
    expect(closeupSchema.parse({ location_note: "Drop 1", inspected_on: "2026-05-01", method: "rope" }).method).toBe("rope");
  });

  it("parses an inspector", () => {
    expect(inspectorSchema.parse({ name: "Pat Example", license_type: "PE", license_number: "012345", user_id: "" })).toEqual({
      name: "Pat Example",
      license_type: "PE",
      license_number: "012345",
      user_id: null,
    });
  });
});

describe("priorItemSchema", () => {
  it("reads the repaired answer", async () => {
    const { priorItemSchema } = await import("./priorItem");
    expect(priorItemSchema.parse({ description: "Cracked lintel", repaired: "" }).repaired).toBeNull();
    expect(priorItemSchema.parse({ description: "Cracked lintel", repaired: "yes" }).repaired).toBe(true);
    expect(priorItemSchema.parse({ description: "Cracked lintel", repaired: "no" }).repaired).toBe(false);
    expect(priorItemSchema.safeParse({ description: "", repaired: "no" }).success).toBe(false);
  });
});

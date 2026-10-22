import { z } from "zod";
import { optionalNumber, optionalText, requiredDate, requiredText } from ".";

export const elevationSchema = z.object({
  name: requiredText("a name (for example North)", 100),
  faces_street: z
    .enum(["yes", "no"], { error: "Say whether this elevation faces a street." })
    .transform((v) => v === "yes"),
  // Blank → 0; the checker flags street elevations with no frontage.
  frontage_ft: optionalNumber("frontage", 0, 9999).transform((v) => v ?? 0),
  setbacks_note: optionalText("setbacks note", 2000),
});

export const CLOSEUP_METHODS = ["scaffold", "swing_stage", "boom_lift", "rope"] as const;
export const CLOSEUP_METHOD_LABEL = {
  scaffold: "Scaffold",
  swing_stage: "Swing stage",
  boom_lift: "Boom lift",
  rope: "Rope access",
} as const;

export const closeupSchema = z.object({
  location_note: requiredText("where the drop was (for example Bay 2, east of entrance)", 300),
  inspected_on: requiredDate("the drop date"),
  method: z.enum(CLOSEUP_METHODS, { error: "Choose how the drop was done." }),
});

export const probeSchema = z.object({
  location_note: requiredText("where the probe was (for example Floor 6, left pier)", 300),
  probed_on: requiredDate("the probe date"),
  tie_type: optionalText("tie type", 200),
  tie_spacing: optionalText("tie spacing", 200),
  tie_condition: optionalText("tie condition", 1000),
});

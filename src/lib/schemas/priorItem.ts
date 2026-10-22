import { z } from "zod";
import { optionalText, requiredText } from ".";

// "" = not decided yet → null; "yes" → repaired; "no" → carried forward as UNSAFE.
const repairedField = z.preprocess(
  (v) => (v === null || v === undefined ? "" : v),
  z.enum(["", "yes", "no"], { error: "Choose whether it was repaired." }).transform((v) => (v === "" ? null : v === "yes")),
);

export const priorItemSchema = z.object({
  description: requiredText("the condition from the previous report", 1000),
  location_note: optionalText("location", 300),
  repaired: repairedField,
  notes: optionalText("notes", 2000),
});
